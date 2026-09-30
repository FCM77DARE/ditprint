import { useEffect, useMemo, useRef, useState } from "react";
import "./marco.css";

// Landing proposta MARCO (nome ainda nao aprovado). Rota /marco, isolada da landing atual.

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

function Simbolo({ stroke = 2, cy = 14.6, r = 2.2 }: { stroke?: number; cy?: number; r?: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 L22 20.5 H2 Z" fill="none" stroke="var(--tinta)" strokeWidth={stroke} strokeLinejoin="round" />
      <circle cx="12" cy={cy} r={r} fill="var(--bronze)" />
    </svg>
  );
}

// ── Curvas de nivel: ruido + marching squares ──────────────────────────────
function hash(x: number, y: number) {
  const h = Math.sin(x * 127.1 + y * 311.7 + 13.37) * 43758.5453;
  return h - Math.floor(h);
}
function suave(t: number) {
  return t * t * (3 - 2 * t);
}
function ruido(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = suave(xf), v = suave(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function relevo(x: number, y: number) {
  let s = 0, amp = 1, f = 1, tot = 0;
  for (let o = 0; o < 4; o++) {
    s += amp * ruido(x * f, y * f);
    tot += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / tot;
}
type Pt = [number, number];
function CurvasDeNivel() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const passo = 18;
    let caminhos: Path2D[] = [];
    let n = 0;
    let raf = 0;
    const cor = (nome: string) => getComputedStyle(cv).getPropertyValue(nome).trim();
    const desenha = () => {
      ctx.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
      const fino = cor("--curva"), forte = cor("--curva-forte");
      ctx.globalAlpha = 0.9;
      for (let k = 0; k < Math.min(caminhos.length, Math.ceil(n)); k++) {
        const mestra = (k + 1) % 5 === 0;
        ctx.strokeStyle = mestra ? forte : fino;
        ctx.lineWidth = mestra ? 1.3 : 0.75;
        ctx.stroke(caminhos[k]);
      }
      ctx.globalAlpha = 1;
    };
    const calcula = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const nx = Math.ceil(w / passo) + 1, ny = Math.ceil(h / passo) + 1;
      const campo = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) campo[j * nx + i] = relevo((i * passo) / 260 + 3.1, (j * passo) / 260 + 7.7);
      caminhos = [];
      for (let k = 1; k <= 18; k++) {
        const lv = 0.22 + k * 0.03;
        const p = new Path2D();
        for (let j = 0; j < ny - 1; j++)
          for (let i = 0; i < nx - 1; i++) {
            const a = campo[j * nx + i], b = campo[j * nx + i + 1], c = campo[(j + 1) * nx + i + 1], d = campo[(j + 1) * nx + i];
            const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const x = i * passo, y = j * passo;
            const t = (p0: number, q: number) => (lv - p0) / (q - p0 || 1e-6);
            const top: Pt = [x + passo * t(a, b), y], dir: Pt = [x + passo, y + passo * t(b, c)];
            const base: Pt = [x + passo * t(d, c), y + passo], esq: Pt = [x, y + passo * t(a, d)];
            const m: Record<number, Pt[][]> = {
              1: [[esq, base]], 2: [[base, dir]], 3: [[esq, dir]], 4: [[top, dir]],
              5: [[esq, top], [base, dir]], 6: [[top, base]], 7: [[esq, top]], 8: [[esq, top]],
              9: [[top, base]], 10: [[esq, base], [top, dir]], 11: [[top, dir]], 12: [[esq, dir]],
              13: [[base, dir]], 14: [[esq, base]],
            };
            for (const s of m[idx] ?? []) {
              p.moveTo(s[0][0], s[0][1]);
              p.lineTo(s[1][0], s[1][1]);
            }
          }
        caminhos.push(p);
      }
      desenha();
    };
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inicia = () => {
      calcula();
      if (reduz) {
        n = caminhos.length;
        desenha();
        return;
      }
      const t0 = performance.now();
      const passoAnim = (agora: number) => {
        const p = Math.min(1, (agora - t0) / 2200);
        n = caminhos.length * (1 - Math.pow(1 - p, 2));
        desenha();
        if (p < 1) raf = requestAnimationFrame(passoAnim);
      };
      raf = requestAnimationFrame(passoAnim);
    };
    inicia();
    let tRes = 0;
    const onResize = () => {
      clearTimeout(tRes);
      tRes = window.setTimeout(() => {
        n = caminhos.length;
        calcula();
      }, 160);
    };
    window.addEventListener("resize", onResize);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onTema = () => desenha();
    mq.addEventListener("change", onTema);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tRes);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onTema);
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}

