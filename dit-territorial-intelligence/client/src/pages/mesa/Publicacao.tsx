import { useCallback, useEffect, useMemo, useState } from "react";
import { adaptarLeitura } from "@/lib/leitura-adapter";
import { trpc } from "@/lib/trpc";
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  LoadingBlock,
  MarcaFaixa,
  Secao,
  TensaoBar,
  faixaDeTensao,
  fmtDelta,
  fmtInt,
} from "@/components/dit";
import {
  LinkAnalise,
  MesaLayout,
  Tabela,
  TD,
  TDR,
  TH,
  THR,
  fmtHa,
  fmtQuando,
  hojeChave,
  rotuloDimensao,
  useLocalState,
} from "./comum";
import {
  IMPACTO_ALTO,
  LIMITE_DELTA_REVISAO,
  montarFila,
  referenciaDaFila,
  tensaoDe,
  type ItemFila,
} from "./dados";

function nomeFaixa(t: number | null) {
  return t === null ? "não medida" : faixaDeTensao(t).rotulo;
}

/** Dimensoes anterior x proposta, em barras pareadas. Score null e "nao medida", nunca 100. */
function DimensoesPareadas({ item }: { item: ItemFila }) {
  // A fila traz so as dimensoes do rascunho; as da ultima publicacao vem de stt.latest (publico, por slug).
  const anterior = trpc.stt.latest.useQuery(
    { slug: item.slug },
    { enabled: item.raw.ultimaPublicada !== null, staleTime: 60_000, retry: 1 }
  );
  const la = anterior.data ? adaptarLeitura(anterior.data) : null;
  const linhas = item.lp.dimensoes.map(d => {
    const ant = la?.dimensoes.find(x => x.id === d.id) ?? null;
    const atual = d.medida && d.score !== null ? d.score : null;
    const antes = ant && ant.medida && ant.score !== null ? ant.score : null;
    return { id: d.id, nome: d.nome, atual, antes, delta: atual !== null && antes !== null ? atual - antes : null };
  });
  // T06: as que mais mudaram primeiro.
  linhas.sort((a, b) => Math.abs(b.delta ?? -1) - Math.abs(a.delta ?? -1));
  return (
    <div className="relative overflow-x-auto">
      {item.raw.ultimaPublicada !== null && anterior.isError && (
        <p className="nota">Não carregamos as dimensões da última publicação; a coluna anterior fica sem base.</p>
      )}
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Dimensões da tensão: valor publicado anterior e valor proposto</caption>
        <thead>
          <tr>
            <th className={TH}>Dimensão</th>
            <th className={TH}>Anterior e proposto</th>
            <th className={THR}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.id} className="border-t">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {l.nome}
              </th>
              <td className="min-w-[140px] px-3 py-2">
                <div
                  role="img"
                  aria-label={`${l.nome}: anterior ${l.antes === null ? "não medida" : fmtInt(l.antes)}, proposto ${l.atual === null ? "não medida" : fmtInt(l.atual)}`}
                  className="space-y-1"
                >
                  <div className="h-[5px]" style={{ background: "var(--muted)" }}>
                    {l.antes !== null && (
                      <div className="h-full" style={{ width: `${l.antes}%`, background: "var(--curva)" }} />
                    )}
                  </div>
                  <div className="h-[5px]" style={{ background: "var(--muted)" }}>
                    {l.atual !== null && (
                      <div
                        className="h-full"
                        style={{ width: `${l.atual}%`, background: faixaDeTensao(l.atual).cor }}
                      />
                    )}
                  </div>
                </div>
                <p className="nota mt-1">
                  {l.antes === null ? "sem base" : fmtInt(l.antes)} para {l.atual === null ? "não medida" : fmtInt(l.atual)}
                </p>
              </td>
              <td className="num px-3 py-2 text-right">{l.delta === null ? "sem base" : fmtDelta(l.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PainelRevisao({
  item,
  segurada,
  publicando,
  devolvendo,
  erro,
  onPublicar,
  onDevolver,
  onSegurar,
  onSoltar,
}: {
  item: ItemFila;
  segurada: boolean;
  publicando: boolean;
  devolvendo: boolean;
  erro: string | null;
  onPublicar: (nota: string | undefined) => void;
  onDevolver: (motivo: string) => void;
  onSegurar: () => void;
  onSoltar: () => void;
}) {
  const original = item.raw.rascunho.notaExecutiva ?? "";
  const [nota, setNota] = useState(original);
  const [devolvendoAberto, setDevolvendoAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    setNota(item.raw.rascunho.notaExecutiva ?? "");
    setDevolvendoAberto(false);
    setMotivo("");
  }, [item.chave, item.raw.rascunho.notaExecutiva]);

  const editada = nota.trim() !== original.trim();
  const territoryId = item.raw.territoryId;

  // signals.list exige um territoryId do banco; em modo disco (sem MySQL) o id e 0 e nao ha sinais a listar.
  const sinais = trpc.signals.list.useQuery({ territoryId, limit: 50 }, { enabled: territoryId > 0, staleTime: 60_000 });
  const top = useMemo(
    () =>
      [...(sinais.data ?? [])]
        .filter(s => s.curationStatus !== "ignored" && typeof s.llmImpactScore === "number")
        .sort((a, b) => (b.llmImpactScore ?? 0) - (a.llmImpactScore ?? 0))
        .slice(0, 5),
    [sinais.data]
  );
  const altos = (sinais.data ?? []).filter(
    s => s.curationStatus !== "ignored" && (s.llmImpactScore ?? 0) >= IMPACTO_ALTO
  ).length;

  const tp = tensaoDe(item.lp);
  const precisaSegurar = item.dimensoesSemMedida > 0 || (!item.lp.derivada && item.lp.confianca < 60);
  const up = item.raw.ultimaPublicada;
  const dev = item.raw.devolvidoAntes;

  return (
    <aside
      aria-label={`Revisão do STT de ${item.nome}`}
      className="space-y-5 rounded-[6px] border bg-card p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">{item.nome}</h2>
        <span className="nota">Período {item.period}</span>
      </div>
      <LinkAnalise slug={item.slug}>
        <span className="text-sm">Abrir a análise completa</span>
      </LinkAnalise>

      <TensaoBar
        tensao={tp}
        faixa={item.lp.derivada ? undefined : item.lp.faixa}
        confianca={item.lp.derivada ? undefined : item.lp.confianca}
        comparacao={
          item.tensaoUltima !== null ? { valor: item.tensaoUltima, rotulo: "sobre o último publicado" } : undefined
        }
        escala={false}
      />
      {up ? (
        <p className="nota">
          Último publicado: {fmtQuando(up.publishedAt)} por {up.publishedBy}. Cálculo novo gerado {fmtHa(item.raw.rascunho.geradoEm)}
          {item.raw.rascunho.nSinais !== null ? `, com ${fmtInt(item.raw.rascunho.nSinais)} sinais` : ""}.
        </p>
      ) : (
        <p className="nota">Este território ainda não tem STT publicado para comparar.</p>
      )}
      {item.lp.derivada && <p className="nota">O motor não informou a confiança desta linha.</p>}
      {dev && (
        <p className="nota">
          Devolvido ao motor por {dev.por} em {fmtQuando(dev.em)}: {dev.motivo}
        </p>
      )}

      {item.alertas.length > 0 && (
        <div role="note" className="space-y-1 border-l-2 border-acento pl-3 text-sm">
          <p className="font-medium text-tinta">Revise antes de publicar</p>
          <ul className="list-disc pl-4 text-tinta-2">
            {item.alertas.map(a => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {precisaSegurar && (
            <p className="text-tinta-2">Dimensão sem dado ou confiança baixa: considere segurar até amanhã.</p>
          )}
        </div>
      )}

      <section aria-labelledby="dim-titulo" className="space-y-2">
        <h3 id="dim-titulo" className="text-sm font-semibold">
          O que mudou por dimensão
        </h3>
        <DimensoesPareadas item={item} />
      </section>

      <section aria-labelledby="sin-titulo" className="space-y-2">
        <h3 id="sin-titulo" className="text-sm font-semibold">
          Sinais de maior impacto
        </h3>
        {territoryId <= 0 ? (
          <p className="text-sm text-tinta-2">
            O servidor está sem banco de dados, então a lista de sinais deste território não está disponível.
          </p>
        ) : sinais.isLoading ? (
          <LoadingBlock linhas={3} rotulo="Carregando sinais" />
        ) : sinais.isError ? (
          <p className="text-sm text-tinta-2">Não carregamos os sinais deste território. Reabra a linha para tentar de novo.</p>
        ) : top.length === 0 ? (
          <p className="text-sm text-tinta-2">Nenhum sinal com impacto calculado para este território.</p>
        ) : (
          <>
            <p className="nota">
              {altos} {altos === 1 ? "sinal" : "sinais"} com impacto acima de {IMPACTO_ALTO.toLocaleString("pt-BR")}. Os 50
              mais recentes do território, não só os do período.
            </p>
            <ul className="space-y-2">
              {top.map(s => (
                <li key={s.id} className="text-sm">
                  <p className="font-medium text-tinta">{s.title}</p>
                  <p className="nota">
                    {s.source} · {rotuloDimensao(s.relatedIndex)} · impacto{" "}
                    <span className="num">{(s.llmImpactScore ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="nota-titulo" className="space-y-2">
        <h3 id="nota-titulo" className="text-sm font-semibold">
          Nota executiva
        </h3>
        <textarea
          id={`nota-${item.chave}`}
          aria-labelledby="nota-titulo"
          className="min-h-28 w-full rounded-[2px] border border-tinta-2 bg-card p-2 text-sm text-tinta"
          value={nota}
          onChange={e => setNota(e.target.value)}
        />
        {!original && <p className="nota">O motor não gerou nota para este período. Escreva uma ou publique sem nota.</p>}
        {/* TODO backend B5: guardar a nota original e o motivo da edicao. O servidor grava so quem publicou e a nota final. */}
        {editada && <p className="nota">A nota editada aqui é a que vai ao ar, com o seu e-mail como autor da publicação.</p>}
      </section>

      {erro && (
        <p role="alert" className="text-sm text-tinta">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primario" disabled={publicando || devolvendo} onClick={() => onPublicar(editada ? nota.trim() : undefined)}>
          {publicando ? "Publicando" : erro ? "Publicar de novo" : "Publicar"}
        </Button>
        {segurada ? (
          <Button variant="secundario" onClick={onSoltar}>
            Tirar da espera
          </Button>
        ) : (
          <Button variant="secundario" onClick={onSegurar}>
            Segurar até amanhã
          </Button>
        )}
        <Button
          variant="fantasma"
          aria-expanded={devolvendoAberto}
          aria-controls="devolver-form"
          disabled={publicando || devolvendo}
          onClick={() => setDevolvendoAberto(v => !v)}
        >
          Devolver ao motor
        </Button>
      </div>

      {devolvendoAberto && (
        <div id="devolver-form" className="space-y-2 rounded-[6px] border p-3">
          <label htmlFor={`motivo-${item.chave}`} className="text-xs font-medium text-tinta-2">
            Motivo da devolução (mínimo 5 caracteres)
          </label>
          <input
            id={`motivo-${item.chave}`}
            className="min-h-9 w-full rounded-[2px] border border-tinta-2 bg-card px-2 text-sm text-tinta"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex.: fonte de D3 fora do ar, refazer depois da coleta"
          />
          <p className="nota">A linha sai da fila até o motor calcular de novo. Nada vai ao público.</p>
          <div className="flex gap-2">
            <Button
              variant="primario"
              size="sm"
              disabled={devolvendo || motivo.trim().length < 5}
              onClick={() => onDevolver(motivo.trim())}
            >
              {devolvendo ? "Devolvendo" : "Confirmar devolução"}
            </Button>
            <Button variant="fantasma" size="sm" onClick={() => setDevolvendoAberto(false)}>
              Voltar à revisão
            </Button>
          </div>
        </div>
      )}
      <p className="nota">Segurar até amanhã vale só neste navegador; devolver ao motor vale para toda a equipe.</p>
    </aside>
  );
}

export default function MesaPublicacao() {
  const utils = trpc.useUtils();
  const [verDevolvidos, setVerDevolvidos] = useState(false);
  const fila0 = trpc.dashboard.filaPublicacao.useQuery({ incluirDevolvidos: verDevolvidos });
  const assinantes = trpc.dashboard.assinantes.list.useQuery();
  const publicar = trpc.dashboard.publishSttScore.useMutation();
  const devolver = trpc.dashboard.devolverAoMotor.useMutation();

  const fila = useMemo(() => montarFila(fila0.data ?? []), [fila0.data]);
  const [segurar, setSegurar] = useLocalState<Record<string, string>>("mesa-segurar-stt", {});
  const hoje = hojeChave();
  const seguro = (chave: string) => segurar[chave] === hoje;

  const [selId, setSelId] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmaLote, setConfirmaLote] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [emCurso, setEmCurso] = useState<Set<string>>(new Set());

  // Mantem a selecao valida quando a fila muda.
  useEffect(() => {
    if (fila.length === 0) {
      setSelId(null);
      return;
    }
    if (selId === null || !fila.some(i => i.chave === selId)) setSelId(fila[0].chave);
  }, [fila, selId]);

  const mover = useCallback(
    (passo: 1 | -1) => {
      if (fila.length === 0) return;
      const i = fila.findIndex(x => x.chave === selId);
      const prox = Math.min(fila.length - 1, Math.max(0, (i < 0 ? 0 : i) + passo));
      setSelId(fila[prox].chave);
    },
    [fila, selId]
  );

  // Atalho (T09): J proxima, K anterior, fora de campos de texto.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        mover(1);
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        mover(-1);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mover]);

  const sel = fila.find(i => i.chave === selId) ?? null;
  const acima = fila.filter(i => i.delta !== null && Math.abs(i.delta) > LIMITE_DELTA_REVISAO).length;

  function marcarEmCurso(chave: string, ligado: boolean) {
    setEmCurso(s => {
      const n = new Set(s);
      if (ligado) n.add(chave);
      else n.delete(chave);
      return n;
    });
  }

  async function publicarUm(item: ItemFila, nota: string | undefined) {
    marcarEmCurso(item.chave, true);
    setErros(e => {
      const { [item.chave]: _, ...resto } = e;
      return resto;
    });
    try {
      await publicar.mutateAsync({ ...referenciaDaFila(item), ...(nota !== undefined ? { executiveNote: nota } : {}) });
      return true;
    } catch (err) {
      const motivo = err instanceof Error ? err.message : "erro desconhecido";
      setErros(e => ({
        ...e,
        [item.chave]: `Não publicamos o STT de ${item.nome}: ${motivo}. Nada mudou para os assinantes.`,
      }));
      return false;
    } finally {
      marcarEmCurso(item.chave, false);
    }
  }

  async function devolverUm(item: ItemFila, motivo: string) {
    marcarEmCurso(item.chave, true);
    try {
      await devolver.mutateAsync({ ...referenciaDaFila(item), motivo });
      setAviso(`STT de ${item.nome} devolvido ao motor. Ele volta à fila quando o motor calcular de novo.`);
      await depois();
    } catch (err) {
      const m = err instanceof Error ? err.message : "erro desconhecido";
      setErros(e => ({ ...e, [item.chave]: `Não devolvemos o STT de ${item.nome}: ${m}.` }));
    } finally {
      marcarEmCurso(item.chave, false);
    }
  }

  async function depois() {
    await Promise.all([
      utils.dashboard.filaPublicacao.invalidate(),
      utils.stt.latest.invalidate(),
      utils.publicData.territoriosPublicados.invalidate(),
    ]);
  }

  async function publicarSelecionados() {
    const itens = fila.filter(i => marcados.has(i.chave));
    setConfirmaLote(false);
    // Cada linha falha sozinha: o resto continua (fluxo 5.c).
    const resultados = await Promise.all(itens.map(i => publicarUm(i, undefined)));
    const ok = resultados.filter(Boolean).length;
    setMarcados(new Set());
    setAviso(
      ok === itens.length
        ? `${ok} ${ok === 1 ? "STT publicado" : "STT publicados"} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`
        : `${ok} de ${itens.length} publicados. As outras seguem na fila com o motivo ao lado.`
    );
    await depois();
  }

  // Quantos assinantes veem os territorios marcados (contagem por e-mail unico, de assinantes.list).
  const alcance = useMemo(() => {
    if (!assinantes.data) return null;
    const slugs = new Set(fila.filter(i => marcados.has(i.chave)).map(i => i.slug));
    return assinantes.data.assinantes.filter(a => a.territorios.some(t => slugs.has(t))).length;
  }, [assinantes.data, fila, marcados]);

  const elegiveis = fila.filter(i => i.alertas.length === 0 && !seguro(i.chave));
  const titulo = fila0.isLoading
    ? "Fila de publicação"
    : fila.length === 0
      ? "Nenhum STT aguarda publicação"
      : `Revise o que mudou e publique: ${fila.length} ${fila.length === 1 ? "STT aguarda" : "STT aguardam"}, ${acima} com variação acima de ${LIMITE_DELTA_REVISAO} pontos`;

  return (
    <MesaLayout titulo={titulo}>
      <div aria-live="polite" className="sr-only">
        {aviso}
      </div>
      {fila0.isLoading ? (
        <LoadingBlock linhas={6} rotulo="Carregando a fila de publicação" />
      ) : fila0.isError ? (
        <ErrorState
          motivo="Não lemos a fila de publicação."
          proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
          onAcao={() => fila0.refetch()}
        />
      ) : fila.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            titulo={verDevolvidos ? "Nenhum STT pendente, nem devolvido" : "Nenhum STT pendente"}
            descricao="Tudo que o motor calculou já foi publicado. A próxima leitura aparece aqui quando o motor rodar de novo. Abra Fontes para ver quando foi a última coleta."
          />
          {!verDevolvidos && (
            <Button variant="secundario" size="sm" onClick={() => setVerDevolvidos(true)}>
              Mostrar os devolvidos ao motor
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {aviso && (
            <p className="border-l-2 border-acento pl-3 text-sm" role="status">
              {aviso}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="nota">
              Ordenado pela maior variação. Teclas J e K passam para a próxima e a anterior. {elegiveis.length} sem alerta
              de revisão.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="fantasma" size="sm" aria-pressed={verDevolvidos} onClick={() => setVerDevolvidos(v => !v)}>
                {verDevolvidos ? "Ocultar devolvidos" : "Mostrar devolvidos"}
              </Button>
              <Button
                variant="secundario"
                size="sm"
                onClick={() => setMarcados(new Set(elegiveis.map(i => i.chave)))}
                disabled={elegiveis.length === 0}
              >
                Marcar as sem alerta
              </Button>
              <Button variant="primario" size="sm" disabled={marcados.size === 0} onClick={() => setConfirmaLote(true)}>
                Publicar selecionados ({marcados.size})
              </Button>
            </div>
          </div>

          {confirmaLote && (
            <div
              role="alertdialog"
              aria-label="Confirmar publicação em lote"
              className="space-y-3 rounded-[6px] border border-acento p-4"
            >
              <p className="text-sm text-tinta">
                Publicar {marcados.size} STT?{" "}
                {alcance === null
                  ? "Os assinantes com acesso a esses territórios passam a ver o número novo."
                  : alcance === 0
                    ? "Nenhum assinante cadastrado acompanha esses territórios hoje."
                    : `Vai aparecer para ${alcance} ${alcance === 1 ? "assinante" : "assinantes"}.`}
              </p>
              <div className="flex gap-2">
                <Button variant="primario" size="sm" onClick={publicarSelecionados}>
                  Confirmar publicação
                </Button>
                <Button variant="fantasma" size="sm" onClick={() => setConfirmaLote(false)}>
                  Voltar à fila
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Secao
              titulo="STT aguardando publicação"
              nota="Tensão nova contra a última publicada do mesmo território. Clique numa linha para revisar ao lado."
            >
              <Tabela legenda="Fila de publicação, ordenada pela maior variação">
                <thead>
                  <tr>
                    <th className={TH}>
                      <span className="sr-only">Selecionar</span>
                    </th>
                    <th className={TH}>Território</th>
                    <th className={THR}>Proposto</th>
                    <th className={THR}>Publicado</th>
                    <th className={THR}>Δ</th>
                    <th className={TH}>Faixa</th>
                    <th className={THR}>Confiança</th>
                    <th className={TH}>Situação</th>
                    <th className={TH}>Cálculo</th>
                  </tr>
                </thead>
                <tbody>
                  {fila.map(i => {
                    const id = i.chave;
                    const tp = tensaoDe(i.lp);
                    const ta = i.tensaoUltima;
                    const ativo = id === selId;
                    return (
                      <tr
                        key={id}
                        aria-current={ativo ? "true" : undefined}
                        onClick={() => setSelId(id)}
                        className={`cursor-pointer border-t hover:bg-muted ${ativo ? "bg-muted" : ""}`}
                      >
                        <td className={TD} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--acento)]"
                            aria-label={`Selecionar ${i.nome} para publicar`}
                            checked={marcados.has(id)}
                            onChange={e => {
                              const n = new Set(marcados);
                              if (e.target.checked) n.add(id);
                              else n.delete(id);
                              setMarcados(n);
                            }}
                          />
                        </td>
                        <th scope="row" className="px-3 py-2 text-left font-medium">
                          <button type="button" className="min-h-9 text-left hover:underline" onClick={() => setSelId(id)}>
                            {i.nome}
                          </button>
                        </th>
                        <td className={TDR}>{tp === null ? "não medida" : fmtInt(tp)}</td>
                        <td className={TDR}>{ta === null ? "sem base" : fmtInt(ta)}</td>
                        <td className={TDR}>{i.delta === null ? "sem base" : fmtDelta(i.delta)}</td>
                        <td className={TD}>
                          <span className="inline-flex items-center gap-2 text-xs text-tinta-2">
                            {tp !== null && (
                              <span style={{ color: faixaDeTensao(tp).cor }}>
                                <MarcaFaixa nivel={faixaDeTensao(tp).id} />
                              </span>
                            )}
                            {ta !== null ? `${nomeFaixa(ta)} para ${nomeFaixa(tp)}` : nomeFaixa(tp)}
                          </span>
                        </td>
                        <td className={TDR}>{i.lp.derivada ? "não calculada" : `${fmtInt(i.lp.confianca)}%`}</td>
                        <td className={TD}>
                          {i.raw.devolvidoAntes ? (
                            <Chip tom="contorno">Devolvida</Chip>
                          ) : seguro(id) ? (
                            <Chip tom="contorno">Segurada</Chip>
                          ) : i.alertas.length > 0 ? (
                            <Chip tom="acento">Revisar</Chip>
                          ) : (
                            <Chip tom="contorno">Sem alerta</Chip>
                          )}
                          {erros[id] && <span className="nota ml-2">falhou</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-tinta-2">{fmtQuando(i.raw.rascunho.geradoEm)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tabela>
              {/* TODO backend B5: coluna "Sinais >= 0,7 na janela" por linha (a fila so traz o total de sinais). */}
            </Secao>

            {sel && (
              <PainelRevisao
                item={sel}
                segurada={seguro(sel.chave)}
                publicando={emCurso.has(sel.chave) && !devolver.isPending}
                devolvendo={emCurso.has(sel.chave) && devolver.isPending}
                erro={erros[sel.chave] ?? null}
                onSegurar={() => setSegurar({ ...segurar, [sel.chave]: hoje })}
                onSoltar={() => {
                  const { [sel.chave]: _, ...resto } = segurar;
                  setSegurar(resto);
                }}
                onPublicar={async nota => {
                  const ok = await publicarUm(sel, nota);
                  if (ok) {
                    setAviso(`STT de ${sel.nome} publicado.`);
                    await depois();
                  }
                }}
                onDevolver={motivo => void devolverUm(sel, motivo)}
              />
            )}
          </div>
        </div>
      )}
    </MesaLayout>
  );
}
