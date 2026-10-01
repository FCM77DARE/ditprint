import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { EmptyState, ErrorState, KpiTile, LoadingBlock, Secao, fmtDelta, fmtInt } from "@/components/dit";
import { MesaLayout, diasDesde, fmtHa, fmtQuando } from "./comum";
import { DIAS_SEM_PUBLICAR, LIMITE_DELTA_REVISAO, PISO_CONFIANCA, montarFila } from "./dados";
import { buttonLinkClass } from "./estilos";

interface Pendencia {
  chave: string;
  tipo: "Tensão pendente" | "Fonte" | "Sem publicação" | "Confiança" | "Lead";
  texto: string;
  href: string;
}

interface OpsBudget {
  budget?: {
    resources?: Array<{ resource: string; monthlyUsed: number; monthlyLimit: number; dailyUsed: number; dailyLimit: number }>;
  };
}

/** GET /api/dit/ops: orcamento consumido da busca paga. Falha silenciosa: o KPI mostra "sem dado". */
function useOps() {
  return useQuery<OpsBudget>({
    queryKey: ["dit-ops"],
    queryFn: async () => {
      const r = await fetch("/api/dit/ops", { credentials: "include" });
      if (!r.ok) throw new Error(`ops ${r.status}`);
      return (await r.json()) as OpsBudget;
    },
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
}

export default function MesaResumo() {
  const [, navegar] = useLocation();
  const fila0 = trpc.dashboard.filaPublicacao.useQuery({});
  const saude = trpc.dashboard.saudeFontes.useQuery(undefined, { refetchInterval: 60_000 });
  const leads = trpc.dashboard.leads.list.useQuery({ status: "novo" });
  const territorios = trpc.territories.listAll.useQuery();
  const publicados = trpc.publicData.territoriosPublicados.useQuery();
  const rodada = trpc.scheduler.status.useQuery(undefined, { refetchInterval: 60_000 });
  const ops = useOps();

  const carregando = fila0.isLoading || saude.isLoading || leads.isLoading;
  const erro = fila0.isError || saude.isError || leads.isError;

  const calc = useMemo(() => {
    if (!fila0.data || !saude.data || !leads.data) return null;
    const agora = Date.now();
    const fila = montarFila(fila0.data);
    const fontes = saude.data.fontes;
    const mudas = fontes.filter(f => f.estado === "muda");
    const falhando = fontes.filter(f => f.estado === "falhando");
    const pub = new Map((publicados.data ?? []).map(p => [p.slug, p]));
    const ativos = (territorios.data ?? []).filter(t => t.active);
    const abaixoDoPiso = (publicados.data ?? []).filter(
      p => typeof p.confianca === "number" && p.confianca < PISO_CONFIANCA
    );
    const semPublicar = ativos.filter(t => {
      const p = pub.get(t.slug);
      const d = p ? diasDesde(p.publishedAt, agora) : null;
      return d === null || d > DIAS_SEM_PUBLICAR;
    });

    const pendencias: Pendencia[] = [];
    for (const i of fila.filter(x => x.alertas.length > 0)) {
      pendencias.push({
        chave: `stt-${i.chave}`,
        tipo: "Tensão pendente",
        texto: `${i.nome}: ${i.delta !== null ? `${fmtDelta(i.delta)} ${Math.abs(i.delta) === 1 ? "ponto" : "pontos"}. ` : ""}${i.alertas.join("; ")}.`,
        href: "/mesa/publicacao",
      });
    }
    for (const f of falhando) {
      pendencias.push({
        chave: `falha-${f.id}`,
        tipo: "Fonte",
        texto: `${f.nome || f.id} está falhando${f.motivo === "cota_serpapi" ? " por cota da busca" : ""}: último erro ${fmtHa(f.ultimoErro)}.`,
        href: "/mesa/fontes",
      });
    }
    for (const f of mudas.filter(f => f.horasSemSinal === null || f.horasSemSinal > 48)) {
      pendencias.push({
        chave: `muda-${f.id}`,
        tipo: "Fonte",
        texto: `${f.nome || f.id} está muda${f.motivo === "cota_serpapi" ? " por cota da busca" : ""}: ${f.ultimoSinal ? `último sinal ${fmtHa(f.ultimoSinal)}` : "nunca trouxe sinal"}.`,
        href: "/mesa/fontes",
      });
    }
    for (const p of abaixoDoPiso) {
      pendencias.push({
        chave: `conf-${p.slug}`,
        tipo: "Confiança",
        texto: `${p.nome}: confiança ${fmtInt(p.confianca as number)}%, abaixo de ${PISO_CONFIANCA}%.`,
        href: `/mesa/analise/${p.slug}`,
      });
    }
    for (const t of semPublicar) {
      const p = pub.get(t.slug);
      pendencias.push({
        chave: `terr-${t.id}`,
        tipo: "Sem publicação",
        texto: `${t.name}: ${p ? `última publicação ${fmtHa(p.publishedAt)}` : "nunca teve Tensão publicada"}.`,
        href: `/mesa/analise/${t.slug}`,
      });
    }
    if (leads.data.length > 0) {
      pendencias.push({
        chave: "leads",
        tipo: "Lead",
        texto: `${leads.data.length} ${leads.data.length === 1 ? "contato novo espera" : "contatos novos esperam"} resposta.`,
        href: "/mesa/leads",
      });
    }
    return { fila, mudas, falhando, abaixoDoPiso, semPublicar, pendencias, total: fontes.length };
  }, [fila0.data, saude.data, leads.data, territorios.data, publicados.data]);

  const orcamento = useMemo(() => {
    const r = ops.data?.budget?.resources?.find(x => x.resource === "serpapi");
    if (!r || !r.monthlyLimit) return null;
    return { pct: Math.round((r.monthlyUsed / r.monthlyLimit) * 100), usado: r.monthlyUsed, limite: r.monthlyLimit };
  }, [ops.data]);

  const a = calc?.fila.length ?? 0;
  const b = (calc?.mudas.length ?? 0) + (calc?.falhando.length ?? 0);
  const novos = leads.data?.length ?? 0;
  const partes = [
    a > 0 ? `${a} ${a === 1 ? "Tensão espera" : "Tensões esperam"} publicação` : null,
    b > 0 ? `${b} ${b === 1 ? "fonte pede" : "fontes pedem"} atenção` : null,
    novos > 0 ? `${novos} ${novos === 1 ? "contato espera" : "contatos esperam"} resposta` : null,
  ].filter((x): x is string => x !== null);
  const titulo = !calc
    ? "Hoje na mesa"
    : partes.length === 0
      ? "Tudo publicado, fontes em dia e nenhum contato esperando"
      : partes.length === 1
        ? partes[0].charAt(0).toUpperCase() + partes[0].slice(1)
        : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`.replace(/^./, c => c.toUpperCase());

  return (
    <MesaLayout titulo={titulo}>
      {carregando ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {["Aguardando publicação", "Fontes mudas ou falhando", "Contatos novos", "Orçamento de busca do mês"].map(r => (
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
            fila0.refetch();
            saude.refetch();
            leads.refetch();
          }}
        />
      ) : (
        <div className="space-y-8">
          {/* TODO backend B5: mesa.resumo com as contagens de ontem para a comparacao de cada KPI. */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Link href="/mesa/publicacao" className="block">
              <KpiTile rotulo="Aguardando publicação" valor={a} unidade={a === 1 ? "Tensão" : "Tensões"} />
            </Link>
            <Link href="/mesa/fontes" className="block">
              <KpiTile rotulo="Fontes mudas ou falhando" valor={b} unidade={`de ${calc.total}`} />
            </Link>
            <Link href="/mesa/leads" className="block">
              <KpiTile rotulo="Contatos novos" valor={novos} />
            </Link>
            <KpiTile
              rotulo="Orçamento de busca do mês"
              valor={orcamento ? `${orcamento.pct}%` : null}
              unidade={orcamento ? `${fmtInt(orcamento.usado)} de ${fmtInt(orcamento.limite)} consultas` : undefined}
              carregando={ops.isLoading}
            />
          </div>
          <p className="nota">
            Sem comparação com ontem: o servidor ainda não guarda o histórico dessas contagens.
            {ops.isError ? " Não lemos o consumo da busca paga agora." : ""}
            {calc.abaixoDoPiso.length > 0
              ? ` ${calc.abaixoDoPiso.length} ${calc.abaixoDoPiso.length === 1 ? "território publicado está" : "territórios publicados estão"} abaixo de ${PISO_CONFIANCA}% de confiança.`
              : ""}
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
            nota={`Tensão com alerta de revisão (variação acima de ${LIMITE_DELTA_REVISAO} pontos, troca de faixa, confiança baixa ou dimensão sem medida), fontes falhando ou mudas há mais de 48 h, confiança publicada abaixo de ${PISO_CONFIANCA}%, territórios sem publicação há mais de ${DIAS_SEM_PUBLICAR} dias e leads novos.`}
          >
            {calc.pendencias.length === 0 ? (
              <EmptyState
                titulo="Tudo em dia"
                descricao={
                  a === 0
                    ? "Nenhuma Tensão aguarda, nenhuma fonte falha ou está muda há dois dias e todos os territórios ativos foram publicados há pouco. Acompanhe a próxima rodada acima."
                    : `Há ${a} ${a === 1 ? "Tensão" : "Tensões"} na fila, mas nenhuma com alerta: dá para publicar em lote.`
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
                Publicar {a === 1 ? "a Tensão pendente" : `as ${a} Tensões pendentes`}
              </Link>
            </div>
          )}
        </div>
      )}
    </MesaLayout>
  );
}