// ── Disco de leitura ───────────────────────────────────────────────────────
const CX = 160, CY = 160;
const A0 = -220, A1 = 40;
const ang = (v: number) => ((A0 + ((A1 - A0) * v) / 100) * Math.PI) / 180;
const ponto = (v: number, r: number): Pt => [CX + r * Math.cos(ang(v)), CY + r * Math.sin(ang(v))];
function arco(v0: number, v1: number, r: number) {
  const p0 = ponto(v0, r), p1 = ponto(v1, r);
  const grande = ((A1 - A0) * (v1 - v0)) / 100 > 180 ? 1 : 0;
  return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r} ${r} 0 ${grande} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
}
function Disco() {
  const ticks = useMemo(() => {
    const out: { a: Pt; b: Pt; longo: boolean; v: number; t: Pt }[] = [];
    for (let v = 0; v <= 100; v += 5) {
      const longo = v % 25 === 0;
      out.push({ v, longo, a: ponto(v, 116), b: ponto(v, longo ? 104 : 109), t: ponto(v, 92) });
    }
    return out;
  }, []);
  const pv = ponto(74, 104), pp = ponto(74, 124);
  return (
    <svg className="disco" viewBox="0 0 320 320" role="img" aria-label="Tensão 74 no que foi medido, faixa possível de 47 a 84, confiança de 63 por cento">
      <defs>
        <path id="marcoAnel" d="M160,160 m-132,0 a132,132 0 1,1 264,0 a132,132 0 1,1 -264,0" />
      </defs>
      <circle cx="160" cy="160" r="150" fill="var(--bronze-fundo)" stroke="var(--bronze)" strokeWidth="2" />
      <circle cx="160" cy="160" r="116" fill="var(--superficie)" stroke="var(--bronze)" strokeWidth="1" />
      <text fontFamily="IBM Plex Mono, monospace" fontSize="11.5" letterSpacing="2.6" fill="var(--bronze)">
        <textPath href="#marcoAnel" startOffset="2%">MARCO · LEITURA TERRITORIAL · PRINT · 3302403 ·</textPath>
      </text>
      <g>
        {ticks.map((k) => (
          <g key={k.v}>
            <line x1={k.a[0]} y1={k.a[1]} x2={k.b[0]} y2={k.b[1]} stroke="var(--tinta-2)" strokeWidth={k.longo ? 1.6 : 0.8} />
            {k.longo && (
              <text x={k.t[0]} y={k.t[1] + 4} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="11" fill="var(--tinta-3)">
                {k.v}
              </text>
            )}
          </g>
        ))}
      </g>
      <path d={arco(47, 84, 124)} fill="none" stroke="var(--bronze-claro)" strokeWidth="16" opacity=".55" />
      <line x1="160" y1="160" x2={pv[0]} y2={pv[1]} opacity=".9" stroke="var(--tinta)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx={pp[0]} cy={pp[1]} r="9" fill="var(--bronze)" stroke="var(--superficie)" strokeWidth="3" />
      <path d="M160 128 L186 176 H134 Z" fill="none" stroke="var(--tinta)" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="160" cy="160" r="5.5" fill="var(--bronze)" />
    </svg>
  );
}

function Dim({ nome, v, cor }: { nome: string; v?: number; cor?: string }) {
  if (v === undefined)
    return (
      <div className="dim sem">
        <span>{nome}</span>
        <div className="trilho"><div className="vazio" /></div>
        <span className="v">sem evid.</span>
      </div>
    );
  return (
    <div className="dim">
      <span>{nome}</span>
      <div className="trilho"><div className="enche" style={{ width: `${v}%`, background: cor }} /></div>
      <span className="v num">{v}</span>
    </div>
  );
}

