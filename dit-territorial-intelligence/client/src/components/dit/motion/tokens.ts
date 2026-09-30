/**
 * Tokens de movimento do Marco. Duracao em segundos, easings em nomes do GSAP.
 * Regra: so transform, opacity e clip-path; nada que mude layout.
 */
export const DUR = {
  /** Micro resposta de estado (hover, ativo). */
  rapida: 0.35,
  /** Linha, bloco, painel entrando. */
  revela: 0.9,
  /** Barra que preenche, numero que conta. */
  dado: 1.2,
  /** Desenho de linha e curva. */
  desenho: 1.8,
  /** Palavra da headline subindo pela mascara. */
  palavra: 0.95,
} as const;

export const EASE = {
  saida: "power3.out",
  forte: "power4.out",
  suave: "power2.out",
  dupla: "power2.inOut",
  scrub: "none",
} as const;

export const STAGGER = {
  palavra: 0.045,
  bloco: 0.09,
  linha: 0.035,
  barra: 0.07,
} as const;

/** Onde o reveal dispara: 8% acima do fim da janela. */
export const ROOT_MARGIN = "0px 0px -8% 0px";

/** Tempo maximo de espera pelo GSAP antes de mostrar tudo sem animacao. */
export const GARANTIA_MS = 3000;

export const reduzido = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Celular e tablet estreito: sem pin, menos paralaxe. */
export const estreito = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches;
