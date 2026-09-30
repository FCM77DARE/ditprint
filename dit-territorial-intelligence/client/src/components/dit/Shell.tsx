import { Rodape, Topo, useMagnetico } from "@/pages/publico/MarcoShell";
import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { MarcoLogo, PoweredByPrint } from "./Marca";
import { Button, botaoVariants } from "./Button";
import { SmoothScroll, useHeaderAutoHide, useMotionScan, type RegraAuto } from "./motion";

function AlternarTema() {
  const { theme, toggleTheme, switchable } = useTheme();
  if (!switchable || !toggleTheme) return null;
  const escuro = theme === "dark";
  return (
    <Button
      variant="fantasma"
      size="sm"
      onClick={toggleTheme}
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      aria-pressed={escuro}
    >
      {escuro ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </Button>
  );
}

export const NAV_PUBLICO = [
  { href: "/#como-funciona", rotulo: "Como funciona" },
  { href: "/metodologia", rotulo: "Metodologia" },
  { href: "/sse", rotulo: "SSE" },
  { href: "/radar", rotulo: "Marco Radar" },
  { href: "/entrar", rotulo: "Entrar" },
];

/** Todo link de navegacao do header: rotas usam o roteador, ancora usa rolagem suave. */
function LinkNav({ item, local, className }: { item: (typeof NAV_PUBLICO)[number]; local: string; className: string }) {
  const hash = item.href.includes("#");
  const ativo = !hash && item.href === local;
  const fechaMenu = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.closest("details")?.removeAttribute("open");
  };
  if (hash) {
    return (
      <a href={item.href} className={className} onClick={fechaMenu}>
        {item.rotulo}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} aria-current={ativo ? "page" : undefined} onClick={fechaMenu}>
      {item.rotulo}
    </Link>
  );
}

/**
 * Shell das paginas publicas: header com MarcoLogo e nav, footer com PoweredByPrint.
 * Traz o movimento das paginas publicas: rolagem suave (Lenis), reveal por
 * atributo data-mo em todo o conteudo e cabecalho que some ao rolar para baixo.
 */
export function PageShell({
  children,
  hero = false,
  className,
}: {
  children: ReactNode;
  /** true aplica as curvas de nivel estaticas ao fundo (alternativa sem movimento). */
  hero?: boolean;
  className?: string;
}) {
  const [local] = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useMotionScan(mainRef);
  // Navegacao entre rotas nao zera o scroll sozinha: volta ao topo, salvo ancora.
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [local]);

  const raiz = useRef<HTMLDivElement>(null);
  useMagnetico(raiz, local);
  return (
    // Páginas públicas vestem a identidade do Marco: mesmo cabeçalho e rodapé da home (MarcoShell).
    <div ref={raiz} className={cn("mh flex min-h-screen flex-col", className)}>
      <SmoothScroll />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2"
      >
        Ir para o conteúdo
      </a>
      <Topo raiz={raiz} />
      <main ref={mainRef} id="conteudo" className={cn("flex-1 pt-20", hero && "bg-curvas")}>
        {children}
      </main>
      <Rodape />
    </div>
  );
}

/** Movimento funcional do portal e da mesa, sem editar cada tela: linhas entram, painel lateral desliza. */
const AUTO_APP: RegraAuto[] = [
  { seletor: "tbody:not([data-mo]) > tr", tipo: "row" },
  { seletor: "aside", tipo: "slide" },
];

export interface ItemNav {
  href: string;
  rotulo: string;
  icone?: ReactNode;
}

/**
 * Shell do portal e da mesa: barra lateral leve em cinza, area de trabalho dominante.
 * No celular a barra vira faixa horizontal no topo (layout pela largura da janela).
 */
export function AppShell({
  itens,
  titulo,
  acoes,
  children,
  className,
}: {
  itens: ItemNav[];
  /** Titulo da tela: afirma a conclusao ou nomeia o territorio. */
  titulo?: string;
  /** Acoes da tela (botoes) no canto direito do cabecalho. */
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [local] = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useMotionScan(mainRef, AUTO_APP, true);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [local]);
  // Ativo é o item de href mais longo que casa com a rota: /mesa/fontes acende Fontes, não Resumo (/mesa).
  const casa = (href: string) => local === href || (href !== "/" && local.startsWith(href + "/"));
  const hrefAtivo = itens
    .map(i => i.href)
    .filter(casa)
    .sort((a, b) => b.length - a.length)[0];
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <aside
        className="border-b bg-sidebar md:w-[208px] md:shrink-0 md:border-b-0 md:border-r"
        aria-label="Navegação da área de trabalho"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:py-6">
          <Link href="/">
            <MarcoLogo size={22} />
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {itens.map(i => {
            const ativo = i.href === hrefAtivo;
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-l-2 border-transparent px-3 text-sm transition-colors duration-300",
                  ativo ? "mo-lado-ativo font-medium text-tinta" : "text-sidebar-foreground hover:text-tinta"
                )}
              >
                {i.icone}
                {i.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-4 py-6 md:block">
          <PoweredByPrint />
        </div>
      </aside>
      <div className={cn("flex min-w-0 flex-1 flex-col", className)}>
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-4 py-2 md:px-6">
          <h1 className="text-lg">{titulo}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {acoes}
            <AlternarTema />
          </div>
        </div>
        <main ref={mainRef} className="mo-rota flex-1 px-4 py-6 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