function BarraTela({ caminho, dir }: { caminho: string; dir: string }) {
  return (
    <div className="tela-barra">
      <span className="marca-mini">
        <Simbolo stroke={2} cy={14.2} r={2.1} />
        <b>MARCO</b>
      </span>
      <span className="caminho">{caminho}</span>
      <span className="dir">{dir}</span>
    </div>
  );
}

export default function Marco() {
  const [pedido, setPedido] = useState(false);

  useEffect(() => {
    const anteriorTitulo = document.title;
    document.title = "Marco | Inteligência territorial da PRINT";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    document.head.appendChild(link);
    const bg = document.body.style.background;
    document.body.style.background = getComputedStyle(document.querySelector(".marco")!).backgroundColor;
    return () => {
      document.title = anteriorTitulo;
      link.remove();
      document.body.style.background = bg;
    };
  }, []);

  return (
    <div className="marco" id="topo">
      <header className="barra">
        <div className="barra-in gutter">
          <a className="marca-mini" href="#topo" aria-label="Marco, início">
            <Simbolo stroke={2} cy={14.2} r={2.1} />
            <b>MARCO</b>
          </a>
          <nav className="nav" aria-label="Seções">
            <a href="#momentos">Três momentos</a>
            <a href="#ficha">A ficha</a>
            <a href="#consulta">Consulta gratuita</a>
            <a href="#medicao">Como medimos</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="abertura gutter" aria-labelledby="marco-palavra">
          <CurvasDeNivel />
          <div className="abertura-texto">
            <p className="dor entra">
              A licença trava, a comunidade fecha o acesso, o TAC de 2019 reaparece. Quase sempre o território avisou antes.
            </p>
            <h1 className="palavra entra d2" id="marco-palavra">
              <Simbolo stroke={2.2} />
              MARCO
            </h1>
            <p className="tese entra d3">Toda operação tem um CEP.</p>
            <div className="assina">
              <span>Inteligência territorial da PRINT</span>
              <span className="mono coord">22°22′S 41°47′W</span>
            </div>
          </div>

          <aside className="leitura-card entra d2" aria-label="Leitura de Macaé">
            <div className="leitura-topo">
              <h2>Macaé, RJ</h2>
              <span className="mono">IBGE 3302403</span>
            </div>
            <div className="disco-wrap">
              <Disco />
              <div className="legenda-disco">
                <div><span className="big num">74</span></div>
                <p><b>Tensão no que foi medido.</b></p>
                <div className="faixa num">entre 47 e 84</div>
                <p>Onde a tensão pode estar, contando o que ainda não foi medido. Confiança de 63%.</p>
              </div>
            </div>
            <p className="nota-proposta">Leitura medida em 24/09/2026.</p>
          </aside>
        </section>

        <section className="cap gutter" id="momentos">
          <div className="cap-cabeca">
            <h2 className="titulo">Três momentos em que o território decide por você.</h2>
            <p className="sub">Cada um tem o seu produto. Comece pelo que está na sua mesa hoje.</p>
          </div>
          <div className="grade g3">
            <article className="bloco momento">
              <span className="quando">Antes de assinar</span>
              <h3>Entrar</h3>
              <p>Saber o que o território vai cobrar de um novo projeto, de uma aquisição ou de um ativo, antes de assinar.</p>
              <p className="produto"><b>Marco Diagnóstico</b>, uma leitura por território.</p>
            </article>
            <article className="bloco momento">
              <span className="quando">Com a operação rodando</span>
              <h3>Operar</h3>
              <p>Saber antes do jornal quando algo começa a se mover em volta da operação, e o que mudou desde a última leitura.</p>
              <p className="produto"><b>Marco Radar</b>, acompanhamento diário por território.</p>
            </article>
            <article className="bloco momento">
              <span className="quando">Quando o problema chegou</span>
              <h3>Responder</h3>
              <p>Uma leitura fria do território para comunicação e jurídico decidirem com base em dado, não em boato.</p>
              <p className="produto"><b>Diagnóstico de urgência</b>, sob demanda.</p>
            </article>
          </div>
        </section>

        <section className="cap gutter" id="ficha">
          <div className="cap-cabeca">
            <h2 className="titulo">A ficha do território cabe em uma tela.</h2>
            <p className="sub">Em que nível está, quanto o número sabe, o que sustenta a leitura. O texto longo fica atrás, para quem quiser abrir.</p>
          </div>
          <div className="tela">
            <BarraTela caminho="Radar / Macaé" dir="leitura de 24/09/2026" />
            <div className="tela-corpo">
              <div className="ficha-cabeca">
                <h3>Macaé, RJ</h3>
                <div className="mono"><span>IBGE 3302403</span><span>22°22′S 41°47′W</span><span>246.391 hab.</span></div>
              </div>
              <div className="ficha-grade">
                <div className="painel">
                  <h4>Leitura</h4>
                  <div className="leitura-num">
                    <span className="n">74</span>
                    <span className="r">tensão alta</span>
                  </div>
                  <p style={{ margin: "8px 0 14px", fontSize: 16 }}>Faixa possível <b className="num">47 a 84</b>. Confiança <b>63%</b>.</p>
                  <p className="fraco" style={{ fontSize: 15, margin: 0 }}>
                    Socioambiental e Governança ainda sem evidência capaz de mover o número. Quando entrarem, a faixa estreita.
                  </p>
                </div>
                <div className="painel">
                  <h4>Dimensões</h4>
                  <div className="dims">
                    <Dim nome="Socioambiental" />
                    <Dim nome="Socioeconômica" v={29} cor="var(--t-baixa)" />
                    <Dim nome="Infraestrutura" v={95} cor="var(--t-alta)" />
                    <Dim nome="Dinâmica territorial" v={78} cor="var(--t-media)" />
                    <Dim nome="Governança" />
                    <Dim nome="Reputação" v={98} cor="var(--t-alta)" />
                  </div>
                </div>
                <div className="painel">
                  <h4>O que sustenta</h4>
                  <div className="fatos">
                    <div className="fato"><b>R$ 6.464 de salário médio formal<span className="pct">maior do país</span></b><span>IBGE CEMPRE, 2021</span></div>
                    <div className="fato"><b>47 vínculos formais por 100 hab.<span className="pct">p99</span></b><span>CEMPRE ÷ Censo 2022</span></div>
                    <div className="fato"><b>202 hab/km²<span className="pct">p93</span></b><span>Censo 2022</span></div>
                    <div className="fato"><b>337 indígenas residentes<span className="pct">p64 por mil hab.</span></b><span>Censo 2022</span></div>
                  </div>
                </div>
              </div>
              <div className="sinais" aria-label="Sinais verificados">
                <div className="sinal">
                  <span><span className="fonte-tag tier-1">Fogo Cruzado</span></span>
                  <span>Nenhum tiroteio registrado em Macaé nos últimos 30 dias.</span>
                  <span className="origem">base oficial, filtrada por município</span>
                </div>
                <div className="sinal">
                  <span><span className="fonte-tag tier-2">Imprensa</span></span>
                  <span>Defesa Civil de Macaé emitiu alerta de ressaca com ondas de até 3 metros sobre a orla e o bairro Fronteira.</span>
                  <span className="origem">cita Macaé, verificado</span>
                </div>
                <div className="sinal">
                  <span><span className="fonte-tag tier-1">ANEEL</span></span>
                  <span>7 empreendimentos de geração registrados no município.</span>
                  <span className="origem">base oficial</span>
                </div>
              </div>
            </div>
          </div>
          <p className="tela-legenda">Dados reais da leitura de Macaé em 24/09/2026. Cada número aponta a fonte e o ano.</p>
        </section>

        <section className="cap gutter" id="consulta">
          <div className="cap-cabeca">
            <h2 className="titulo">Veja o que dá para saber de um território agora, de graça.</h2>
            <p className="sub">A consulta estrutural usa só dado oficial, sai na hora e mostra também o que falta. Exemplo com Altamira.</p>
          </div>
          <div className="tela">
            <BarraTela caminho="Consulta / Altamira, PA" dir="fora do Radar" />
            <div className="tela-corpo gratis">
              <div>
                <div className="ficha-cabeca" style={{ marginBottom: 14 }}>
                  <h3>Altamira, PA</h3>
                  <div className="mono"><span>IBGE 1500602</span></div>
                </div>
                <p style={{ fontSize: 19, marginBottom: 18 }}>O que dá para saber de Altamira agora, sem esperar coleta.</p>
                <div className="dims">
                  <Dim nome="Socioeconômica" v={35} cor="var(--t-baixa)" />
                  <Dim nome="Infraestrutura" v={97} cor="var(--t-alta)" />
                  <Dim nome="Dinâmica territorial" v={95} cor="var(--t-alta)" />
                </div>
                <div className="falta">Falta para a leitura completa: socioambiental, governança, reputação e os sinais dos últimos 24 meses.</div>
                <div className="pedido">
                  <button className="cta" type="button" disabled={pedido} onClick={() => setPedido(true)}>
                    Pedir a leitura completa
                  </button>
                  <span className="muted" role="status" aria-live="polite" hidden={!pedido}>
                    Pedido registrado nesta tela. Ainda não enviamos nada: o envio real entra com o lançamento.
                  </span>
                </div>
              </div>
              <div className="painel">
                <h4>O que sustenta</h4>
                <div className="fatos">
                  <div className="fato"><b>159.533 km²<span className="pct">maior do país</span></b><span>Censo 2022</span></div>
                  <div className="fato"><b>0,79 hab/km²<span className="pct">p1</span></b><span>Censo 2022, território rarefeito</span></div>
                  <div className="fato"><b>6.194 indígenas residentes<span className="pct">p95 por mil hab.</span></b><span>Censo 2022, 49 por mil habitantes</span></div>
                  <div className="fato"><b>R$ 2.413 de salário médio formal<span className="pct">p74</span></b><span>IBGE CEMPRE, 2021</span></div>
                  <div className="fato"><b>126.279 hab.<span className="pct">p96</span></b><span>Censo 2022</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cap gutter" id="medicao">
          <div className="cap-cabeca">
            <h2 className="titulo">Dois números, e o segundo diz quanto confiar no primeiro.</h2>
          </div>
          <div className="grade g3">
            <div className="bloco">
              <h3>Tensão</h3>
              <p>De 0 a 100, calculada só sobre o que tem evidência. Quanto maior, mais o território tende a cobrar de quem opera nele.</p>
            </div>
            <div className="bloco">
              <h3>Confiança</h3>
              <p>O peso da metodologia que foi de fato medido. O que ainda falta vira faixa, não chute: por isso Macaé é 74, entre 47 e 84.</p>
            </div>
            <div className="bloco">
              <h3>Sem alarme</h3>
              <p>A escala vai de sálvia a óxido, as cores do próprio terreno. Número com margem, sem cenário dramático.</p>
            </div>
          </div>
          <div className="escala" aria-label="Escala de tensão">
            <div style={{ background: "#5E8A6F" }}><b>0 a 39</b>baixa</div>
            <div style={{ background: "#8C8A45" }}><b>40 a 59</b>moderada</div>
            <div style={{ background: "#B38A2F" }}><b>60 a 79</b>alta</div>
            <div style={{ background: "#9B4424" }}><b>80 a 100</b>muito alta</div>
          </div>
          <div className="fontes" aria-label="Fontes oficiais">
            {["IBGE", "CEMPRE", "Censo", "ANEEL", "Fogo Cruzado"].map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
          <p className="humana">Toda leitura passa por um analista antes de ser publicada. O dado é oficial, e a publicação é humana.</p>
        </section>
      </main>

      <footer className="rodape gutter">
        <span className="powered">
          <span>powered by</span>
          <img className="logo-clara" src="/brand/print-logo.png" alt="PRINT" />
          <img className="logo-escura" src="/brand/print-logo-white.png" alt="PRINT" />
        </span>
        <span>Marco é o nome proposto para a inteligência territorial da PRINT.</span>
      </footer>
    </div>
  );
}
