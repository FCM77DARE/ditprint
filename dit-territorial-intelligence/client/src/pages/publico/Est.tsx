import { useState } from "react";
import { PageShell } from "@/components/dit";
import { Acao, Rotulo, TopoPagina, Vertice } from "./MarcoShell";

/**
 * EST · Exposição Setorial no Território.
 * Gesto da página: o visitante escolhe o setor e o mesmo território acende
 * as dimensões que mais pesam para aquela atividade. É ilustração qualitativa
 * (sem número); a exposição real sai na EST do território, sob pedido.
 */

type Dim = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";

const DIMS: { id: Dim; nome: string; x: number; y: number }[] = [
  { id: "D1", nome: "Socioambiental", x: 22, y: 30 },
  { id: "D2", nome: "Socioeconômica", x: 64, y: 18 },
  { id: "D3", nome: "Infraestrutura", x: 82, y: 56 },
  { id: "D4", nome: "Dinâmica territorial", x: 40, y: 62 },
  { id: "D5", nome: "Governança", x: 14, y: 78 },
  { id: "D6", nome: "Reputação", x: 66, y: 86 },
];

const SETORES: { nome: string; pesa: Dim[]; frase: string }[] = [
  { nome: "Energia e transmissão", pesa: ["D1", "D4", "D5"], frase: "Licença, comunidade no traçado e a prefeitura que precisa estar junto." },
  { nome: "Mineração", pesa: ["D1", "D4", "D6"], frase: "Passivo ambiental, conflito pelo uso da terra e a imagem que chega antes." },
  { nome: "Saneamento", pesa: ["D3", "D5", "D2"], frase: "A rede que falta, a capacidade do município de contratar e a conta que a população paga." },
  { nome: "Infraestrutura e concessões", pesa: ["D3", "D5", "D6"], frase: "Obra em curso, contrato público e o que se diz da concessão." },
  { nome: "Agro", pesa: ["D1", "D4", "D3"], frase: "Área protegida, disputa por terra e a logística para escoar." },
  { nome: "Imobiliário e urbanismo", pesa: ["D4", "D3", "D2"], frase: "Expansão urbana, serviço que acompanha e a renda do entorno." },
  { nome: "Poder público", pesa: ["D5", "D2", "D6"], frase: "Capacidade fiscal, desigualdade e o humor de quem vota." },
];

export default function PublicoEst() {
  const [i, setI] = useState(0);
  const setor = SETORES[i];
  return (
    <PageShell>
      <TopoPagina
        rotulo="EST · Exposição Setorial no Território"
        titulo="O mesmo território cobra diferente de cada setor."
        acoes={<><Acao href="/diagnostico?interesse=est" clara>Pedir a EST</Acao><a href="/#leitura" className="link-claro">Ler um território de graça</a></>}
      >
        <p>Escolha um setor abaixo e veja o território mudar de figura.</p>
      </TopoPagina>

      <section className="largura est" aria-label="Exposição por setor">
        <div className="est-escolha">
          <Rotulo>Seu setor</Rotulo>
          <div className="est-setores" role="radiogroup" aria-label="Setor">
            {SETORES.map((s, k) => (
              <button key={s.nome} type="button" role="radio" aria-checked={k === i} onClick={() => setI(k)} className={k === i ? "ativo" : ""}>
                <Vertice fixo={k === i} />{s.nome}
              </button>
            ))}
          </div>
          <p className="est-frase" key={setor.nome}>{setor.frase}</p>
          <p className="est-nota">Ilustração do que costuma pesar para o setor. A exposição de cada território sai na EST, sob pedido.</p>
        </div>

        <div className="est-mapa" aria-hidden="true">
          <img src="/arte/relevo-papel.jpg" alt="" />
          {DIMS.map(d => {
            const ordem = setor.pesa.indexOf(d.id);
            const acesa = ordem >= 0;
            return (
              <div key={d.id} className={`est-ponto ${acesa ? "aceso" : ""}`} style={{ left: `${d.x}%`, top: `${d.y}%`, transitionDelay: acesa ? `${ordem * 120}ms` : "0ms" }}>
                <span className="halo" />
                <Vertice fixo={acesa} />
                <span className="rot">{d.nome}{acesa && <b>{ordem === 0 ? "pesa mais" : "pesa"}</b>}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="escuro pag-faixa">
        <div className="largura pag-cta est-cta">
          <h2>A EST chega junto do Diagnóstico completo do território.</h2>
          <Acao href="/diagnostico?interesse=est" clara>Pedir a EST</Acao>
        </div>
      </section>
    </PageShell>
  );
}
