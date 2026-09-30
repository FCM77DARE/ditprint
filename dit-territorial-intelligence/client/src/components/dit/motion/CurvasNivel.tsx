import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Curvas de nivel como aneis em torno de um cume (o vertice). Geradas por uma
 * funcao suave (soma de senos), sem ruido aleatorio: o mesmo desenho toda vez.
 * Tres camadas SVG empilhadas permitem paralaxe e deriva em velocidades
 * diferentes, e cada camada e um elemento HTML, entao o transform roda no
 * compositor. Decorativo: aria-hidden.
 */

const CAMADAS = 3;

function anel(raio: number, k: number, pontos = 96): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < pontos; i++) {
    const t = (i / pontos) * Math.PI * 2;
    const r =
      raio *
      (1 +
        0.11 * Math.sin(2 * t + 0.55 + k * 0.11) +
        0.07 * Math.sin(3 * t - 1.1 - k * 0.08) +
        0.035 * Math.sin(5 * t + 2.3 + k * 0.05));
    pts.push([500 + r * Math.cos(t), 500 + r * 0.82 * Math.sin(t)]);
  }
  // Catmull-Rom fechado convertido em Bezier cubica.
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}

export function CurvasNivel({
  aneis = 18,
  className,
  animar = true,
}: {
  aneis?: number;
  className?: string;
  /** false: desenho estatico (sem data-mo). */
  animar?: boolean;
}) {
  const camadas = useMemo(() => {
    const out: { d: string; mestra: boolean }[][] = Array.from({ length: CAMADAS }, () => []);
    for (let k = 0; k < aneis; k++) {
      out[k % CAMADAS].push({ d: anel(46 + k * 27, k), mestra: (k + 1) % 5 === 0 });
    }
    return out;
  }, [aneis]);

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      {camadas.map((aneisDaCamada, c) => (
        <svg
          key={c}
          data-camada={c}
          viewBox="0 0 1000 1000"
          className="mo-camada absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          <g data-mo={animar ? "drawgroup" : undefined} data-mo-delay={0.1 + c * 0.25} data-mo-dur={3}>
            {aneisDaCamada.map((a, i) => (
              <path
                key={i}
                d={a.d}
                pathLength={1}
                stroke="var(--tinta-2)"
                strokeOpacity={a.mestra ? 0.34 : 0.17}
                strokeWidth={a.mestra ? 1.6 : 1}
              />
            ))}
          </g>
        </svg>
      ))}
    </div>
  );
}
