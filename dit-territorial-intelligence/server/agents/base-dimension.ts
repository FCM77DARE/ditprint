/**
 * BaseDimensionAgent — Abstract base class for the 6 PRINT dimension agents.
 *
 * Each dimension agent:
 *   1. Runs its registered source agents in parallel
 *   2. Classifies each raw signal into an indicator + impact score (deterministic)
 *   3. Calculates the dimension score using weighted indicator averages
 *   4. Flags signals with impactScore ≥ 0.7 for real-time alerts
 *
 * No LLM calls here — classification is rule-based. The LLM enters only in the
 * Orchestrator for the daily STT consolidation and rationale generation.
 */

import type { Territory } from "../../drizzle/schema";
import type { DimensionId } from "../indicators";
import { DIMENSIONS_LIST } from "../indicators";
import type {
  ClassifiedSignal,
  CollectOptions,
  DimensionResult,
  ImpactLevel,
  RawSignal,
} from "./types";
import type { BaseSourceAgent } from "./base-source";
import { logger } from "../_core/logger";

// Impact thresholds — matching the plan governance decisions
export const ALERT_THRESHOLD = 0.7;
export const STT_INCLUDE_THRESHOLD = 0.3;

export interface IndicatorKeywordRule {
  /** Indicator code this rule maps to (e.g. "1.1.1.3") */
  indicatorCode: string;
  /** Keywords to match (case-insensitive substring) */
  keywords: string[];
  /** Base impact score when this rule fires (refined by other factors below) */
  baseImpact: number;
}

export abstract class BaseDimensionAgent {
  abstract readonly id: DimensionId;
  abstract readonly sources: BaseSourceAgent[];

  /**
   * Keyword rules used for deterministic signal classification.
   * Concrete agents override this to provide dimension-specific rules.
   */
  abstract readonly classificationRules: IndicatorKeywordRule[];

  protected log = logger.child({ module: "dimension-agent", agent: this.constructor.name });

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run the full dimension pipeline for a territory and period.
   * Returns a DimensionResult with score, signals, and per-indicator breakdown.
   */
  async run(territory: Territory, options: CollectOptions = {}): Promise<DimensionResult> {
    const collectedAt = new Date().toISOString();

    // 1. Run all source agents in parallel; failed ones return []
    const sourceResults = await Promise.allSettled(
      this.sources.map((s) => s.collect(territory, options))
    );

    let sourcesOk = 0;
    let sourcesError = 0;
    const rawSignals: RawSignal[] = [];

    for (const result of sourceResults) {
      if (result.status === "fulfilled") {
        rawSignals.push(...result.value);
        if (result.value.length >= 0) sourcesOk++;
      } else {
        sourcesError++;
      }
    }

    this.log.debug(
      {
        dimension: this.id,
        territory: territory.slug,
        rawSignals: rawSignals.length,
        sourcesOk,
        sourcesError,
      },
      "Dimension raw collection complete"
    );

    // 2. Deduplicate by URL (simple exact match)
    const deduped = deduplicateSignals(rawSignals);

    // 3. Classify each signal
    const classified = deduped
      .map((s) => this.classify(s))
      .filter((s): s is ClassifiedSignal => s !== null);

    // 4. Calculate per-indicator scores
    const indicatorScores = this.aggregateIndicatorScores(classified);

    // 5. Calculate new signals score (weighted average of indicators)
    const newSignalsScore = this.calculateDimensionScore(indicatorScores);

    // 6. Cumulative Memory (Historical Base + New Signals)
    const prevKey = this.id.toLowerCase() as "d1" | "d2" | "d3" | "d4" | "d5" | "d6";
    const prevScore = options.previousScores?.[prevKey] ?? 0;
    
    // Se há tensão histórica, ela decai 15% a cada período sem novos sinais, mas se soma aos novos
    let score = (prevScore * 0.85) + newSignalsScore;
    score = Math.min(100, Math.round(score * 10) / 10);

    this.log.info(
      {
        dimension: this.id,
        territory: territory.slug,
        score,
        prevScore,
        newSignalsScore,
        classified: classified.length,
        alerts: classified.filter((s) => s.triggersAlert).length,
      },
      "Dimension run complete"
    );

    return {
      dimensionId: this.id,
      score,
      sourcesOk,
      sourcesError,
      signals: classified,
      indicatorScores,
      collectedAt,
    };
  }

