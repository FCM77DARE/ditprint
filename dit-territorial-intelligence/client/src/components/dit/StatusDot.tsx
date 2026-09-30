import { cn } from "@/lib/utils";

export type StatusTipo = "ok" | "atencao" | "mudo";

const CFG: Record<StatusTipo, { rotulo: string; cor: string }> = {
  ok: { rotulo: "Ok", cor: "var(--status-ok)" },
  atencao: { rotulo: "Atenção", cor: "var(--status-atencao)" },
  mudo: { rotulo: "Mudo", cor: "var(--status-mudo)" },
};

/** Saude por FORMA + texto: ok = circulo cheio, atencao = triangulo, mudo = circulo vazado. */
export function StatusDot({
  status,
  rotulo,
  className,
}: {
  status: StatusTipo;
  /** Sobrescreve o texto padrao (ex. "Ok há 3 min"). */
  rotulo?: string;
  className?: string;
}) {
  const { rotulo: padrao, cor } = CFG[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-tinta", className)}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ color: cor }}>
        {status === "ok" && <circle cx="6" cy="6" r="5" fill="currentColor" />}
        {status === "atencao" && <path d="M6 1 11 10.5H1Z" fill="currentColor" />}
        {status === "mudo" && (
          <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>
      {rotulo ?? padrao}
    </span>
  );
}
