/** Regras de escala de tensao, compartilhadas pelos componentes. Sem JSX. */

export type FaixaTensaoId = 1 | 2 | 3 | 4 | 5;

export interface FaixaTensaoInfo {
  id: FaixaTensaoId;
  rotulo: "Baixa" | "Moderada" | "Elevada" | "Alta" | "Crítica";
  min: number;
  max: number;
  cor: string;
}

export const FAIXAS_TENSAO: FaixaTensaoInfo[] = [
  { id: 1, rotulo: "Baixa", min: 0, max: 20, cor: "var(--tensao-1)" },
  { id: 2, rotulo: "Moderada", min: 20, max: 40, cor: "var(--tensao-2)" },
  { id: 3, rotulo: "Elevada", min: 40, max: 60, cor: "var(--tensao-3)" },
  { id: 4, rotulo: "Alta", min: 60, max: 80, cor: "var(--tensao-4)" },
  { id: 5, rotulo: "Crítica", min: 80, max: 100, cor: "var(--tensao-5)" },
];

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, n));
}

export function faixaDeTensao(valor: number): FaixaTensaoInfo {
  const v = clamp(valor);
  const idx = Math.min(4, Math.floor(v / 20));
  return FAIXAS_TENSAO[idx];
}

/** Formata numero inteiro em pt-BR. */
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

/** Delta com sinal explicito: +4, −3, 0. O sinal menos usa U+2212 (nao e travessao). */
export function fmtDelta(n: number): string {
  const r = Math.round(n);
  if (r === 0) return "0";
  return `${r > 0 ? "+" : "\u2212"}${Math.abs(r)}`;
}
