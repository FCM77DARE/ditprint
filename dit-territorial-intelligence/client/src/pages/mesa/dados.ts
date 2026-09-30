import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { adaptarLeitura, type LeituraAdaptada } from "@/lib/leitura-adapter";
import { faixaDeTensao } from "@/components/dit";

export type Saidas = inferRouterOutputs<AppRouter>;
export type ScoreRow = Saidas["stt"]["all"][number];
export type TerritorioRow = Saidas["territories"]["listAll"][number];
export type SinalRow = Saidas["signals"]["list"][number];
export type FonteSaude = Saidas["agentHealth"]["list"][number];

/**
 * Confianca da leitura = peso das dimensoes medidas sobre o peso total (shared/leitura.ts),
 * ou seja, a cobertura. Abaixo de 60 o TensaoBar ja desenha hachura: a mesa usa a mesma regra.
 */
export const PISO_CONFIANCA = 60;
/** Variacao que o spec (M2) manda revisar. */
export const LIMITE_DELTA_REVISAO = 5;
/** Sem publicacao ha mais de N dias entra em "Exige voce" (spec M1/M5). */
export const DIAS_SEM_PUBLICAR = 3;
/** Fonte sem execucao ha mais de N horas e "muda" (spec M3). */
export const HORAS_MUDA = 24;
/** Impacto do LLM a partir do qual o sinal pesa (spec M4). */
export const IMPACTO_ALTO = 0.7;

export interface ItemFila {
  pendente: ScoreRow;
  anterior: ScoreRow | null;
  lp: LeituraAdaptada;
  la: LeituraAdaptada | null;
  delta: number | null;
  mudaFaixa: boolean;
  dimensoesSemMedida: number;
  /** Motivos para o operador olhar com calma antes de publicar. */
  alertas: string[];
}

export function tensaoDe(l: LeituraAdaptada | null): number | null {
  return l && l.tensao !== null ? l.tensao : null;
}

/** Fila unica: todos os scores nao publicados, com o ultimo publicado de cada territorio ao lado. */
export function montarFila(rows: ScoreRow[]): ItemFila[] {
  const publicadosPorTerritorio = new Map<number, ScoreRow[]>();
  for (const r of rows) {
    if (!r.published) continue;
    const l = publicadosPorTerritorio.get(r.territoryId) ?? [];
    l.push(r);
    publicadosPorTerritorio.set(r.territoryId, l);
  }
  publicadosPorTerritorio.forEach(l => l.sort((a, b) => b.period.localeCompare(a.period)));

  const fila = rows
    .filter(r => !r.published)
    .map<ItemFila>(pendente => {
      const candidatos = publicadosPorTerritorio.get(pendente.territoryId) ?? [];
      const anterior =
        candidatos.find(c => c.period <= pendente.period) ?? candidatos[0] ?? null;
      const lp = adaptarLeitura(pendente);
      const la = anterior ? adaptarLeitura(anterior) : null;
      const tp = tensaoDe(lp);
      const ta = tensaoDe(la);
      const delta = tp !== null && ta !== null ? tp - ta : null;
      const mudaFaixa = tp !== null && ta !== null && faixaDeTensao(tp).id !== faixaDeTensao(ta).id;
      const dimensoesSemMedida = lp.dimensoes.filter(d => !d.medida || d.score === null).length;
      const alertas: string[] = [];
      if (delta !== null && Math.abs(delta) > LIMITE_DELTA_REVISAO)
        alertas.push(`Variação acima de ${LIMITE_DELTA_REVISAO} pontos`);
      if (mudaFaixa) alertas.push("Troca de faixa");
      if (!lp.derivada && lp.confianca < PISO_CONFIANCA)
        alertas.push(`Confiança abaixo de ${PISO_CONFIANCA}%`);
      if (dimensoesSemMedida > 0)
        alertas.push(
          dimensoesSemMedida === 1 ? "1 dimensão sem medida" : `${dimensoesSemMedida} dimensões sem medida`
        );
      if (tp === null) alertas.push("Tensão não medida");
      return { pendente, anterior, lp, la, delta, mudaFaixa, dimensoesSemMedida, alertas };
    });

  // T06: ordem pelo valor que importa, maior variacao absoluta primeiro; sem base de comparacao por ultimo.
  return fila.sort((a, b) => {
    const da = a.delta === null ? -1 : Math.abs(a.delta);
    const db = b.delta === null ? -1 : Math.abs(b.delta);
    return db - da;
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

export type EstadoFonte = "mudo" | "atencao" | "ok";
export type CausaFonte = "cota" | "defeito" | "sem-execucao" | null;

export interface FonteAvaliada {
  id: string;
  nome: string;
  dimensao: string | null;
  estado: EstadoFonte;
  causa: CausaFonte;
  lastRunAt: Date | null;
  lastError: string | null;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgLatencyMs: number;
}

const RE_COTA = /cota|quota|serpapi|rate.?limit|429|esgotad|teto/i;

export function nomeLegivel(id: string): string {
  const base = id.replace(/^src-/, "").replace(/-/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Regra do estado (mesma do spec M3, com o que o backend hoje sabe):
 * - mudo: nunca rodou desde o reinicio do processo, ou a ultima execucao passou de 24 h;
 * - atencao: rodou, mas o ultimo resultado foi erro ou a taxa de sucesso ficou abaixo de 90%;
 * - ok: o resto.
 * "Ultimo sucesso" e "ultimo erro" ainda nao sao separados no servidor: lastRunAt e a ultima execucao.
 */
export function avaliarFonte(
  f: FonteSaude,
  dimensaoDe: Record<string, string>,
  agora = Date.now()
): FonteAvaliada {
  const lastRunAt = f.lastRunAt ? new Date(f.lastRunAt) : null;
  const horas = lastRunAt ? (agora - lastRunAt.getTime()) / 3_600_000 : null;
  const mudo = horas === null || horas > HORAS_MUDA;
  const comProblema = Boolean(f.lastError) || (f.successCount + f.errorCount > 0 && f.successRate < 0.9);
  const estado: EstadoFonte = mudo ? "mudo" : comProblema ? "atencao" : "ok";

  let causa: CausaFonte = null;
  if (estado !== "ok") {
    if (f.lastError) causa = RE_COTA.test(f.lastError) ? "cota" : "defeito";
    else causa = mudo && lastRunAt === null ? "sem-execucao" : null;
  }
  return {
    id: f.id,
    nome: nomeLegivel(f.id),
    dimensao: dimensaoDe[f.id] ?? null,
    estado,
    causa,
    lastRunAt,
    lastError: f.lastError,
    successCount: f.successCount,
    errorCount: f.errorCount,
    successRate: f.successRate,
    avgLatencyMs: f.avgLatencyMs,
  };
}

const ORDEM_ESTADO: Record<EstadoFonte, number> = { mudo: 0, atencao: 1, ok: 2 };

/** Gravidade primeiro (T06, E14): muda, atencao, ok; dentro do estado, a mais antiga primeiro. */
export function ordenarFontes(l: FonteAvaliada[]): FonteAvaliada[] {
  return [...l].sort((a, b) => {
    const d = ORDEM_ESTADO[a.estado] - ORDEM_ESTADO[b.estado];
    if (d !== 0) return d;
    const ta = a.lastRunAt ? a.lastRunAt.getTime() : -Infinity;
    const tb = b.lastRunAt ? b.lastRunAt.getTime() : -Infinity;
    return ta - tb;
  });
}
