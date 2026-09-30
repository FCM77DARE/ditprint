import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Bell, CalendarDays, LogOut, UserRound } from "lucide-react";
import { AppShell, Button, EmptyState, botaoVariants, type ItemNav } from "@/components/dit";
import { cn } from "@/lib/utils";
import { usePortalSessao } from "./usePortalSessao";

const ITENS: ItemNav[] = [
  { href: "/portal", rotulo: "Hoje", icone: <CalendarDays size={16} aria-hidden /> },
  { href: "/portal/alertas", rotulo: "Alertas", icone: <Bell size={16} aria-hidden /> },
  { href: "/portal/conta", rotulo: "Conta", icone: <UserRound size={16} aria-hidden /> },
];

/** Casca das 4 telas do portal: AppShell com Hoje, Alertas e Conta, e o gate de sessao. */
export function PortalFrame({
  titulo,
  acoes,
  children,
}: {
  titulo: string;
  acoes?: ReactNode;
  children: (email: string) => ReactNode;
}) {
  const { email, sair } = usePortalSessao();
  const [, navegar] = useLocation();

  return (
    <AppShell
      itens={ITENS}
      titulo={email ? titulo : "Entre com o link de acesso"}
      acoes={
        email ? (
          <>
            {acoes}
            <span className="hidden max-w-[220px] truncate text-sm text-tinta-2 md:inline" title={email}>
              {email}
            </span>
            <Button variant="fantasma" size="sm" onClick={sair}>
              <LogOut size={16} aria-hidden />
              Sair
            </Button>
          </>
        ) : undefined
      }
    >
      {email ? (
        children(email)
      ) : (
        <EmptyState
          titulo="Entre com o link de acesso"
          descricao="O Radar mostra só os territórios do seu contrato. Peça o link de acesso por e-mail para abrir o portal."
          acao="Pedir link de acesso"
          onAcao={() => navegar("/entrar")}
        />
      )}
    </AppShell>
  );
}

/** Link com cara de botao (evita <a><button>). */
export function LinkBotao({
  href,
  children,
  variant = "secundario",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primario" | "secundario" | "fantasma";
  className?: string;
}) {
  return (
    <Link href={href} className={cn(botaoVariants({ variant, size: "md" }), className)}>
      {children}
    </Link>
  );
}
