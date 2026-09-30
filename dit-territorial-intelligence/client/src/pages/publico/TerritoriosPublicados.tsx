import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { LoadingBlock, MarcaFaixa, Secao, faixaDeTensao, fmtInt } from "@/components/dit";

/**
 * Territorios com leitura, direto da procedure publicData.territories.
 * Sem dado ou erro, o bloco inteiro some (nunca numero fixo de marketing).
 * TODO backend B1/B7: hoje a procedure nao filtra por published=true nem devolve
 * delta de 30 dias; trocar por publicData.territoriosPublicados quando existir.
 */
export function TerritoriosPublicados({ max = 3, titulo }: { max?: number; titulo: string }) {
  const { data, isLoading, isError } = trpc.publicData.territories.useQuery(undefined, {
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

  const linhas = (data ?? [])
    .filter(t => t.leitura && t.leitura.tensao !== null)
    .sort((a, b) => (b.leitura!.tensao as number) - (a.leitura!.tensao as number))
    .slice(0, max);
  if (linhas.length === 0) return null;

  return (
    <Secao titulo={titulo} nota="Tensão de 0 a 100. A faixa mostra o intervalo possível; a confiança, quanto da metodologia foi medido.">
      <ul className="divide-y border-y">
        {linhas.map(t => {
          const l = t.leitura!;
          const f = faixaDeTensao(l.tensao as number);
          return (
            <li key={t.slug}>
              <Link
                href={`/territorio/${t.slug}`}
                className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-1 py-3 hover:bg-muted"
              >
                <span className="min-w-[10rem] flex-1 font-medium text-tinta">
                  {t.name}
                  {t.state ? <span className="text-tinta-2">, {t.state}</span> : null}
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="num text-xl font-medium text-tinta">{fmtInt(l.tensao as number)}</span>
                  <span style={{ color: f.cor }}>
                    <MarcaFaixa nivel={f.id} />
                  </span>
                  <span className="text-tinta">{f.rotulo}</span>
                </span>
                <span className="num text-sm text-tinta-2">
                  faixa {fmtInt(l.faixa.min)} a {fmtInt(l.faixa.max)}
                </span>
                <span className="text-sm text-tinta-2">confiança {fmtInt(l.confianca)}%</span>
                {t.period ? <span className="nota">leitura de {t.period}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}
