/**
 * STT Consolidator — Cálculo cumulativo do Score de Território Total.
 *
 * METODOLOGIA PRINT (fixada 02/06/2026 a partir de feedback da fundadora):
 *
 *   O STT NÃO É uma fotografia dos sinais coletados HOJE. É a consolidação
 *   ponderada de TODOS os sinais detectados nos últimos 24 meses, lidos do
 *   banco, com decaimento exponencial por idade do sinal.
 *
 *   Resultado: o STT varia DIARIAMENTE conforme novos sinais entram (cada
 *   coleta adiciona ao histórico), mas dentro do dia o resultado é estável
 *   (cache diário). Município pesquisado hoje tem o mesmo STT durante o dia,
 *   amanhã muda quando a coleta noturna trouxer manchete nova.
 *
 *   Modelo:
 *
 *     peso(sinal) = sinal.structural ? 1.0 : 2^(-meses_atrás / 12)
 *
 *     D_i = Σ (sinal.impact × indicador.weight × peso) / Σ (indicador.weight × peso)
 *     STT = Σ (D_i × W_i), onde Σ W_i = 1.0
 *
 *   Decaimento exponencial com meia-vida de 12 meses:
 *     • Sinal de hoje: peso 1.0
 *     • Sinal de 6m atrás: ≈0.71
 *     • Sinal de 12m atrás: 0.5  (meia-vida)
 *     • Sinal de 18m atrás: ≈0.35
 *     • Sinal de 24m atrás: 0.25
 *
 *   Sinais estruturais (Censo IBGE, ANEEL SIGA, INCRA SIPRA, etc) são
 *   point-in-time e VÁLIDOS enquanto não sobrescritos por dado mais recente
 *   do mesmo agente — entram com peso 1.0 sempre.
 */

import { getDb } from "../db";
import { signals as signalsTable } from "../../drizzle/schema";
import { and, eq, gte } from "drizzle-orm";
import { logger } from "../_core/logger";
import { DIMENSIONS_LIST } from "../indicators";
import type { DimensionId } from "../indicators";
import { readSignalsInWindow, type StoredSignal } from "./signal-store";

const log = logger.child({ module: "stt-consolidator" });

// Janela canônica: 24 meses (730 dias).
const WINDOW_MONTHS = 24;
const WINDOW_MS = WINDOW_MONTHS * 30 * 24 * 60 * 60 * 1000;

// Meia-vida de decaimento exponencial: 12 meses.
// peso(t) = 2^(-monthsAgo / HALF_LIFE_MONTHS)
const HALF_LIFE_MONTHS = 12;

// Mesmos pesos do calculator.ts (Σ = 1.0).
const DIM_WEIGHTS: Record<DimensionId, number> = {
  D1: 0.22, D2: 0.15, D3: 0.15, D4: 0.22, D5: 0.15, D6: 0.11, D7: 0,
};

export interface ConsolidatedStt {
  stt: number;
  dimensions: Record<DimensionId, number>;
  totalSignalsInWindow: number;
  totalSignalsToday: number;
  totalStructuralSignals: number;
  oldestSignalAt: Date | null;
  newestSignalAt: Date | null;
  /** Soma dos pesos temporais aplicados — diagnóstico interno */
  effectiveWeightSum: number;
  /** Por dimensão: nº sinais e nº estruturais */
  dimensionDetail: Record<DimensionId, { signals: number; structural: number }>;
}

/**
 * Calcula peso temporal exponencial de um sinal.
 * Sinais estruturais retornam 1.0 sempre.
 */
function temporalWeight(publishedAt: Date | null, isStructural: boolean): number {
  if (isStructural) return 1.0;
  if (!publishedAt) return 0;
  const monthsAgo = (Date.now() - publishedAt.getTime()) / (30 * 24 * 60 * 60 * 1000);
  if (monthsAgo < 0) return 1.0; // futuro = considera atual
  return Math.pow(2, -monthsAgo / HALF_LIFE_MONTHS);
}

