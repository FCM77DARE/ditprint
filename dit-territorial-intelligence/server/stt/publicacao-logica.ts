/**
 * Lógica pura da publicação: o que é "publicado", delta 7/30 dias, série para
 * sparkline, nota pública, item da fila da mesa. Sem banco, sem disco, sem
 * relógio escondido (quem chama passa `agora` quando importa), para testar.
 *
 * Vocabulário:
 *   - Rascunho: o que o motor calculou e ainda nenhum humano publicou.
 *   - Publicação: o que um operador publicou. É a única coisa que sai para fora.
 *     A publicação congela tensão e confiança do momento: o número público não
 *     muda quando a evidência muda depois.
 */

import type { Leitura } from "../../shared/leitura";
import type { CenarioStt } from "../../shared/metodologia";

export type Dims = Partial<Record<"d1" | "d2" | "d3" | "d4" | "d5" | "d6" | "d7", number | null>>;

export interface Publicacao {
  slug: string;
  /** 0 em modo disco (sem MySQL). */
  territoryId: number;
  nome: string;
  estado: string | null;
  regiao: string | null;
  period: string;
  stt: number;
  /** Congelada na publicação; null em publicações legadas anteriores ao campo leitura. */
  tensao: number | null;
  confianca: number | null;
  scenario: CenarioStt;
  dims: Dims;
  activatedIndex: string | null;
  notaExecutiva: string | null;
  leitura: Leitura | null;
  nSinais: number | null;
  /** ISO. */
  publishedAt: string;
  publishedBy: string;
  origem: "mysql" | "disco" | "legado";
  scoreId?: number;
}

export interface Rascunho {
  slug: string;
  territoryId: number;
  nome: string;
  estado: string | null;
  regiao: string | null;
  period: string;
  stt: number;
  scenario: CenarioStt;
  dims: Dims;
  activatedIndex: string | null;
  notaExecutiva: string | null;
  leitura: Leitura | null;
  nSinais: number | null;
  /** ISO do último cálculo do motor. */
  geradoEm: string;
  scoreId?: number;
}

export interface Devolucao {
  slug: string;
  period: string;
  motivo: string;
  por: string;
  /** ISO. */
  em: string;
  /** `geradoEm` do rascunho que foi devolvido: rascunho novo reabre a fila. */
  rascunhoGeradoEm: string;
}

export interface PontoSerie {
  /** YYYY-MM-DD */
  data: string;
  valor: number;
}

// ─── Flags ────────────────────────────────────────────────────────────────────

function flagLigada(valor: string | undefined, padrao: boolean): boolean {
  if (valor === undefined || valor === "") return padrao;
  return !["false", "0", "off", "nao", "não"].includes(valor.trim().toLowerCase());
}

/** DIT_GATE_PUBLICACAO (padrão true): leituras públicas só mostram o publicado. */
export function gateAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return flagLigada(env.DIT_GATE_PUBLICACAO, true);
}

/** DIT_PORTAL_AUTH (padrão true): portal e SSE exigem sessão de assinante ou operador. */
export function portalAuthAtivo(env: Record<string, string | undefined> = process.env): boolean {
  return flagLigada(env.DIT_PORTAL_AUTH, true);
}

// ─── Números ──────────────────────────────────────────────────────────────────

const arredonda1 = (v: number) => Math.round(v * 10) / 10;

/** Valor que a série e os deltas acompanham: tensão publicada, senão o STT. */
export function valorDe(p: Pick<Publicacao, "tensao" | "stt">): number {
  return typeof p.tensao === "number" && Number.isFinite(p.tensao) ? p.tensao : p.stt;
}

function dia(iso: string): string {
  return iso.slice(0, 10);
}

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Um ponto por dia (a última publicação do dia), em ordem cronológica. */
export function pontosDiarios(pubs: Publicacao[]): PontoSerie[] {
  const porDia = new Map<string, Publicacao>();
  for (const p of [...pubs].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))) {
    porDia.set(dia(p.publishedAt), p);
  }
  return Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, p]) => ({ data, valor: arredonda1(valorDe(p)) }));
}

/** Série para sparkline: até `max` pontos diários mais recentes. */
export function serieParaSparkline(pubs: Publicacao[], max = 12): PontoSerie[] {
  return pontosDiarios(pubs).slice(-max);
}

/**
 * Variação entre a última publicação e a publicada "há `dias` dias ou antes".
 * Sem publicação tão antiga, devolve null: não inventa base de comparação.
 */
export function deltaEmDias(pubs: Publicacao[], dias: number): number | null {
  const pontos = pontosDiarios(pubs);
  if (pontos.length < 2) return null;
  const ultimo = pontos[pontos.length - 1];
  const limite = somarDias(ultimo.data, -dias);
  let ref: PontoSerie | null = null;
  for (const p of pontos) {
    if (p.data <= limite) ref = p;
  }
  return ref ? arredonda1(ultimo.valor - ref.valor) : null;
}

