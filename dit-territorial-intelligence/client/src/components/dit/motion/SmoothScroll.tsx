import { useEffect } from "react";
import "lenis/dist/lenis.css";
import { carregaGsap, carregaLenis, defineLenis, rolarPara, stRef } from "./engine";
import { reduzido } from "./tokens";

/**
 * Rolagem suave (Lenis) so nas paginas publicas. Quando o ScrollTrigger esta
 * carregado (landing), o Lenis o alimenta pelo ticker do GSAP para os dois
 * andarem juntos. Sem movimento reduzido, sem toque: rolagem nativa em celular.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (reduzido()) return;
    let vivo = true;
    let destroi: (() => void) | null = null;

    Promise.all([carregaLenis(), carregaGsap()]).then(async ([Lenis, gsap]) => {
      if (!vivo) return;
      const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
      defineLenis(lenis);
      document.documentElement.dataset.lenis = "on";

      // ScrollTrigger (landing) e atualizado a cada passo do Lenis; o ticker do GSAP move os dois.
      lenis.on("scroll", () => stRef.current?.update());
      const tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      const aoClicar = (e: MouseEvent) => {
        const a = (e.target as Element | null)?.closest?.("a[href*='#']") as HTMLAnchorElement | null;
        if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
        const url = new URL(a.href, window.location.href);
        if (url.pathname !== window.location.pathname || url.origin !== window.location.origin || url.hash.length < 2) return;
        const alvo = document.querySelector<HTMLElement>(decodeURIComponent(url.hash));
        if (!alvo) return;
        e.preventDefault();
        history.replaceState(null, "", url.hash);
        rolarPara(alvo);
      };
      document.addEventListener("click", aoClicar);

      destroi = () => {
        document.removeEventListener("click", aoClicar);
        gsap.ticker.remove(tick);
        lenis.destroy();
        defineLenis(null);
        delete document.documentElement.dataset.lenis;
      };
    });

    return () => {
      vivo = false;
      destroi?.();
    };
  }, []);

  return null;
}