/**
 * Identifica sinais estruturais por sourceAgentId.
 * Estes são point-in-time (IBGE Censo 2022 vale até próximo censo, ANEEL SIGA
 * vale enquanto o empreendimento estiver ativo, etc).
 */
const STRUCTURAL_SOURCES = new Set<string>([
  "src-ibge-censo",
  "src-ibge-renda",
  "src-ibge-habitacao",
  "src-ipeadata",
  "src-pnud-atlas",
  "src-aneel-siga",
  "src-incra-sipra",
  "src-snis",
  "src-inep",
  "src-inep-ideb",
  "src-datasus-real",
  "src-cnuc",
]);

function isStructural(sig: { source: string; metadata: unknown }): boolean {
  if (STRUCTURAL_SOURCES.has(sig.source)) return true;
  const meta = sig.metadata as Record<string, unknown> | null | undefined;
  return meta?.structural === true;
}

/**
 * Lê todos os sinais do território nos últimos 24 meses e consolida o STT
 * com decaimento exponencial.
 *
 * Se o banco estiver vazio (território nunca coletado), retorna stt=0 e
 * dimensões zeradas — caller deve recorrer ao snapshot do orquestrador.
 */
export async function consolidateSttFromHistory(
  territoryId: number,
  territorySlug?: string
): Promise<ConsolidatedStt | null> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - WINDOW_MS);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  // FONTE DE DADOS: MySQL (DB) é a primária; disco (.jsonl) é fallback
  // quando DATABASE_URL não está configurado (caso Railway atual jun/2026).
  let rows: Array<{
    relatedIndex: string | null;
    source: string;
    publishedAt: Date | null;
    llmImpactScore: number | null;
    metadata: unknown;
    createdAt: Date | null;
  }> = [];

  if (db && territoryId > 0) {
    try {
      const dbRows = await db
        .select()
        .from(signalsTable)
        .where(
          and(
            eq(signalsTable.territoryId, territoryId),
            gte(signalsTable.publishedAt, cutoff)
          )
        );
      rows = dbRows.map((r) => ({
        relatedIndex: r.relatedIndex,
        source: r.source,
        publishedAt: r.publishedAt,
        llmImpactScore: r.llmImpactScore,
        metadata: r.metadata,
        createdAt: r.createdAt,
      }));
    } catch (err) {
      log.warn({ err, territoryId }, "Falha ler signals do DB — caindo no fallback disco");
    }
  }

  // FALLBACK DISCO: lê .jsonl quando DB indisponível ou retornou vazio.
  if (rows.length === 0 && territorySlug) {
    try {
      const disk: StoredSignal[] = await readSignalsInWindow(territorySlug, WINDOW_MONTHS);
      rows = disk.map((s) => ({
        relatedIndex: s.dimension,
        source: s.source,
        publishedAt: new Date(s.publishedAt),
        llmImpactScore: s.impact,
        metadata: { ...(s.metadata ?? {}), structural: s.structural },
        createdAt: new Date(s.storedAt),
      }));
      log.info(
        { territorySlug, fromDisk: rows.length },
        "Sinais lidos do storage em disco (fallback)"
      );
    } catch (err) {
      log.warn({ err, territorySlug }, "Falha ler signals do disco");
    }
  }

  if (rows.length === 0) {
    log.info(
      { territoryId, territorySlug },
      "Sem sinais no histórico (DB + disco vazios) — consolidação retorna null"
    );
    return null;
  }

  try {
    // Acumuladores por dimensão.
    const dimAccum: Record<DimensionId, { num: number; den: number; count: number; struct: number }> = {
      D1: { num: 0, den: 0, count: 0, struct: 0 },
      D2: { num: 0, den: 0, count: 0, struct: 0 },
      D3: { num: 0, den: 0, count: 0, struct: 0 },
      D4: { num: 0, den: 0, count: 0, struct: 0 },
      D5: { num: 0, den: 0, count: 0, struct: 0 },
      D6: { num: 0, den: 0, count: 0, struct: 0 },
      D7: { num: 0, den: 0, count: 0, struct: 0 },
    };

    let totalStructural = 0;
    let totalToday = 0;
    let effectiveWeightSum = 0;
    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const row of rows) {
      const dim = (row.relatedIndex ?? "GERAL") as DimensionId | "GERAL";
      if (dim === "GERAL" || !(dim in DIM_WEIGHTS)) continue;

      const structural = isStructural({ source: row.source, metadata: row.metadata });
      const w = temporalWeight(row.publishedAt, structural);
      if (w <= 0) continue;

      const impact = Number(row.llmImpactScore ?? 0);
      if (!Number.isFinite(impact) || impact <= 0) continue;

      // Impact 0-1 → escala 0-100 pro score da dimensão.
      const scaled = impact * 100;

      dimAccum[dim].num += scaled * w;
      dimAccum[dim].den += w;
      dimAccum[dim].count += 1;
      if (structural) {
        dimAccum[dim].struct += 1;
        totalStructural += 1;
      }
      effectiveWeightSum += w;

      if (row.publishedAt) {
        if (!oldest || row.publishedAt < oldest) oldest = row.publishedAt;
        if (!newest || row.publishedAt > newest) newest = row.publishedAt;
      }

      if (row.createdAt && row.createdAt >= todayStart) totalToday += 1;
    }

    // Score por dimensão = média ponderada (0-100).
    const dimensions: Record<DimensionId, number> = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0, D7: 0 };
    for (const id of Object.keys(dimAccum) as DimensionId[]) {
      const { num, den } = dimAccum[id];
      dimensions[id] = den > 0 ? Math.round((num / den) * 10) / 10 : 0;
    }

    // STT global = Σ (D_i × W_i) com pesos PRINT (D1=22%, D2=15%, etc).
    let stt = 0;
    for (const id of Object.keys(DIM_WEIGHTS) as DimensionId[]) {
      stt += (dimensions[id] ?? 0) * (DIM_WEIGHTS[id] ?? 0);
    }
    stt = Math.max(0, Math.min(100, Math.round(stt * 10) / 10));

    const dimensionDetail: Record<DimensionId, { signals: number; structural: number }> = {
      D1: { signals: dimAccum.D1.count, structural: dimAccum.D1.struct },
      D2: { signals: dimAccum.D2.count, structural: dimAccum.D2.struct },
      D3: { signals: dimAccum.D3.count, structural: dimAccum.D3.struct },
      D4: { signals: dimAccum.D4.count, structural: dimAccum.D4.struct },
      D5: { signals: dimAccum.D5.count, structural: dimAccum.D5.struct },
      D6: { signals: dimAccum.D6.count, structural: dimAccum.D6.struct },
      D7: { signals: dimAccum.D7.count, structural: dimAccum.D7.struct },
    };

    log.info(
      {
        territoryId,
        stt,
        totalSignals: rows.length,
        totalStructural,
        totalToday,
        windowMonths: WINDOW_MONTHS,
        halfLifeMonths: HALF_LIFE_MONTHS,
      },
      "STT consolidado a partir de histórico de 24mo"
    );

    // Suppress unused (referenced for documentation/future use).
    void DIMENSIONS_LIST;

    return {
      stt,
      dimensions,
      totalSignalsInWindow: rows.length,
      totalSignalsToday: totalToday,
      totalStructuralSignals: totalStructural,
      oldestSignalAt: oldest,
      newestSignalAt: newest,
      effectiveWeightSum: Math.round(effectiveWeightSum * 100) / 100,
      dimensionDetail,
    };
  } catch (err) {
    log.error({ err, territoryId }, "Falha ao consolidar STT do histórico");
    return null;
  }
}
