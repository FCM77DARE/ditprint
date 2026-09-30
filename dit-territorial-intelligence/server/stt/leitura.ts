/**
 * Leitura territorial: liga o cálculo puro (tensao-confianca.ts) ao que o
 * backend de fato tem: consolidado de 24 meses, camada estrutural, linhas do
 * banco. É daqui que sai o campo `leitura` que o front recebe.
 *
 * Tudo aqui é ADITIVO: nenhum campo antigo muda, e qualquer falha devolve
 * `null` em vez de derrubar a procedure que já funcionava.
 *
 * As funções puras (`leituraDeConsolidado`, `leituraDeDimensoes`) não tocam
 * banco nem disco. As assíncronas (`leituraDoTerritorio`, `leituraPorId`) só
 * importam consolidator/db em tempo de execução, para que os testes das puras
 * não abram conexão nenhuma.
 */

import type { Leitura } from "../../shared/leitura";
import type { ConsolidatedStt } from "./consolidator";
import {
  calcularTensaoConfianca,
  type DimensaoEntrada,
  type DimensaoId,
} from "./tensao-confianca";
import { logger } from "../_core/logger";

const log = logger.child({ module: "leitura" });

/** D7 tem peso 0 na metodologia em produção: fica fora da leitura. */
export const DIMENSOES_DA_LEITURA: DimensaoId[] = ["D1", "D2", "D3", "D4", "D5", "D6"];

export type ScoresDimensao = Partial<Record<DimensaoId, number | null | undefined>>;

/** O que se sabe de evidência por dimensão, já separado em estrutural e sinal. */
export interface EvidenciaDimensao {
  estrutural: boolean;
  sinaisVerificados: number;
}
export type EvidenciaPorDimensao = Partial<Record<DimensaoId, EvidenciaDimensao>>;

/** Scores (D1..D6) + evidência → Leitura. */
export function leituraDeEvidencia(scores: ScoresDimensao, evidencia: EvidenciaPorDimensao): Leitura {
  const entrada: DimensaoEntrada[] = DIMENSOES_DA_LEITURA.map((id) => ({
    id,
    score: scores[id],
    estrutural: evidencia[id]?.estrutural ?? false,
    sinaisVerificados: evidencia[id]?.sinaisVerificados ?? 0,
  }));
  return calcularTensaoConfianca(entrada);
}

/**
 * Evidência a partir do consolidado de 24 meses.
 *
 * Estrutural = a camada estrutural (percentil nacional) cobre a dimensão OU
 * existe sinal de fonte estrutural (IBGE, SNIS...). Sinal verificado = o que
 * sobra depois de tirar os de fonte estrutural, para não contar duas vezes.
 */
export function evidenciaDeConsolidado(
  c: Pick<ConsolidatedStt, "dimensionDetail" | "structuralBasis">
): EvidenciaPorDimensao {
  const out: EvidenciaPorDimensao = {};
  for (const id of DIMENSOES_DA_LEITURA) {
    const det = c.dimensionDetail?.[id] ?? { signals: 0, structural: 0 };
    out[id] = {
      estrutural: Boolean(c.structuralBasis?.[id]) || det.structural > 0,
      sinaisVerificados: Math.max(0, det.signals - det.structural),
    };
  }
  return out;
}

export function leituraDeConsolidado(
  c: Pick<ConsolidatedStt, "dimensions" | "dimensionDetail" | "structuralBasis">
): Leitura {
  return leituraDeEvidencia(c.dimensions, evidenciaDeConsolidado(c));
}

/**
 * Sem consolidado (território sem histórico): só há os sinais do dia, e
 * nenhuma camada estrutural conhecida.
 */
export function leituraDeDimensoes(
  dimensoes: Partial<Record<DimensaoId, { score: number; signals: unknown[] } | undefined>>
): Leitura {
  const scores: ScoresDimensao = {};
  const evidencia: EvidenciaPorDimensao = {};
  for (const id of DIMENSOES_DA_LEITURA) {
    const d = dimensoes[id];
    scores[id] = d?.score;
    evidencia[id] = { estrutural: false, sinaisVerificados: d?.signals?.length ?? 0 };
  }
  return leituraDeEvidencia(scores, evidencia);
}

// ─── Caminho assíncrono: linhas do banco e rotas de leitura ───────────────────

/** Linha do banco (stt_scores / index_history) → scores D1..D6. */
export function scoresDeLinha(row: Record<string, unknown> | null | undefined): ScoresDimensao {
  const out: ScoresDimensao = {};
  if (!row) return out;
  for (const id of DIMENSOES_DA_LEITURA) {
    const v = row[`${id.toLowerCase()}Score`];
    out[id] = typeof v === "number" ? v : null;
  }
  return out;
}

