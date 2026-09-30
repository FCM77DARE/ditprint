import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  DimensoesTable,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageShell,
  Secao,
  TensaoBar,
  botaoVariants,
  faixaDeTensao,
  Sparkline,
  fmtDelta,
  fmtInt,
} from "@/components/dit";
import { Palavras } from "@/components/dit/motion";
import { camposPublicados } from "@/lib/publicados";
import { cn } from "@/lib/utils";

function CtaDiagnostico({ nome, rotulo }: { nome?: string; rotulo: string }) {
  const href = nome ? `/diagnostico?territorio=${encodeURIComponent(nome)}` : "/diagnostico";
  return (
    <Link href={href} className={cn(botaoVariants({ variant: "primario", size: "lg" }), "self-start")}>
      {rotulo}
    </Link>
  );
}

export default function PublicoTerritorio() {
  const { slug = "" } = useParams<{ slug: string }>();
  const q = trpc.publicData.territoryDetail.useQuery({ slug }, { enabled: !!slug, retry: false });

  if (q.isLoading) {
    return (
      <PageShell>
        <div className="container max-w-4xl space-y-8 py-12">
          <LoadingBlock linhas={2} rotulo="Carregando a leitura do território" />
          <LoadingBlock linhas={6} rotulo="Carregando as dimensões" />
        </div>
      </PageShell>
    );
  }

  // Território inexistente ou sem leitura: estado sob demanda, com caminho para o pedido.
  if (q.error?.data?.code === "NOT_FOUND") {
    return (
      <PageShell>
        <div className="container max-w-4xl space-y-5 py-12">
          <Palavras as="h1" className="text-3xl" texto="Este território ainda não tem leitura publicada." />
          <p className="max-w-prose text-tinta-2">
            A leitura pública cobre só o que um analista da PRINT já publicou. Peça o diagnóstico e nós localizamos o
            território.
          </p>
          <CtaDiagnostico rotulo="Pedir leitura deste território" />
        </div>
      </PageShell>
    );
  }

  if (q.isError || !q.data) {
    return (
      <PageShell>
        <div className="container max-w-4xl py-12">
          <ErrorState
            motivo="Não conseguimos carregar a leitura agora."
            proximoPasso="Tente de novo em instantes. Se continuar, peça o diagnóstico e respondemos por e-mail."
            acao="Tentar de novo"
            onAcao={() => q.refetch()}
          />
        </div>
      </PageShell>
    );
  }

  const t = q.data;
  const leitura = t.leitura;
  const nomeCompleto = t.state ? `${t.name}, ${t.state}` : t.name;

  // Cobertura insuficiente: a procedure respondeu, mas não há base para medir.
  if (!leitura || leitura.tensao === null) {
    return (
      <PageShell>
        <div className="container max-w-4xl space-y-6 py-12">
          <h1 className="text-3xl">{nomeCompleto}: cobertura insuficiente para medir a tensão.</h1>
          <EmptyState
            titulo="Sem número, de propósito"
            descricao="Ainda não há dimensões medidas neste território. O Marco não preenche o vazio com um valor assumido. Um analista pode levantar o que falta no diagnóstico."
          />
          <CtaDiagnostico nome={nomeCompleto} rotulo="Pedir diagnóstico deste território" />
        </div>
      </PageShell>
    );
  }

  const faixa = faixaDeTensao(leitura.tensao);
  const extra = camposPublicados(t);
  const serie = (extra.serie ?? []).map(p => p.valor);
  const nota = extra.notaExecutiva?.trim();
  const movimento = (rotulo: string, v: number | null | undefined) =>
    typeof v === "number" ? `${fmtDelta(v)} em ${rotulo}` : `sem base de ${rotulo}`;

  return (
    <PageShell>
      <article className="container max-w-4xl space-y-10 py-12">
        <header className="space-y-3">
          <p className="nota">Leitura pública{t.period ? `, período ${t.period}` : ""}</p>
          <h1 className="text-3xl md:text-4xl">
            {nomeCompleto}: tensão {fmtInt(leitura.tensao)}, faixa {faixa.rotulo.toLowerCase()}.
          </h1>
        </header>

        <TensaoBar tensao={leitura.tensao} faixa={leitura.faixa} confianca={leitura.confianca} />

        <Secao
          titulo={`Variação: ${movimento("7 dias", extra.delta7)}; ${movimento("30 dias", extra.delta30)}.`}
          nota="Comparação com a última publicação de 7 e 30 dias atrás. Sem publicação tão antiga, não há base e não inventamos uma."
        >
          {serie.length >= 2 ? (
            <Sparkline valores={serie} largura={320} altura={56} rotulo={`Tensão de ${nomeCompleto}`} className="max-w-full" />
          ) : (
            <p className="text-sm text-tinta-2">Ainda não há publicações suficientes para desenhar a tendência.</p>
          )}
        </Secao>

        {nota ? (
          <Secao titulo="O que o analista escreveu" nota="Primeiro parágrafo da nota executiva. A nota completa é do Marco Radar.">
            <p className="max-w-prose whitespace-pre-line text-tinta">{nota}</p>
          </Secao>
        ) : null}

        <Secao
          titulo="As dimensões que mais pesam vêm primeiro."
          nota="Dimensão não medida fica fora do cálculo, sem valor assumido."
        >
          <DimensoesTable dimensoes={leitura.dimensoes} />
        </Secao>

        <Secao titulo="Como ler a coluna Fonte">
          <dl data-mo="stagger" className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-tinta">Estrutural</dt>
              <dd className="text-tinta-2">Indicador oficial comparado com o país em percentil nacional.</dd>
            </div>
            <div>
              <dt className="font-semibold text-tinta">Sinal</dt>
              <dd className="text-tinta-2">Notícia ou registro que passou pelo verificador de sinais.</dd>
            </div>
          </dl>
          <p className="text-sm">
            <Link href="/metodologia" className="text-acento-texto underline underline-offset-4">
              Ver a metodologia completa
            </Link>
          </p>
        </Secao>

        <section className="space-y-3 border-t pt-8">
          <h2 className="text-2xl">O diagnóstico completo acrescenta atores, cenários e a nota executiva.</h2>
          <CtaDiagnostico nome={nomeCompleto} rotulo="Pedir diagnóstico deste território" />
        </section>
      </article>
    </PageShell>
  );
}
