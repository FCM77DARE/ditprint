import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Chip, EmptyState, ErrorState, KpiTile, LoadingBlock } from "@/components/dit";
import { CLASSE_SELECT, MesaLayout, Seletor, Tabela, TD, TH, fmtHa, fmtQuando } from "./comum";

type Status = "novo" | "em_contato" | "proposta" | "ganho" | "perdido";

const STATUS: Array<{ valor: Status; rotulo: string }> = [
  { valor: "novo", rotulo: "Novo" },
  { valor: "em_contato", rotulo: "Em contato" },
  { valor: "proposta", rotulo: "Proposta" },
  { valor: "ganho", rotulo: "Ganho" },
  { valor: "perdido", rotulo: "Perdido" },
];

const MOMENTO: Record<string, string> = { entrar: "Entrar", operar: "Operar", responder: "Responder" };

const CAMPO_NOTA =
  "min-h-9 w-full min-w-[12rem] rounded-[2px] border border-tinta-2 bg-card px-2 text-sm text-tinta placeholder:text-tinta-2";

export default function MesaLeads() {
  const utils = trpc.useUtils();
  const [filtro, setFiltro] = useState<string>("todos");
  const q = trpc.dashboard.leads.list.useQuery(filtro === "todos" ? {} : { status: filtro as Status });
  const todos = trpc.dashboard.leads.list.useQuery({});
  const atualizar = trpc.dashboard.leads.updateStatus.useMutation();
  const [notas, setNotas] = useState<Record<string, string>>({});

  const novos = (todos.data ?? []).filter(l => l.status === "novo").length;
  const emAndamento = (todos.data ?? []).filter(l => l.status === "em_contato" || l.status === "proposta").length;
  const total = todos.data?.length ?? 0;

  const titulo = todos.isLoading
    ? "Leads"
    : total === 0
      ? "Nenhum lead ainda"
      : novos > 0
        ? `${novos} ${novos === 1 ? "lead novo espera" : "leads novos esperam"} resposta`
        : `${total} ${total === 1 ? "lead" : "leads"}, nenhum novo`;

  async function salvar(id: string, status: Status, notaInterna?: string) {
    try {
      await atualizar.mutateAsync({ id, status, notaInterna });
      await Promise.all([utils.dashboard.leads.list.invalidate()]);
      toast.success("Lead atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não atualizamos o lead. Tente de novo.");
    }
  }

  return (
    <MesaLayout titulo={titulo}>
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiTile rotulo="Leads novos" valor={todos.isLoading ? null : novos} carregando={todos.isLoading} />
          <KpiTile rotulo="Em contato ou proposta" valor={todos.isLoading ? null : emAndamento} carregando={todos.isLoading} />
          <KpiTile rotulo="Total de leads" valor={todos.isLoading ? null : total} carregando={todos.isLoading} />
        </div>

        <Seletor
          id="leads-status"
          rotulo="Status"
          valor={filtro}
          onChange={setFiltro}
          opcoes={[{ valor: "todos", rotulo: "Todos" }, ...STATUS]}
        />

        {q.isLoading ? (
          <LoadingBlock linhas={6} rotulo="Carregando leads" />
        ) : q.isError ? (
          <ErrorState
            motivo="Não lemos os leads."
            proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
            onAcao={() => q.refetch()}
          />
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            titulo={filtro === "todos" ? "Nenhum lead ainda" : "Nenhum lead com este status"}
            descricao={
              filtro === "todos"
                ? "Pedidos feitos em /diagnostico aparecem aqui, com território, momento e decisão."
                : "Troque o filtro de status para ver os outros."
            }
          />
        ) : (
          <Tabela legenda="Leads do diagnóstico e do Marco Radar">
            <thead>
              <tr>
                <th className={TH}>Quem</th>
                <th className={TH}>Território</th>
                <th className={TH}>Momento</th>
                <th className={TH}>Decisão e observação</th>
                <th className={TH}>Chegou</th>
                <th className={TH}>Status</th>
                <th className={TH}>Nota interna</th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map(l => {
                const notaAtual = notas[l.id] ?? l.notaInterna ?? "";
                return (
                  <tr key={l.id} className="border-t align-top">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {l.nome || l.email}
                      {l.empresa ? <span className="nota block">{l.empresa}</span> : null}
                      <a href={`mailto:${l.email}`} className="nota block underline underline-offset-2">
                        {l.email}
                      </a>
                    </th>
                    <td className={TD}>{l.territorio || <span className="text-tinta-2">não informado</span>}</td>
                    <td className={TD}>
                      {l.momento ? <Chip tom="neutro">{MOMENTO[l.momento] ?? l.momento}</Chip> : "não informado"}
                    </td>
                    <td className={`${TD} max-w-[24rem]`}>
                      {l.decisao ? <p>{l.decisao}</p> : <p className="text-tinta-2">sem decisão descrita</p>}
                      {l.observacao ? <p className="nota">{l.observacao}</p> : null}
                      {l.reenvios > 0 ? (
                        <p className="nota">Reenviou {l.reenvios} {l.reenvios === 1 ? "vez" : "vezes"}.</p>
                      ) : null}
                    </td>
                    <td className={`${TD} text-xs text-tinta-2`}>
                      {fmtQuando(new Date(l.criadoEm))}
                      <span className="block">{fmtHa(new Date(l.criadoEm))}</span>
                    </td>
                    <td className={TD}>
                      <select
                        aria-label={`Status de ${l.nome || l.email}`}
                        className={CLASSE_SELECT}
                        value={l.status}
                        disabled={atualizar.isPending}
                        onChange={e => void salvar(l.id, e.target.value as Status, notaAtual || undefined)}
                      >
                        {STATUS.map(s => (
                          <option key={s.valor} value={s.valor}>
                            {s.rotulo}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={TD}>
                      <input
                        aria-label={`Nota interna sobre ${l.nome || l.email}`}
                        className={CAMPO_NOTA}
                        value={notaAtual}
                        placeholder="Anote o próximo passo"
                        onChange={e => setNotas(n => ({ ...n, [l.id]: e.target.value }))}
                        onBlur={() => {
                          if (notaAtual !== (l.notaInterna ?? "")) void salvar(l.id, l.status as Status, notaAtual);
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        )}
      </div>
    </MesaLayout>
  );
}
