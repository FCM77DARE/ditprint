/**
 * DIT Orchestrator — Consolidates 6 dimension agents into daily STT
 *
 * Responsibilities:
 *   1. Run all 6 dimension agents for a territory (parallel)
 *   2. Dispatch real-time alerts for signals with impactScore ≥ 0.7
 *   3. Consolidate dimension scores → STT using PRINT formula
 *   4. Persist results to sttScores + indexHistory + indicatorScores tables
 *   5. Monitor agent health across all 39 agents
 *
 * Governance decisions baked in:
 *   - Auto-classification is deterministic (no LLM per signal)
 *   - STT consolidation uses LLM once per territory per day (in collector.ts)
 *   - Human-in-the-loop only at publication (STT stays "pending" until analyst publishes)
 *   - Real-time alerts trigger when impactScore ≥ 0.7
 */

import { getDb } from "../db";
import { indexHistory, indicatorScores, signals as signalsTable, sttScores } from "../../drizzle/schema";
import type { Territory } from "../../drizzle/schema";
import { and, desc as descOrder, eq as eqOp, lt } from "drizzle-orm";
import type { DimensionId } from "../indicators";
import { calculateSTT, DIMENSIONS_LIST } from "../indicators";
import type { AgentHealth, ClassifiedSignal, CollectOptions, DimensionResult, OrchestratorResult } from "./types";
import { ALERT_THRESHOLD } from "./base-dimension";
import { calculateSttWithLLM } from "../stt/calculator";
import { detectAnomalies } from "../stt/anomalyDetector";
import type { TerritoryContextData } from "../stt/types";
import { dispatchAlert, dispatchAnomalyAlert } from "../alertEngine";
import type { BaseDimensionAgent } from "./base-dimension";
import { DimSocioambiental } from "./dimensions/dim-socioambiental";
import { DimSocioeconomico } from "./dimensions/dim-socioeconomico";
import { DimInfraestrutura } from "./dimensions/dim-infraestrutura";
import { DimDinamica } from "./dimensions/dim-dinamica";
import { DimGovernanca } from "./dimensions/dim-governanca";
import { DimReputacao } from "./dimensions/dim-reputacao";
import { DimRecursos } from "./dimensions/dim-recursos";
import { logger } from "../_core/logger";

const log = logger.child({ module: "orchestrator" });

// Singleton dimension agents — instantiated once, reused across runs
const DIMENSION_AGENTS: BaseDimensionAgent[] = [
  new DimSocioambiental(),
  new DimSocioeconomico(),
  new DimInfraestrutura(),
  new DimDinamica(),
  new DimGovernanca(),
  new DimReputacao(),
  new DimRecursos(),
];

export class Orchestrator {
  private dimensions = DIMENSION_AGENTS;

  // ─── Main entry point ─────────────────────────────────────────────────────

