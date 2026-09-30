import { Link } from "wouter";
import { Acao, TopoPagina } from "./MarcoShell";
import { Chip, PageShell, botaoVariants } from "@/components/dit";
import { Palavras } from "@/components/dit/motion";
import { cn } from "@/lib/utils";

/**
 * SSE volta como pagina publica de apresentacao. A pagina antiga trazia setores e notas fixos
 * (exemplo da Baia de Guanabara); nada disso veio do codigo, entao nao foi portado.
 * Nao ha procedure de SSE: quando houver, o exemplo real entra aqui.
 */
export default function PublicoSse() {
  return (
    <PageShell>
      <TopoPagina rotulo="SSE · A unit by PRINT" titulo="Sector Sensitivity Exposure: cada setor se expõe de um jeito ao mesmo território."
        acoes={<><Acao href="/diagnostico?interesse=sse" clara>Pedir diagnóstico</Acao><Link href="/metodologia" className="link-claro">Ver como a Tensão é calculada</Link></>}>
        <p className="destaque">Exposição Setorial no Território</p>
        <p>O SSE mostra como a presença e a atuação de um determinado setor se relacionam com as características, forças e fragilidades de cada território. Para isso, o indicador cruza a Tensão do território com fatores específicos do setor analisado, permitindo identificar onde a atividade tende a encontrar maior sensibilidade, maior aderência ou maior potencial de impacto na localidade.</p>
      </TopoPagina>
      <article className="container max-w-4xl space-y-12 py-12 md:py-16">

        <section className="space-y-3" aria-labelledby="como-le">
          <h2 id="como-le" className="text-2xl">
            O mesmo território pode expor setores diferentes de formas diferentes.
          </h2>
          <ol data-mo="stagger" className="grid gap-4 md:grid-cols-3">
            <li className="space-y-2 border-t-2 border-tinta pt-4">
              <p className="num text-sm text-tinta-2">1. O território</p>
              <p className="text-sm text-tinta-2">A Tensão mede o território e a Confiança diz quanto dele foi medido.</p>
            </li>
            <li className="space-y-2 border-t-2 border-tinta pt-4">
              <p className="num text-sm text-tinta-2">2. O setor</p>
              <p className="text-sm text-tinta-2">Fatores específicos do setor analisado são cruzados com a Tensão.</p>
            </li>
            <li className="space-y-2 border-t-2 border-tinta pt-4">
              <p className="num text-sm text-tinta-2">3. A exposição</p>
              <p className="text-sm text-tinta-2">
                A leitura aponta onde a atividade encontra mais sensibilidade, aderência ou potencial de impacto.
              </p>
            </li>
          </ol>
          <p className="nota">
            É leitura estratégica, sem recomendação nem plano operacional. O SSE é entregue sob pedido, junto do
            diagnóstico do território.
          </p>
        </section>

        <div className="space-y-3 border-t pt-8">
          <h2 className="text-2xl">Quer saber como o seu setor se expõe em um território?</h2>
          <Link
            href="/diagnostico?interesse=sse"
            className={cn(botaoVariants({ variant: "primario", size: "lg" }))}
          >
            Pedir diagnóstico
          </Link>
        </div>
      </article>
    </PageShell>
  );
}
