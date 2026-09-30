import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import "./marco-home.css";

/*
 * Peças da identidade do Marco usadas em todas as páginas públicas:
 * o vértice geodésico (o ponto se fixa em laranja de baliza), a marca,
 * o "powered by PRINT" com a logo original, o cabeçalho que troca de tom
 * sobre seção escura e o rodapé. Estilos em marco-home.css, presos a .mh.
 */

export const reduzirMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Vertice({ fixo = false, className }: { fixo?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`vx ${fixo ? "fixo" : ""} ${className ?? ""}`}>
      <path className="tri" d="M50 12 L90 82 L10 82 Z" />
      <circle className="pt" cx="50" cy="59" r="9" />
    </svg>
  );
}

export function Marca({ className }: { className?: string }) {
  return (
    <Link href="/" className={`marca ${className ?? ""}`} aria-label="Marco, página inicial">
      <Vertice fixo />
      <span>marco</span>
    </Link>
  );
}

export function PoweredBy() {
  return (
    <a className="origem" href="https://www.printrio.net" target="_blank" rel="noopener noreferrer">
      powered by
      <img className="preta" src="/marco/print-preta.png" alt="PRINT" />
      <img className="clara" src="/marco/print-clara.png" alt="PRINT" />
    </a>
  );
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <p className="rotulo"><Vertice fixo />{children}</p>;
}

export function Seta() {
  return (
    <svg className="seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Botão da casa: o ponto se fixa no hover, a seta anda, o botão puxa o cursor. */
export function Acao({ href, children, clara = false, onClick }: { href?: string; children: ReactNode; clara?: boolean; onClick?: () => void }) {
  const cls = `acao ${clara ? "clara" : ""}`;
  const miolo = (<><Vertice />{children}<Seta /></>);
  if (!href) return <button type="button" className={cls} data-magnetico onClick={onClick}>{miolo}</button>;
  const interno = href.startsWith("/") && !href.startsWith("//");
  return interno
    ? <Link href={href} className={cls} data-magnetico onClick={onClick}>{miolo}</Link>
    : <a href={href} className={cls} data-magnetico onClick={onClick}>{miolo}</a>;
}

/** Botões com data-magnetico puxam até 6 px na direção do cursor (ponteiro fino, sem reduced-motion). */
export function useMagnetico(raiz: React.RefObject<HTMLElement | null>, dep: unknown = null) {
  useEffect(() => {
    if (reduzirMotion() || window.matchMedia("(hover: none)").matches) return;
    const r = raiz.current;
    if (!r) return;
    const mover = (e: PointerEvent) => {
      const b = e.currentTarget as HTMLElement, q = b.getBoundingClientRect();
      const dx = (e.clientX - (q.left + q.width / 2)) / q.width, dy = (e.clientY - (q.top + q.height / 2)) / q.height;
      b.style.transform = `translate(${dx * 12}px, ${dy * 10}px)`;
    };
    const soltar = (e: PointerEvent) => { (e.currentTarget as HTMLElement).style.transform = ""; };
    const bs = Array.from(r.querySelectorAll<HTMLElement>("[data-magnetico]"));
    bs.forEach(b => { b.addEventListener("pointermove", mover); b.addEventListener("pointerleave", soltar); });
    return () => bs.forEach(b => { b.removeEventListener("pointermove", mover); b.removeEventListener("pointerleave", soltar); });
  }, [raiz, dep]);
}

type ItemNav = { href: string; rotulo: string };

const NAV_PADRAO: ItemNav[] = [
  { href: "/#como-funciona", rotulo: "Como funciona" },
  { href: "/#escada", rotulo: "O que você recebe" },
  { href: "/metodologia", rotulo: "Metodologia" },
  { href: "/sse", rotulo: "SSE" },
  { href: "/entrar", rotulo: "Entrar" },
];

/** Cabeçalho fixo: tom escuro sobre .hero/.escuro, papel sobre o resto. */
export function Topo({ raiz, nav = NAV_PADRAO, pedir = { href: "/#completa", rotulo: "Diagnóstico completo" } }: {
  raiz: React.RefObject<HTMLElement | null>;
  nav?: ItemNav[];
  pedir?: ItemNav;
}) {
  const topo = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const el = topo.current, r = raiz.current;
    if (!el || !r) return;
    const atualizar = () => {
      const escuros = Array.from(r.querySelectorAll(".hero, .escuro, .estratos"));
      const sobre = escuros.some(s => { const b = s.getBoundingClientRect(); return b.top <= 40 && b.bottom > 40; });
      el.classList.toggle("sobre-escuro", sobre);
      el.classList.toggle("rolou", window.scrollY > 12);
    };
    atualizar();
    window.addEventListener("scroll", atualizar, { passive: true });
    const t = window.setInterval(atualizar, 800); // conteúdo que chega depois (stream) muda as seções
    return () => { window.removeEventListener("scroll", atualizar); window.clearInterval(t); };
  }, [raiz]);
  const link = (i: ItemNav, cls?: string) =>
    i.href.startsWith("/#") || i.href.startsWith("#")
      ? <a key={i.href} href={i.href} className={cls} onClick={() => setMenu(false)}>{i.rotulo}</a>
      : <Link key={i.href} href={i.href} className={cls} onClick={() => setMenu(false)}>{i.rotulo}</Link>;
  return (
    <header className={`topo sobre-escuro ${menu ? "aberto" : ""}`} ref={topo}>
      <div className="largura">
        <div className="esq"><Marca /><PoweredBy /></div>
        <nav aria-label="Principal">
          {nav.map(i => link(i))}
          {link(pedir, "pedir")}
        </nav>
        <button className="burger" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu(m => !m)}><span /><span /></button>
      </div>
    </header>
  );
}

export function Rodape() {
  return (
    <footer className="rodape">
      <div className="largura">
        <Marca />
        <nav aria-label="Rodapé">
          <Link href="/metodologia">Metodologia</Link>
          <Link href="/sse">SSE</Link>
          <Link href="/radar">Marco Radar</Link>
          <Link href="/entrar">Entrar</Link>
        </nav>
        <PoweredBy />
      </div>
    </footer>
  );
}

/** Página pública no sistema Marco: .mh, cabeçalho, conteúdo, rodapé. */
export function MarcoPagina({ children, dep }: { children: ReactNode; dep?: unknown }) {
  const raiz = useRef<HTMLDivElement>(null);
  useMagnetico(raiz, dep);
  return (
    <div className="mh" ref={raiz}>
      <Topo raiz={raiz} />
      <main>{children}</main>
      <Rodape />
    </div>
  );
}

/** Topo escuro das páginas internas: relevo ao fundo, rótulo, título grande, texto e ações. */
export function TopoPagina({ rotulo, titulo, children, acoes, imagem = "/marco/relevo-escuro.jpg" }: {
  rotulo?: string; titulo: string; children?: ReactNode; acoes?: ReactNode; imagem?: string;
}) {
  return (
    <section className="hero hero-pagina">
      <img className="fundo" src={imagem} alt="" aria-hidden="true" fetchPriority="high" />
      <div className="veu" />
      <div className="largura">
        {rotulo && <span className="selo"><Vertice fixo />{rotulo}</span>}
        <h1>{titulo}</h1>
        {children && <div className="sub-pagina">{children}</div>}
        {acoes && <div className="acoes">{acoes}</div>}
      </div>
    </section>
  );
}