  // ─── Classification ─────────────────────────────────────────────────────────

  /**
   * Classify a single raw signal using keyword rules.
   * Returns null if the signal matches no rule (will be filtered out).
   *
   * Classification pipeline:
   *   1. Match keywords → indicatorCode + baseImpact
   *   2. Boost impact for official sources vs. media
   *   3. Derive impactLevel
   *   4. Set triggersAlert when impactScore ≥ ALERT_THRESHOLD
   */
  classify(signal: RawSignal): ClassifiedSignal | null {
    const text = `${signal.title} ${signal.summary ?? ""}`.toLowerCase();

    let bestRule: IndicatorKeywordRule | null = null;
    let matchCount = 0;

    for (const rule of this.classificationRules) {
      const hits = rule.keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
      if (hits > matchCount) {
        matchCount = hits;
        bestRule = rule;
      }
    }

    if (!bestRule) return null;

    // Official sources get a 15% impact boost; confidence is higher
    const isOfficialSource = OFFICIAL_SOURCE_IDS.has(signal.sourceAgentId);
    const impactBoost = isOfficialSource ? 0.15 : 0;
    const confidence = isOfficialSource ? 0.85 : 0.65;

    const impactScore = Math.min(1, bestRule.baseImpact + impactBoost);
    const impactLevel = scoreToLevel(impactScore);
    const triggersAlert = impactScore >= ALERT_THRESHOLD;

    return {
      ...signal,
      indicatorCode: bestRule.indicatorCode,
      impactScore,
      impactLevel,
      confidence,
      triggersAlert,
    };
  }

  // ─── Scoring ─────────────────────────────────────────────────────────────────

  /**
   * Aggregate classified signals into per-indicator scores (0–100).
   * Uses the max impactScore among signals for each indicator, scaled to 0-100.
   */
  protected aggregateIndicatorScores(
    signals: ClassifiedSignal[]
  ): Record<string, number> {
    const maxImpact: Record<string, number> = {};

    for (const signal of signals) {
      if (signal.impactScore < STT_INCLUDE_THRESHOLD) continue;
      const current = maxImpact[signal.indicatorCode] ?? 0;
      if (signal.impactScore > current) {
        maxImpact[signal.indicatorCode] = signal.impactScore;
      }
    }

    // Scale 0.0–1.0 → 0–100
    const scores: Record<string, number> = {};
    for (const [code, impact] of Object.entries(maxImpact)) {
      scores[code] = Math.round(impact * 100);
    }
    return scores;
  }

  /**
   * Calculate the weighted dimension score (0–100) from per-indicator scores.
   * Uses indicator weights from server/indicators.ts.
   */
  protected calculateDimensionScore(indicatorScores: Record<string, number>): number {
    const dimension = DIMENSIONS_LIST.find((d) => d.id === this.id);
    if (!dimension) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const obj of dimension.objectsOfStudy) {
      for (const indicator of obj.indicators) {
        const score = indicatorScores[indicator.code] ?? 0;
        weightedSum += score * indicator.weight;
        totalWeight += indicator.weight;
      }
    }

    if (totalWeight === 0) return 0;
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Source agent IDs considered "official" (receive a confidence/impact boost) */
const OFFICIAL_SOURCE_IDS = new Set([
  "src-ibama",
  "src-inpe-deter",
  "src-cemaden",
  "src-inmet",
  "src-cnuc",
  "src-ibge-censo",
  "src-ibge-renda",
  "src-ipeadata",
  "src-snis-sinasa",
  "src-datasus",
  "src-inep",
  "src-ibge-habitacao",
  "src-sinir",
  "src-mapa-empresas",
  "src-antt-portos",
  "src-funai-iphan",
  "src-querido-diario",
  "src-fogo-cruzado",
]);

function scoreToLevel(score: number): ImpactLevel {
  if (score >= ALERT_THRESHOLD) return "high";
  if (score >= STT_INCLUDE_THRESHOLD) return "medium";
  if (score > 0.1) return "low";
  return "negligible";
}

/**
 * Deduplicate signals by URL (exact match).
 * Signals without a URL are always kept.
 */
function deduplicateSignals(signals: RawSignal[]): RawSignal[] {
  const seen = new Set<string>();
  return signals.filter((s) => {
    if (!s.url) return true;
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}
