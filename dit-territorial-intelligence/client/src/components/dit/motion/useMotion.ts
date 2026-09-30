import { useEffect, type RefObject } from "react";
import { carregaGsap } from "./engine";
import { DUR, EASE, GARANTIA_MS, ROOT_MARGIN, STAGGER, reduzido } from "./tokens";

/**
 * Motor de reveal por atributo. Uma pagina marca os blocos com data-mo e o
 * motor anima cada um quando entra na janela (IntersectionObserver, sem custo
 * por frame). Tipos:
 *   up        bloco sobe e aparece
 *   fade      so opacidade
 *   stagger   filhos diretos entram em sequencia
 *   row       linha de tabela (curta e discreta)
 *   slide     painel que desliza da direita
 *   words     palavras sobem por mascara (use <Palavras>)
 *   bar       barra ou regua que cresce do zero (scaleX)
 *   open      faixa que abre do centro (clip-path)
 *   count     numero que conta ate o valor real do texto
 *   mark      marcador que corre ate a posicao final
 *   spark     linha SVG que se desenha (pathLength=1)
 *   draw      idem, para um traco qualquer
 *   drawgroup todos os paths filhos se desenham em sequencia
 *   dot       ponto que brota
 * Extras: data-mo-delay (s), data-mo-dur (s).
 * Valores finais sempre vem do DOM renderizado: o motor nao conhece numero.
 */

export interface RegraAuto {
  seletor: string;
  tipo: string;
}

type Gsap = Awaited<ReturnType<typeof carregaGsap>>;

const num = (v: string | undefined, padrao: number) => {
  const n = v === undefined ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : padrao;
};

/** "1.234,5%" -> { pre, valor, dec, pos }. Null quando nao e um numero simples. */
function parseNumero(texto: string) {
  const m = texto.trim().match(/^([^\d-]*)(-?\d{1,3}(?:\.\d{3})+|-?\d+)(?:,(\d+))?([^\d]*)$/);
  if (!m) return null;
  const inteiro = Number(m[2].replace(/\./g, ""));
  const dec = m[3] ?? "";
  const valor = Number(dec ? `${inteiro}.${dec}` : inteiro);
  if (!Number.isFinite(valor)) return null;
  return { pre: m[1], valor, casas: dec.length, pos: m[4] };
}

