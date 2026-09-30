import { useEffect, type RefObject } from "react";
import { reduzido } from "./tokens";

/**
 * Cabecalho publico: some ao rolar para baixo, volta ao subir, e uma regua
 * bronze mostra o progresso da leitura. Escreve direto no DOM (sem re-render)
 * e so usa transform. Com movimento reduzido o cabecalho fica sempre visivel.
 */
export function useHeaderAutoHide(
  header: RefObject<HTMLElement | null>,
  progresso: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const h = header.current;
    if (!h) return;
    const reduz = reduzido();
    let ultimo = window.scrollY;
    let quadro = 0;

    const atualiza = () => {
      quadro = 0;
      const y = window.scrollY;
      const barra = progresso.current;
      if (barra) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        barra.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, y / max)) : 0})`;
      }
      if (!reduz) {
        const dy = y - ultimo;
        const menuAberto = !!h.querySelector("details[open]") || h.matches(":focus-within:has(:focus-visible)");
        if (y < 96 || dy < -6 || menuAberto) h.dataset.oculto = "false";
        else if (dy > 6) h.dataset.oculto = "true";
      }
      ultimo = y;
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(atualiza);
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    // Foco por teclado dentro do cabecalho sempre o traz de volta.
    const aoFocar = () => {
      h.dataset.oculto = "false";
    };
    h.addEventListener("focusin", aoFocar);
    atualiza();
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
      h.removeEventListener("focusin", aoFocar);
      cancelAnimationFrame(quadro);
    };
  }, [header, progresso]);
}
