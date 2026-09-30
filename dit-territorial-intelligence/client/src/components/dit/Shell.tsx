import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { DitLogo, PoweredByPrint } from "./Marca";
import { Button, botaoVariants } from "./Button";

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
  { href: "/radar", rotulo: "Radar" },
  { href: "/entrar", rotulo: "Entrar" },
];

/** Shell das paginas publicas: header com DitLogo e nav, footer com PoweredByPrint. */
export function PageShell({
  children,
  hero = false,
  className,
}: {
  children: ReactNode;
  /** true aplica as curvas de nivel ao fundo de toda a pagina (so para o hero publico). */
  hero?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-screen flex-col bg-background text-foreground", className)}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2"
      >
        Ir para o conteúdo
      </a>
      <header className="border-b bg-background">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <Link href="/" aria-label="DIT, página inicial">
            <DitLogo comDescricao />
          </Link>
          <nav aria-label="Principal" className="flex flex-wrap items-center gap-1">
            {/* Em telas largas os links ficam na linha; abaixo de 768px vão para o menu compacto. */}
            {NAV_PUBLICO.map(i => (
              <a
                key={i.href}
                href={i.href}
                className="hidden min-h-11 items-center px-3 text-sm text-tinta-2 hover:text-tinta md:inline-flex"
              >
                {i.rotulo}
              </a>
            ))}
            <details className="group relative md:hidden">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center px-3 text-sm text-tinta-2 hover:text-tinta [&::-webkit-details-marker]:hidden">
                Menu
              </summary>
              <div className="absolute left-0 top-full z-40 mt-1 flex w-56 flex-col rounded-[6px] border bg-card p-1">
                {NAV_PUBLICO.map(i => (
                  <a
                    key={i.href}
                    href={i.href}
                    className="inline-flex min-h-11 items-center px-3 text-sm text-tinta hover:bg-muted"
                  >
                    {i.rotulo}
                  </a>
                ))}
              </div>
            </details>
            <a href="/diagnostico" className={cn(botaoVariants({ variant: "primario", size: "md" }))}>
              Pedir diagnóstico
            </a>
            <AlternarTema />
          </nav>
        </div>
      </header>
      <main id="conteudo" className={cn("flex-1", hero && "bg-curvas")}>
        {children}
      </main>
      <footer className="border-t">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-6">
          <DitLogo size={20} />
          <PoweredByPrint />
        </div>
      </footer>
    </div>
  );
}

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
            <DitLogo size={22} />
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
                  "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-l-2 px-3 text-sm",
                  ativo
                    ? "border-acento font-medium text-tinta"
                    : "border-transparent text-sidebar-foreground hover:text-tinta"
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
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
