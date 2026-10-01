import { Link } from "wouter";
import { PageShell } from "@/components/dit";
import { Acao, Rotulo, TopoPagina, Vertice } from "./MarcoShell";
import { TerritoriosPublicados } from "./TerritoriosPublicados";

const ENTREGAS = [
  { nome: "Leitura do dia", texto: "A Tensão e a Confiança de cada território que você acompanha, e o que mudou desde a última leitura." },
  { nome: "Nota do analista", texto: "Duas frases: o que mudou, por quê e o que observar." },
  { nome: "Alerta", texto: "Aviso quando um sinal relevante chega, sem esperar a leitura do dia." },
  { nome: "Portal", texto: "Todos os seus territórios numa tela, para entender o dia em segundos." },
];

const FAQ = [
  { p: "Quem publica a leitura que eu recebo?", r: "Um analista da PRINT revisa e publica. Só o que foi publicado chega ao portal e aos alertas." },
  { p: "Posso acompanhar qualquer território?", r: "Você escolhe os territórios no pedido. Onde faltam dados, o Marco Radar diz isso em vez de mostrar um número sem base." },
  { p: "Qual a diferença para o Diagnóstico completo?", r: "O Radar acompanha todo dia, por assinatura. O Diagnóstico completo é a leitura inteira de um território para uma decisão." },
  { p: "Quanto custa?", r: "Depende de quantos territórios você acompanha. Um analista da PRINT responde ao seu pedido." },
];

export default function PublicoRadar() {
  return (
    <PageShell>
      <TopoPagina
        rotulo="Marco Radar"
        titulo="Você sabe o que mudou no seu CEP antes do jornal."
        acoes={<><Acao href="/diagnostico?interesse=radar" clara>Pedir o Marco Radar</Acao><Link href="/entrar" className="link-claro">Já assino, quero entrar</Link></>}
      >
        <p>Seus territórios lidos todos os dias, com a assinatura de um analista.</p>
      </TopoPagina>

      <section className="largura pag-bloco">
        <Rotulo>O que chega todos os dias</Rotulo>
        <ol className="pag-tres pag-quatro">
          {ENTREGAS.map((e, i) => (
            <li key={e.nome}><span className="n">{String(i + 1).padStart(2, "0")}</span><h2>{e.nome}</h2><p>{e.texto}</p></li>
          ))}
        </ol>
      </section>

      <section className="escuro pag-faixa">
        <div className="largura pag-dois">
          <div><span className="pag-num">Todo dia</span><p>Um ponto por território por dia. A série vira o histórico que nenhuma visita de campo consegue manter.</p></div>
          <div><span className="pag-num">Assinado</span><p>Nenhum número chega ao Radar sem a publicação de um analista da PRINT.</p></div>
        </div>
      </section>

      <div className="largura"><TerritoriosPublicados titulo="Territórios com leitura agora" /></div>

      <section className="largura pag-bloco faq-grade">
        <div className="fixo">
          <Rotulo>Dúvidas</Rotulo>
          <h2 className="pag-t">O que quem acompanha território pergunta.</h2>
        </div>
        <div>
          {FAQ.map(f => (
            <details key={f.p}><summary>{f.p}<Vertice /></summary><p>{f.r}</p></details>
          ))}
        </div>
      </section>

      <section className="largura pag-bloco pag-cta">
        <h2>Acompanhe o seu CEP todos os dias.</h2>
        <Acao href="/diagnostico?interesse=radar">Pedir o Marco Radar</Acao>
      </section>
    </PageShell>
  );
}
