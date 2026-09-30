import { Fragment, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button, EmptyState, ErrorState, KpiTile, LoadingBlock, Secao, StatusDot, fmtInt } from "@/components/dit";
import { MesaLayout, Seletor, Tabela, TD, TDR, TH, THR, fmtHa, fmtQuando } from "./comum";
import { avaliarFonte, ordenarFontes, HORAS_MUDA, type CausaFonte, type EstadoFonte } from "./dados";
import { DIMENSAO_DA_FONTE } from "./fontes-dimensao";

const ROTULO_CAUSA: Record<Exclude<CausaFonte, null>, string> = {
  cota: "Mudo por cota da busca (SerpAPI)",
  defeito: "Defeito próprio da fonte",
  "sem-execucao": "Sem execução desde o reinício do servidor",
};

function fmtLatencia(ms: number): string {
  if (!ms) return "sem medida";
  return ms < 1000 ? `${fmtInt(ms)} ms` : `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}

export default function MesaFontes() {
  const saude = trpc.agentHealth.list.useQuery(undefined, { refetchInterval: 60_000 });
  const rodar = trpc.scheduler.runNow.useMutation();
  const [estado, setEstado] = useState("todos");
  const [dimensao, setDimensao] = useState("todas");
  const [causa, setCausa] = useState("todas");
  const [aberta, setAberta] = useState<string | null>(null);
  const [confirma, setConfirma] = useState(false);

  const fontes = useMemo(
    () => ordenarFontes((saude.data ?? []).map(f => avaliarFonte(f, DIMENSAO_DA_FONTE))),
    [saude.data]
  );
  const cont = useMemo(() => {
    const c: Record<EstadoFonte, number> = { mudo: 0, atencao: 0, ok: 0 };
    for (const f of fontes) c[f.estado]++;
    return c;
  }, [fontes]);
  const porCausa = useMemo(() => {
    const c = { cota: 0, defeito: 0, "sem-execucao": 0 };
    for (const f of fontes) if (f.estado === "mudo" && f.causa) c[f.causa]++;
    return c;
  }, [fontes]);

  const visiveis = fontes.filter(
    f =>
      (estado === "todos" || f.estado === estado) &&
      (dimensao === "todas" || f.dimensao === dimensao) &&
      (causa === "todas" || f.causa === causa)
  );

  const titulo = saude.isLoading
    ? "Saúde das fontes"
    : `${cont.mudo} ${cont.mudo === 1 ? "fonte está muda" : "fontes estão mudas"} há mais de ${HORAS_MUDA} h; ${cont.atencao} em atenção; ${cont.ok} ok`;

  async function coletar() {
    setConfirma(false);
    try {
      await rodar.mutateAsync();
      await saude.refetch();
    } catch {
      /* o estado de erro da mutation aparece abaixo */
    }
  }

  return (
    <MesaLayout
      titulo={titulo}
      acoes={
        <Button variant="secundario" size="sm" onClick={() => setConfirma(true)} disabled={rodar.isPending}>
          {rodar.isPending ? "Coletando" : "Rodar a coleta agora"}
        </Button>
      }
    >
      {confirma && (
        <div role="alertdialog" aria-label="Confirmar coleta" className="mb-4 space-y-3 rounded-[6px] border border-acento p-4">
          <p className="text-sm text-tinta">
            A coleta roda todas as fontes de todos os territórios e consome a cota da busca paga. Rodar agora?
          </p>
          {/* TODO backend B4: scheduler.runNow escopado a uma fonte ("Reexecutar fonte"). Hoje so existe a rodada inteira. */}
          <div className="flex gap-2">
            <Button size="sm" onClick={coletar}>
              Confirmar coleta
            </Button>
            <Button variant="fantasma" size="sm" onClick={() => setConfirma(false)}>
              Voltar às fontes
            </Button>
          </div>
        </div>
      )}
      {rodar.isError && (
        <p role="alert" className="mb-4 text-sm text-tinta">
          A coleta não terminou: {rodar.error.message}. Confira os logs do servidor e tente de novo.
        </p>
      )}
      {rodar.isSuccess && (
        <p role="status" className="mb-4 border-l-2 border-acento pl-3 text-sm">
          Coleta concluída. A tabela abaixo já mostra o estado novo.
        </p>
      )}

      {saude.isLoading ? (
        <LoadingBlock linhas={8} rotulo="Carregando a saúde das fontes" />
      ) : saude.isError ? (
        <ErrorState
          motivo="Não lemos o estado das fontes."
          proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
          onAcao={() => saude.refetch()}
        />
      ) : fontes.length === 0 ? (
        <EmptyState
          titulo="Nenhuma fonte registrada"
          descricao="O motor não devolveu nenhuma fonte. Confira o orquestrador no servidor."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiTile rotulo="Fontes mudas" valor={cont.mudo} unidade={`de ${fontes.length}`} />
            <KpiTile rotulo="Fontes em atenção" valor={cont.atencao} unidade={`de ${fontes.length}`} />
            <KpiTile rotulo="Fontes ok" valor={cont.ok} unidade={`de ${fontes.length}`} />
          </div>
          {/* TODO backend B4: saude persistida por dia. Sem ela, nao ha comparacao com ontem. */}
          <p className="nota">
            Sem comparação com ontem: o servidor guarda a saúde só na memória e zera quando reinicia. Entre as
            mudas: {porCausa.cota} por cota da busca, {porCausa.defeito} por defeito próprio e{" "}
            {porCausa["sem-execucao"]} sem execução desde o reinício.
          </p>

          <Secao titulo="Da mais grave para a menos grave" nota="Muda é a fonte sem execução há mais de 24 h. O último sucesso ainda não é separado da última execução no servidor.">
            <div className="flex flex-wrap items-end gap-3">
              <Seletor
                id="f-estado"
                rotulo="Estado"
                valor={estado}
                onChange={setEstado}
                opcoes={[
                  { valor: "todos", rotulo: "Todos" },
                  { valor: "mudo", rotulo: "Mudas" },
                  { valor: "atencao", rotulo: "Em atenção" },
                  { valor: "ok", rotulo: "Ok" },
                ]}
              />
              <Seletor
                id="f-causa"
                rotulo="Causa"
                valor={causa}
                onChange={setCausa}
                opcoes={[
                  { valor: "todas", rotulo: "Todas" },
                  { valor: "cota", rotulo: ROTULO_CAUSA.cota },
                  { valor: "defeito", rotulo: ROTULO_CAUSA.defeito },
                  { valor: "sem-execucao", rotulo: ROTULO_CAUSA["sem-execucao"] },
                ]}
              />
              <Seletor
                id="f-dim"
                rotulo="Dimensão"
                valor={dimensao}
                onChange={setDimensao}
                opcoes={[
                  { valor: "todas", rotulo: "Todas" },
                  ...["D1", "D2", "D3", "D4", "D5", "D6"].map(d => ({ valor: d, rotulo: d })),
                ]}
              />
            </div>

            {visiveis.length === 0 ? (
              <EmptyState
                titulo="Nenhuma fonte neste filtro"
                descricao="Nada combina com o estado, a causa e a dimensão escolhidos. Afrouxe um dos filtros para ver as outras fontes."
              />
            ) : (
              <Tabela legenda="Saúde das fontes, da mais grave para a menos grave">
                <thead>
                  <tr>
                    <th className={TH}>Fonte</th>
                    <th className={TH}>Dim.</th>
                    <th className={TH}>Estado</th>
                    <th className={TH}>Causa</th>
                    <th className={TH}>Última execução</th>
                    <th className={THR}>Sucesso</th>
                    <th className={THR}>Latência</th>
                    <th className={TH}>
                      <span className="sr-only">Detalhe</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(f => {
                    const exp = aberta === f.id;
                    const total = f.successCount + f.errorCount;
                    return (
                      <Fragment key={f.id}>
                        <tr className="border-t">
                          <th scope="row" className="px-3 py-2 text-left font-medium">
                            {f.nome}
                            <span className="nota block font-mono">{f.id}</span>
                          </th>
                          <td className={TD}>{f.dimensao ?? "sem dimensão"}</td>
                          <td className={TD}>
                            <StatusDot
                              status={f.estado}
                              rotulo={f.estado === "mudo" ? "Muda" : f.estado === "atencao" ? "Atenção" : "Ok"}
                            />
                          </td>
                          <td className={`${TD} text-xs text-tinta-2`}>{f.causa ? ROTULO_CAUSA[f.causa] : ""}</td>
                          <td className={TD} title={fmtQuando(f.lastRunAt)}>
                            {fmtHa(f.lastRunAt)}
                          </td>
                          <td className={TDR}>
                            {total === 0 ? "sem execução" : `${fmtInt(f.successRate * 100)}% de ${fmtInt(total)}`}
                          </td>
                          <td className={TDR}>{fmtLatencia(f.avgLatencyMs)}</td>
                          <td className={TD}>
                            {f.lastError && (
                              <Button
                                variant="fantasma"
                                size="sm"
                                aria-expanded={exp}
                                aria-controls={`erro-${f.id}`}
                                onClick={() => setAberta(exp ? null : f.id)}
                              >
                                {exp ? "Ocultar erro" : "Ver erro"}
                              </Button>
                            )}
                          </td>
                        </tr>
                        {exp && f.lastError && (
                          <tr id={`erro-${f.id}`} className="border-t bg-muted">
                            <td colSpan={8} className="px-3 py-3">
                              <p className="text-xs font-medium text-tinta-2">Último erro, texto completo</p>
                              <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-tinta">
                                {f.lastError}
                              </p>
                              {/* TODO backend B4: territorios afetados e peso da dimensao no STT para esta fonte. */}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </Tabela>
            )}
            <p className="nota">
              A dimensão de cada fonte vem da pasta dela no código. A linha do tempo de coleta das últimas 24 h
              depende do histórico persistido.
            </p>
          </Secao>
        </div>
      )}
    </MesaLayout>
  );
}
