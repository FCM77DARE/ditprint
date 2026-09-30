import { Link } from "wouter";
import { Chip, FAIXAS_TENSAO, PageShell, Secao, botaoVariants } from "@/components/dit";
import { Palavras } from "@/components/dit/motion";
import { cn } from "@/lib/utils";
import {
  DIMENSOES_METODOLOGIA,
  LIMITE_ALERTA,
  LIMITE_ENTRA_NO_CALCULO,
  PESO_ESTRUTURAL,
  PESO_SINAL,
} from "@shared/metodologia";

const dec = (n: number) => n.toLocaleString("pt-BR");
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function PublicoMetodologia() {
  return (
    <PageShell>
      <article className="container max-w-4xl space-y-12 py-12 md:py-16">
        <header className="space-y-3">
          <p className="nota">Antes chamado de STT (Score de Tensão Territorial).</p>
          <Palavras as="h1" className="text-3xl md:text-4xl" texto="Tensão: como medimos o território em seis dimensões, com um analista por trás de cada número." />
          <p className="max-w-prose text-tinta-2">
            Você não deveria confiar em um número que não consegue conferir. Aqui está como a conta funciona, e os pesos
            estão abertos logo abaixo.
          </p>
        </header>

        <Secao titulo="O território é lido em seis dimensões, e só entra na conta quem foi medida.">
          <ul data-mo="stagger" className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
            {DIMENSOES_METODOLOGIA.filter(d => !d.emCalibracao).map(d => (
              <li key={d.id} className="border-t pt-2">
                <p className="font-medium text-tinta">
                  <span className="num text-tinta-2">{d.id}</span> {d.nome}
                </p>
                <p className="text-tinta-2">{d.olha}</p>
              </li>
            ))}
          </ul>
          <details className="rounded-[6px] border bg-superficie p-4">
            <summary className="cursor-pointer text-sm font-medium text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              Ver os pesos de cada dimensão
            </summary>
            <div className="mt-4 space-y-4">
              <p className="nota">Pesos lidos da mesma constante que o motor usa (shared/metodologia.ts, conferida por teste).</p>
              <p className="num rounded-[6px] border bg-superficie p-4 text-sm md:text-base">
                Tensão = Σ (Di × Wi) ÷ Σ Wi, somando só as dimensões medidas
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <caption className="sr-only">Dimensões, pesos e o que cada uma observa</caption>
                  <thead>
                    <tr className="text-left text-xs text-tinta-2">
                      <th scope="col" className="pb-2 pr-4 font-medium">Dimensão</th>
                      <th scope="col" className="pb-2 pr-4 text-right font-medium">Peso</th>
                      <th scope="col" className="pb-2 font-medium">O que observa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DIMENSOES_METODOLOGIA.map(d => (
                      <tr key={d.id} className="border-t align-top">
                        <th scope="row" className="py-2 pr-4 text-left font-medium text-tinta">
                          <span className="num text-tinta-2">{d.id}</span> {d.nome}
                          {d.emCalibracao && (
                            <span className="ml-2 align-middle">
                              <Chip tom="contorno">em calibração</Chip>
                            </span>
                          )}
                        </th>
                        <td className="num py-2 pr-4 text-right text-tinta">{pct(d.peso)}</td>
                        <td className="py-2 text-tinta-2">
                          {d.olha}
                          {d.emCalibracao && " Fora do cálculo até a calibração terminar."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </Secao>

        <Secao titulo="Duas camadas alimentam cada dimensão: a estrutural e a dos sinais.">
          <div data-mo="stagger" className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 border-t-2 border-tinta pt-4">
              <h3 className="text-lg">Camada estrutural, peso {dec(PESO_ESTRUTURAL)}</h3>
              <p className="text-sm text-tinta-2">
                Indicadores oficiais de cada município, comparados com o país inteiro em percentil nacional. Muda devagar
                e dá a base da leitura.
              </p>
            </div>
            <div className="space-y-2 border-t-2 border-tinta pt-4">
              <h3 className="text-lg">Sinais verificados, peso {dec(PESO_SINAL)}</h3>
              <p className="text-sm text-tinta-2">
                Notícias e registros do dia. É a camada que faz a leitura se mover de um dia para o outro.
              </p>
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-tinta-2">
            <li>Onde não existe camada estrutural para a dimensão, vale o sinal sozinho. Nada é inventado para preencher.</li>
            <li>
              O verificador confere cada sinal antes de contar. Sinal com impacto a partir de {dec(LIMITE_ALERTA)} dispara
              alerta; entre {dec(LIMITE_ENTRA_NO_CALCULO)} e {dec(LIMITE_ALERTA)} entra no cálculo; abaixo de{" "}
              {dec(LIMITE_ENTRA_NO_CALCULO)} só fica registrado.
            </li>
            <li>Uma dimensão é medida quando tem a camada estrutural ou ao menos um sinal verificado. Cobertura de fonte sem sinal não conta.</li>
          </ul>
        </Secao>

        <Secao titulo="A tensão diz quanto pressiona; a confiança diz quanto sabemos; a faixa mostra o que falta.">
          <dl data-mo="stagger" className="grid gap-4 text-sm md:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-base font-semibold text-tinta">Tensão</dt>
              <dd className="text-tinta-2">
                De 0 a 100, calculada só com o que foi medido: os pesos das dimensões medidas são reajustados para somar
                um.
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-base font-semibold text-tinta">Confiança</dt>
              <dd className="text-tinta-2">
                A parte do peso da metodologia que foi de fato medida, de 0 a 100. Duas dimensões sem dado baixam a
                confiança, não a tensão.
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-base font-semibold text-tinta">Faixa</dt>
              <dd className="text-tinta-2">
                O menor e o maior valor possíveis se as dimensões não medidas fossem 0 ou 100. A largura da faixa é a
                largura da ignorância.
              </dd>
            </div>
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-sm">
              <caption className="sr-only">As cinco faixas de tensão</caption>
              <thead>
                <tr className="text-left text-xs text-tinta-2">
                  <th scope="col" className="pb-2 pr-4 font-medium">Rótulo</th>
                  <th scope="col" className="pb-2 text-right font-medium">Tensão</th>
                </tr>
              </thead>
              <tbody>
                {FAIXAS_TENSAO.map(f => (
                  <tr key={f.id} className="border-t">
                    <th scope="row" className="py-2 pr-4 text-left font-medium text-tinta">{f.rotulo}</th>
                    <td className="num py-2 text-right text-tinta-2">
                      {f.min} a {f.max}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>

        <Secao titulo="Um analista da PRINT publica cada leitura; a IA escreve, mas não muda a conta.">
          <ul className="list-disc space-y-1 pl-5 text-sm text-tinta-2">
            <li>A conta da tensão é determinística. O modelo de linguagem entra uma vez por território por dia, para redigir a nota executiva, e seu resultado é conferido contra a conta.</li>
            <li>Nada chega ao cliente antes da publicação por um analista. O que não foi publicado não aparece no site nem no Marco Radar.</li>
            <li>A nota executiva diz o que mudou, por quê e o que observar.</li>
          </ul>
        </Secao>

        <Secao titulo="O que a leitura não faz.">
          <ul className="list-disc space-y-1 pl-5 text-sm text-tinta-2">
            <li>Não é previsão. É leitura do que está medido hoje.</li>
            <li>Dimensão sem dado aparece como não medida, nunca com valor assumido.</li>
            <li>Recursos naturais e potencial (D7) ficam fora do cálculo até a calibração terminar.</li>
            <li>Não substitui o trabalho de campo: ajuda a decidir onde e o que ir ver.</li>
          </ul>
        </Secao>

        <div className="space-y-3 border-t pt-8">
          <h2 className="text-2xl">Quer a leitura do seu território?</h2>
          <Link href="/diagnostico" className={cn(botaoVariants({ variant: "primario", size: "lg" }))}>
            Pedir diagnóstico
          </Link>
        </div>
      </article>
    </PageShell>
  );
}
