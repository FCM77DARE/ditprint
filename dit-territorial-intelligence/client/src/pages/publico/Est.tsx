import { PageShell } from "@/components/dit";
import { Acao, Rotulo, TopoPagina, Vertice } from "./MarcoShell";

/** EST · Exposição Setorial no Território. Diz o que o cliente recebe; o método fica com a PRINT. */
const PERGUNTAS = [
  { t: "Onde o seu setor encontra resistência", d: "Os pontos do território em que a atividade tende a enfrentar mais sensibilidade." },
  { t: "Onde o seu setor encontra aderência", d: "O que no lugar favorece a operação e pode ser apoio desde o primeiro dia." },
  { t: "Onde o seu setor pode pesar mais", d: "O potencial de impacto da atividade naquele território, antes que ele apareça." },
];

// Setores das frentes comerciais do Marco (postos v_dit_* da cidade).
const SETORES = ["Energia e transmissão", "Mineração", "Saneamento", "Infraestrutura e concessões", "Agro", "Imobiliário e urbanismo", "Poder público"];

export default function PublicoEst() {
  return (
    <PageShell>
      <TopoPagina
        rotulo="EST · Exposição Setorial no Território"
        titulo="O mesmo território cobra diferente de cada setor."
        acoes={<><Acao href="/diagnostico?interesse=est" clara>Pedir a EST</Acao><a href="/#leitura" className="link-claro">Ler um território de graça</a></>}
      >
        <p>A leitura do território vista pela régua do seu setor.</p>
      </TopoPagina>

      <section className="largura pag-bloco">
        <Rotulo>O que a EST responde</Rotulo>
        <ol className="pag-tres">
          {PERGUNTAS.map((p, i) => (
            <li key={p.t}><span className="n">{String(i + 1).padStart(2, "0")}</span><h2>{p.t}</h2><p>{p.d}</p></li>
          ))}
        </ol>
      </section>

      <section className="escuro pag-faixa">
        <div className="largura">
          <Rotulo>Para quem opera em</Rotulo>
          <ul className="pag-setores">{SETORES.map(s => <li key={s}><Vertice fixo />{s}</li>)}</ul>
        </div>
      </section>

      <section className="largura pag-bloco pag-cta">
        <h2>A EST é entregue junto do Diagnóstico completo do território.</h2>
        <Acao href="/diagnostico?interesse=est">Pedir a EST</Acao>
      </section>
    </PageShell>
  );
}
