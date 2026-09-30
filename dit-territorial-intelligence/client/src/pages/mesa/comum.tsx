import { useEffect, useState, type ReactNode } from "react";
import { Redirect, Link } from "wouter";
import { AppShell, LoadingBlock, type ItemNav } from "@/components/dit";
import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import { cn } from "@/lib/utils";

/** Menu da mesa. Contadores entram quando o backend B5 (mesa.resumo) existir. */
export const ITENS_MESA: ItemNav[] = [
  { href: "/mesa", rotulo: "Resumo" },
  { href: "/mesa/publicacao", rotulo: "Publicação" },
  { href: "/mesa/territorios", rotulo: "Territórios" },
  { href: "/mesa/sinais", rotulo: "Sinais" },
  { href: "/mesa/fontes", rotulo: "Fontes" },
  { href: "/mesa/assinantes", rotulo: "Assinantes" },
];

/**
 * Layout e guarda da mesa: sem sessao de operador, vai para /mesa/login
 * (o Dashboard antigo fazia o mesmo com window.location no render).
 * As procedures da mesa sao dashboardProcedure, entao o servidor recusa de qualquer forma.
 */
export function MesaLayout({
  titulo,
  acoes,
  children,
}: {
  titulo: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const { isLoading, isAuthenticated } = useDashboardAuth();
  useEffect(() => {
    document.title = `${titulo} · Mesa DIT`;
  }, [titulo]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-md p-8">
        <LoadingBlock linhas={3} rotulo="Verificando acesso da equipe" />
      </main>
    );
  }
  if (!isAuthenticated) return <Redirect to="/mesa/login" />;

  return (
    <AppShell itens={ITENS_MESA} titulo={titulo} acoes={acoes}>
      {children}
    </AppShell>
  );
}

/** Estilo unico de tabela densa (T13): numero a direita, cabecalho discreto. */
export const TH = "px-3 py-2 text-left text-xs font-medium text-tinta-2";
export const THR = "px-3 py-2 text-right text-xs font-medium text-tinta-2";
export const TD = "px-3 py-2 align-middle";
export const TDR = "num px-3 py-2 text-right align-middle";

export function Tabela({
  legenda,
  children,
  className,
}: {
  legenda: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-x-auto rounded-[6px] border bg-card", className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{legenda}</caption>
        {children}
      </table>
    </div>
  );
}

export function Campo({
  rotulo,
  id,
  children,
}: {
  rotulo: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-tinta-2">
        {rotulo}
      </label>
      {children}
    </div>
  );
}

export const CLASSE_SELECT =
  "min-h-9 rounded-[2px] border border-tinta-2 bg-card px-2 text-sm text-tinta";

export function Seletor({
  id,
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: Array<{ valor: string; rotulo: string }>;
}) {
  return (
    <Campo id={id} rotulo={rotulo}>
      <select id={id} className={CLASSE_SELECT} value={valor} onChange={e => onChange(e.target.value)}>
        {opcoes.map(o => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </Campo>
  );
}

export function LinkAnalise({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <Link href={`/mesa/analise/${slug}`} className="font-medium text-tinta underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

// ─── Formatacao ───────────────────────────────────────────────────────────────

export const NOMES_DIMENSAO: Record<string, string> = {
  D1: "Socioambiental",
  D2: "Socioeconômica",
  D3: "Infraestrutura e Serviços",
  D4: "Dinâmica Territorial",
  D5: "Governança e Articulação",
  D6: "Reputação e Visibilidade",
  D7: "Recursos Naturais e Potencial",
};

export function rotuloDimensao(id: string | null | undefined): string {
  if (!id || id === "GERAL") return "Geral";
  return `${id} ${NOMES_DIMENSAO[id] ?? ""}`.trim();
}

const DATA_CURTA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function fmtQuando(d: Date | string | null | undefined): string {
  if (!d) return "sem registro";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "sem registro";
  return DATA_CURTA.format(dt);
}

export function fmtHa(d: Date | string | null | undefined, agora = Date.now()): string {
  if (!d) return "nunca";
  const ms = agora - new Date(d).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} dias`;
}

export function diasDesde(d: Date | string | null | undefined, agora = Date.now()): number | null {
  if (!d) return null;
  return Math.floor((agora - new Date(d).getTime()) / 86_400_000);
}

/** Dia local como chave (yyyy-mm-dd), para "segurar ate amanha". */
export function hojeChave(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Estado simples persistido em localStorage, com falha silenciosa (modo privado). */
export function useLocalState<T>(chave: string, inicial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const bruto = window.localStorage.getItem(chave);
      return bruto ? (JSON.parse(bruto) as T) : inicial;
    } catch {
      return inicial;
    }
  });
  const set = (novo: T) => {
    setV(novo);
    try {
      window.localStorage.setItem(chave, JSON.stringify(novo));
    } catch {
      /* sem armazenamento: o estado vale so nesta aba */
    }
  };
  return [v, set];
}