function formata(v: number, casas: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function animaGrupo(gsap: Gsap, tipo: string, els: HTMLElement[], concluir: (el: HTMLElement) => void, dist: number) {
  const n = els.length;
  const atraso = (el: HTMLElement) => num(el.dataset.moDelay, 0);
  const comum = (el: HTMLElement) => ({ delay: atraso(el), onComplete: () => concluir(el) });
  const passo = (base: number) => Math.min(base, 0.5 / Math.max(1, n - 1));

  switch (tipo) {
    case "up":
    case "fade":
      els.forEach((el, i) =>
        gsap.fromTo(
          el,
          { opacity: 0, y: tipo === "up" ? dist : 0 },
          { opacity: 1, y: 0, duration: num(el.dataset.moDur, DUR.revela), ease: EASE.saida, ...comum(el), delay: atraso(el) + i * passo(STAGGER.bloco) }
        )
      );
      break;
    case "row":
      els.forEach((el, i) =>
        gsap.fromTo(
          el,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.45, ease: EASE.suave, ...comum(el), delay: atraso(el) + i * passo(STAGGER.linha) }
        )
      );
      break;
    case "slide":
      els.forEach(el =>
        gsap.fromTo(el, { opacity: 0, x: 28 }, { opacity: 1, x: 0, duration: 0.6, ease: EASE.forte, ...comum(el) })
      );
      break;
    case "stagger":
      els.forEach(el => {
        const filhos = Array.from(el.children) as HTMLElement[];
        gsap.fromTo(
          filhos,
          { opacity: 0, y: dist },
          {
            opacity: 1,
            y: 0,
            duration: DUR.revela,
            ease: EASE.saida,
            stagger: Math.min(STAGGER.bloco, 0.6 / Math.max(1, filhos.length - 1)),
            delay: atraso(el),
            onComplete: () => concluir(el),
          }
        );
        // Filhos entram no estado final pelo gsap; o CSS de "esconder" solta no concluir.
        el.setAttribute("data-mo-ok", "");
      });
      return;
    case "words":
      els.forEach(el => {
        const palavras = el.querySelectorAll<HTMLElement>(".mo-w");
        gsap.fromTo(
          palavras,
          { yPercent: 112 },
          { yPercent: 0, duration: DUR.palavra, ease: EASE.forte, stagger: STAGGER.palavra, ...comum(el) }
        );
      });
      break;
    case "bar":
      els.forEach((el, i) =>
        gsap.fromTo(
          el,
          { scaleX: 0, transformOrigin: "0 50%" },
          { scaleX: 1, duration: DUR.dado, ease: EASE.saida, ...comum(el), delay: atraso(el) + i * passo(STAGGER.barra) }
        )
      );
      break;
    case "open":
      els.forEach(el =>
        gsap.fromTo(
          el,
          { clipPath: "inset(0 50% 0 50%)" },
          { clipPath: "inset(0 0% 0 0%)", duration: DUR.dado, ease: EASE.forte, ...comum(el) }
        )
      );
      break;
    case "mark":
      els.forEach(el => {
        const desloca = -el.offsetLeft;
        gsap.fromTo(
          el,
          { opacity: 0, x: desloca },
          { opacity: 1, x: 0, duration: DUR.dado, ease: EASE.saida, ...comum(el) }
        );
      });
      break;
    case "count":
      els.forEach(el => {
        const no = el.firstChild;
        const p = el.childNodes.length === 1 && no?.nodeType === 3 ? parseNumero(no.nodeValue ?? "") : null;
        if (!p || !no) {
          gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.5, ...comum(el) });
          return;
        }
        const final = no.nodeValue ?? "";
        const estado = { v: 0 };
        no.nodeValue = `${p.pre}${formata(0, p.casas)}${p.pos}`;
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: atraso(el) });
        gsap.to(estado, {
          v: p.valor,
          duration: num(el.dataset.moDur, DUR.dado),
          ease: EASE.suave,
          delay: atraso(el),
          onUpdate: () => {
            no.nodeValue = `${p.pre}${formata(estado.v, p.casas)}${p.pos}`;
          },
          onComplete: () => {
            no.nodeValue = final;
            concluir(el);
          },
        });
      });
      break;
    case "spark":
    case "draw":
      els.forEach(el =>
        gsap.fromTo(
          el,
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: num(el.dataset.moDur, tipo === "spark" ? 1.3 : DUR.desenho), ease: EASE.dupla, ...comum(el) }
        )
      );
      break;
    case "drawgroup":
      els.forEach(el => {
        const tracos = el.querySelectorAll<SVGElement>("path");
        gsap.fromTo(
          tracos,
          { strokeDashoffset: 1 },
          {
            strokeDashoffset: 0,
            duration: num(el.dataset.moDur, 2.4),
            ease: EASE.dupla,
            stagger: { each: 0.07, from: "start" },
            delay: atraso(el),
            onComplete: () => concluir(el),
          }
        );
      });
      break;
    case "dot":
      els.forEach(el =>
        gsap.fromTo(
          el,
          { opacity: 0, scale: 0, transformOrigin: "50% 50%" },
          { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(2.2)", ...comum(el) }
        )
      );
      break;
    default:
      els.forEach(concluir);
  }
  // Libera o estado escondido do CSS agora que o gsap segura o valor inicial por estilo inline.
  els.forEach(el => el.setAttribute("data-mo-ok", ""));
}

/** O que o gsap deixa inline e deve sair ao terminar. Nunca limpar opacity de barra: o React a define. */
const LIMPAR: Record<string, string> = {
  up: "transform,opacity",
  fade: "transform,opacity",
  row: "transform,opacity",
  slide: "transform,opacity",
  count: "opacity",
  mark: "transform,opacity",
  dot: "transform,opacity",
  bar: "transform",
  open: "clipPath",
  spark: "strokeDashoffset,strokeDasharray",
  draw: "strokeDashoffset,strokeDasharray",
};

