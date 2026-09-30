import { trpc } from "@/lib/trpc";
import { Chip, EmptyState, ErrorState, LoadingBlock, Secao } from "@/components/dit";
import { MesaLayout, Tabela, TD, TH, fmtQuando } from "./comum";

const ROTULO_PLANO: Record<string, string> = {
  free_alert: "Alerta gratuito",
  radar: "Radar",
  dit: "Diagnóstico",
};

export default function MesaAssinantes() {
  const lista = trpc.subscribers.list.useQuery();
  const n = lista.data?.length ?? 0;
  const ativos = (lista.data ?? []).filter(s => s.active).length;

  const titulo = lista.isLoading
    ? "Assinantes"
    : n === 0
      ? "Nenhum assinante cadastrado ainda"
      : `${ativos} ${ativos === 1 ? "assinante ativo" : "assinantes ativos"} de ${n} cadastrados`;

  return (
    <MesaLayout titulo={titulo}>
      <div className="space-y-8">
        {/* TODO backend B2: tabela subscriber_territories (vinculo assinante x territorio) e subscribers.vincular. */}
        {/* TODO backend B6: leads.list/updateStatus para os pedidos de diagnostico e a acao "Convidar ao portal". */}
        <EmptyState
          titulo="O vínculo entre assinante e território ainda não existe"
          descricao="Hoje o cadastro guarda só o território de interesse que a pessoa escreveu, sem ligar o assinante ao território que ele pode ver no portal. Por isso aqui não dá para vincular territórios, convidar ao portal nem contar quem verá cada STT publicado. Isso entra com o vínculo no servidor (item B2)."
        />

        <Secao
          titulo="Cadastros que existem hoje"
          nota="Território de interesse é o que a pessoa declarou ao se cadastrar; não controla acesso a nada."
        >
          {lista.isLoading ? (
            <LoadingBlock linhas={5} rotulo="Carregando assinantes" />
          ) : lista.isError ? (
            <ErrorState
              motivo="Não lemos a lista de assinantes."
              proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
              onAcao={() => lista.refetch()}
            />
          ) : n === 0 ? (
            <EmptyState
              titulo="Nenhum cadastro ainda"
              descricao="Quando alguém se cadastrar no Radar, o nome aparece aqui com plano e território de interesse."
            />
          ) : (
            <Tabela legenda="Assinantes cadastrados">
              <thead>
                <tr>
                  <th className={TH}>Nome</th>
                  <th className={TH}>Empresa</th>
                  <th className={TH}>Plano</th>
                  <th className={TH}>Território de interesse</th>
                  <th className={TH}>Situação</th>
                  <th className={TH}>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {lista.data!.map(s => (
                  <tr key={s.id} className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {s.name}
                      <span className="nota block">{s.email}</span>
                    </th>
                    <td className={TD}>{s.company ?? "sem empresa"}</td>
                    <td className={TD}>{ROTULO_PLANO[s.plan] ?? s.plan}</td>
                    <td className={TD}>{s.territoryInterest ?? "não informado"}</td>
                    <td className={TD}>
                      <Chip tom={s.active ? "neutro" : "contorno"}>{s.active ? "Ativo" : "Inativo"}</Chip>
                    </td>
                    <td className={`${TD} text-xs text-tinta-2`}>{fmtQuando(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Secao>
      </div>
    </MesaLayout>
  );
}
