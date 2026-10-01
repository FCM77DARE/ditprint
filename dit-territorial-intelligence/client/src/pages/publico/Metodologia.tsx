import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/dit";
import { Acao, Rotulo, TopoPagina, Vertice } from "./MarcoShell";

/**
 * Metodologia pública como anatomia de uma leitura real (Macaé, 24/09/2026):
 * o visitante rola e vê o número nascer, do dado oficial à Tensão.
 * Mostra que dá para conferir; não mostra a conta (pesos e fórmula ficam na casa).
 */

const PASSOS = [
  { n: "01", t: "Começa pelo dado oficial", d: "Indicadores públicos do município, cada um com a fonte e o ano." },
  { n: "02", t: "Toda notícia passa por um filtro", d: "Só fica o que cita o território pelo nome. O resto é descartado antes de contar." },
  { n: "03", t: "Seis dimensões se preenchem", d: "Cada dimensão só entra quando tem evidência. A que não tem aparece vazia, sem chute." },
  { n: "04", t: "O número sai com o quanto ele sabe", d: "A Tensão vem sempre com a Confiança e com a faixa onde ela pode estar." },
];

const OFICIAIS = [
  { t: "R$ 6.464 de salário médio formal", f: "IBGE CEMPRE, 2021" },
  { t: "47 vínculos formais por 100 hab.", f: "CEMPRE e Censo 2022" },
  { t: "202 hab/km²", f: "Censo 2022" },
  { t: "246.391 habitantes", f: "Censo 2022" },
];

const NOTICIAS = [
  { t: "Defesa Civil de Macaé emitiu alerta de ressaca com ondas de até 3 metros sobre a orla e o bairro Fronteira.", ok: true },
  { t: "Nenhum tiroteio registrado em Macaé nos últimos 30 dias.", ok: true },
  { t: "Notícia do estado do Rio que não cita Macaé.", ok: false },
];

const DIMS: { nome: string; v: number | null }[] = [
  { nome: "Socioambiental", v: null }, { nome: "Socioeconômica", v: 29 }, { nome: "Infraestrutura", v: 95 },
  { nome: "Dinâmica territorial", v: 78 }, { nome: "Governança", v: null }, { nome: "Reputação", v: 98 },
];

function Palco({ passo }: { passo: number }) {
  return (
    <div className="anat-palco" aria-hidden="true">
      <div className="anat-cab"><Vertice fixo={passo >= 3} /><span>Macaé, RJ</span><span className="mono">IBGE 3302403 · 22°22′S 41°47′W</span></div>

      <div className={`anat-cena ${passo === 0 ? "ativa" : ""}`}>
        {OFICIAIS.map((o, i) => (
          <div key={o.t} className="anat-fato" style={{ transitionDelay: `${i * 90}ms` }}><b>{o.t}</b><span>{o.f}</span></div>
        ))}
      </div>

      <div className={`anat-cena ${passo === 1 ? "ativa" : ""}`}>
        {NOTICIAS.map((n, i) => (
          <div key={n.t} className={`anat-noticia ${n.ok ? "ok" : "fora"}`} style={{ transitionDelay: `${i * 120}ms` }}>
            <span className="carimbo">{n.ok ? "cita Macaé" : "descartada"}</span>
            <p>{n.t}</p>
          </div>
        ))}
      </div>

      <div className={`anat-cena ${passo === 2 ? "ativa" : ""}`}>
        <div className="anat-dims">
          {DIMS.map((d, i) => (
            <div key={d.nome} className={`anat-dim ${d.v == null ? "vazia" : ""}`} style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="nome">{d.nome}</span>
              <span className="trilho">{d.v != null && <i style={{ transform: passo === 2 ? `scaleX(${d.v / 100})` : "scaleX(0)", transitionDelay: `${200 + i * 80}ms` }} />}</span>
              <span className="v">{d.v ?? "sem evidência"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`anat-cena ${passo === 3 ? "ativa" : ""}`}>
        <div className="anat-num"><strong>74</strong><span>Tensão<b>Alta</b></span></div>
        <div className="anat-barra"><span className="faixa" /><span className="ponto" /></div>
        <p className="anat-nota">Pode estar entre <b>47 e 84</b>. Confiança <b>63%</b>: duas dimensões ainda sem evidência.</p>
      </div>

      <p className="anat-legenda">Leitura real de Macaé em 24/09/2026.</p>
    </div>
  );
}

export default function PublicoMetodologia() {
  const [passo, setPasso] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entradas => {
        for (const e of entradas) if (e.isIntersecting) setPasso(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    refs.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <PageShell>
      <TopoPagina rotulo="Metodologia" titulo="Um número que você consegue conferir." acoes={<Acao href="/#leitura" clara>Ler um território</Acao>}>
        <p>Role e veja uma leitura real nascer, do dado oficial ao número.</p>
      </TopoPagina>

      <section className="largura anat" aria-label="Como uma leitura nasce">
        <ol className="anat-passos">
          {PASSOS.map((p, i) => (
            <li key={p.n} data-i={i} ref={el => { refs.current[i] = el; }} className={passo === i ? "ativo" : ""}>
              <span className="n">{p.n}</span>
              <h2>{p.t}</h2>
              <p>{p.d}</p>
            </li>
          ))}
        </ol>
        <div className="anat-fixo"><Palco passo={passo} /></div>
      </section>

      <section className="escuro pag-faixa">
        <div className="largura anat-fecho">
          <Rotulo>Quem assina</Rotulo>
          <h2>Nenhuma leitura de assinante vai ao ar sem um analista da PRINT.</h2>
        </div>
      </section>
    </PageShell>
  );
}
