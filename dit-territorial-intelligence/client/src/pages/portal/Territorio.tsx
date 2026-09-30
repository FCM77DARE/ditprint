import { useLocation, useParams } from "wouter";
import {
  DimensoesTable,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Secao,
  Sparkline,
  TensaoBar,
} from "@/components/dit";
import { trpc } from "@/lib/trpc";
import { LinkBotao, PortalFrame } from "./PortalFrame";
import {
  NOME_DIMENSAO,
  fmtDataHora,
  useAlertasPortal,
  useTerritoriosPortal,
  type TerritorioPortal,
} from "./dados";
import { ImpactoBarra, fmtDelta1 } from "./pecas";

/** Dimensao que mais pesa: maior score entre as medidas. null se nenhuma foi medida. */
function dimensaoQuePesa(t: TerritorioPortal): string | null {
  const medidas = t.leitura.dimensoes.filter(d => d.medida && d.score !== null);
  if (medidas.length === 0) return null;
  return [...medidas].sort((a, b) => (b.score as number) - (a.score as number))[0].nome;
}

function fraseTerritorio(t: TerritorioPortal): string {
  if (t.leitura.tensao === null) {
    return `${t.nome}: a tensão ainda não foi medida.`;
  }
  const tensao = Math.round(t.leitura.tensao);
  const var_ = t.delta === null ? "sem leitura anterior para comparar" : `${fmtDelta1(t.delta)} pontos contra a leitura anterior`;
  const pesa = dimensaoQuePesa(t);
  return `${t.nome}: tensão ${tensao}, ${var_}${pesa ? `; o que mais pesa é ${pesa}` : ""}.`;
}

function tituloHistorico(serie: number[]): string {
  if (serie.length < 2) return "O histórico ainda não tem leituras suficientes para mostrar tendência";
  const d = serie[serie.length - 1] - serie[0];
  const pts = Math.abs(Math.round(d));
  const n = serie.length;
  if (pts === 0) return `A tensão ficou estável em ${n} leituras`;
  return `A tensão ${d > 0 ? "subiu" : "caiu"} ${pts} ${pts === 1 ? "ponto" : "pontos"} em ${n} leituras`;
}

export default function PortalTerritorio() {
  return (
    <PortalFrame titulo="Leitura do território">
      {() => <ConteudoTerritorio />}
    </PortalFrame>
  );
}