export function ultimaPublicacao(pubs: Publicacao[]): Publicacao | null {
  if (pubs.length === 0) return null;
  return [...pubs].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[pubs.length - 1];
}

/** Primeiro parágrafo da nota: o que a área pública pode mostrar sem pedir acesso. */
export function primeiroParagrafo(nota: string | null | undefined): string | null {
  if (!nota) return null;
  const p = nota.trim().split(/\n\s*\n/)[0]?.trim();
  return p ? p : null;
}

export interface VisaoPublicada {
  ultima: Publicacao | null;
  notaExecutiva: string | null;
  delta7: number | null;
  delta30: number | null;
  serie: PontoSerie[];
}

/** Tudo que o front precisa de um território a partir das suas publicações. */
export function visaoDasPublicacoes(pubs: Publicacao[], opcoes: { notaCompleta: boolean }): VisaoPublicada {
  const ultima = ultimaPublicacao(pubs);
  const nota = ultima?.notaExecutiva ?? null;
  return {
    ultima,
    notaExecutiva: opcoes.notaCompleta ? nota : primeiroParagrafo(nota),
    delta7: deltaEmDias(pubs, 7),
    delta30: deltaEmDias(pubs, 30),
    serie: serieParaSparkline(pubs, 12),
  };
}

/**
 * Junta o que está no livro de publicações com linhas legadas do MySQL
 * (stt_scores published=true sem registro no livro). O livro vence quando o
 * período coincide.
 */
export function mesclarPublicacoes(livro: Publicacao[], legado: Publicacao[]): Publicacao[] {
  const periodosNoLivro = new Set(livro.map((p) => p.period));
  return [...livro, ...legado.filter((p) => !periodosNoLivro.has(p.period))].sort((a, b) =>
    a.publishedAt.localeCompare(b.publishedAt)
  );
}

// ─── Fila da mesa ─────────────────────────────────────────────────────────────

export interface ItemFila {
  slug: string;
  territoryId: number;
  nome: string;
  estado: string | null;
  period: string;
  scoreId: number | null;
  rascunho: {
    stt: number;
    tensao: number | null;
    confianca: number | null;
    faixa: { min: number; max: number } | null;
    scenario: CenarioStt;
    notaExecutiva: string | null;
    nSinais: number | null;
    geradoEm: string;
    dims: Dims;
  };
  ultimaPublicada: {
    stt: number;
    tensao: number | null;
    confianca: number | null;
    scenario: CenarioStt;
    notaExecutiva: string | null;
    publishedAt: string;
    publishedBy: string;
  } | null;
  /** valor do rascunho menos valor da última publicada (tensão, senão STT); null sem publicada. */
  delta: number | null;
  devolvidoAntes: { motivo: string; por: string; em: string } | null;
}

/** Entra na fila se nunca foi publicado ou se o motor calculou depois da última publicação. */
export function entraNaFila(r: Rascunho, ultima: Publicacao | null): boolean {
  if (!ultima) return true;
  return r.geradoEm > ultima.publishedAt;
}

export function devolucaoVigente(r: Rascunho, d: Devolucao | null | undefined): Devolucao | null {
  if (!d) return null;
  return d.rascunhoGeradoEm === r.geradoEm ? d : null;
}

export function montarItemFila(r: Rascunho, ultima: Publicacao | null, dev: Devolucao | null): ItemFila {
  const tensao = r.leitura?.tensao ?? null;
  const valorNovo = typeof tensao === "number" ? tensao : r.stt;
  return {
    slug: r.slug,
    territoryId: r.territoryId,
    nome: r.nome,
    estado: r.estado,
    period: r.period,
    scoreId: r.scoreId ?? null,
    rascunho: {
      stt: r.stt,
      tensao,
      confianca: r.leitura?.confianca ?? null,
      faixa: r.leitura?.faixa ?? null,
      scenario: r.scenario,
      notaExecutiva: r.notaExecutiva,
      nSinais: r.nSinais,
      geradoEm: r.geradoEm,
      dims: r.dims,
    },
    ultimaPublicada: ultima
      ? {
          stt: ultima.stt,
          tensao: ultima.tensao,
          confianca: ultima.confianca,
          scenario: ultima.scenario,
          notaExecutiva: ultima.notaExecutiva,
          publishedAt: ultima.publishedAt,
          publishedBy: ultima.publishedBy,
        }
      : null,
    delta: ultima ? arredonda1(valorNovo - valorDe(ultima)) : null,
    devolvidoAntes: dev ? { motivo: dev.motivo, por: dev.por, em: dev.em } : null,
  };
}

/** Maior variação primeiro; sem base de comparação, pelo STT mais alto. */
export function ordenarFila(itens: ItemFila[]): ItemFila[] {
  return [...itens].sort((a, b) => {
    const da = a.delta === null ? -1 : Math.abs(a.delta);
    const db = b.delta === null ? -1 : Math.abs(b.delta);
    if (da !== db) return db - da;
    return b.rascunho.stt - a.rascunho.stt;
  });
}
