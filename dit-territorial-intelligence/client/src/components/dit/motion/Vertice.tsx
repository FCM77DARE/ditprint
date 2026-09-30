import { cn } from "@/lib/utils";

/**
 * Vertice geodesico grande: o triangulo se desenha e o ponto bronze brota
 * por ultimo, marcando o cume. Mesmo desenho do MarcoMark, em escala de hero.
 */
export function VerticeGrande({
  className,
  atraso = 0.3,
  animar = true,
}: {
  className?: string;
  atraso?: number;
  animar?: boolean;
}) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("overflow-visible text-tinta", className)}>
      <path
        d="M16 4.5 28 25.5H4Z"
        pathLength={1}
        stroke="currentColor"
        strokeWidth="0.32"
        strokeLinejoin="miter"
        data-mo={animar ? "draw" : undefined}
        data-mo-delay={atraso}
        data-mo-dur={1.9}
      />
      <circle
        cx="16"
        cy="19"
        r="1.45"
        fill="var(--acento)"
        data-mo={animar ? "dot" : undefined}
        data-mo-delay={atraso + 1.55}
      />
    </svg>
  );
}
