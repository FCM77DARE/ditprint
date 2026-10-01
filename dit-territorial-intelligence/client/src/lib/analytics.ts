/**
 * Clique de CTA na landing pública, medido pelo Umami já carregado em main.tsx
 * (window.umami?.track). Nunca lança erro se o Umami não existir ou não tiver
 * carregado ainda — o clique do usuário não pode depender disso.
 */

declare global {
  interface Window {
    umami?: { track: (nome: string, dados?: Record<string, unknown>) => void };
  }
}

export function trackCta(cta: string, bloco: string) {
  try {
    window.umami?.track("cta_clique", { cta, bloco });
  } catch {
    // Umami indisponível não pode quebrar a navegação do CTA.
  }
}
