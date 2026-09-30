import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { adaptarLeitura, type LeituraAdaptada } from "@/lib/leitura-adapter";
import { faixaDeTensao } from "@/components/dit";

export type Saidas = inferRouterOutputs<AppRouter>;
export type ScoreRow = Saidas["stt"]["all"][number];
export type TerritorioRow = Saidas["territories"]["listAll"][number];
export type SinalRow = Saidas["signals"]["list"][number];

/**
 * Confianca da leitura = peso das dimensoes medidas sobre o peso total (shared/leitura.ts),
 * ou seja, a cobertura. Abaixo de 60 o TensaoBar ja desenha hachura: a mesa usa a mesma regra.
 */
export const PISO_CONFIANCA = 60;
/** Variacao que o spec (M2) manda revisar. */
export const LIMITE_DELTA_REVISAO = 5;
/** Sem publicacao ha mais de N dias entra em "Exige voce" (spec M1/M5). */
export const DIAS_SEM_PUBLICAR = 3;
/** Impacto do LLM a partir do qual o sinal pesa (spec M4). */
export const IMPACTO_ALTO = 0.7;

export type FilaServidor = Saidas["dashboard"]["filaPublicacao"][number];

export interface ItemFila {
  /** Identidade estavel da linha: scoreId quando ha linha no banco, senao slug|periodo. */
  chave: string;
  raw: FilaServidor;
  slug: string;
  nome: string;
  period: string;
  lp: LeituraAdaptada;
  tensaoUltima: number | null;
  delta: number | null;
  mudaFaixa: boolean;
  dimensoesSemMedida: number;
  /** Motivos para o operador olhar com calma antes de publicar. */
  alertas: string[];
}

export function tensaoDe(l: LeituraAdaptada | null): number | null {
  return l && l.tensao !== null ? l.tensao : null;
}

/** Referencia que publishSttScore e devolverAoMotor aceitam: scoreId quando existe, senao slug + periodo. */
export function referenciaDaFila(i: ItemFila): { scoreId: number } | { slug: string; period: string } {
  return i.raw.scoreId ? { scoreId: i.raw.scoreId } : { slug: i.slug, period: i.period };
}

/**
 * Monta a leitura do rascunho a partir do que a fila do servidor traz (tensao, confianca, faixa, dims).
 * Dimensao sem valor fica nao medida; confianca ausente marca `derivada` (nunca vira 100).
 */
export function leituraDoRascunho(r: FilaServidor["rascunho"]): LeituraAdaptada {
  const base = adaptarLeitura({
    stt: r.tensao ?? r.stt,
    d1Score: r.dims.d1 ?? null,
    d2Score: r.dims.d2 ?? null,
    d3Score: r.dims.d3 ?? null,
    d4Score: r.dims.d4 ?? null,
    d5Score: r.dims.d5 ?? null,
    d6Score: r.dims.d6 ?? null,
  });
  return {
    ...base,
    tensao: r.tensao ?? r.stt,
    confianca: r.confianca ?? 0,
    faixa: r.faixa ?? base.faixa,
    derivada: r.confianca === null,
  };
}

/** Fila unica vinda de dashboard.filaPublicacao (ja ordenada pelo servidor por |delta|), com os alertas de revisao. */
export function montarFila(itens: FilaServidor[]): ItemFila[] {
  return itens.map<ItemFila>(raw => {
    const lp = leituraDoRascunho(raw.rascunho);
    const up = raw.ultimaPublicada;
    const tensaoUltima = up ? (up.tensao ?? up.stt) : null;
    const tp = tensaoDe(lp);
    const delta = raw.delta;
    const mudaFaixa = tp !== null && tensaoUltima !== null && faixaDeTensao(tp).id !== faixaDeTensao(tensaoUltima).id;
    const dimensoesSemMedida = lp.dimensoes.filter(d => !d.medida || d.score === null).length;
    const alertas: string[] = [];
    if (delta !== null && Math.abs(delta) > LIMITE_DELTA_REVISAO)
      alertas.push(`Variação acima de ${LIMITE_DELTA_REVISAO} pontos`);
    if (mudaFaixa) alertas.push("Troca de faixa");
    if (!lp.derivada && lp.confianca < PISO_CONFIANCA) alertas.push(`Confiança abaixo de ${PISO_CONFIANCA}%`);
    if (dimensoesSemMedida > 0)
      alertas.push(dimensoesSemMedida === 1 ? "1 dimensão sem medida" : `${dimensoesSemMedida} dimensões sem medida`);
    if (tp === null) alertas.push("Tensão não medida");
    if (raw.devolvidoAntes) alertas.push("Já foi devolvido ao motor uma vez");
    return {
      chave: raw.scoreId ? String(raw.scoreId) : `${raw.slug}|${raw.period}`,
      raw,
      slug: raw.slug,
      nome: raw.nome,
      period: raw.period,
      lp,
      tensaoUltima,
      delta,
      mudaFaixa,
      dimensoesSemMedida,
      alertas,
    };
  });
}

/** Ultimo score publicado de cada territorio (pelo periodo). */
export function ultimosPublicados(rows: ScoreRow[]): Map<number, ScoreRow> {
  const m = new Map<number, ScoreRow>();
  for (const r of rows) {
    if (!r.published) continue;
    const atual = m.get(r.territoryId);
    if (!atual || r.period > atual.period) m.set(r.territoryId, r);
  }
  return m;
}

export type FonteClassificada = Saidas["dashboard"]["saudeFontes"]["fontes"][number];
export type EstadoFonte = FonteClassificada["estado"];
export type MotivoFonte = FonteClassificada["motivo"];

export function nomeLegivel(id: string): string {
  const base = id.replace(/^src-/, "").replace(/-/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}