/**
 * Liga o motor numa raiz. `auto` marca elementos por seletor (util para tabelas
 * do portal e da mesa, sem editar cada pagina). Observa o DOM: blocos que
 * chegam depois (dados da API) tambem entram.
 */
export function useMotionScan(
  ref: RefObject<HTMLElement | null>,
  auto: RegraAuto[] = [],
  /** true no portal e na mesa: deslocamentos curtos, tudo mais discreto. */
  suave = false
) {
  useEffect(() => {
    const raiz = ref.current;
    if (!raiz || reduzido()) return;

    let vivo = true;
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    let quadro = 0;
    let gsapPronto: Gsap | null = null;
    let ctx: { add: (fn: () => void) => void; kill: () => void } | null = null;

    raiz.setAttribute("data-mo-on", "");
    // Sem GSAP a tempo, mostra tudo: nunca deixar conteudo escondido.
    const garantia = window.setTimeout(() => {
      if (!gsapPronto) raiz.removeAttribute("data-mo-on");
    }, GARANTIA_MS);

    const concluir = (el: HTMLElement) => {
      el.setAttribute("data-mo-ok", "");
      const g = gsapPronto;
      if (!g) return;
      const tipo = el.dataset.mo ?? "";
      if (LIMPAR[tipo]) g.set(el, { clearProps: LIMPAR[tipo] });
      else if (tipo === "stagger") g.set(Array.from(el.children), { clearProps: "transform,opacity" });
      else if (tipo === "words") g.set(el.querySelectorAll(".mo-w"), { clearProps: "transform" });
      else if (tipo === "drawgroup") g.set(el.querySelectorAll("path"), { clearProps: "strokeDashoffset,strokeDasharray" });
    };

    const aplicaAuto = () => {
      for (const r of auto) {
        raiz.querySelectorAll<HTMLElement>(r.seletor).forEach(el => {
          if (!el.hasAttribute("data-mo")) el.setAttribute("data-mo", r.tipo);
        });
      }
    };

    const observa = () => {
      aplicaAuto();
      raiz.querySelectorAll<HTMLElement>("[data-mo]:not([data-mo-vist])").forEach(el => {
        el.setAttribute("data-mo-vist", "");
        io?.observe(el);
      });
    };

    const agenda = () => {
      if (quadro) return;
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        if (vivo) observa();
      });
    };

    carregaGsap().then(gsap => {
      if (!vivo) return;
      gsapPronto = gsap;
      const c = gsap.context(() => {}, raiz);
      ctx = c;

      io = new IntersectionObserver(
        entradas => {
          const vis = entradas.filter(e => e.isIntersecting).map(e => e.target as HTMLElement);
          if (!vis.length) return;
          vis.forEach(el => io?.unobserve(el));
          // Agrupa por tipo para o stagger valer entre irmaos que entram juntos.
          const porTipo = new Map<string, HTMLElement[]>();
          vis
            .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
            .forEach(el => {
              const t = el.dataset.mo ?? "";
              porTipo.set(t, [...(porTipo.get(t) ?? []), el]);
            });
          c.add(() => porTipo.forEach((els, t) => animaGrupo(gsap, t, els, concluir, suave ? 10 : 28)));
        },
        { rootMargin: ROOT_MARGIN, threshold: 0.01 }
      );

      mo = new MutationObserver(agenda);
      mo.observe(raiz, { childList: true, subtree: true });
      observa();
    });

    return () => {
      vivo = false;
      window.clearTimeout(garantia);
      cancelAnimationFrame(quadro);
      io?.disconnect();
      mo?.disconnect();
      ctx?.kill();
      raiz.removeAttribute("data-mo-on");
      raiz.querySelectorAll("[data-mo-vist]").forEach(el => el.removeAttribute("data-mo-vist"));
    };
  }, [ref]);
}
