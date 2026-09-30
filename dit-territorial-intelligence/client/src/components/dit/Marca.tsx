import { cn } from "@/lib/utils";

/** Vertice geodesico: triangulo equilatero com ponto no centro, traco fino. */
export function MarcoMark({
  size = 28,
  className,
  title,
}: {
  size?: number;
  className?: string;
  /** Se informado, o simbolo vira imagem com nome acessivel; senao e decorativo. */
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0 text-tinta", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        d="M16 4.5 28 25.5H4Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="miter"
      />
      <circle cx="16" cy="19" r="2" fill="var(--acento)" />
    </svg>
  );
}

/** Simbolo + "Marco" + descricao opcional. */
export function MarcoLogo({
  comDescricao = false,
  size = 28,
  className,
}: {
  comDescricao?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3 text-tinta", className)}>
      <MarcoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-bold tracking-wide">Marco</span>
        {comDescricao && (
          <span className="mt-1 text-[11px] font-medium text-tinta-2">
            Inteligência territorial da PRINT
          </span>
        )}
      </span>
    </span>
  );
}

/** Assinatura "powered by PRINT", usa o arquivo original da logo. */
export function PoweredByPrint({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs text-tinta-2", className)}>
      <span>powered by</span>
      <img
        src="/brand/print-logo.png"
        alt="PRINT"
        height={11}
        className="h-[11px] w-auto dark:hidden"
      />
      <img
        src="/brand/print-logo-white.png"
        alt="PRINT"
        height={11}
        className="hidden h-[11px] w-auto dark:inline"
      />
    </span>
  );
}