/** Mesma extração de IBGE que o orchestrator usa para a camada estrutural. */
export function ibgeDoContexto(contextData: unknown): {
  ibgeId: number | string | null;
  lista: string[] | undefined;
} {
  const ctx = (contextData ?? null) as Record<string, unknown> | null;
  const lista = Array.isArray(ctx?.ibgeMunicipios)
    ? (ctx!.ibgeMunicipios as unknown[]).map((v) => String(v))
    : undefined;
  const ibgeId =
    typeof ctx?.ibgeId === "string" || typeof ctx?.ibgeId === "number"
      ? (ctx.ibgeId as string | number)
      : lista?.[0] ?? null;
  return { ibgeId, lista };
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cacheEvidencia = new Map<string, { ts: number; evidencia: EvidenciaPorDimensao }>();

export function limparCacheEvidencia(): void {
  cacheEvidencia.clear();
}

async function evidenciaDoTerritorio(t: {
  id: number;
  slug: string;
  contextData: unknown;
}): Promise<EvidenciaPorDimensao> {
  const chave = `${t.id}:${t.slug}`;
  const hit = cacheEvidencia.get(chave);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.evidencia;

  const { consolidateSttFromHistory } = await import("./consolidator");
  const { ibgeId, lista } = ibgeDoContexto(t.contextData);
  const consolidado = await consolidateSttFromHistory(t.id, t.slug, ibgeId, lista);
  const evidencia = consolidado ? evidenciaDeConsolidado(consolidado) : {};
  cacheEvidencia.set(chave, { ts: Date.now(), evidencia });
  return evidencia;
}

/**
 * Leitura de um território para scores já conhecidos (linha do banco).
 * Nunca lança: em qualquer falha devolve null e a procedure segue como antes.
 */
export async function leituraDoTerritorio(
  t: { id: number; slug: string; contextData: unknown },
  scores: ScoresDimensao
): Promise<Leitura | null> {
  try {
    return leituraDeEvidencia(scores, await evidenciaDoTerritorio(t));
  } catch (err) {
    log.warn({ err: (err as Error).message, slug: t.slug }, "Leitura indisponível (não-fatal)");
    return null;
  }
}

/** Igual a leituraDoTerritorio, para quem só tem o id do território. */
export async function leituraPorId(territoryId: number, scores: ScoresDimensao): Promise<Leitura | null> {
  try {
    const { getDb } = await import("../db");
    const { territories } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return null;
    const [t] = await db.select().from(territories).where(eq(territories.id, territoryId)).limit(1);
    if (!t) return null;
    return leituraDoTerritorio({ id: t.id, slug: t.slug, contextData: t.contextData }, scores);
  } catch (err) {
    log.warn({ err: (err as Error).message, territoryId }, "Leitura indisponível (não-fatal)");
    return null;
  }
}

// ─── Anexar `leitura` a linhas que já voltam ao front ─────────────────────────

type LinhaComTerritorio = Record<string, unknown> & { territoryId: number };

/**
 * Devolve as mesmas linhas com o campo `leitura` a mais. Os campos antigos
 * passam intactos (spread). O território é resolvido uma vez e a evidência
 * vem do cache, então uma lista de N períodos custa uma consolidação.
 *
 * A evidência é a de AGORA aplicada aos scores de cada linha: para períodos
 * antigos a confiança é aproximada, e o doc 02-logica-agentes.md registra isso.
 */
export async function anexarLeitura<T extends LinhaComTerritorio>(
  territoryId: number,
  rows: T[]
): Promise<Array<T & { leitura: Leitura | null }>> {
  if (rows.length === 0) return [];
  let territorio: { id: number; slug: string; contextData: unknown } | null = null;
  try {
    const { getDb } = await import("../db");
    const { territories } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      const [t] = await db.select().from(territories).where(eq(territories.id, territoryId)).limit(1);
      if (t) territorio = { id: t.id, slug: t.slug, contextData: t.contextData };
    }
  } catch (err) {
    log.warn({ err: (err as Error).message, territoryId }, "Território indisponível para a leitura (não-fatal)");
  }
  const out: Array<T & { leitura: Leitura | null }> = [];
  for (const row of rows) {
    const leitura = territorio ? await leituraDoTerritorio(territorio, scoresDeLinha(row)) : null;
    out.push({ ...row, leitura });
  }
  return out;
}

/** Varias linhas de vários territórios (ex.: stt.all), na ordem original. */
export async function anexarLeituraMulti<T extends LinhaComTerritorio>(
  rows: T[]
): Promise<Array<T & { leitura: Leitura | null }>> {
  const grupos = new Map<number, T[]>();
  for (const r of rows) grupos.set(r.territoryId, [...(grupos.get(r.territoryId) ?? []), r]);
  const resolvidos = new Map<T, T & { leitura: Leitura | null }>();
  await Promise.all(
    Array.from(grupos.entries()).map(async ([id, linhas]) => {
      const com = await anexarLeitura(id, linhas);
      linhas.forEach((l, i) => resolvidos.set(l, com[i]));
    })
  );
  return rows.map((r) => resolvidos.get(r) ?? { ...r, leitura: null });
}
