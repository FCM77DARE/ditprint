import { useMemo } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Chip,
  DimensoesTable,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Secao,
  Sparkline,
  TensaoBar,
  fmtDelta,
  fmtInt,
  faixaDeTensao,
} from "@/components/dit";
import { adaptarLeitura } from "@/lib/leitura-adapter";
import { MesaLayout, Tabela, TD, TDR, TH, THR, fmtQuando, rotuloDimensao } from "./comum";
import { IMPACTO_ALTO, tensaoDe } from "./dados";
import { buttonLinkClass } from "./estilos";

export default function MesaAnalise() {
  const [, params] = useRoute("/mesa/analise/:slug");
  const slug = params?.slug ?? "";

  const territorio = trpc.territories.bySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  const id = territorio.data?.id;
  const historico = trpc.stt.history.useQuery({ territoryId: id ?? 0, limit: 12 }, { enabled: id !== undefined });
  const sinais = trpc.signals.list.useQuery({ territoryId: id ?? 0, limit: 100 }, { enabled: id !== undefined });
  const exportar = trpc.onepager.generate.useMutation();

  const linhas = useMemo(
    () => [...(historico.data ?? [])].sort((a, b) => b.period.localeCompare(a.period)),
    [historico.data]
  );
  const atual = linhas[0] ?? null;
  const anterior = linhas[1] ?? null;
  const la = atual ? adaptarLeitura(atual) : null;
  const lant = anterior ? adaptarLeitura(anterior) : null;
  const ta = tensaoDe(la);
  const tant = tensaoDe(lant);
  const delta = ta !== null && tant !== null ? ta - tant : null;

  const porDimensao = useMemo(() => {
    if (!la) return [];
    return la.dimensoes
      .map(d => {
        const antes = lant?.dimensoes.find(x => x.id === d.id) ?? null;
        const v = d.medida && d.score !== null ? d.score : null;
        const va = antes && antes.medida && antes.score !== null ? antes.score : null;
        return { id: d.id, nome: d.nome, v, va, d: v !== null && va !== null ? v - va : null };
      })
      .sort((x, y) => Math.abs(y.d ?? -1) - Math.abs(x.d ?? -1));
  }, [la, lant]);

  const pesaram = useMemo(
    () =>
      [...(sinais.data ?? [])]
        .filter(s => s.curationStatus !== "ignored" && typeof s.llmImpactScore === "number")
        .sort((a, b) => (b.llmImpactScore ?? 0) - (a.llmImpactScore ?? 0)),
    [sinais.data]
  );
  const altos = pesaram.filter(s => (s.llmImpactScore ?? 0) >= IMPACTO_ALTO).length;

  const serie = useMemo(
    () =>
      [...linhas]
        .reverse()
        .map(r => tensaoDe(adaptarLeitura(r)))
        .filter((v): v is number => v !== null),
    [linhas]
  );

  const puxadaPor =
    porDimensao.find(x => x.d !== null && x.d !== 0) ??
    [...porDimensao].sort((x, y) => (y.v ?? -1) - (x.v ?? -1)).find(x => x.v !== null) ??
    null;

  const nome = territorio.data?.name ?? "Análise do território";
  const titulo =
    !territorio.data || historico.isLoading
      ? nome
      : ta === null
        ? `${nome}: tensão ainda não medida`
        : `${nome}: tensão ${fmtInt(ta)}${delta !== null ? `, ${fmtDelta(delta)} sobre o período anterior` : ""}${puxadaPor ? `, ${delta !== null ? "puxada por" : "maior valor em"} ${puxadaPor.nome}` : ""}${altos > 0 ? `; ${altos} ${altos === 1 ? "sinal pesou" : "sinais pesaram"}` : ""}`;

  return (
    <MesaLayout
      titulo={titulo}
      acoes={
        <>
          <Link href="/mesa/territorios" className={buttonLinkClass("fantasma", "sm")}>
            Voltar aos territórios
          </Link>
          {territorio.data && (
            <Button
              size="sm"
              disabled={exportar.isPending || !atual}
              onClick={() => exportar.mutate({ territorySlug: slug })}
            >
              {exportar.isPending ? "Gerando" : "Exportar leitura"}
            </Button>
          )}
        </>
      }
    >
      {territorio.isLoading ? (
        <LoadingBlock linhas={6} rotulo="Carregando o território" />
      ) : territorio.isError ? (
        <ErrorState
          motivo="Não carregamos este território."
          proximoPasso="Tente de novo; se repetir, volte à lista de territórios e abra de lá."
          onAcao={() => territorio.refetch()}
        />
      ) : !territorio.data ? (
        <EmptyState
          titulo="Território não encontrado"
          descricao={`Não existe território com o endereço "${slug}". Volte à lista e escolha um da tabela.`}
        />
      ) : historico.isLoading ? (
        <LoadingBlock linhas={6} rotulo="Carregando a leitura" />
      ) : historico.isError ? (
        <ErrorState
          motivo="Não lemos o histórico deste território."
          proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
          onAcao={() => historico.refetch()}
        />
      ) : !atual || !la ? (
        <EmptyState
          titulo="Nenhuma leitura calculada"
          descricao="O motor ainda não gerou STT para este território. Colete os sinais em Sinais e aguarde a próxima rodada."
        />
      ) : (
        <div className="space-y-8">
          {exportar.isError && (
            <p role="alert" className="text-sm">
              Não geramos a leitura: {exportar.error.message}. Tente de novo em alguns minutos.
            </p>
          )}
          {exportar.data && (
            <Secao titulo="Leitura exportada" nota={`One-pager de ${exportar.data.territory}, período ${exportar.data.period}, ${exportar.data.signalCount} sinais considerados.`}>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-[6px] border bg-card p-4 text-sm text-tinta">
                {exportar.data.content}
              </pre>
              <Button
                variant="secundario"
                size="sm"
                onClick={() => navigator.clipboard?.writeText(exportar.data?.content ?? "")}
              >
                Copiar o texto
              </Button>
            </Secao>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Secao
              titulo={`Período ${atual.period}`}
              nota={
                la.derivada
                  ? "Confiança e faixa ainda não vieram do motor para esta leitura."
                  : "Faixa cinza é o intervalo plausível; a confiança é a cobertura das dimensões medidas."
              }
            >
              <div className="flex flex-wrap gap-2">
                <Chip tom={atual.published ? "neutro" : "acento"}>
                  {atual.published ? "Publicado" : "Rascunho, não publicado"}
                </Chip>
                {atual.scenario && <Chip tom="contorno">Cenário {atual.scenario}</Chip>}
              </div>
              <TensaoBar
                tensao={ta}
                faixa={la.derivada ? undefined : la.faixa}
                confianca={la.derivada ? undefined : la.confianca}
                comparacao={
                  tant !== null ? { valor: tant, rotulo: `sobre ${anterior?.period}` } : undefined
                }
              />
              {!anterior && (
                <p className="nota">Só há {linhas.length} período: a comparação aparece quando houver o segundo.</p>
              )}
            </Secao>

            <Secao
              titulo="Tensão ao longo dos períodos"
              nota={`${linhas.length} ${linhas.length === 1 ? "período" : "períodos"} com leitura. Último ponto em bronze.`}
            >
              <Sparkline valores={serie} largura={360} altura={64} rotulo="Tensão por período" />
              <Tabela legenda="Histórico de tensão por período">
                <thead>
                  <tr>
                    <th className={TH}>Período</th>
                    <th className={THR}>Tensão</th>
                    <th className={TH}>Faixa</th>
                    <th className={TH}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(r => {
                    const t = tensaoDe(adaptarLeitura(r));
                    return (
                      <tr key={r.id} className="border-t">
                        <th scope="row" className="px-3 py-2 text-left font-medium num">
                          {r.period}
                        </th>
                        <td className={TDR}>{t === null ? "não medida" : fmtInt(t)}</td>
                        <td className={TD}>{t === null ? "" : faixaDeTensao(t).rotulo}</td>
                        <td className={TD}>{r.published ? "Publicado" : "Rascunho"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tabela>
            </Secao>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Secao
              titulo="As seis dimensões, da maior tensão para a menor"
              nota="Dimensão não medida fica sem barra e não entra como 100. Peso e fonte vêm do motor."
            >
              <DimensoesTable dimensoes={la.dimensoes} />
              {la.derivada && <p className="nota">Pesos ainda não vieram do motor para esta leitura.</p>}
            </Secao>

            <Secao
              titulo={anterior ? `O que mudou desde ${anterior.period}` : "O que mudou"}
              nota="Diferença em pontos de cada dimensão. Comparações de 7 e 30 dias dependem do histórico diário, que o servidor ainda não guarda."
            >
              {/* TODO backend B3: delta7, delta30 e contribuicao de cada dimensao ao STT vindos do servidor. */}
              {!anterior ? (
                <EmptyState
                  titulo="Sem período anterior"
                  descricao="Só existe uma leitura deste território. A comparação por dimensão aparece na próxima rodada."
                />
              ) : (
                <Tabela legenda="Variação de cada dimensão sobre o período anterior">
                  <thead>
                    <tr>
                      <th className={TH}>Dimensão</th>
                      <th className={THR}>Antes</th>
                      <th className={THR}>Agora</th>
                      <th className={THR}>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porDimensao.map(x => (
                      <tr key={x.id} className="border-t">
                        <th scope="row" className="px-3 py-2 text-left font-medium">
                          {x.nome}
                        </th>
                        <td className={TDR}>{x.va === null ? "não medida" : fmtInt(x.va)}</td>
                        <td className={TDR}>{x.v === null ? "não medida" : fmtInt(x.v)}</td>
                        <td className={TDR}>{x.d === null ? "sem base" : fmtDelta(x.d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
            </Secao>
          </div>

          <Secao
            titulo={
              altos === 0
                ? "Nenhum sinal com impacto alto neste território"
                : `${altos} ${altos === 1 ? "sinal pesou" : "sinais pesaram"} com impacto acima de ${IMPACTO_ALTO.toLocaleString("pt-BR")}`
            }
            nota="Os 100 sinais mais recentes, do maior impacto para o menor. Mostra os 15 primeiros."
          >
            {sinais.isLoading ? (
              <LoadingBlock linhas={5} rotulo="Carregando sinais" />
            ) : sinais.isError ? (
              <ErrorState
                motivo="Não lemos os sinais deste território."
                proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
                onAcao={() => sinais.refetch()}
              />
            ) : pesaram.length === 0 ? (
              <EmptyState
                titulo="Nenhum sinal com impacto calculado"
                descricao="O motor ainda não calculou impacto para os sinais deste território. Use Coletar agora na tela Sinais."
              />
            ) : (
              <Tabela legenda="Sinais que mais pesaram na leitura">
                <thead>
                  <tr>
                    <th className={TH}>Sinal</th>
                    <th className={TH}>Dimensão</th>
                    <th className={TH}>Procedência</th>
                    <th className={THR}>Impacto</th>
                    <th className={TH}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {pesaram.slice(0, 15).map(s => (
                    <tr key={s.id} className="border-t">
                      <th scope="row" className="max-w-[420px] px-3 py-2 text-left font-medium">
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noreferrer noopener" className="hover:underline">
                            {s.title}
                          </a>
                        ) : (
                          s.title
                        )}
                      </th>
                      <td className={TD}>{rotuloDimensao(s.relatedIndex ?? s.llmSuggestedIndex)}</td>
                      <td className={`${TD} text-xs text-tinta-2`}>{s.source}</td>
                      <td className={TDR}>
                        {(s.llmImpactScore ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`${TD} text-xs text-tinta-2`}>{fmtQuando(s.publishedAt ?? s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </Secao>

          <Secao titulo="Justificativa do cálculo" nota="Texto gerado pelo motor para o período mais recente.">
            {atual.executiveNote ? (
              <p className="max-w-prose whitespace-pre-wrap text-sm text-tinta">{atual.executiveNote}</p>
            ) : (
              <EmptyState
                titulo="O motor não escreveu justificativa para este período"
                descricao="Sem a nota, o número não tem explicação para o assinante. Segure a publicação ou escreva a nota na fila de Publicação."
              />
            )}
          </Secao>
          {/* TODO backend: comparacao com territorio irmao (seletor) depende de mesa.comparar; nao ha procedure. */}
        </div>
      )}
    </MesaLayout>
  );
}
