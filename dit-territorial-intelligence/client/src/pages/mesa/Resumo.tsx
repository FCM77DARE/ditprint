import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { adaptarLeitura } from "@/lib/leitura-adapter";
import { trpc } from "@/lib/trpc";
import { EmptyState, ErrorState, KpiTile, LoadingBlock, Secao, fmtDelta } from "@/components/dit";
import { MesaLayout, diasDesde, fmtHa, fmtQuando } from "./comum";
import {
  DIAS_SEM_PUBLICAR,
  LIMITE_DELTA_REVISAO,
  PISO_CONFIANCA,
  avaliarFonte,
  montarFila,
  ultimosPublicados,
} from "./dados";
import { DIMENSAO_DA_FONTE } from "./fontes-dimensao";
import { buttonLinkClass } from "./estilos";

interface Pendencia {
  chave: string;
  tipo: "STT pendente" | "Fonte muda" | "Sem publicação";
  texto: string;
  href: string;
}

export default function MesaResumo() {
  const [, navegar] = useLocation();
  const scores = trpc.stt.all.useQuery();
  const fontes = trpc.agentHealth.list.useQuery(undefined, { refetchInterval: 60_000 });
  const territorios = trpc.territories.listAll.useQuery();
  const rodada = trpc.scheduler.status.useQuery(undefined, { refetchInterval: 60_000 });

  const carregando = scores.isLoading || fontes.isLoading || territorios.isLoading;
  const erro = scores.isError || fontes.isError || territorios.isError;

  const calc = useMemo(() => {
    if (!scores.data || !fontes.data || !territorios.data) return null;
    const agora = Date.now();
    const fila = montarFila(scores.data);
    const avaliadas = fontes.data.map(f => avaliarFonte(f, DIMENSAO_DA_FONTE, agora));
    const mudas = avaliadas.filter(f => f.estado === "mudo");
    const nomes = new Map(territorios.data.map(t => [t.id, t]));
    const ativos = territorios.data.filter(t => t.active);
    const pub = ultimosPublicados(scores.data);
    const abaixoDoPiso = ativos.filter(t => {
      const p = pub.get(t.id);
      if (!p) return false; // sem leitura publicada entra em "sem publicacao", nao aqui
      const l = adaptarLeitura(p);
      return !l.derivada && l.confianca < PISO_CONFIANCA;
    });
    const semPublicar = ativos.filter(t => {
      const p = pub.get(t.id);
      const d = p ? diasDesde(p.publishedAt ?? p.updatedAt, agora) : null;
      return d === null || d > DIAS_SEM_PUBLICAR;
    });

    const pendencias: Pendencia[] = [];
    for (const i of fila.filter(x => x.alertas.length > 0)) {
      const t = nomes.get(i.pendente.territoryId);
      pendencias.push({
        chave: `stt-${i.pendente.id}`,
        tipo: "STT pendente",
        texto: `${t?.name ?? "Território"}: ${i.delta !== null ? `${fmtDelta(i.delta)} ${Math.abs(i.delta) === 1 ? "ponto" : "pontos"}. ` : ""}${i.alertas.join("; ")}.`,
        href: "/mesa/publicacao",
      });
    }
    for (const f of mudas.filter(f => !f.lastRunAt || agora - f.lastRunAt.getTime() > 48 * 3_600_000)) {
      pendencias.push({
        chave: `fonte-${f.id}`,
        tipo: "Fonte muda",
        texto: `${f.nome}${f.dimensao ? ` (${f.dimensao})` : ""}: ${f.lastRunAt ? `última execução ${fmtHa(f.lastRunAt)}` : "sem execução desde o reinício do servidor"}.`,
        href: "/mesa/fontes",
      });
    }
    for (const t of semPublicar) {
      const p = pub.get(t.id);
      pendencias.push({
        chave: `terr-${t.id}`,
        tipo: "Sem publicação",
        texto: `${t.name}: ${p ? `última publicação ${fmtHa(p.publishedAt ?? p.updatedAt)}` : "nunca teve STT publicado"}.`,
        href: `/mesa/analise/${t.slug}`,
      });
    }
    return { fila, mudas, avaliadas, abaixoDoPiso, semPublicar, pendencias };
  }, [scores.data, fontes.data, territorios.data]);

  const a = calc?.fila.length ?? 0;
  const b = calc?.mudas.length ?? 0;
  const titulo = !calc
    ? "Hoje na mesa"
    : a === 0 && b === 0
      ? "Tudo publicado e as fontes estão em dia"
      : `Faltam ${a} STT para publicar e ${b} ${b === 1 ? "fonte muda" : "fontes mudas"}; o resto está em dia`;

  return (
    <MesaLayout titulo={titulo}>
      {carregando ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {["Aguardando publicação", "Fontes mudas", "Abaixo do piso de confiança", "Orçamento consumido"].map(r => (
              <KpiTile key={r} rotulo={r} valor={null} carregando />
            ))}
          </div>
          <LoadingBlock linhas={4} rotulo="Carregando a mesa" />
        </div>
      ) : erro || !calc ? (
        <ErrorState
          motivo="Não carregamos a mesa."
          proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar e se a sessão da equipe ainda vale."
          onAcao={() => {
            scores.refetch();
            fontes.refetch();
            territorios.refetch();
          }}
        />
      ) : (
        <div className="space-y-8">
          {/* TODO backend B5: mesa.resumo com os mesmos numeros de ontem para a comparacao de cada KPI. */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Link href="/mesa/publicacao" className="block">
              <KpiTile rotulo="Aguardando publicação" valor={a} unidade="STT" />
            </Link>
            <Link href="/mesa/fontes" className="block">
              <KpiTile
                rotulo="Fontes mudas há mais de 24 h"
                valor={b}
                unidade={`de ${calc.avaliadas.length}`}
              />
            </Link>
            <Link href="/mesa/territorios" className="block">
              <KpiTile
                rotulo={`Territórios abaixo de ${PISO_CONFIANCA}% de confiança`}
                valor={calc.abaixoDoPiso.length}
                unidade={`de ${territorios.data?.filter(t => t.active).length ?? 0} ativos`}
              />
            </Link>
            {/* TODO backend: GET /api/dit/ops (orcamento de busca consumido) nao existe em server/routes. */}
            <KpiTile rotulo="Orçamento de busca consumido" valor={null} />
          </div>
          <p className="nota">
            Sem comparação com ontem: o servidor ainda não guarda o histórico dessas contagens. O orçamento
            consumido aparece quando o servidor expuser o consumo da busca paga.
          </p>

          <Secao
            titulo="Próxima rodada do motor"
            nota="Vem do agendador do servidor."
          >
            {rodada.isError ? (
              <p className="text-sm text-tinta-2">Não lemos o agendador. Recarregue a mesa para tentar de novo.</p>
            ) : rodada.data ? (
              <p className="text-sm text-tinta">
                {rodada.data.active
                  ? rodada.data.nextRunAt
                    ? `Próxima rodada ${fmtQuando(rodada.data.nextRunAt)}.`
                    : "Agendador ligado, sem horário definido."
                  : "Agendador desligado: o motor só roda quando alguém dispara a coleta."}{" "}
                {rodada.data.isRunning
                  ? "Uma rodada está em andamento."
                  : rodada.data.lastRunAt
                    ? `Última rodada ${fmtHa(rodada.data.lastRunAt)}.`
                    : "Nenhuma rodada desde o reinício do servidor."}
              </p>
            ) : (
              <LoadingBlock linhas={1} rotulo="Carregando agendador" />
            )}
          </Secao>

          <Secao
            titulo={calc.pendencias.length === 0 ? "Nada exige você agora" : "Exige você"}
            nota={`STT com alerta de revisão (variação acima de ${LIMITE_DELTA_REVISAO} pontos, troca de faixa, confiança baixa ou dimensão sem medida), fontes mudas há mais de 48 h e territórios sem publicação há mais de ${DIAS_SEM_PUBLICAR} dias.`}
          >
            {calc.pendencias.length === 0 ? (
              <EmptyState
                titulo="Tudo em dia"
                descricao={
                  a === 0
                    ? "Nenhum STT aguarda, nenhuma fonte está muda há dois dias e todos os territórios ativos foram publicados há pouco. Acompanhe a próxima rodada acima."
                    : `Há ${a} STT na fila, mas nenhum com alerta: dá para publicar em lote.`
                }
                acao={a > 0 ? "Abrir a fila" : undefined}
                onAcao={a > 0 ? () => navegar("/mesa/publicacao") : undefined}
              />
            ) : (
              <ul className="divide-y rounded-[6px] border bg-card">
                {calc.pendencias.slice(0, 8).map(p => (
                  <li key={p.chave}>
                    <Link
                      href={p.href}
                      className="flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-sm hover:bg-muted"
                    >
                      <span className="w-28 shrink-0 text-xs font-medium text-tinta-2">{p.tipo}</span>
                      <span className="text-tinta">{p.texto}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {calc.pendencias.length > 8 && (
              <p className="nota">Mostrando 8 de {calc.pendencias.length}. Abra Publicação, Fontes e Territórios para ver o resto.</p>
            )}
          </Secao>

          {a > 0 && (
            <div>
              <Link href="/mesa/publicacao" className={buttonLinkClass("primario", "md")}>
                Publicar os {a} STT pendentes
              </Link>
            </div>
          )}
        </div>
      )}
    </MesaLayout>
  );
}
