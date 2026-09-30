import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button, Chip, EmptyState, ErrorState, LoadingBlock, Secao } from "@/components/dit";
import {
  MesaLayout,
  Seletor,
  Tabela,
  TD,
  TDR,
  TH,
  THR,
  fmtQuando,
  rotuloDimensao,
} from "./comum";
import { IMPACTO_ALTO, type SinalRow } from "./dados";

type StatusSinal = SinalRow["curationStatus"];

const ROTULO_STATUS: Record<StatusSinal, string> = {
  pending: "A curar",
  relevant: "Verificado",
  analyzed: "Verificado e analisado",
  ignored: "Rejeitado",
};

const fmtImpacto = (v: number | null) =>
  v === null ? "sem cálculo" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MesaSinais() {
  const utils = trpc.useUtils();
  const territorios = trpc.territories.listAll.useQuery();
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("todos");
  const [dim, setDim] = useState("todas");
  const [impacto, setImpacto] = useState("todos");
  const [fonte, setFonte] = useState("todas");
  const [selId, setSelId] = useState<number | null>(null);
  const [confirmaColeta, setConfirmaColeta] = useState(false);

  useEffect(() => {
    if (!slug && territorios.data && territorios.data.length > 0) setSlug(territorios.data[0].slug);
  }, [territorios.data, slug]);

  const territorio = territorios.data?.find(t => t.slug === slug) ?? null;
  const lista = trpc.signals.list.useQuery(
    { territoryId: territorio?.id ?? 0, limit: 200 },
    { enabled: Boolean(territorio) }
  );
  const curar = trpc.signals.curate.useMutation({
    onSuccess: () => utils.signals.list.invalidate(),
  });
  const coletar = trpc.signals.collect.useMutation({
    onSuccess: () => utils.signals.list.invalidate(),
  });

  const fontes = useMemo(
    () => Array.from(new Set((lista.data ?? []).map(s => s.source))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [lista.data]
  );

  const linhas = useMemo(() => {
    return (lista.data ?? [])
      .filter(s => {
        if (status === "pendentes" && s.curationStatus !== "pending") return false;
        if (status === "verificados" && s.curationStatus !== "relevant" && s.curationStatus !== "analyzed") return false;
        if (status === "rejeitados" && s.curationStatus !== "ignored") return false;
        const d = s.relatedIndex ?? s.llmSuggestedIndex ?? "GERAL";
        if (dim !== "todas" && d !== dim) return false;
        if (impacto !== "todos" && (s.llmImpactScore ?? -1) < Number(impacto)) return false;
        if (fonte !== "todas" && s.source !== fonte) return false;
        return true;
      })
      .sort((a, b) => (b.llmImpactScore ?? -1) - (a.llmImpactScore ?? -1));
  }, [lista.data, status, dim, impacto, fonte]);

  const aCurar = (lista.data ?? []).filter(s => s.curationStatus === "pending").length;
  const altos = (lista.data ?? []).filter(
    s => s.curationStatus === "pending" && (s.llmImpactScore ?? 0) >= IMPACTO_ALTO
  ).length;
  const sel = linhas.find(s => s.id === selId) ?? null;

  const titulo = !territorio
    ? "Sinais"
    : lista.isLoading
      ? `Sinais de ${territorio.name}`
      : (lista.data ?? []).length === 0
        ? `Nenhum sinal coletado em ${territorio.name}`
        : aCurar === 0
        ? `Nada a curar em ${territorio.name}`
        : `${aCurar} ${aCurar === 1 ? "sinal espera" : "sinais esperam"} curadoria em ${territorio.name}; ${altos} com impacto acima de ${IMPACTO_ALTO.toLocaleString("pt-BR")}`;

  return (
    <MesaLayout
      titulo={titulo}
      acoes={
        territorio && (
          <Button
            variant="secundario"
            size="sm"
            disabled={coletar.isPending}
            onClick={() => setConfirmaColeta(true)}
          >
            {coletar.isPending ? "Coletando" : "Coletar agora"}
          </Button>
        )
      }
    >
      {/* TODO backend B5: lista de sinais entre todos os territorios (hoje signals.list exige um territoryId). */}
      {confirmaColeta && territorio && (
        <div role="alertdialog" aria-label="Confirmar coleta de sinais" className="mb-4 space-y-3 rounded-[6px] border border-acento p-4">
          <p className="text-sm text-tinta">
            Coletar sinais novos de {territorio.name} usa a busca paga e avisa o responsável por e-mail. Coletar agora?
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setConfirmaColeta(false);
                coletar.mutate({ territorySlug: territorio.slug });
              }}
            >
              Confirmar coleta
            </Button>
            <Button variant="fantasma" size="sm" onClick={() => setConfirmaColeta(false)}>
              Voltar aos sinais
            </Button>
          </div>
        </div>
      )}
      {coletar.isError && (
        <p role="alert" className="mb-4 text-sm">
          A coleta não terminou: {coletar.error.message}. Tente de novo em alguns minutos.
        </p>
      )}
      {coletar.isSuccess && (
        <p role="status" className="mb-4 border-l-2 border-acento pl-3 text-sm">
          Coleta concluída para {territorio?.name}. Os sinais novos já estão na lista.
        </p>
      )}

      {territorios.isLoading ? (
        <LoadingBlock linhas={6} rotulo="Carregando territórios" />
      ) : territorios.isError ? (
        <ErrorState
          motivo="Não lemos a lista de territórios."
          proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
          onAcao={() => territorios.refetch()}
        />
      ) : !territorio ? (
        <EmptyState
          titulo="Nenhum território cadastrado"
          descricao="Sem território não há sinal para curar. Cadastre o primeiro território para o motor começar a coletar."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Seletor
              id="s-terr"
              rotulo="Território"
              valor={slug}
              onChange={v => {
                setSlug(v);
                setSelId(null);
                setFonte("todas");
              }}
              opcoes={(territorios.data ?? []).map(t => ({ valor: t.slug, rotulo: t.name }))}
            />
            <Seletor
              id="s-status"
              rotulo="Situação"
              valor={status}
              onChange={setStatus}
              opcoes={[
                { valor: "todos", rotulo: "Todos" },
                { valor: "pendentes", rotulo: "A curar" },
                { valor: "verificados", rotulo: "Verificados" },
                { valor: "rejeitados", rotulo: "Rejeitados" },
              ]}
            />
            <Seletor
              id="s-dim"
              rotulo="Dimensão"
              valor={dim}
              onChange={setDim}
              opcoes={[
                { valor: "todas", rotulo: "Todas" },
                ...["D1", "D2", "D3", "D4", "D5", "D6"].map(d => ({ valor: d, rotulo: rotuloDimensao(d) })),
                { valor: "GERAL", rotulo: "Geral" },
              ]}
            />
            <Seletor
              id="s-imp"
              rotulo="Impacto"
              valor={impacto}
              onChange={setImpacto}
              opcoes={[
                { valor: "todos", rotulo: "Qualquer" },
                { valor: "0.5", rotulo: "0,5 ou mais" },
                { valor: String(IMPACTO_ALTO), rotulo: `${IMPACTO_ALTO.toLocaleString("pt-BR")} ou mais` },
              ]}
            />
            <Seletor
              id="s-fonte"
              rotulo="Procedência"
              valor={fonte}
              onChange={setFonte}
              opcoes={[{ valor: "todas", rotulo: "Todas" }, ...fontes.map(f => ({ valor: f, rotulo: f }))]}
            />
          </div>

          {lista.isLoading ? (
            <LoadingBlock linhas={8} rotulo="Carregando sinais" />
          ) : lista.isError ? (
            <ErrorState
              motivo="Não lemos os sinais deste território."
              proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
              onAcao={() => lista.refetch()}
            />
          ) : linhas.length === 0 ? (
            <EmptyState
              titulo={(lista.data ?? []).length === 0 ? "Nenhum sinal coletado" : "Nenhum sinal neste filtro"}
              descricao={
                (lista.data ?? []).length === 0
                  ? `O motor ainda não coletou sinais de ${territorio.name}. Use Coletar agora para a primeira coleta.`
                  : "Nada combina com os filtros escolhidos. Afrouxe um deles para ver os outros sinais."
              }
            />
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <Secao
                titulo={`${linhas.length} ${linhas.length === 1 ? "sinal" : "sinais"} por impacto`}
                nota={`Até os 200 mais recentes do território, do maior impacto para o menor. ${linhas.length !== (lista.data ?? []).length ? `Filtro mostra ${linhas.length} de ${(lista.data ?? []).length}.` : ""}`}
              >
                <Tabela legenda="Sinais do território, ordenados pelo impacto">
                  <thead>
                    <tr>
                      <th className={TH}>Sinal</th>
                      <th className={TH}>Dimensão</th>
                      <th className={TH}>Procedência</th>
                      <th className={THR}>Impacto</th>
                      <th className={TH}>Data</th>
                      <th className={TH}>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(s => (
                      <tr
                        key={s.id}
                        aria-current={s.id === selId ? "true" : undefined}
                        className={`cursor-pointer border-t hover:bg-muted ${s.id === selId ? "bg-muted" : ""}`}
                        onClick={() => setSelId(s.id)}
                      >
                        <th scope="row" className="max-w-[360px] px-3 py-2 text-left font-medium">
                          <button type="button" className="min-h-9 text-left hover:underline" onClick={() => setSelId(s.id)}>
                            {s.title}
                          </button>
                        </th>
                        <td className={TD}>{s.relatedIndex ?? s.llmSuggestedIndex ?? "Geral"}</td>
                        <td className={`${TD} text-xs text-tinta-2`}>{s.source}</td>
                        <td className={TDR}>{fmtImpacto(s.llmImpactScore)}</td>
                        <td className={`${TD} text-xs text-tinta-2`}>{fmtQuando(s.publishedAt ?? s.createdAt)}</td>
                        <td className={TD}>
                          <Chip tom={s.curationStatus === "pending" ? "acento" : "contorno"}>
                            {ROTULO_STATUS[s.curationStatus]}
                          </Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              </Secao>

              {sel ? (
                <aside
                  aria-label="Detalhe do sinal"
                  className="space-y-4 rounded-[6px] border bg-card p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
                >
                  <h2 className="text-lg">{sel.title}</h2>
                  <p className="nota">
                    {sel.source} · {rotuloDimensao(sel.relatedIndex ?? sel.llmSuggestedIndex)} · impacto{" "}
                    <span className="num">{fmtImpacto(sel.llmImpactScore)}</span>
                    {sel.publishedAt ? ` · publicado em ${fmtQuando(sel.publishedAt)}` : ""}
                  </p>
                  {sel.summary && <p className="text-sm text-tinta">{sel.summary}</p>}
                  {sel.llmAnalysis && (
                    <div>
                      <p className="text-xs font-medium text-tinta-2">Por que pesa, segundo o motor</p>
                      <p className="mt-1 text-sm text-tinta">{sel.llmAnalysis}</p>
                    </div>
                  )}
                  {sel.curationNote && (
                    <div>
                      <p className="text-xs font-medium text-tinta-2">Nota da curadoria</p>
                      <p className="mt-1 text-sm text-tinta">{sel.curationNote}</p>
                    </div>
                  )}
                  {sel.url && (
                    <a
                      href={sel.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-block break-all text-sm text-acento-texto underline"
                    >
                      Abrir a fonte original
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={curar.isPending || sel.curationStatus === "relevant"}
                      onClick={() => curar.mutate({ signalId: sel.id, status: "relevant" })}
                    >
                      Aprovar sinal
                    </Button>
                    <Button
                      variant="secundario"
                      disabled={curar.isPending || sel.curationStatus === "ignored"}
                      onClick={() => curar.mutate({ signalId: sel.id, status: "ignored" })}
                    >
                      Descartar sinal
                    </Button>
                    {/* TODO backend B5: Reclassificar (trocar a dimensao do sinal); nao ha procedure para isso. */}
                  </div>
                  {curar.isError && (
                    <p role="alert" className="text-sm">
                      Não gravamos a curadoria: {curar.error.message}. Nada mudou neste sinal.
                    </p>
                  )}
                  <p className="nota">
                    Situação hoje: {ROTULO_STATUS[sel.curationStatus]}. Reclassificar a dimensão depende de uma função
                    do servidor que ainda não existe.
                  </p>
                </aside>
              ) : (
                <p className="nota">Clique num sinal para ver o resumo, a análise do motor e a fonte.</p>
              )}
            </div>
          )}
        </div>
      )}
    </MesaLayout>
  );
}
