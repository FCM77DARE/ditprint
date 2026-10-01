import { PageShell } from "@/components/dit";
import { Acao, Rotulo, TopoPagina, Vertice } from "./MarcoShell";

/**
 * Metodologia pública: o que o Marco mede e como o cliente confere, sem entregar a conta.
 * Pesos, fórmula e mecânica ficam em shared/metodologia.ts e na Mesa, não aqui (Felipe, 30/09/2026).
 */
const DIMENSOES = ["Socioambiental", "Socioeconômica", "Infraestrutura e serviços", "Dinâmica territorial", "Governança", "Reputação e visibilidade"];

const PRINCIPIOS = [
  { t: "Cada número aponta a fonte", d: "Dado oficial e notícia que cita o território pelo nome, conferida antes de entrar." },
  { t: "O que falta aparece", d: "Quando uma dimensão não tem evidência, a leitura diz. Nada é preenchido no chute." },
  { t: "Um analista assina", d: "Nenhuma leitura de assinante vai ao ar sem revisão de um analista da PRINT." },
];

export default function PublicoMetodologia() {
  return (
    <PageShell>
      <TopoPagina rotulo="Metodologia" titulo="Um número que você consegue conferir." acoes={<Acao href="/#leitura" clara>Ler um território</Acao>}>
        <p>Cada leitura mostra de onde veio cada número e quanto do território foi de fato medido.</p>
      </TopoPagina>

      <section className="largura pag-bloco">
        <Rotulo>Seis dimensões</Rotulo>
        <h2 className="pag-t">O território inteiro, na mesma régua em todo município.</h2>
        <ul className="pag-dims">{DIMENSOES.map(d => <li key={d}><Vertice fixo />{d}</li>)}</ul>
      </section>

      <section className="escuro pag-faixa">
        <div className="largura pag-dois">
          <div><span className="pag-num">Tensão</span><p>De 0 a 100: quanto o território tende a cobrar de quem opera nele.</p></div>
          <div><span className="pag-num">Confiança</span><p>Quanto do território foi medido. O que falta vira faixa, não chute.</p></div>
        </div>
      </section>

      <section className="largura pag-bloco">
        <ol className="pag-tres">
          {PRINCIPIOS.map((p, i) => (
            <li key={p.t}><span className="n">{String(i + 1).padStart(2, "0")}</span><h2>{p.t}</h2><p>{p.d}</p></li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}