function ConteudoTerritorio() {
  const { slug } = useParams<{ slug: string }>();
  const [, navegar] = useLocation();
  const { itens, carregando, erro, recarregar } = useTerritoriosPortal();
  const territorio = itens.find(t => t.slug === slug);
  const { alertas } = useAlertasPortal(territorio ? [territorio] : [], 10);

  // TODO backend B3: portal.territorio({slug}) devolve sinais verificados do territorio com fonte,
  // data e impacto. Ate la, a unica fonte e a amostra publica (poucos sinais, sem URL).
  const sinais = trpc.publicData.sampleSignals.useQuery({ limit: 6 }, { staleTime: 5 * 60 * 1000 });
  const sinaisDoTerritorio = (sinais.data ?? []).filter(s => territorio && s.territory === territorio.nome);

  if (carregando) {
    return (
      <div className="space-y-6">
        <p className="font-display text-2xl text-tinta-2">Carregando a leitura...</p>
        <LoadingBlock linhas={5} rotulo="Carregando a leitura do território" />
      </div>
    );
  }
  if (erro) {
    return (
      <ErrorState
        motivo="Não carregamos este território."
        proximoPasso="Tente de novo; se continuar, fale com o time PRINT."
        onAcao={recarregar}
      />
    );
  }
  if (!territorio) {
    return (
      <EmptyState
        titulo="Este território não está no seu Radar."
        descricao="O endereço não corresponde a nenhum território do seu contrato."
        acao="Voltar para Hoje"
        onAcao={() => navegar("/portal")}
      />
    );
  }

  const { leitura } = territorio;
  const comparacao =
    territorio.delta !== null && leitura.tensao !== null
      ? { valor: leitura.tensao - territorio.delta, rotulo: "contra a leitura anterior" }
      : undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="max-w-[60ch] font-display text-xl font-semibold leading-snug text-tinta md:text-2xl">
            {fraseTerritorio(territorio)}
          </p>
          <p className="nota">
            {territorio.uf ? `${territorio.uf}. ` : ""}
            {territorio.periodo ? `Leitura de ${territorio.periodo}.` : "Sem período de leitura."}
          </p>
        </div>
        <LinkBotao href={`/portal/conta#${territorio.slug}`} variant="primario">
          Configurar alertas deste território
        </LinkBotao>
      </div>

      <Secao titulo="Tensão e faixa plausível">
        <TensaoBar
          tensao={leitura.tensao}
          faixa={leitura.derivada ? undefined : leitura.faixa}
          confianca={leitura.derivada ? undefined : leitura.confianca}
          comparacao={comparacao}
        />
        {leitura.derivada && (
          <p className="nota">
            A confiança desta leitura ainda não foi calculada; por isso não aparece. Não mostramos um valor
            assumido.
          </p>
        )}
      </Secao>

      <Secao titulo="Nota executiva">
        {territorio.nota ? (
          <div className="space-y-2">
            <p className="max-w-[70ch] whitespace-pre-line text-sm text-tinta">{territorio.nota}</p>
            {territorio.notaPeriodo && <p className="nota">Publicada para o período {territorio.notaPeriodo}.</p>}
          </div>
        ) : (
          <EmptyState
            titulo="A nota do dia ainda não foi publicada"
            descricao="Quando o analista publicar a nota executiva, ela aparece aqui. Nunca mostramos rascunho."
          />
          // TODO backend B3: portal.territorio expoe a nota executiva publicada do dia.
        )}
      </Secao>

      <Secao
        titulo="O que mais pesa entre as seis dimensões"
        nota="Dimensão sem dado aparece como não medida e fica fora do cálculo."
      >
        <DimensoesTable dimensoes={leitura.dimensoes} />
        {/* TODO backend B3: variação de 30 dias por dimensão em portal.territorio. */}
      </Secao>

      <Secao titulo={tituloHistorico(territorio.serie)}>
        {territorio.serie.length >= 2 ? (
          <div className="space-y-2">
            <Sparkline
              valores={territorio.serie}
              largura={320}
              altura={64}
              rotulo={`Tensão de ${territorio.nome} nas últimas leituras publicadas`}
              className="max-w-full"
            />
            <p className="nota">
              {territorio.serie.length < 12
                ? `Histórico com ${territorio.serie.length} de 12 pontos: o gráfico completa conforme o Radar acumula publicações.`
                : "Últimas 12 leituras publicadas."}
            </p>
          </div>
        ) : (
          <EmptyState
            titulo="Sem histórico suficiente"
            descricao="São necessárias ao menos duas leituras publicadas para desenhar a tendência."
          />
        )}
      </Secao>

      <Secao titulo="Sinais verificados recentes" nota="Amostra dos sinais curados como relevantes, com fonte e data.">
        {sinais.isLoading ? (
          <LoadingBlock linhas={3} rotulo="Carregando sinais" />
        ) : sinais.isError ? (
          <ErrorState
            motivo="Não carregamos os sinais."
            proximoPasso="Tente de novo em instantes."
            onAcao={() => void sinais.refetch()}
          />
        ) : sinaisDoTerritorio.length === 0 ? (
          <EmptyState
            titulo="Nenhum sinal verificado recente para este território"
            descricao="Sinais entram aqui depois de curados pelo analista. Os alertas abaixo mostram o que já chegou a você."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">Sinais verificados recentes do território</caption>
              <thead>
                <tr className="text-left text-xs text-tinta-2">
                  <th scope="col" className="pb-2 pr-4 font-medium">Data</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Dimensão</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Sinal</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">Fonte</th>
                  <th scope="col" className="pb-2 font-medium">Impacto</th>
                </tr>
              </thead>
              <tbody>
                {sinaisDoTerritorio.map(s => (
                  <tr key={s.id} className="border-t align-top text-sm">
                    <td className="num py-2 pr-4 text-tinta-2">
                      {s.publishedAt ? new Date(s.publishedAt).toLocaleDateString("pt-BR") : "sem data"}
                    </td>
                    <td className="py-2 pr-4 text-tinta">
                      {s.relatedIndex ? NOME_DIMENSAO[s.relatedIndex] ?? s.relatedIndex : "Geral"}
                    </td>
                    <td className="py-2 pr-4 text-tinta">{s.title}</td>
                    <td className="py-2 pr-4 text-tinta-2">{s.source}</td>
                    <td className="py-2">
                      <ImpactoBarra valor={s.llmImpactScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      <Secao titulo="Alertas deste território">
        {alertas.length === 0 ? (
          <EmptyState
            titulo="Nenhum alerta recente neste território"
            descricao="Alerta dispara quando um sinal passa do seu limite de impacto."
          />
        ) : (
          <ul className="divide-y border-y">
            {alertas.slice(0, 5).map(a => (
              <li key={a.id} className="grid gap-x-4 gap-y-1 py-3 text-sm md:grid-cols-[120px_1fr_auto]">
                <span className="num text-tinta-2">{fmtDataHora(a.enviadoEm)}</span>
                <span className="text-tinta">{a.titulo}</span>
                <ImpactoBarra valor={a.impacto} />
              </li>
            ))}
          </ul>
        )}
        <LinkBotao href={`/portal/conta#${territorio.slug}`}>Ajustar limite de alerta</LinkBotao>
      </Secao>
    </div>
  );
}
