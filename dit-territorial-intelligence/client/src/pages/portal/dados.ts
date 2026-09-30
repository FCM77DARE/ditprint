import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { adaptarLeitura, type LeituraAdaptada } from "@/lib/leitura-adapter";
import { faixaDeTensao } from "@/components/dit";

/**
 * Dados do portal, compostos com as procedures que existem hoje.
 *
 * TODO backend B2: todas as listas abaixo trazem TODOS os territorios ativos, nao
 * so os do assinante (falta a tabela subscriber_territories).
 * TODO backend B1: publicData.territories le index_history, nao stt_scores.published;
 * ate o gate de publicacao, "publicado" aqui e aproximado.
 * TODO backend B3: portal.hoje e portal.territorio devolveriam delta 7d/30d,
 * dimensao que mais moveu e sinais do assinante. Hoje o delta e o de publicData
 * (contra a leitura anterior do mesmo territorio, em geral mensal).
 */

export interface TerritorioPortal {
  id: number;
  slug: string;
  nome: string;
  uf: string | null;
  periodo: string | null;
  leitura: LeituraAdaptada;
  /** Variacao em pontos contra a leitura anterior; null quando nao ha base. */
  delta: number | null;
  mudouDeFaixa: boolean;
  /** Serie publicada em ordem cronologica. */
  serie: number[];
  nota: string | null;
  notaPeriodo: string | null;
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
  const lista = trpc.publicData.territories.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
  const base = lista.data ?? [];
  const historicos = trpc.useQueries(t =>
    base.map(b => t.territories.history({ slug: b.slug, limit: 12 }, { staleTime: 5 * 60 * 1000 }))
  );

  const historicoErro = historicos.some(h => h.isError);
  const historicoCarregando = historicos.some(h => h.isLoading);
  const chaveHist = historicos.map(h => h.dataUpdatedAt).join(",");

  const itens = useMemo<TerritorioPortal[]>(() => {
    const out = base.map((b, i) => {
      const rows = historicos[i]?.data ?? [];
      const leitura = adaptarLeitura({ stt: b.stt, leitura: b.leitura });
      const delta = typeof b.sttDelta === "number" ? b.sttDelta : null;
      const mudouDeFaixa =
        b.stt !== null && delta !== null && faixaDeTensao(b.stt).id !== faixaDeTensao(b.stt - delta).id;
      const comNota = rows.find(r => r.executiveNote && r.executiveNote.trim().length > 0);
      return {
        id: b.id,
        slug: b.slug,
        nome: b.name,
        uf: b.state,
        periodo: b.period,
        leitura,
        delta,
        mudouDeFaixa,
        serie: [...rows].reverse().map(r => r.stt),
        nota: comNota?.executiveNote?.trim() ?? null,
        notaPeriodo: comNota?.period ?? null,
      };
    });
    return out.sort((a, b) => {
      const da = a.delta === null ? -1 : Math.abs(a.delta);
      const db = b.delta === null ? -1 : Math.abs(b.delta);
      return db - da || a.nome.localeCompare(b.nome, "pt-BR");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.dataUpdatedAt, chaveHist]);

  return {
    itens,
    carregando: lista.isLoading,
    carregandoHistorico: historicoCarregando,
    erro: lista.isError,
    erroHistorico: historicoErro,
    recarregar: () => {
      void lista.refetch();
    },
    atualizadoEm: lista.dataUpdatedAt ? new Date(lista.dataUpdatedAt) : null,
  };
}

export function useAlertasPortal(territorios: TerritorioPortal[], limite = 50) {
  const consultas = trpc.useQueries(t =>
    territorios.map(x => t.alertLog.recent({ territoryId: x.id, limit: limite }, { staleTime: 60 * 1000 }))
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
