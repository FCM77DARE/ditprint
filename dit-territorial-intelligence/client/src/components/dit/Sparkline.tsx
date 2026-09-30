import { cn } from "@/lib/utils";
import { fmtInt } from "./tensao";

export interface SparklineProps {
  /** Serie em ordem cronologica. */
  valores: number[];
  largura?: number;
  altura?: number;
  /** Nome acessivel, ex. "Tensão nos últimos 30 dias". */
  rotulo: string;
  className?: string;
}

/** Linha simples, sem eixo, com o ultimo ponto marcado. */
export function Sparkline({ valores, largura = 120, altura = 32, rotulo, className }: SparklineProps) {
  if (valores.length < 2) {
    return (
      <span className={cn("nota", className)} role="img" aria-label={`${rotulo}: histórico insuficiente`}>
        histórico insuficiente
      </span>
    );
  }
  const pad = 3;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (largura - pad * 2)) / (valores.length - 1);
  const y = (v: number) => altura - pad - ((v - min) * (altura - pad * 2)) / span;
  const pontos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ultimo = valores[valores.length - 1];

  return (
    <svg
      width={largura}
      height={altura}
      viewBox={`0 0 ${largura} ${altura}`}
      role="img"
      aria-label={`${rotulo}: de ${fmtInt(valores[0])} para ${fmtInt(ultimo)}`}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <polyline points={pontos} fill="none" stroke="var(--tinta-2)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={x(valores.length - 1)} cy={y(ultimo)} r="3" fill="var(--acento)" />
    </svg>
  );
}
