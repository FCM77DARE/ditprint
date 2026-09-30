import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MarcoMark } from "./Marca";
import { Button } from "./Button";

export function EmptyState({
  titulo,
  descricao,
  acao,
  onAcao,
  className,
}: {
  titulo: string;
  descricao: string;
  /** Verbo da proxima acao, ex. "Coletar sinais". */
  acao?: string;
  onAcao?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-[6px] border border-dashed p-6", className)}>
      <MarcoMark size={24} className="text-tinta-2" />
      <div className="space-y-1">
        <p className="text-base font-semibold text-tinta">{titulo}</p>
        <p className="max-w-prose text-sm text-tinta-2">{descricao}</p>
      </div>
      {acao && (
        <Button variant="secundario" size="sm" onClick={onAcao}>
          {acao}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  motivo,
  proximoPasso,
  acao = "Tentar de novo",
  onAcao,
  className,
}: {
  /** Motivo em linguagem simples, sem codigo tecnico. */
  motivo: string;
  /** Proximo passo comecando por verbo. */
  proximoPasso: string;
  acao?: string;
  onAcao?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-start gap-3 rounded-[6px] border p-6", className)}
      style={{ borderColor: "var(--tensao-5)" }}
    >
      <div className="space-y-1">
        <p className="text-base font-semibold text-tinta">Não foi possível carregar</p>
        <p className="max-w-prose text-sm text-tinta">{motivo}</p>
        <p className="max-w-prose text-sm text-tinta-2">{proximoPasso}</p>
      </div>
      {onAcao && (
        <Button variant="secundario" size="sm" onClick={onAcao}>
          {acao}
        </Button>
      )}
    </div>
  );
}

/** Esqueleto estatico (sem pulso nem spinner). */
export function LoadingBlock({
  linhas = 3,
  rotulo = "Carregando",
  className,
}: {
  linhas?: number;
  rotulo?: string;
  className?: string;
}) {
  const larguras = ["100%", "86%", "94%", "72%", "90%", "80%"];
  return (
    <div role="status" aria-busy="true" className={cn("space-y-3", className)}>
      {Array.from({ length: linhas }).map((_, i) => (
        <div
          key={i}
          className="h-3"
          aria-hidden
          style={{ width: larguras[i % larguras.length], background: "var(--muted)" }}
        />
      ))}
      <span className="sr-only">{rotulo}</span>
    </div>
  );
}

/** Secao com titulo que afirma a conclusao, nota de fonte/definicao em texto menor. */
export function Secao({
  titulo,
  children,
  nota,
  className,
}: {
  titulo: string;
  children: ReactNode;
  nota?: string;
  className?: string;
}) {
  return (
    <section data-mo="up" className={cn("space-y-3", className)}>
      <div>
        <h2 className="text-xl">{titulo}</h2>
        {nota && <p className="nota mt-1">{nota}</p>}
      </div>
      {children}
    </section>
  );
}
