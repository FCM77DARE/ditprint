import { Link } from "wouter";
import { camposPublicados } from "@/lib/publicados";
import { trpc } from "@/lib/trpc";
import { LoadingBlock, MarcaFaixa, Secao, Sparkline, faixaDeTensao, fmtDelta, fmtInt } from "@/components/dit";

/**
 * Territorios com leitura publicada, de publicData.territoriosPublicados (so entra quem tem
 * publicacao de um analista). Serie e nota executiva (primeiro paragrafo) vem de
 * publicData.territories, por slug. Sem dado ou erro, o bloco inteiro some: nunca numero fixo.
 */
export function TerritoriosPublicados({ max = 3, titulo }: { max?: number; titulo: string }) {
  const { data, isLoading, isError } = trpc.publicData.territoriosPublicados.useQuery(undefined, {
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
  const extras = trpc.publicData.territories.useQuery(undefined, {
    enabled: (data?.length ?? 0) > 0,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  if (isError) return null;
  if (isLoading) {
    return (
      <Secao titulo={titulo}>
        <LoadingBlock linhas={3} rotulo="Carregando territórios com leitura" />
      </Secao>
    );
  }

  const extraPorSlug = new Map((extras.data ?? []).map(t => [t.slug, t]));
  const linhas = (data ?? [])
    .filter(t => t.tensao !== null)
    .sort((a, b) => (b.tensao as number) - (a.tensao as number))
    .slice(0, max);
  if (linhas.length === 0) return null;

  return (
    <Secao
      titulo={titulo}
      nota="Tensão de 0 a 100, publicada por um analista da PRINT. A confiança diz quanto da metodologia foi medido."
    >
      <ul className="divide-y border-y">
        {linhas.map(t => {
          const tensao = t.tensao as number;
          const f = faixaDeTensao(tensao);
          const ex = extraPorSlug.get(t.slug);
          const campos = ex ? camposPublicados(ex) : null;
          const serie = (campos?.serie ?? []).map(p => p.valor);
          const nota = campos?.notaExecutiva?.trim();
          return (
            <li key={t.slug}>
              <Link href={`/territorio/${t.slug}`} className="block space-y-1 py-3 hover:bg-muted">
                <span className="flex min-h-11 flex-wrap items-center gap-x-6 gap-y-1">
                  <span className="min-w-[10rem] flex-1 font-medium text-tinta">
                    {t.nome}
                    {t.estado ? <span className="text-tinta-2">, {t.estado}</span> : null}
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className="num text-xl font-medium text-tinta">{fmtInt(tensao)}</span>
                    <span style={{ color: f.cor }}>
                      <MarcaFaixa nivel={f.id} />
                    </span>
                    <span className="text-tinta">{f.rotulo}</span>
                  </span>
                  <span className="num text-sm text-tinta-2">
                    {typeof t.delta30 === "number" ? `${fmtDelta(t.delta30)} em 30 dias` : "sem base de 30 dias"}
                  </span>
                  {serie.length >= 2 ? (
                    <Sparkline valores={serie} largura={80} altura={24} rotulo={`Tensão de ${t.nome}`} />
                  ) : null}
                  <span className="text-sm text-tinta-2">
                    {typeof t.confianca === "number" ? `confiança ${fmtInt(t.confianca)}%` : "confiança não informada"}
                  </span>
                  {t.period ? <span className="nota">leitura de {t.period}</span> : null}
                </span>
                {nota ? <span className="line-clamp-2 block max-w-prose text-sm text-tinta-2">{nota}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}
