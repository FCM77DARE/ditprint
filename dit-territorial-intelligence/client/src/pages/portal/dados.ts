import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { adaptarLeitura, type LeituraAdaptada } from "@/lib/leitura-adapter";
import { faixaDeTensao } from "@/components/dit";

/**
 * Dados do portal: portal.hoje traz so os territorios do contrato do assinante,
 * com delta de 7 e 30 dias, serie publicada e nota executiva inteira.
 * O id numerico (usado por alertPreferences e alertLog) vem de publicData.territories, por slug.
 */

export interface TerritorioPortal {
  /** Id do territorio no banco; 0 quando o servidor roda sem MySQL (alertas nao existem nesse modo). */
  id: number;
  slug: string;
  nome: string;
  uf: string | null;
  periodo: string | null;
  leitura: LeituraAdaptada;
  /** Variacao em pontos nos ultimos 7 dias; null quando nao ha publicacao com 7 dias ou mais. */
  delta: number | null;
  delta7: number | null;
  delta30: number | null;
  mudouDeFaixa: boolean;
  /** Serie publicada em ordem cronologica. */
  serie: number[];
  nota: string | null;
  notaPeriodo: string | null;
  publicadoEm: string | null;
  publicadoPor: string | null;
}

export interface AlertaPortal {
  id: number;
  territoryId: number;
  slug: string;
  territorio: string;
  titulo: string;
  impacto: number | null;
  dimensao: string | null;
  canal: "email" | "push" | "sse";
  enviadoEm: Date;
  entregue: boolean;
  aberto: boolean;
  erro: string | null;
}

export function useTerritoriosPortal() {
  const lista = trpc.portal.hoje.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    retry: 1,
  });
  const ids = trpc.publicData.territories.useQuery(undefined, { staleTime: 10 * 60 * 1000, retry: 1 });

  const itens = useMemo<TerritorioPortal[]>(() => {
    const idPorSlug = new Map((ids.data ?? []).map(t => [t.slug, t.id ?? 0]));
    const out = (lista.data ?? []).map(b => {
      const leitura = adaptarLeitura({ stt: b.stt, leitura: b.leitura });
      const delta = typeof b.delta7 === "number" ? b.delta7 : null;
      const mudouDeFaixa =
        b.stt !== null && delta !== null && faixaDeTensao(b.stt).id !== faixaDeTensao(b.stt - delta).id;
      const nota = b.notaExecutiva?.trim();
      return {
        id: idPorSlug.get(b.slug) ?? 0,
        slug: b.slug,
        nome: b.nome,
        uf: b.estado ?? null,
        periodo: b.period ?? null,
        leitura,
        delta,
        delta7: delta,
        delta30: typeof b.delta30 === "number" ? b.delta30 : null,
        mudouDeFaixa,
        serie: (b.serie ?? []).map(p => p.valor),
        nota: nota ? nota : null,
        notaPeriodo: b.period ?? null,
        publicadoEm: b.publishedAt ? String(b.publishedAt) : null,
        publicadoPor: b.publishedBy ?? null,
      };
    });
    return out.sort((a, b) => {
      const da = a.delta === null ? -1 : Math.abs(a.delta);
      const db = b.delta === null ? -1 : Math.abs(b.delta);
      return db - da || a.nome.localeCompare(b.nome, "pt-BR");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.dataUpdatedAt, ids.dataUpdatedAt]);

  return {
    itens,
    carregando: lista.isLoading,
    carregandoHistorico: false,
    erro: lista.isError,
    erroHistorico: false,
    recarregar: () => {
      void lista.refetch();
    },
    atualizadoEm: lista.dataUpdatedAt ? new Date(lista.dataUpdatedAt) : null,
  };
}

export function useAlertasPortal(territorios: TerritorioPortal[], limite = 50) {
  const consultas = trpc.useQueries(t =>
    territorios.map(x =>
      t.alertLog.recent({ territoryId: x.id, limit: limite }, { staleTime: 60 * 1000, enabled: x.id > 0, retry: 1 })
    )
  );
  const chave = consultas.map(c => c.dataUpdatedAt).join(",");

  const alertas = useMemo<AlertaPortal[]>(() => {
    const out: AlertaPortal[] = [];
    territorios.forEach((t, i) => {
      for (const r of consultas[i]?.data ?? []) {
        out.push({
          id: r.id,
          territoryId: t.id,
          slug: t.slug,
          territorio: t.nome,
          titulo: r.signalTitle?.trim() || "Resumo do território",
          impacto: r.impactScore ?? null,
          dimensao: r.dimension ?? null,
          canal: r.channel,
          enviadoEm: new Date(r.sentAt),
          entregue: r.delivered,
          aberto: r.opened,
          erro: r.errorMessage ?? null,
        });
      }
    });
    return out.sort((a, b) => b.enviadoEm.getTime() - a.enviadoEm.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territorios.map(t => t.id).join(","), chave]);

  return {
    alertas,
    carregando: consultas.some(c => c.isLoading),
    erro: consultas.some(c => c.isError),
    recarregar: () => consultas.forEach(c => void c.refetch()),
  };
}

export const NOME_DIMENSAO: Record<string, string> = {
  D1: "Socioambiental",
  D2: "Socioeconômica",
  D3: "Infraestrutura",
  D4: "Dinâmica territorial",
  D5: "Governança",
  D6: "Reputação",
  D7: "Dimensão 7",
  GERAL: "Geral",
};

export const NOME_CANAL: Record<string, string> = {
  email: "E-mail",
  push: "Push",
  sse: "Painel ao vivo",
};

/** Rotulo textual do impacto (0 a 1). Corte de 0,7 = limite de alerta imediato do Radar. */
export function rotuloImpacto(v: number | null): string {
  if (v === null) return "Sem impacto medido";
  if (v >= 0.9) return "Imediato, crítico";
  if (v >= 0.7) return "Imediato";
  if (v >= 0.5) return "Relevante";
  return "Moderado";
}

export function fmtImpacto(v: number | null): string {
  return v === null ? "sem dado" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDataHora(d: Date): string {
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Barra de 0 a 1 para o impacto (comprimento a partir do zero). */
export function pctImpacto(v: number | null): number {
  return v === null ? 0 : Math.max(0, Math.min(100, v * 100));
}
