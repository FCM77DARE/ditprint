/**
 * STT Consolidator — Cálculo cumulativo do Score de Território Total.
 *
 * METODOLOGIA PRINT — "COMPLEXIDADE RESIDUAL" (fixada 02/06/2026 v2):
 *
 *   PRINCÍPIO INVERTIDO: todo território começa em STT = 100 (complexidade
 *   máxima por desconhecimento). Sinais coletados podem REDUZIR a complexidade
 *   conforme o motor consegue "explicar" aspectos do território.
 *
 *   Por que invertido:
 *     • Sem dado = território DESCONHECIDO = COMPLEXO até prova em contrário
 *     • Cada sinal que entra é "evidência que reduz a opacidade"
 *     • Sinais TENSIONANTES (alerta, conflito, autuação) NÃO reduzem — só
 *       confirmam que a complexidade alta É REAL ali
 *     • Sinais RESOLUTIVOS (IBGE Censo, ANEEL, INCRA, programa BNDES,
 *       parceria acadêmica) reduzem por revelar a estrutura do território
 *
 *   Modelo:
 *
 *     peso_temporal(sinal) = sinal.structural ? 1.0 : 2^(-meses_atrás / 12)
 *
 *     Pra cada dimensão D_i:
 *       D_i = 100
 *       para cada sinal s:
 *         delta = s.impact × peso_temporal × FATOR_RESOLUTIVO
 *         se s.tipo == 'resolutivo':  D_i -= delta
 *         se s.tipo == 'tensionante': D_i += delta × FATOR_TENSAO  (mantém alto)
 *       D_i = clamp(0, 100)
 *
 *     STT = Σ (D_i × W_i), pesos PRINT (D1=22%, D2=15%, etc)
 *
 *   Resultado: município com vácuo de coleta (Rio do Fogo) fica alto (~85-95)
 *   refletindo "desconhecimento + tensões reais"; município muito coberto
 *   com dados positivos baixa pra ~30-50.
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

// Quanto cada sinal RESOLUTIVO de impact=1.0 reduz a dimensão (em pontos).
// Calibrado pra que ~8-10 sinais resolutivos fortes (impact ≥ 0.6) zerem a
// dimensão (saem de 100 para 0). Municípios bem cobertos chegam a 30-50;
// vazios ficam em 90-100.
const FATOR_RESOLUTIVO = 20;

// Quanto cada sinal TENSIONANTE de impact=1.0 acrescenta (mantém alta).
// Pequeno — função primária é NÃO reduzir; ajuste pra cima só pra sinais
// muito graves (impact alto + structural false + dimensão crítica).
const FATOR_TENSAO = 4;

// Fontes RESOLUTIVAS: dados estruturados que "explicam" aspectos do território.
const RESOLUTIVE_SOURCES = new Set<string>([
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
  "src-querido-diario",
  "src-universidades",
]);

// Fontes TENSIONANTES: sinais que CONFIRMAM/REFORÇAM complexidade.
// Não reduzem (e podem aumentar levemente) o score da dimensão.
const TENSIONING_SOURCES = new Set<string>([
  "src-mp-ambiental",
  "src-ibama",
  "src-cemaden",
  "src-inmet",
  "src-fogo-cruzado",
  "src-isp-ssp",
  "src-judiciario",
  "src-geni-uff",
  "src-inpe-deter",
]);

/** Decide polaridade do sinal: resolutivo, tensionante ou neutro (Google News etc) */
function signalPolarity(source: string, impact: number): "resolutive" | "tensioning" | "neutral" {
  if (RESOLUTIVE_SOURCES.has(source)) return "resolutive";
  if (TENSIONING_SOURCES.has(source)) return "tensioning";
  // Google News, SerpAPI genérico: neutral — mas se impact >= 0.7 (triggersAlert)
  // tratamos como tensionante porque foi classificado como alerta.
  if (impact >= 0.7) return "tensioning";
  // Neutros baixo-impacto contam como leve resolutivo (mostraram dado coletável).
  return "neutral";
}

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
    // Acumuladores por dimensão — modelo "Complexidade Residual":
    // baseline = 100; sinais resolutivos subtraem, tensionantes adicionam.
    const dimAccum: Record<
      DimensionId,
      {
        score: number; // começa em 100
        count: number;
        struct: number;
        resolutive: number;
        tensioning: number;
      }
    > = {
      D1: { score: 100, count: 0, struct: 0, resolutive: 0, tensioning: 0 },
      D2: { score: 100, count: 0, struct: 0, resolutive: 0, tensioning: 0 },
      D3: { score: 100, count: 0, struct: 0, resolutive: 0, tensioning: 0 },
      D4: { score: 100, count: 0, struct: 0, resolutive: 0, tensioning: 0 },
      D5: { score: 100, count: 0, struct: 0, resolutive: 0, tensioning: 0 },
      D6: { score: 100, count: 0, struct: 0, resolutive: 0, tensioning: 0 },
      D7: { score: 100, count: 0, struct: 0, resolutive: 0, tensioning: 0 },
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

      const polarity = signalPolarity(row.source, impact);

      // Modelo invertido:
      //  resolutive  → subtrai do score (resolve aspecto do território)
      //  tensioning  → adiciona ao score (confirma complexidade)
      //  neutral     → resolutivo fraco (sinal foi coletado, mas é genérico)
      if (polarity === "resolutive") {
        const delta = impact * w * FATOR_RESOLUTIVO;
        dimAccum[dim].score -= delta;
        dimAccum[dim].resolutive += 1;
      } else if (polarity === "tensioning") {
        const delta = impact * w * FATOR_TENSAO;
        dimAccum[dim].score += delta;
        dimAccum[dim].tensioning += 1;
      } else {
        // Neutral: efeito leve resolutivo (1/3 do fator)
        const delta = impact * w * (FATOR_RESOLUTIVO / 3);
        dimAccum[dim].score -= delta;
        dimAccum[dim].resolutive += 1;
      }

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

    // Score por dimensão = clamp(0, 100). Sem sinais = score continua 100.
    const dimensions: Record<DimensionId, number> = { D1: 100, D2: 100, D3: 100, D4: 100, D5: 100, D6: 100, D7: 100 };
    for (const id of Object.keys(dimAccum) as DimensionId[]) {
      const s = dimAccum[id].score;
      dimensions[id] = Math.max(0, Math.min(100, Math.round(s * 10) / 10));
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
