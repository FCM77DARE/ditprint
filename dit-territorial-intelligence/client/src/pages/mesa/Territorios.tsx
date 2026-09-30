import { useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingBlock,
  MarcaFaixa,
  Secao,
  faixaDeTensao,
  fmtInt,
} from "@/components/dit";
import { adaptarLeitura } from "@/lib/leitura-adapter";
import { MesaLayout, Tabela, TD, TDR, TH, THR, diasDesde, fmtHa, fmtQuando } from "./comum";
import { DIAS_SEM_PUBLICAR, PISO_CONFIANCA, tensaoDe, ultimosPublicados } from "./dados";
import { buttonLinkClass } from "./estilos";

export default function MesaTerritorios() {
  const territorios = trpc.territories.listAll.useQuery();
  const scores = trpc.stt.all.useQuery();
  const assinantes = trpc.dashboard.assinantes.list.useQuery();
  // Uma consulta leve por territorio: ultima coleta. TODO backend B5: incluir no resumo da mesa.
  const coletas = trpc.useQueries(t =>
    (territorios.data ?? []).map(x => t.analytics.collectionSnapshots({ territoryId: x.id, limit: 1 }))
  );

  const porSlug = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assinantes.data?.assinantes ?? []) for (const slug of a.territorios) m.set(slug, (m.get(slug) ?? 0) + 1);
    return m;
  }, [assinantes.data]);

  const publicados = useMemo(() => ultimosPublicados(scores.data ?? []), [scores.data]);

  const linhas = useMemo(() => {
    const agora = Date.now();
    return (territorios.data ?? [])
      .map((t, idx) => {
        const pub = publicados.get(t.id) ?? null;
        const leitura = pub ? adaptarLeitura(pub) : null;
        const ultimaColeta = coletas[idx]?.data?.[0]?.collectedAt ?? null;
        const dias = pub ? diasDesde(pub.publishedAt ?? pub.updatedAt, agora) : null;
        const medidas = leitura ? leitura.dimensoes.filter(d => d.medida && d.score !== null).length : null;
        return { t, pub, leitura, ultimaColeta, dias, medidas, carregandoColeta: coletas[idx]?.isLoading ?? false };
      })
      .sort((a, b) => {
        // Ativos primeiro; dentro deles, quem esta ha mais tempo sem publicar (sem publicacao = pior).
        if (a.t.active !== b.t.active) return a.t.active ? -1 : 1;
        const da = a.dias === null ? Infinity : a.dias;
        const db = b.dias === null ? Infinity : b.dias;
        return db - da;
      });
  }, [territorios.data, publicados, coletas]);

  const ativos = linhas.filter(l => l.t.active);
  const semPublicar = ativos.filter(l => l.dias === null || l.dias > DIAS_SEM_PUBLICAR).length;

  const titulo = territorios.isLoading
    ? "Territórios"
    : `${ativos.length} ${ativos.length === 1 ? "território ativo" : "territórios ativos"}; ${semPublicar} sem publicação há mais de ${DIAS_SEM_PUBLICAR} dias`;

  return (
    <MesaLayout titulo={titulo}>
      {territorios.isLoading || scores.isLoading ? (
        <LoadingBlock linhas={6} rotulo="Carregando territórios" />
      ) : territorios.isError || scores.isError ? (
        <ErrorState
          motivo="Não lemos a lista de territórios."
          proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
          onAcao={() => {
            territorios.refetch();
            scores.refetch();
          }}
        />
      ) : linhas.length === 0 ? (
        <EmptyState
          titulo="Nenhum território cadastrado"
          descricao="Sem território o motor não tem o que medir. O cadastro de território novo ainda é feito pelo painel antigo."
        />
      ) : (
        <Secao
          titulo="Do mais antigo sem publicar para o mais recente"
          nota={`Cobertura é o número de dimensões medidas na última leitura publicada, de 6. Confiança abaixo de ${PISO_CONFIANCA}% pede atenção.`}
        >
          <Tabela legenda="Territórios monitorados">
            <thead>
              <tr>
                <th className={TH}>Território</th>
                <th className={TH}>UF</th>
                <th className={TH}>Situação</th>
                <th className={THR}>Tensão publicada</th>
                <th className={THR}>Confiança</th>
                <th className={THR}>Cobertura</th>
                <th className={THR}>Assinantes</th>
                <th className={TH}>Última publicação</th>
                <th className={TH}>Última coleta</th>
                <th className={TH}>
                  <span className="sr-only">Ação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ t, pub, leitura, ultimaColeta, dias, medidas, carregandoColeta }) => {
                const tp = tensaoDe(leitura);
                return (
                  <tr key={t.id} className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      <Link href={`/mesa/analise/${t.slug}`} className="hover:underline">
                        {t.name}
                      </Link>
                    </th>
                    <td className={TD}>{t.state ?? "sem UF"}</td>
                    <td className={TD}>
                      <Chip tom={t.active ? "neutro" : "contorno"}>{t.active ? "Ativo" : "Pausado"}</Chip>
                    </td>
                    <td className={TDR}>
                      {pub === null ? (
                        <span className="font-body text-xs text-tinta-2">sem publicação</span>
                      ) : tp === null ? (
                        <span className="font-body text-xs text-tinta-2">não medida</span>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-2">
                          <span style={{ color: faixaDeTensao(tp).cor }}>
                            <MarcaFaixa nivel={faixaDeTensao(tp).id} />
                          </span>
                          {fmtInt(tp)}
                        </span>
                      )}
                    </td>
                    <td className={TDR}>
                      {leitura === null || leitura.derivada ? (
                        <span className="font-body text-xs text-tinta-2">não calculada</span>
                      ) : (
                        `${fmtInt(leitura.confianca)}%`
                      )}
                    </td>
                    <td className={TDR}>{medidas === null ? "sem leitura" : `${medidas} de 6`}</td>
                    <td className={TDR}>{assinantes.isError ? "sem dado" : assinantes.isLoading ? "carregando" : porSlug.get(t.slug) ?? 0}</td>
                    <td className={TD}>
                      {pub === null ? (
                        "nunca"
                      ) : (
                        <span title={fmtQuando(pub.publishedAt ?? pub.updatedAt)}>
                          {fmtHa(pub.publishedAt ?? pub.updatedAt)}
                          {dias !== null && dias > DIAS_SEM_PUBLICAR && <span className="nota"> (atrasada)</span>}
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      {carregandoColeta ? "carregando" : ultimaColeta ? fmtHa(ultimaColeta) : "sem coleta"}
                    </td>
                    <td className={TD}>
                      <Link
                        href={`/mesa/analise/${t.slug}`}
                        className={buttonLinkClass("secundario")}
                        aria-label={`Abrir análise de ${t.name}`}
                      >
                        Abrir análise
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        </Secao>
      )}
    </MesaLayout>
  );
}
