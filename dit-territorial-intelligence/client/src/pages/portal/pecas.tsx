import { MarcaFaixa, faixaDeTensao, fmtInt } from "@/components/dit";
import type { LeituraAdaptada } from "@/lib/leitura-adapter";
import { cn } from "@/lib/utils";
import { fmtImpacto, pctImpacto, rotuloImpacto } from "./dados";

/** Delta com uma casa decimal e sinal explicito (o menos e U+2212, nao travessao). */
export function fmtDelta1(n: number | null): string {
  if (n === null) return "sem base";
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "0,0";
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}`;
}

/**
 * Versao compacta da TensaoBar para linha de tabela: numero, barra curta a partir do
 * zero e rotulo da faixa (texto + marca de cinco tracos). Sem valor: "Não medida".
 */
export function TensaoLinha({ leitura, className }: { leitura: LeituraAdaptada; className?: string }) {
  if (leitura.tensao === null) {
    return <span className={cn("text-sm text-tinta-2", className)}>Não medida</span>;
  }
  const v = Math.max(0, Math.min(100, leitura.tensao));
  const info = faixaDeTensao(v);
  const hachura = !leitura.derivada && leitura.confianca < 60;
  return (
    <div
      className={cn("flex items-center gap-3", className)}
      role="img"
      aria-label={`Tensão ${fmtInt(v)} de 100, faixa ${info.rotulo}`}
    >
      <span className="num w-8 shrink-0 text-right text-base font-medium text-tinta">{fmtInt(v)}</span>
      <div className="h-[8px] w-[72px] shrink-0 sm:w-[96px]" style={{ background: "var(--muted)" }}>
        <div
          className="h-full"
          style={{
            width: `${v}%`,
            background: info.cor,
            backgroundImage: hachura
              ? "repeating-linear-gradient(135deg, transparent 0 3px, var(--superficie) 3px 5px)"
              : undefined,
          }}
        />
      </div>
      <span className="flex items-center gap-1.5 text-sm text-tinta">
        <span style={{ color: info.cor }}>
          <MarcaFaixa nivel={info.id} />
        </span>
        {info.rotulo}
      </span>
    </div>
  );
}

/** Confianca em texto; sem leitura do backend diz que nao foi informada (nunca inventa). */
export function ConfiancaTexto({ leitura }: { leitura: LeituraAdaptada }) {
  if (leitura.derivada || leitura.tensao === null) {
    return <span className="text-sm text-tinta-2">não informada</span>;
  }
  return (
    <span className="num text-sm text-tinta">
      {fmtInt(leitura.confianca)}%
      {leitura.confianca < 60 && <span className="font-body text-xs text-tinta-2"> baixa</span>}
    </span>
  );
}

/** Impacto de 0 a 1: barra a partir do zero, numero e rotulo textual (cor nunca sozinha). */
export function ImpactoBarra({ valor, className }: { valor: number | null; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-[6px] w-14 shrink-0"
        style={{ background: "var(--muted)" }}
        role="img"
        aria-label={`Impacto ${fmtImpacto(valor)} de 1, ${rotuloImpacto(valor)}`}
      >
        <div className="h-full" style={{ width: `${pctImpacto(valor)}%`, background: "var(--tinta-2)" }} />
      </div>
      <span className="num text-sm text-tinta">{fmtImpacto(valor)}</span>
      <span className="text-xs text-tinta-2">{rotuloImpacto(valor)}</span>
    </div>
  );
}

/** Delta com sinal; a cor nunca e o unico sinal. */
export function DeltaTexto({ valor, sufixo }: { valor: number | null; sufixo?: string }) {
  if (valor === null) return <span className="text-sm text-tinta-2">sem base</span>;
  return (
    <span className="num text-sm text-tinta">
      {fmtDelta1(valor)}
      {sufixo && <span className="font-body text-xs text-tinta-2"> {sufixo}</span>}
    </span>
  );
}
