/**
 * Carregamento preguicoso de GSAP, ScrollTrigger e Lenis. Nada disso entra no
 * bundle inicial: cada chunk so baixa quando uma tela com movimento monta.
 */
import type { gsap as Gsap } from "gsap";
import type { ScrollTrigger as ST } from "gsap/ScrollTrigger";
import type Lenis from "lenis";

let pGsap: Promise<typeof Gsap> | null = null;
let pST: Promise<{ gsap: typeof Gsap; ScrollTrigger: typeof ST }> | null = null;
let pLenis: Promise<typeof Lenis> | null = null;

export function carregaGsap(): Promise<typeof Gsap> {
  pGsap ??= import("gsap").then(m => {
    m.gsap.defaults({ ease: "power3.out", duration: 0.9 });
    return m.gsap;
  });
  return pGsap;
}

/** ScrollTrigger carregado (o Lenis o atualiza a cada passo). */
export const stRef: { current: typeof ST | null } = { current: null };

export function carregaScrollTrigger() {
  pST ??= Promise.all([carregaGsap(), import("gsap/ScrollTrigger")]).then(([gsap, m]) => {
    gsap.registerPlugin(m.ScrollTrigger);
    stRef.current = m.ScrollTrigger;
    return { gsap, ScrollTrigger: m.ScrollTrigger };
  });
  return pST;
}

export function carregaLenis(): Promise<typeof Lenis> {
  pLenis ??= import("lenis").then(m => m.default);
  return pLenis;
}

/** Instancia unica do Lenis (so existe nas paginas publicas). */
let lenisAtual: Lenis | null = null;
export const defineLenis = (l: Lenis | null) => {
  lenisAtual = l;
};
export const getLenis = () => lenisAtual;

/** Rola ate um alvo respeitando o Lenis quando ele existe. */
export function rolarPara(alvo: string | HTMLElement, deslocamento = -72) {
  const l = lenisAtual;
  if (l) {
    l.scrollTo(alvo, { offset: deslocamento, duration: 1.3 });
    return;
  }
  const el = typeof alvo === "string" ? document.querySelector<HTMLElement>(alvo) : alvo;
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}