  /**
   * Run the full collection and scoring pipeline for one territory.
   *
   * Designed to be called by the scheduler every 24h per territory.
   * Historical runs pass `options.period` to scope collection.
   */
  async run(territory: Territory, options: CollectOptions = {}): Promise<OrchestratorResult> {
    const period = options.period ?? currentPeriod();

    // Janela temporal padrão: T-24 meses até T (data da pesquisa).
    // O DIT analisa a trajetória do território nos últimos 24 meses para
    // produzir um STT acertivo — não apenas um snapshot momentâneo.
    // Caller pode sobrescrever passando dateStart/dateEnd explícitos.
    const referenceDate = options.dateEnd ? parseUsDate(options.dateEnd) : new Date();
    const startBoundary = options.dateStart
      ? parseUsDate(options.dateStart)
      : (() => {
          const d = new Date(referenceDate);
          d.setMonth(d.getMonth() - 24);
          d.setDate(1);
          return d;
        })();

    const windowOpts: CollectOptions = {
      ...options,
      dateStart: options.dateStart ?? formatUsDate(startBoundary),
      dateEnd: options.dateEnd ?? formatUsDate(referenceDate),
    };

    log.info(
      {
        territory: territory.slug,
        period,
        dateStart: windowOpts.dateStart,
        dateEnd: windowOpts.dateEnd,
        windowMonths: 24,
      },
      "Orchestrator run started — janela T-24mo"
    );

    // 1. Fetch previous period scores for cumulative memory calculation
    const previousScores = await this._fetchPreviousScores(territory.id, period);

    // 2. Run all 6 dimension agents in parallel — passando a janela temporal
    const dimResults = await Promise.allSettled(
      this.dimensions.map((d) => d.run(territory, { ...windowOpts, previousScores }))
    );

    const dimensions = {} as Record<DimensionId, DimensionResult>;
    let totalSignalsCount = 0;
    const allCollectedSignals: ClassifiedSignal[] = [];
    const alerts: ClassifiedSignal[] = [];

    for (const result of dimResults) {
      if (result.status === "rejected") {
        log.error({ err: result.reason }, "Dimension agent failed");
        continue;
      }
      const dim = result.value;
      dimensions[dim.dimensionId] = dim;
      totalSignalsCount += dim.signals.length;
      allCollectedSignals.push(...dim.signals);
      alerts.push(...dim.signals.filter((s) => s.triggersAlert));
    }

    // 3. Build DimensionScore[] for LLM calculator
    const dimensionScoreList = buildDimensionScoreList(dimensions);

    // 4. Run LLM STT calculation (1 call/territory/day) with post-verification
    let stt = clampScore(calculateSTT(buildDimensionScoreMap(dimensions)));
    let executiveNote = "";
    let activatedDimension: DimensionId | "GERAL" = "GERAL";

    try {
      const calculatorResult = await calculateSttWithLLM({
        territory: {
          id: territory.id,
          slug: territory.slug,
          name: territory.name,
          contextData: territory.contextData as TerritoryContextData | null,
        },
        period,
        previousScores,
        dimensionScores: dimensionScoreList,
      });

      stt = calculatorResult.stt;
      executiveNote = calculatorResult.executiveNote;
      activatedDimension = calculatorResult.activatedDimension;

      log.info(
        {
          territory: territory.slug,
          period,
          stt,
          llmVerificationPassed: calculatorResult.llmVerificationPassed,
          scenario: calculatorResult.scenario,
          alerts: alerts.length,
          totalSignals: totalSignalsCount,
        },
        "Orchestrator consolidation complete"
      );
    } catch (err) {
      log.warn({ err, territory: territory.slug }, "LLM calculator failed — using deterministic STT");
      log.info({ territory: territory.slug, period, stt, alerts: alerts.length, totalSignals: totalSignalsCount }, "Orchestrator consolidation complete (deterministic)");
    }

    // 5. Dispatch real-time alerts for high-impact signals (fire-and-forget)
    for (const alert of alerts) {
      dispatchAlert({
        territoryId: territory.id,
        territoryName: territory.name,
        territorySlug: territory.slug,
        signalTitle: alert.title,
        signalSummary: alert.summary ?? undefined,
        signalUrl: alert.url ?? undefined,
        impactScore: alert.impactScore,
        dimension: dimensionFromSourceId(alert.sourceAgentId),
        indicatorCode: alert.indicatorCode,
        publishedAt: alert.publishedAt ?? undefined,
        alertType: "signal",
      }).catch((err) => log.warn({ err, signal: alert.title }, "Signal alert dispatch error"));
    }

    // 6. Run anomaly detection + dispatch anomaly alerts
    try {
      const anomaly = await detectAnomalies(territory.id, stt, previousScores?.stt ?? null);
      if (anomaly.isAnomaly || anomaly.isEscalation) {
        log.warn({ territory: territory.slug, anomaly }, "Anomaly/escalation detected post-STT");
        const alertType = anomaly.isEscalation ? "escalation" : "anomaly";
        dispatchAnomalyAlert(
          territory.id, territory.name, territory.slug, alertType,
          { currentStt: stt, previousStt: previousScores?.stt, sigmaDeviation: anomaly.sigmaDeviation, dayDelta: anomaly.dayDelta }
        ).catch((err) => log.warn({ err }, "Anomaly alert dispatch error"));
      }
    } catch (err) {
      log.warn({ err, territory: territory.slug }, "Anomaly detection failed — skipping");
    }

    // 7. Persist to DB
    await this._persist(territory, period, stt, dimensions, executiveNote, activatedDimension);

    // 8. Persist signals (all relevant ones for reports, plus all alerts)
    const signalsToPersist = allCollectedSignals.filter(s => s.impactScore >= 0.3 || s.triggersAlert);
    await this._persistSignals(territory, signalsToPersist);

    const result: OrchestratorResult = {
      territoryId: territory.id,
      territorySlug: territory.slug,
      period,
      stt,
      dimensions,
      alerts,
      totalSignals: totalSignalsCount,
      completedAt: new Date().toISOString(),
    };

    return result;
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  /**
   * Returns health snapshots for all source agents across all dimensions.
   * Used by the dashboard's Agent Health Panel.
   */
  getAgentHealth(): AgentHealth[] {
    const health: AgentHealth[] = [];
    for (const dim of this.dimensions) {
      for (const source of dim.sources) {
        health.push(source.health);
      }
    }
    return health;
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private async _fetchPreviousScores(
    territoryId: number,
    currentPeriod: string
  ): Promise<{ stt: number; d1?: number; d2?: number; d3?: number; d4?: number; d5?: number; d6?: number } | null> {
    const db = await getDb();
    if (!db) return null;
    try {
      const rows = await db
        .select({
          stt: indexHistory.stt,
          d1: indexHistory.d1Score,
          d2: indexHistory.d2Score,
          d3: indexHistory.d3Score,
          d4: indexHistory.d4Score,
          d5: indexHistory.d5Score,
          d6: indexHistory.d6Score,
        })
        .from(indexHistory)
        .where(and(eqOp(indexHistory.territoryId, territoryId), lt(indexHistory.period, currentPeriod)))
        .orderBy(descOrder(indexHistory.period))
        .limit(1);
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        stt: r.stt ?? 0,
        d1: r.d1 ?? undefined, d2: r.d2 ?? undefined, d3: r.d3 ?? undefined,
        d4: r.d4 ?? undefined, d5: r.d5 ?? undefined, d6: r.d6 ?? undefined,
      };
    } catch {
      return null;
    }
  }

  private async _persist(
    territory: Territory,
    period: string,
    stt: number,
    dimensions: Partial<Record<DimensionId, DimensionResult>>,
    executiveNote: string = "",
    activatedDimension: DimensionId | "GERAL" = "GERAL"
  ) {
    const db = await getDb();
    if (!db) {
      log.warn({ territory: territory.slug }, "No DB connection — skipping persistence");
      return;
    }

    const d = (id: DimensionId) => clampScore(dimensions[id]?.score ?? 0);

    // Upsert sttScores (unique on territoryId + period)
    await db
      .insert(sttScores)
      .values({
        territoryId: territory.id,
        period,
        stt,
        d1Score: d("D1"),
        d2Score: d("D2"),
        d3Score: d("D3"),
        d4Score: d("D4"),
        d5Score: d("D5"),
        d6Score: d("D6"),
        activatedIndex: activatedDimension,
        executiveNote: executiveNote || null,
        scenario: scoreToScenario(stt),
        published: false,
      })
      .onDuplicateKeyUpdate({
        set: {
          stt,
          d1Score: d("D1"),
          d2Score: d("D2"),
          d3Score: d("D3"),
          d4Score: d("D4"),
          d5Score: d("D5"),
          d6Score: d("D6"),
          activatedIndex: activatedDimension,
          executiveNote: executiveNote || null,
          scenario: scoreToScenario(stt),
          updatedAt: new Date(),
        },
      });

    // Upsert indexHistory
    await db
      .insert(indexHistory)
      .values({
        territoryId: territory.id,
        period,
        stt,
        d1Score: d("D1"),
        d2Score: d("D2"),
        d3Score: d("D3"),
        d4Score: d("D4"),
        d5Score: d("D5"),
        d6Score: d("D6"),
        scenario: scoreToScenario(stt),
        signalCount: Object.values(dimensions).reduce((s, d) => s + d.signals.length, 0),
        relevantSignalCount: Object.values(dimensions).reduce(
          (s, d) => s + d.signals.filter((sig) => sig.impactScore >= 0.3).length,
          0
        ),
        llmRationale: executiveNote,
        source: "llm",
      })
      .onDuplicateKeyUpdate({
        set: {
          stt,
          d1Score: d("D1"),
          d2Score: d("D2"),
          d3Score: d("D3"),
          d4Score: d("D4"),
          d5Score: d("D5"),
          d6Score: d("D6"),
          llmRationale: executiveNote,
          scenario: scoreToScenario(stt),
        },
      });

    // Persist per-indicator scores
    // TODO: resolve indicatorId FK once scripts/seed-indicators.ts seeds the indicators table.
    // For now we skip indicator_scores writes — per-indicator data available in DimensionResult.
    void indicatorScores;
    void DIMENSIONS_LIST; // referenced for future per-indicator persistence

    log.debug({ territory: territory.slug, period }, "DB persistence complete");
  }

  private async _persistSignals(
    territory: Territory,
    signalsToPersist: ClassifiedSignal[]
  ) {
    if (signalsToPersist.length === 0) return;
    const db = await getDb();
    if (!db) return;

    for (const sig of signalsToPersist) {
      try {
        await db.insert(signalsTable).ignore().values({
          territoryId: territory.id,
          source: sig.sourceAgentId as any, // Cast to any since we changed column to varchar
          relatedIndex: dimensionFromSourceId(sig.sourceAgentId),
          title: sig.title,
          summary: sig.summary ?? null,
          url: sig.url ?? null,
          publishedAt: sig.publishedAt ?? new Date(),
          curationStatus: "pending",
          llmImpactScore: sig.impactScore,
          metadata: sig.metadata ?? null,
        });
      } catch (err) {
        log.warn({ err, title: sig.title }, "Failed to persist signal");
      }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Formato US "MM/DD/YYYY" usado por CollectOptions.dateStart / dateEnd. */
function formatUsDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function parseUsDate(s: string): Date {
  const [mm, dd, yyyy] = s.split("/").map(Number);
  return new Date(yyyy, (mm ?? 1) - 1, dd ?? 1);
}

function clampScore(v: number): number {
  return Math.min(100, Math.max(0, Number(v) || 0));
}

function scoreToScenario(stt: number): "estabilidade" | "pressao" | "escalada" {
  if (stt >= 75) return "escalada";
  if (stt >= 50) return "pressao";
  return "estabilidade";
}

function buildDimensionScoreMap(
  dimensions: Partial<Record<DimensionId, DimensionResult>>
): Record<DimensionId, number> {
  return {
    D1: dimensions.D1?.score ?? 0,
    D2: dimensions.D2?.score ?? 0,
    D3: dimensions.D3?.score ?? 0,
    D4: dimensions.D4?.score ?? 0,
    D5: dimensions.D5?.score ?? 0,
    D6: dimensions.D6?.score ?? 0,
  };
}

function buildDimensionScoreList(
  dimensions: Partial<Record<DimensionId, DimensionResult>>
): import("../stt/types").DimensionScore[] {
  return (["D1", "D2", "D3", "D4", "D5", "D6"] as DimensionId[]).map((id) => ({
    id,
    score: dimensions[id]?.score ?? 0,
    topSignals: (dimensions[id]?.signals ?? []).map((s) => ({
      title: s.title,
      indicatorCode: s.indicatorCode,
      impactScore: s.impactScore,
      dimension: id,
    })),
  }));
}

function dimensionFromSourceId(sourceAgentId: string): "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "GERAL" {
  const map: Record<string, "D1" | "D2" | "D3" | "D4" | "D5" | "D6"> = {
    "src-inmet": "D1",
    "src-cptec-inpe": "D1",
    "src-ibge-mapbiomas": "D1",
    "src-cnuc": "D1",
    "src-secretarias-ma": "D1",
    "src-cemaden": "D1",
    "src-fiocruz-clima": "D1",
    "src-inpe-deter": "D1",
    "src-ibama": "D1",
    "src-mp-ambiental": "D1",
    "src-ibge-censo": "D2",
    "src-ibge-renda": "D2",
    "src-pnud-atlas": "D2",
    "src-ipeadata": "D2",
    "src-snis-sinasa": "D3",
    "src-datasus": "D3",
    "src-inep": "D3",
    "src-ibge-habitacao": "D3",
    "src-mapa-empresas": "D3",
    "src-antt-portos": "D3",
    "src-sinir": "D3",
    "src-plano-diretor": "D4",
    "src-judiciario": "D4",
    "src-fogo-cruzado": "D4",
    "src-geni-uff": "D4",
    "src-isp-ssp": "D4",
    "src-funai-iphan": "D4",
    "src-unicamp-terr": "D4",
    "src-querido-diario": "D5",
    "src-conselhos": "D5",
    "src-audiencias": "D5",
    "src-orcamento-participativo": "D5",
    "src-google-news": "D6",
    "src-google-trends": "D6",
    "src-redes-sociais": "D6",
    "src-universidades": "D6",
  };
  return map[sourceAgentId] ?? "GERAL";
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const orchestrator = new Orchestrator();
