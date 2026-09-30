/**
 * Monta, a partir das publicações, os objetos que as procedures públicas e do
 * portal devolvem. Mantém os campos antigos (nomes e formas) e acrescenta os
 * novos (notaExecutiva, delta7, delta30, serie, leitura congelada).
 *
 * Nada aqui lê rascunho nem index_history.
 */

import type { Leitura } from "../shared/leitura";
import { cenarioDoStt } from "../shared/metodologia";
import {
  valorDe,
  visaoDasPublicacoes,
  type Dims,
  type PontoSerie,
  type Publicacao,
} from "./stt/publicacao-logica";
import type { TerritorioComPublicacoes } from "./publicacao";

export interface CamposPublicados {
  notaExecutiva: string | null;
  delta7: number | null;
  delta30: number | null;
  serie: PontoSerie[];
  publicado: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
}

export function camposPublicados(pubs: Publicacao[], opcoes: { notaCompleta: boolean }): CamposPublicados {
  const v = visaoDasPublicacoes(pubs, opcoes);
  return {
    notaExecutiva: v.notaExecutiva,
    delta7: v.delta7,
    delta30: v.delta30,
    serie: v.serie,
    publicado: v.ultima !== null,
    publishedAt: v.ultima?.publishedAt ?? null,
    publishedBy: v.ultima?.publishedBy ?? null,
  };
}

/** Diferença entre a última publicação e a anterior (qualquer distância no tempo). */
export function deltaDoUltimoPonto(pubs: Publicacao[]): number | null {
  if (pubs.length < 2) return null;
  const o = [...pubs].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const a = o[o.length - 2];
  const b = o[o.length - 1];
  return Math.round((valorDe(b) - valorDe(a)) * 10) / 10;
}

/** dims {d1..} para o formato de linha do banco que o cálculo de leitura entende. */
export function linhaDeDims(dims: Dims): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const k of ["d1", "d2", "d3", "d4", "d5", "d6", "d7"] as const) out[`${k}Score`] = dims[k] ?? null;
  return out;
}

/**
 * Leitura da publicação: a congelada, ou (publicações legadas do MySQL, sem
 * leitura gravada) a calculada agora com a evidência atual.
 */
export async function leituraDaPublicacao(
  t: Pick<TerritorioComPublicacoes, "slug" | "territoryId" | "contextData">,
  ultima: Publicacao | null
): Promise<Leitura | null> {
  if (!ultima) return null;
  if (ultima.leitura) return ultima.leitura;
  if (t.territoryId <= 0) return null;
  const { leituraDoTerritorio } = await import("./stt/leitura");
  return leituraDoTerritorio(
    { id: t.territoryId, slug: t.slug, contextData: t.contextData },
    linhaDeDims(ultima.dims) as never
  );
}

/** Um período por linha (a publicação mais recente de cada período), do período mais novo ao mais antigo. */
export function publicacoesPorPeriodo(pubs: Publicacao[]): Publicacao[] {
  const m = new Map<string, Publicacao>();
  for (const p of [...pubs].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))) m.set(p.period, p);
  return Array.from(m.values()).sort((a, b) => b.period.localeCompare(a.period));
}

/**
 * Formato antigo de linha de stt_scores (o que `stt.latest` e `stt.history`
 * sempre devolveram), agora vindo da publicação. `executiveNote` segue como
 * nome do campo; `nota` decide se vai completa ou só o primeiro parágrafo.
 */
export function linhaCompativel(
  p: Publicacao,
  leitura: Leitura | null,
  nota: string | null,
  variation: number | null = null
) {
  const quando = new Date(p.publishedAt);
  return {
    variation,
    itt: null as number | null,
    ics: null as number | null,
    ivs: null as number | null,
    ive: null as number | null,
    ici: null as number | null,
    createdAt: quando,
    updatedAt: quando,
    id: p.scoreId ?? 0,
    territoryId: p.territoryId,
    period: p.period,
    stt: p.stt,
    d1Score: p.dims.d1 ?? null,
    d2Score: p.dims.d2 ?? null,
    d3Score: p.dims.d3 ?? null,
    d4Score: p.dims.d4 ?? null,
    d5Score: p.dims.d5 ?? null,
    d6Score: p.dims.d6 ?? null,
    d7Score: p.dims.d7 ?? null,
    activatedIndex: p.activatedIndex,
    executiveNote: nota,
    scenario: p.scenario ?? cenarioDoStt(p.stt),
    published: true as const,
    publishedAt: new Date(p.publishedAt),
    publishedBy: p.publishedBy,
    leitura,
  };
}

/**
 * Formato de `/api/dit/history/:slug` (SnapshotHistoryEntry), agora vindo das
 * publicações: uma entrada por dia (a última publicação do dia), cronológica.
 */
export function entradasDeHistorico(pubs: Publicacao[]) {
  const porDia = new Map<string, Publicacao>();
  for (const p of [...pubs].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))) {
    porDia.set(p.publishedAt.slice(0, 10), p);
  }
  return Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, p]) => ({
      date,
      stt: p.stt,
      tensao: p.tensao,
      confianca: p.confianca,
      scenario: p.scenario,
      signalsCount: p.nSinais ?? 0,
      computedAt: p.publishedAt,
    }));
}
