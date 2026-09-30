import { Fragment, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button, EmptyState, ErrorState, KpiTile, LoadingBlock, Secao, StatusDot, fmtInt } from "@/components/dit";
import { MesaLayout, Seletor, Tabela, TD, TDR, TH, THR, fmtHa, fmtQuando } from "./comum";
import { nomeLegivel, type EstadoFonte, type MotivoFonte } from "./dados";

const ROTULO_MOTIVO: Record<Exclude<MotivoFonte, "ok">, string> = {
  cota_serpapi: "Cota da busca (SerpAPI) esgotada",
  defeito: "Defeito próprio da fonte",
};

const ROTULO_ESTADO: Record<EstadoFonte, string> = { ok: "Ok", muda: "Muda", falhando: "Falhando" };
const STATUS_DOT: Record<EstadoFonte, "ok" | "atencao" | "mudo"> = { ok: "ok", muda: "mudo", falhando: "atencao" };

export default function MesaFontes() {
  const saude = trpc.dashboard.saudeFontes.useQuery(undefined, { refetchInterval: 60_000 });
  const rodar = trpc.scheduler.runNow.useMutation();
  const [estado, setEstado] = useState("todos");
  const [dimensao, setDimensao] = useState("todas");
  const [motivo, setMotivo] = useState("todos");
  const [aberta, setAberta] = useState<string | null>(null);
  const [confirma, setConfirma] = useState(false);

  // O servidor ja entrega ordenado por gravidade (falhando e mudas primeiro).
  const fontes = saude.data?.fontes ?? [];
  const resumo = saude.data?.resumo;
  const dimensoes = useMemo(
    () => Array.from(new Set(fontes.map(f => f.dimensao).filter((d): d is string => Boolean(d)))).sort(),
    [fontes]
  );

  const visiveis = fontes.filter(
    f =>
      (estado === "todos" || f.estado === estado) &&
      (dimensao === "todas" || f.dimensao === dimensao) &&
      (motivo === "todos" || f.motivo === motivo)
  );

  const titulo =
    saude.isLoading || !resumo
      ? "Saúde das fontes"
      : resumo.mudas + resumo.falhando + resumo.ok === 0
        ? "Nenhuma fonte registrou rodada ainda"
        : `${resumo.mudas} ${resumo.mudas === 1 ? "fonte está muda" : "fontes estão mudas"} e ${resumo.falhando} ${resumo.falhando === 1 ? "falha" : "falham"}; ${resumo.ok} ${resumo.ok === 1 ? "está" : "estão"} ok`;

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
      ) : saude.isError || !resumo ? (
        <ErrorState
          motivo="Não lemos o estado das fontes."
          proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
          onAcao={() => saude.refetch()}
        />
      ) : fontes.length === 0 ? (
        <EmptyState
          titulo="Nenhuma rodada registrada ainda"
          descricao="A saúde das fontes nasce da primeira rodada do motor depois desta versão. Rode a coleta para preencher a tabela."
        />
      ) : (
        <div className="space-y-6">
          {saude.data?.cotaSerpapiEsgotada && (
            <p role="status" className="border-l-2 border-acento pl-3 text-sm text-tinta">
              A cota da busca paga (SerpAPI) está esgotada: as fontes que dependem dela ficam mudas até a cota voltar. Isso
              não é defeito das fontes.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiTile rotulo="Fontes mudas" valor={resumo.mudas} unidade={`de ${resumo.total}`} />
            <KpiTile rotulo="Fontes falhando" valor={resumo.falhando} unidade={`de ${resumo.total}`} />
            <KpiTile rotulo="Fontes ok" valor={resumo.ok} unidade={`de ${resumo.total}`} />
          </div>
          <p className="nota">
            Entre as que não estão ok: {resumo.porCota} por cota da busca e {resumo.porDefeito} por defeito próprio. A
            saúde é gravada a cada rodada e guarda os últimos 7 dias; o histórico aparece nas colunas de 7 dias.
          </p>

          <Secao
            titulo="Da mais grave para a menos grave"
            nota="Falhando: o último erro é posterior ao último sucesso. Muda: rodou nos últimos 7 dias e não trouxe nenhum sinal."
          >
            <div className="flex flex-wrap items-end gap-3">
              <Seletor
                id="f-estado"
                rotulo="Estado"
                valor={estado}
                onChange={setEstado}
                opcoes={[
                  { valor: "todos", rotulo: "Todos" },
                  { valor: "muda", rotulo: "Mudas" },
                  { valor: "falhando", rotulo: "Falhando" },
                  { valor: "ok", rotulo: "Ok" },
                ]}
              />
              <Seletor
                id="f-causa"
                rotulo="Causa"
                valor={motivo}
                onChange={setMotivo}
                opcoes={[
                  { valor: "todos", rotulo: "Todas" },
                  { valor: "cota_serpapi", rotulo: ROTULO_MOTIVO.cota_serpapi },
                  { valor: "defeito", rotulo: ROTULO_MOTIVO.defeito },
                ]}
              />
              {dimensoes.length > 0 && (
                <Seletor
                  id="f-dim"
                  rotulo="Dimensão"
                  valor={dimensao}
                  onChange={setDimensao}
                  opcoes={[{ valor: "todas", rotulo: "Todas" }, ...dimensoes.map(d => ({ valor: d, rotulo: d }))]}
                />
              )}
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
                    <th className={TH}>Última rodada</th>
                    <th className={TH}>Último sinal</th>
                    <th className={THR}>Rodadas 7 dias</th>
                    <th className={THR}>Sinais 7 dias</th>
                    <th className={TH}>
                      <span className="sr-only">Detalhe</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(f => {
                    const exp = aberta === f.id;
                    return (
                      <Fragment key={f.id}>
                        <tr className="border-t">
                          <th scope="row" className="px-3 py-2 text-left font-medium">
                            {f.nome || nomeLegivel(f.id)}
                            <span className="nota block font-mono">{f.id}</span>
                          </th>
                          <td className={TD}>{f.dimensao ?? "sem dimensão"}</td>
                          <td className={TD}>
                            <StatusDot status={STATUS_DOT[f.estado]} rotulo={ROTULO_ESTADO[f.estado]} />
                          </td>
                          <td className={`${TD} text-xs text-tinta-2`}>
                            {f.motivo === "ok" ? "" : ROTULO_MOTIVO[f.motivo]}
                          </td>
                          <td className={TD} title={f.ultimaRodada ? fmtQuando(f.ultimaRodada) : undefined}>
                            {fmtHa(f.ultimaRodada)}
                          </td>
                          <td className={TD} title={f.ultimoSinal ? fmtQuando(f.ultimoSinal) : undefined}>
                            {f.ultimoSinal ? fmtHa(f.ultimoSinal) : "nunca trouxe"}
                          </td>
                          <td className={TDR}>
                            {f.rodadas7d === 0
                              ? "sem rodada"
                              : `${fmtInt(f.sucessos7d)} ok, ${fmtInt(f.erros7d)} ${f.erros7d === 1 ? "erro" : "erros"}`}
                          </td>
                          <td className={TDR}>{fmtInt(f.sinais7d)}</td>
                          <td className={TD}>
                            {f.ultimoErroMsg && (
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
                        {exp && f.ultimoErroMsg && (
                          <tr id={`erro-${f.id}`} className="border-t bg-muted">
                            <td colSpan={9} className="px-3 py-3">
                              <p className="text-xs font-medium text-tinta-2">
                                Último erro{f.ultimoErro ? `, ${fmtQuando(f.ultimoErro)}` : ""}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-tinta">
                                {f.ultimoErroMsg}
                              </p>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </Tabela>
            )}
            {/* TODO backend B4: scheduler.runNow escopado a uma fonte, territorios afetados e peso da dimensao na Tensao por fonte. */}
            <p className="nota">
              Uma fonte só aparece aqui depois da primeira rodada em que foi observada. A saúde é por fonte, não por fonte
              e território.
            </p>
          </Secao>
        </div>
      )}
    </MesaLayout>
  );
}
