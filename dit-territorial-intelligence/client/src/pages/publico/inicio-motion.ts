import { useEffect, type RefObject } from "react";
import { carregaScrollTrigger, rolarPara } from "@/components/dit/motion/engine";
import { reduzido } from "@/components/dit/motion/tokens";

/**
 * Coreografia de scroll da landing (ScrollTrigger). O reveal simples de blocos
 * e palavras vem do motor data-mo; aqui ficam so as cenas amarradas ao scroll:
 * curvas do hero em paralaxe e deriva, texto que acende palavra a palavra,
 * os tres momentos com pin, o caminho de "como funciona" que se desenha e o
 * fundo do CTA. Tudo em transform/opacity. Em movimento reduzido nada roda.
 */
export function useLandingMotion(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (reduzido()) return;
    const raiz = ref.current;
    if (!raiz) return;
    let vivo = true;
    let desfaz: (() => void) | null = null;

    carregaScrollTrigger().then(({ gsap, ScrollTrigger }) => {
      if (!vivo) return;
      const mm = gsap.matchMedia();

      mm.add(
        { desktop: "(min-width: 900px)", mobile: "(max-width: 899px)", fino: "(hover: hover) and (pointer: fine)" },
        ctx => {
          const { desktop, fino } = ctx.conditions as { desktop: boolean; mobile: boolean; fino: boolean };
          const q = <T extends Element = HTMLElement>(s: string) => gsap.utils.toArray<T>(s, raiz);
          const limpezas: (() => void)[] = [];

          // ── Hero: camadas de curvas em deriva lenta, paralaxe com o scroll e com o mouse.
          const hero = raiz.querySelector<HTMLElement>("[data-lp=hero]");
          if (hero) {
            q<HTMLElement>("[data-lp=hero] [data-camada]").forEach((c, i) => {
              gsap.to(c, {
                rotation: i % 2 ? -5 : 6,
                duration: 24 + i * 7,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
                transformOrigin: "50% 50%",
              });
              gsap.to(c, {
                yPercent: (i + 1) * (desktop ? 5 : 3),
                scale: 1 + (i + 1) * 0.03,
                ease: "none",
                scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
              });
              if (fino) {
                const qx = gsap.quickTo(c, "x", { duration: 1.4, ease: "power3" });
                const qy = gsap.quickTo(c, "y", { duration: 1.4, ease: "power3" });
                const mover = (e: PointerEvent) => {
                  const r = hero.getBoundingClientRect();
                  qx(((e.clientX - r.left) / r.width - 0.5) * (i + 1) * -22);
                  qy(((e.clientY - r.top) / r.height - 0.5) * (i + 1) * -22);
                };
                hero.addEventListener("pointermove", mover);
                limpezas.push(() => hero.removeEventListener("pointermove", mover));
              }
            });
            // O conteudo do hero se afasta ao rolar para a proxima cena.
            gsap.to("[data-lp=hero-texto]", {
              y: -56,
              opacity: 0.12,
              ease: "none",
              scrollTrigger: { trigger: hero, start: "top top", end: "bottom 15%", scrub: true },
            });
          }

          // ── Texto grande que acende palavra a palavra.
          q("[data-lp-scrub]").forEach(p => {
            gsap.to(p.querySelectorAll(".mo-w"), {
              opacity: 1,
              stagger: 0.12,
              ease: "none",
              scrollTrigger: { trigger: p, start: "top 82%", end: "bottom 52%", scrub: 0.6 },
            });
          });

          // ── Tres momentos: pin no desktop, troca de painel pelo progresso; empilhado no celular.
          const stage = raiz.querySelector<HTMLElement>("[data-lp=stage]");
          const secaoMomentos = raiz.querySelector<HTMLElement>("[data-lp=momentos]");
          const paineis = q<HTMLElement>("[data-lp=painel]");
          if (stage && secaoMomentos && paineis.length) {
            if (desktop) {
              const itens = q<HTMLElement>("[data-lp=mom-item]");
              const regua = raiz.querySelector<HTMLElement>("[data-lp=mom-regua]");
              stage.setAttribute("data-pin", "on");
              gsap.set(paineis, { autoAlpha: 0, y: 28 });
              paineis.forEach(p => p.setAttribute("inert", ""));
              let atual = -1;
              const vai = (i: number) => {
                if (i === atual) return;
                atual = i;
                paineis.forEach((p, k) => {
                  if (k === i) {
                    p.removeAttribute("inert");
                    gsap.fromTo(
                      p,
                      { autoAlpha: 0, y: 34 },
                      { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", overwrite: true }
                    );
                    gsap.fromTo(
                      p.querySelectorAll("[data-lp=painel-linha]"),
                      { autoAlpha: 0, y: 18 },
                      { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.08, delay: 0.1, overwrite: true }
                    );
                  } else {
                    p.setAttribute("inert", "");
                    gsap.to(p, { autoAlpha: 0, y: -22, duration: 0.35, ease: "power2.in", overwrite: true });
                  }
                });
                itens.forEach((li, k) =>
                  gsap.to(li, { opacity: k === i ? 1 : 0.22, x: k === i ? 14 : 0, duration: 0.55, ease: "power3.out", overwrite: true })
                );
              };
              vai(0);
              ScrollTrigger.create({
                trigger: secaoMomentos,
                pin: true,
                anticipatePin: 1,
                start: "top top",
                end: () => "+=" + window.innerHeight * 2.1,
                onUpdate: self => {
                  if (regua) gsap.set(regua, { scaleY: self.progress });
                  vai(Math.min(paineis.length - 1, Math.floor(self.progress * paineis.length)));
                },
              });
              limpezas.push(() => {
                stage.removeAttribute("data-pin");
                paineis.forEach(p => p.removeAttribute("inert"));
              });
            } else {
              gsap.from(paineis, {
                autoAlpha: 0,
                y: 36,
                duration: 0.9,
                stagger: 0.12,
                scrollTrigger: { trigger: paineis[0], start: "top 85%" },
              });
            }
          }

          // ── Como funciona: a linha se desenha e cada no acende quando a linha chega nele.
          const caminho = raiz.querySelector<HTMLElement>("[data-lp=caminho]");
          if (caminho) {
            const passos = q<HTMLElement>("[data-lp=passo]");
            const nos = q<HTMLElement>("[data-lp=no]");
            const linhaH = caminho.querySelector<HTMLElement>(".lp-linha-h");
            const linhaV = caminho.querySelector<HTMLElement>(".lp-linha-v");
            let limiares: number[] = [];
            const mede = () => {
              limiares = passos.map(p =>
                desktop ? p.offsetLeft / caminho.offsetWidth : (p.offsetTop + 15) / caminho.offsetHeight
              );
            };
            const ativa = (p: number) =>
              passos.forEach((el, i) => {
                const on = p >= limiares[i] - 0.02;
                if (nos[i].dataset.ativo !== String(on)) {
                  nos[i].dataset.ativo = String(on);
                  el.dataset.ativo = String(on);
                }
              });
            passos.forEach(el => (el.dataset.ativo = "false"));
            ScrollTrigger.create({
              trigger: caminho,
              start: "top 72%",
              end: desktop ? () => "+=" + window.innerHeight * 0.6 : "bottom 62%",
              scrub: 0.5,
              onRefresh: mede,
              onUpdate: self => {
                if (linhaH) gsap.set(linhaH, { scaleX: self.progress });
                if (linhaV) gsap.set(linhaV, { scaleY: self.progress });
                ativa(self.progress);
              },
            });
            mede();
          }

          // ── CTA final: as curvas respiram com o scroll.
          const cta = raiz.querySelector<HTMLElement>("[data-lp=cta]");
          if (cta) {
            q<HTMLElement>("[data-lp=cta] [data-camada]").forEach((c, i) =>
              gsap.fromTo(
                c,
                { scale: 0.9 - i * 0.03, rotation: i % 2 ? 4 : -4 },
                {
                  scale: 1.08 + i * 0.05,
                  rotation: i % 2 ? -4 : 4,
                  ease: "none",
                  scrollTrigger: { trigger: cta, start: "top bottom", end: "bottom top", scrub: true },
                }
              )
            );
          }

          // ── Botoes com atracao magnetica leve (so mouse).
          if (fino) {
            q("[data-lp-magnet]").forEach(el => {
              const qx = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
              const qy = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
              const mover = (e: Event) => {
                const ev = e as PointerEvent;
                const r = el.getBoundingClientRect();
                qx((ev.clientX - (r.left + r.width / 2)) * 0.22);
                qy((ev.clientY - (r.top + r.height / 2)) * 0.3);
              };
              const sair = () => {
                qx(0);
                qy(0);
              };
              el.addEventListener("pointermove", mover);
              el.addEventListener("pointerleave", sair);
              limpezas.push(() => {
                el.removeEventListener("pointermove", mover);
                el.removeEventListener("pointerleave", sair);
              });
            });
          }

          return () => limpezas.forEach(f => f());
        },
        raiz
      );

      const recalcula = () => ScrollTrigger.refresh();
      window.addEventListener("load", recalcula);
      document.fonts?.ready.then(() => {
        if (!vivo) return;
        ScrollTrigger.refresh();
        // Chegou por link com ancora de outra pagina: o pin mudou as posicoes, reposiciona.
        if (window.location.hash.length > 1) rolarPara(window.location.hash);
      });

      desfaz = () => {
        window.removeEventListener("load", recalcula);
        mm.revert();
      };
    });

    return () => {
      vivo = false;
      desfaz?.();
    };
  }, [ref]);
}
