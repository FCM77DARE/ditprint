import { cn } from "@/lib/utils";
import type { FaixaLeitura } from "@shared/leitura";
import { FAIXAS_TENSAO, clamp, faixaDeTensao, fmtDelta, fmtInt } from "./tensao";

export interface TensaoBarProps {
  /** 0-100, ou null quando nao medida. */
  tensao: number | null;
  /** Intervalo plausivel, desenhado como faixa cinza. */
  faixa?: FaixaLeitura;
  /** 0-100. Vira texto "confianca 63%" e opacidade/hachura da barra. */
  confianca?: number;
  /** Valor anterior para mostrar o delta com sinal. */
  comparacao?: { valor: number; rotulo: string };
  /** Mostra a escala com as cinco faixas abaixo da barra. */
  escala?: boolean;
  className?: string;
}

/** Cinco tracos crescentes, N preenchidos: marca de forma da faixa, independente de cor. */
export function MarcaFaixa({ nivel, className }: { nivel: 1 | 2 | 3 | 4 | 5; className?: string }) {
  return (
    <svg width="25" height="10" viewBox="0 0 25 10" aria-hidden className={cn("shrink-0", className)}>
      {[0, 1, 2, 3, 4].map(i => {
        const ativo = i < nivel;
        const h = ativo ? (i + 1) * 2 : 2;
        return (
          <rect
            key={i}
            x={i * 5}
            y={10 - h}
            width="3.5"
            height={h}
            fill={ativo ? "currentColor" : "var(--linha)"}
          />
        );
      })}
    </svg>
  );
}

/**
 * Barra horizontal 0-100 que substitui o gauge.
 * Valor em comprimento a partir do zero, faixa min-max em cinza, marcador do
 * valor, rotulo textual da faixa e confianca em texto.
 */
export function TensaoBar({
  tensao,
  faixa,
  confianca,
  comparacao,
  escala = true,
  className,
}: TensaoBarProps) {
  if (tensao === null || Number.isNaN(tensao)) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="font-display text-2xl font-bold text-tinta-2">Não medida</p>
        <p className="nota">
          Ainda não há dados suficientes para medir a tensão deste território. Colete os sinais
          para gerar a primeira leitura.
        </p>
      </div>
    );
  }

  const v = clamp(tensao);
  const info = faixaDeTensao(v);
  const conf = confianca === undefined ? undefined : clamp(confianca);
  const opac = conf === undefined ? 1 : 0.5 + 0.5 * (conf / 100);
  const hachura = conf !== undefined && conf < 60;
  const delta = comparacao ? v - comparacao.valor : null;

  const descricao =
    `Tensão ${fmtInt(v)} de 100, faixa ${info.rotulo}.` +
    (faixa ? ` Intervalo plausível de ${fmtInt(faixa.min)} a ${fmtInt(faixa.max)}.` : "") +
    (conf !== undefined ? ` Confiança ${fmtInt(conf)}%.` : "") +
    (comparacao && delta !== null ? ` ${fmtDelta(delta)} pontos ${comparacao.rotulo}.` : "");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="num text-5xl font-medium leading-none text-tinta">{fmtInt(v)}</span>
        <span className="flex items-center gap-2 text-base font-semibold text-tinta">
          <span style={{ color: info.cor }}>
            <MarcaFaixa nivel={info.id} />
          </span>
          {info.rotulo}
        </span>
        {comparacao && delta !== null && (
          <span className="text-sm text-tinta-2">
            <span className="num font-medium text-tinta">{fmtDelta(delta)}</span> {comparacao.rotulo}
          </span>
        )}
        {conf !== undefined && <span className="text-sm text-tinta-2">confiança {fmtInt(conf)}%</span>}
      </div>

      <div role="img" aria-label={descricao}>
        <div className="relative h-[22px]">
          {faixa && (
            <div
              className="absolute top-0 h-[6px]"
              style={{
                left: `${clamp(faixa.min)}%`,
                width: `${Math.max(0, clamp(faixa.max) - clamp(faixa.min))}%`,
                background: "var(--confianca-faixa)",
                borderLeft: "2px solid var(--tinta-2)",
                borderRight: "2px solid var(--tinta-2)",
              }}
            />
          )}
          <div className="absolute bottom-0 h-[12px] w-full" style={{ background: "var(--muted)" }}>
            <div
              className="h-full"
              style={{
                width: `${v}%`,
                background: info.cor,
                opacity: opac,
                backgroundImage: hachura
                  ? "repeating-linear-gradient(135deg, transparent 0 3px, var(--superficie) 3px 5px)"
                  : undefined,
              }}
            />
          </div>
          <div
            className="absolute bottom-0 h-[22px] w-[2px]"
            style={{ left: `calc(${v}% - 1px)`, background: "var(--tinta)" }}
          />
        </div>

        {escala && (
          <div className="mt-1 flex" aria-hidden>
            {FAIXAS_TENSAO.map(f => (
              <div
                key={f.id}
                className="flex-1 border-l text-[11px] text-tinta-2 first:border-l-0"
              >
                <span className="num pl-1">{f.min}</span>
                <span className="block pl-1">{f.rotulo}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {faixa && (
        <p className="nota">
          Faixa plausível {fmtInt(faixa.min)} a {fmtInt(faixa.max)}
          {hachura ? ". Hachura indica confiança baixa." : "."}
        </p>
      )}
    </div>
  );
}
