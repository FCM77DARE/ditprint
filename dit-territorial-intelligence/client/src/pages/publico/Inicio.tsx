import { useEffect, useRef, useState } from "react";
import BuscaLeitura from "./BuscaLeitura";
import { Acao, Rodape, Rotulo, Seta, Topo, Vertice, reduzirMotion as reduzir, useMagnetico } from "./MarcoShell";

/*
 * Home do Marco (redesign 30/09/2026, feito na sessão principal a pedido do Felipe:
 * "resolve o front e depois ensina para eles").
 * Referência principal: a home do ditoo (auditia/ai-audit/client/src/pages/Home.tsx):
 * hero escuro com arte própria, a pesquisa como ação principal, um gesto único de marca,
 * demonstração que toca sozinha, seções escuras e claras alternadas, motion por GSAP e Lenis.
 * Identidade própria do Marco: o vértice geodésico (triângulo com ponto) sobre curvas de nível.
 * O gesto é o ponto se fixar em laranja de baliza. Tudo preso a .mh.
 */


// ─── Fatos que a página mostra (todos conferidos no código ou numa leitura real) ──

// As seis dimensões e o que cada uma olha: shared/metodologia.ts e server/stt/calculator.ts.
const DIMENSOES = [
  { cod: "D1", nome: "Socioambiental", olha: "Bioma, áreas protegidas, embargos, passivos e ações civis públicas." },
  { cod: "D2", nome: "Socioeconômica", olha: "Renda, emprego formal, desigualdade e escala da economia local." },
  { cod: "D3", nome: "Infraestrutura e serviços", olha: "Saúde, saneamento, educação, logística e obras em curso." },
  { cod: "D4", nome: "Dinâmica territorial", olha: "Uso do solo, conflitos, expansão urbana e populações tradicionais." },
  { cod: "D5", nome: "Governança", olha: "Capacidade fiscal, contas entregues, contratos e articulação pública." },
  { cod: "D6", nome: "Reputação e visibilidade", olha: "O que a imprensa, as buscas e as redes dizem do lugar." },
];

// Leitura real de Macaé, 24/09/2026 (a mesma da landing /marco): números com fonte e ano.
const MACAE = {
  nome: "Macaé, RJ", ibge: "3302403", coord: "22°22′S 41°47′W", data: "24/09/2026",
  tensao: 74, faixa: [47, 84] as const, confianca: 63,
  estrutural: [
    { t: "R$ 6.464 de salário médio formal", f: "IBGE CEMPRE, 2021" },
    { t: "47 vínculos formais por 100 hab.", f: "CEMPRE ÷ Censo 2022" },
    { t: "202 hab/km²", f: "Censo 2022" },
  ],
  sinais: [
    { fonte: "Fogo Cruzado", t: "Nenhum tiroteio registrado em Macaé nos últimos 30 dias." },
    { fonte: "Imprensa verificada", t: "Defesa Civil de Macaé emitiu alerta de ressaca com ondas de até 3 metros sobre a orla e o bairro Fronteira." },
    { fonte: "ANEEL", t: "7 empreendimentos de geração registrados no município." },
  ],
  dims: [
    { nome: "Socioambiental", v: null }, { nome: "Socioeconômica", v: 29 }, { nome: "Infraestrutura", v: 95 },
    { nome: "Dinâmica territorial", v: 78 }, { nome: "Governança", v: null }, { nome: "Reputação", v: 98 },
  ] as { nome: string; v: number | null }[],
};

const ESCADA = [
  { n: "01", t: "Leitura gratuita", d: "Você digita o território e a leitura roda na sua tela: dado oficial na hora e os sinais chegando enquanto as fontes respondem.", cta: "Ler agora", href: "#leitura" },
  { n: "02", t: "Diagnóstico completo", d: "Todas as dimensões abertas, cada sinal com fonte e data, previsão, recomendações por momento e a nota de um analista da PRINT.", cta: "Pedir o completo", href: "#completa" },
  { n: "03", t: "Marco Radar", d: "O território acompanhado todo dia. Você fica sabendo antes do jornal quando alguma coisa começa a se mexer.", cta: "Conhecer o Radar", href: "/radar" },
  { n: "04", t: "Diagnóstico no local", d: "A equipe da PRINT vai ao território: escuta, campo e articulação, para a decisão que não cabe numa tela.", cta: "Falar com a PRINT", href: "#completa" },
];

const FAQ = [
  { p: "O que eu recebo de graça?", r: "A leitura estrutural do município na hora, com a fonte e o ano de cada número, e a leitura dos sinais recentes rodando na sua tela. O que fica atrás do cadastro é o relatório inteiro e a nota do analista." },
  { p: "Já contratamos consultoria para isso.", r: "O Marco não substitui a visita. Ele diz onde olhar primeiro e deixa o território acompanhado entre uma visita e outra. Quando a decisão pede campo, a PRINT vai ao local." },
  { p: "De onde vêm os números?", r: "De base oficial (IBGE, Tesouro, IBAMA, Defesa Civil, ANEEL e outras) e de notícia que cita o município pelo nome, verificada antes de entrar. Cada número mostra a fonte." },
  { p: "E quando falta dado?", r: "O Marco diz que falta. A Tensão é calculada só sobre o que foi medido, e a Confiança mostra quanto do território foi de fato lido. O que falta vira faixa, não chute." },
  { p: "Quem publica a nota do território?", r: "Um analista da PRINT. A máquina coleta e calcula; nenhuma leitura de assinante vai ao ar sem revisão humana." },
];

// ─── Demonstração do "como funciona" ───────────────────────────────────────

function Demo({ p, tudo }: { p: number; tudo: boolean }) {
  const lim = (v: number) => Math.max(0, Math.min(1, v));
  const cena = tudo ? 3 : p < 0.3 ? 0 : p < 0.68 ? 1 : 2;
  const digitado = MACAE.nome.slice(0, Math.round((tudo ? 1 : lim(p / 0.24)) * MACAE.nome.length));
  const tSinais = tudo ? 1 : lim((p - 0.3) / 0.34);
  const tRes = tudo ? 1 : lim((p - 0.68) / 0.24);
  return (
    <figure className="tela" aria-hidden="true">
      <div className="tela-topo">
        <Vertice fixo={cena >= 2} />
        <span>Primeira leitura · {MACAE.nome}</span>
        <i className="tela-prog"><b style={{ width: `${(tudo ? 1 : p) * 100}%` }} /></i>
      </div>
      <div className={`cena ${cena === 0 || tudo ? "ativa" : ""}`}>
        <div className="demo-busca">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
          <span className="digitado">{digitado}<i className="cursor" /></span>
          <span className={`demo-botao ${digitado.length === MACAE.nome.length ? "aceso" : ""}`}><Vertice fixo={digitado.length === MACAE.nome.length} />Ler este território</span>
        </div>
        <div className="demo-estrutural">
          {MACAE.estrutural.map((e, i) => (
            <div key={e.t} className={`fato ${lim((tudo ? 1 : p / 0.3) * 3 - i) > 0.5 ? "fixou" : ""}`}><b>{e.t}</b><span>{e.f}</span></div>
          ))}
        </div>
      </div>
      <div className={`cena ${cena === 1 || tudo ? "ativa" : ""}`}>
        <p className="cena-t">Sinais verificados chegando</p>
        <ol className="feed">
          {MACAE.sinais.map((s, i) => (
            <li key={s.t} className={lim(tSinais * 3.2 - i) > 0.4 ? "fixou" : ""}>
              <Vertice fixo={lim(tSinais * 3.2 - i) > 0.9} />
              <div><span className="fonte">{s.fonte}</span><p>{s.t}</p></div>
            </li>
          ))}
        </ol>
      </div>
      <div className={`cena ${cena === 2 || tudo ? "ativa" : ""}`}>
        <div className="res">
          <div className="res-num"><strong>{Math.round(MACAE.tensao * tRes)}</strong><span>Tensão</span></div>
          <div className="res-barra">
            <span className="faixa" style={{ left: `${MACAE.faixa[0]}%`, width: `${(MACAE.faixa[1] - MACAE.faixa[0]) * tRes}%` }} />
            <span className="marco-pt" style={{ left: `${MACAE.tensao * tRes}%` }} />
          </div>
          <p className="res-nota">Faixa possível <b>{MACAE.faixa[0]} a {MACAE.faixa[1]}</b>. Confiança <b>{MACAE.confianca}%</b>.</p>
        </div>
        <div className="dims">
          {MACAE.dims.map((d, i) => (
            <div key={d.nome} className="dim">
              <span>{d.nome}</span>
              <span className="trilho">{d.v != null && <i style={{ transform: `scaleX(${(d.v / 100) * lim(tRes * 1.6 - i * 0.1)})` }} />}</span>
              <span className="v">{d.v ?? "não medida"}</span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

// ─── Pedido do Diagnóstico completo (grava lead) ─────────────────────────────

function DobraCompleta() {
  const [f, setF] = useState({ nome: "", email: "", empresa: "", territorio: "", decisao: "", interesse: "completo" });
  const [estado, setEstado] = useState<"livre" | "enviando" | "ok" | "erro">("livre");
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(v => ({ ...v, [k]: e.target.value })) });
  const pronto = f.nome.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) && f.empresa.trim();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pronto || estado === "enviando") return;
    setEstado("enviando");
    try {
      const r = await fetch("/api/dit/lead", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: f.nome.trim(), email: f.email.trim(), empresa: f.empresa.trim(),
          territorio: f.territorio.trim() || undefined, decisao: f.decisao.trim() || undefined,
          observacao: `origem: home · interesse: ${f.interesse === "local" ? "diagnóstico no local" : "diagnóstico completo"}`,
        }),
      });
      if (!r.ok) throw new Error();
      setEstado("ok");
    } catch { setEstado("erro"); }
  };

  return (
    <section className="secao escuro completa" id="completa">
      <img className="fundo" src="/arte/relevo-cta.jpg" alt="" aria-hidden="true" data-giro />
      <div className="largura grade2">
        <div>
          <Rotulo>Diagnóstico completo</Rotulo>
          <h2 className="titulo dividir">Quando a decisão pede o território inteiro.</h2>
          <p className="explica sobe">O completo abre as seis dimensões, cada sinal com fonte e data, a previsão e as recomendações para entrar, operar ou responder, com a nota assinada por um analista da PRINT.</p>
          <p className="explica sobe">Se a decisão pede campo, a PRINT vai ao local.</p>
        </div>
        {estado === "ok" ? (
          <div className="form-ok"><Vertice fixo /><strong>Pedido recebido.</strong><p>Um analista da PRINT responde no e-mail que você deixou.</p></div>
        ) : (
          <form className="form sobe" onSubmit={enviar}>
            <div className="escolha" role="radiogroup" aria-label="O que você precisa">
              <button type="button" role="radio" aria-checked={f.interesse === "completo"} onClick={() => setF(v => ({ ...v, interesse: "completo" }))}>Diagnóstico completo</button>
              <button type="button" role="radio" aria-checked={f.interesse === "local"} onClick={() => setF(v => ({ ...v, interesse: "local" }))}>Diagnóstico no local</button>
            </div>
            <input {...campo("nome")} placeholder="Seu nome" aria-label="Seu nome" autoComplete="name" />
            <input {...campo("email")} type="email" placeholder="E-mail profissional" aria-label="E-mail profissional" autoComplete="email" />
            <div className="par">
              <input {...campo("empresa")} placeholder="Empresa" aria-label="Empresa" autoComplete="organization" />
              <input {...campo("territorio")} placeholder="Território (opcional)" aria-label="Território (opcional)" />
            </div>
            <textarea {...campo("decisao")} rows={3} maxLength={1000} placeholder="Que decisão você precisa tomar? (opcional)" aria-label="Que decisão você precisa tomar? (opcional)" />
            {estado === "erro" && <p className="erro">Não conseguimos registrar agora. Tente de novo em instantes.</p>}
            <button className="acao clara" type="submit" disabled={!pronto || estado === "enviando"} data-magnetico>
              <Vertice />{estado === "enviando" ? "Enviando" : "Pedir o diagnóstico"}<Seta />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────

export default function Inicio() {
  const raiz = useRef<HTMLDivElement>(null);
  const [demo, setDemo] = useState({ p: 0, tudo: false });
  const [etapa, setEtapa] = useState(0);
  const irPara = useRef<(i: number) => void>(() => {});

  useMagnetico(raiz);

  // Motion: GSAP + ScrollTrigger + Lenis, carregados só aqui. Receita do ditoo (Home.tsx).
  useEffect(() => {
    const r = raiz.current;
    if (!r) return;
    const dimsGrade = Array.from(r.querySelectorAll<HTMLLIElement>(".grade6 li"));
    const n6 = r.querySelector<HTMLSpanElement>("#n6");
    const etapaDe = (p: number) => (p < 0.3 ? 0 : p < 0.68 ? 1 : 2);

    if (reduzir()) {
      dimsGrade.forEach(li => li.classList.add("fixou"));
      if (n6) n6.textContent = "6";
      setDemo({ p: 1, tudo: false });
      setEtapa(2);
      irPara.current = i => { const p = [0.25, 0.62, 1][i]; setDemo({ p, tudo: false }); setEtapa(i); };
      return;
    }

    let desfazer = () => {};
    let vivo = true;
    (async () => {
      const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import("gsap"), import("gsap/ScrollTrigger"), import("lenis"),
      ]);
      if (!vivo) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      const ancoras = Array.from(r.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
      const aoClicar = (e: MouseEvent) => {
        const alvo = (e.currentTarget as HTMLAnchorElement).getAttribute("href") ?? "";
        if (alvo.length < 2) return;
        e.preventDefault(); lenis.scrollTo(alvo, { offset: -80 });
      };
      ancoras.forEach(a => a.addEventListener("click", aoClicar));

      const ctx = gsap.context(() => {
        // Títulos em cortina, nítidos o tempo todo.
        r.querySelectorAll<HTMLElement>(".dividir").forEach(el => {
          const hero = el.tagName === "H1";
          gsap.fromTo(el, { clipPath: "inset(0% 0% 100% 0%)", y: 26 }, {
            clipPath: "inset(0% 0% -20% 0%)", y: 0, duration: hero ? 1.1 : 0.95, ease: "power4.out", delay: hero ? 0.15 : 0,
            clearProps: "clipPath", scrollTrigger: hero ? undefined : { trigger: el, start: "top 85%" },
          });
        });
        gsap.from(".hero .entra", { autoAlpha: 0, y: 16, duration: 0.7, ease: "power2.out", stagger: 0.08, delay: 0.45 });
        gsap.to(".hero .fundo", { yPercent: 10, scale: 1.12, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
        // O vértice do hero: o ponto se fixa depois que o título entra.
        gsap.delayedCall(1.2, () => r.querySelector(".hero-vx")?.classList.add("fixo"));

        // As seis dimensões fixam em sequência, com o contador.
        const cont = { k: 0 };
        if (n6) n6.textContent = "0";
        ScrollTrigger.create({
          trigger: ".grade6", start: "top 80%", once: true,
          onEnter: () => gsap.to(cont, { k: 6, duration: 1.4, ease: "power1.inOut", onUpdate: () => {
            const k = Math.round(cont.k);
            dimsGrade.forEach((li, i) => li.classList.toggle("fixou", i < k));
            if (n6) n6.textContent = String(k);
          } }),
        });

        // Demonstração: toca sozinha ao aparecer; clicar num passo vai direto a ele.
        const est = { p: 0 };
        const pintar = () => { setDemo({ p: est.p, tudo: false }); setEtapa(etapaDe(est.p)); };
        const tocar = gsap.to(est, { p: 1, duration: 10, ease: "none", paused: true, onUpdate: pintar });
        ScrollTrigger.create({ trigger: ".tela", start: "top 75%", once: true, onEnter: () => tocar.play() });
        irPara.current = i => { tocar.pause(); gsap.to(est, { p: [0.25, 0.62, 1][i], duration: 0.8, ease: "power2.out", onUpdate: pintar }); };

        gsap.utils.toArray<HTMLElement>(".sobe").forEach(el => gsap.from(el, { autoAlpha: 0, y: 20, duration: 0.7, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 88%" } }));
        gsap.utils.toArray<HTMLElement>(".lista-sobe").forEach(l => gsap.from(l.children, { autoAlpha: 0, y: 28, duration: 0.8, stagger: 0.09, ease: "power3.out", scrollTrigger: { trigger: l, start: "top 85%" } }));
        gsap.utils.toArray<HTMLElement>("[data-paralaxe]").forEach(img => gsap.fromTo(img, { yPercent: -Number(img.dataset.paralaxe) }, { yPercent: Number(img.dataset.paralaxe), ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } }));
        gsap.utils.toArray<HTMLElement>("[data-escala]").forEach(img => gsap.fromTo(img, { scale: 1.2 }, { scale: 1, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } }));
        gsap.utils.toArray<HTMLElement>("[data-giro]").forEach(img => gsap.fromTo(img, { rotate: -4, scale: 1.1 }, { rotate: 3, scale: 1.18, ease: "none", scrollTrigger: { trigger: img.closest("section"), start: "top bottom", end: "bottom top", scrub: true } }));
      }, r);

      const recalcular = () => ScrollTrigger.refresh();
      window.addEventListener("load", recalcular);
      document.fonts?.ready.then(recalcular);
      // Aba em segundo plano pausa a animação: nada acima da dobra fica escondido.
      const garantia = window.setTimeout(() => {
        r.querySelectorAll<HTMLElement>(".hero .dividir, .hero .entra").forEach(el => {
          if (Number(getComputedStyle(el).opacity) < 0.5 || el.style.clipPath) { gsap.killTweensOf(el); gsap.set(el, { clearProps: "all" }); }
        });
      }, 2500);

      desfazer = () => {
        window.clearTimeout(garantia);
        window.removeEventListener("load", recalcular);
        ancoras.forEach(a => a.removeEventListener("click", aoClicar));
        ctx.revert();
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    })();
    return () => { vivo = false; desfazer(); };
  }, []);

  return (
    <div className="mh" ref={raiz}>
      <Topo raiz={raiz} nav={[
        { href: "#como-funciona", rotulo: "Como funciona" },
        { href: "#escada", rotulo: "O que você recebe" },
        { href: "/metodologia", rotulo: "Metodologia" },
        { href: "/est", rotulo: "EST" },
        { href: "/entrar", rotulo: "Entrar" },
      ]} pedir={{ href: "#completa", rotulo: "Diagnóstico completo" }} />

      <main>
        {/* 1 · Hero: o relevo é a arte da marca; o marco fica no topo do morro */}
        <section className="hero" id="leitura">
          <img className="fundo" src="/arte/relevo-hero.jpg" alt="" aria-hidden="true" fetchPriority="high" />
          <div className="veu" />
          <div className="largura">
            <span className="selo entra"><Vertice fixo className="hero-vx" />Primeira leitura gratuita · qualquer município do Brasil</span>
            <h1 className="dividir">Toda operação tem um CEP.</h1>
            <p className="sub entra">O território decide. Leia o que ele diz antes de assinar.</p>
            <div className="busca entra"><BuscaLeitura variante="hero" /></div>
            <div className="hero-base entra">
              <p className="credencial"><strong>Dado oficial dos 5.571 municípios, sinais verificados e um analista antes de publicar.</strong>A primeira leitura sai na hora. O resto chega enquanto as fontes respondem.</p>
              <div className="fila" aria-hidden="true">{DIMENSOES.map(d => <Vertice key={d.cod} fixo />)}</div>
            </div>
          </div>
        </section>

        {/* 2 · As seis dimensões */}
        <section className="escuro seis" aria-labelledby="t6">
          <div className="largura">
            <div className="cab">
              <div>
                <h2 id="t6" className="dividir">Seis dimensões lidas em cada território</h2>
                <p className="metodo">A mesma régua em todo município. Uma leitura se compara com a seguinte.</p>
              </div>
              <div className="contador" aria-hidden="true"><span id="n6">6</span><small>/6</small></div>
            </div>
            <ol className="grade6">
              {DIMENSOES.map(d => (
                <li key={d.cod}><Vertice /><div><span className="cod">{d.cod}</span><h3>{d.nome}</h3><p>{d.olha}</p></div></li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3 · Como funciona: a leitura de Macaé toca sozinha */}
        <section className="como" id="como-funciona" aria-labelledby="t-como">
          <img className="curvas" src="/arte/relevo-papel.jpg" alt="" aria-hidden="true" />
          <div className="largura como-grade">
            <div>
              <Rotulo>Como funciona</Rotulo>
              <h2 id="t-como" className="titulo dividir">Você digita o território. O Marco faz o levantamento.</h2>
              <ol className="etapas">
                {[
                  { t: "Você escolhe o município", d: "Só o nome. A leitura estrutural sai na hora, com a fonte e o ano de cada número." },
                  { t: "As fontes respondem ao vivo", d: "Cada sinal que cita o território pelo nome é verificado e entra na tela enquanto chega." },
                  { t: "A Tensão fecha com a Confiança", d: "O número é calculado só sobre o que foi medido. O que falta vira faixa, não chute." },
                ].map((s, i) => (
                  <li key={s.t} className={etapa === i ? "ativa" : ""} onClick={() => irPara.current(i)}>
                    <span className="n">{i + 1}</span><div><h3>{s.t}</h3><p>{s.d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <Demo p={demo.p} tudo={demo.tudo} />
              <p className="legenda">Leitura real de {MACAE.nome} em {MACAE.data}. Cada número aponta a fonte e o ano.</p>
            </div>
          </div>
        </section>

        {/* 4 · A escada */}
        <section className="secao escada" id="escada">
          <div className="largura">
            <Rotulo>O que você recebe</Rotulo>
            <h2 className="titulo dividir">Comece de graça. Suba quando a decisão pedir.</h2>
            <ol className="degraus lista-sobe">
              {ESCADA.map(e => (
                <li key={e.n}>
                  <span className="n">{e.n}</span>
                  <h3>{e.t}</h3>
                  <p>{e.d}</p>
                  <Acao href={e.href}>{e.cta}</Acao>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5 · Antes e depois, atravessado pelos estratos */}
        <section id="antes-depois">
          <div className="estratos">
            <img src="/arte/estratos.jpg" alt="" aria-hidden="true" data-paralaxe="12" />
            <div className="largura">
              <Rotulo>Os três momentos</Rotulo>
              <h2 className="titulo dividir">Entrar, operar ou responder. Em qualquer um deles, o território decide antes do contrato.</h2>
            </div>
          </div>
          <div className="duas">
            <div className="coluna sem">
              <h3>Sem o Marco</h3>
              <ul className="lista-sobe">
                {["A due diligence olha o ativo e esquece o lugar.", "Você descobre a mudança no território pelo jornal.", "Cada consultoria entrega uma régua diferente.", "Não existe como comparar este mês com o anterior."].map(t => (
                  <li key={t}><Vertice />{t}</li>
                ))}
              </ul>
            </div>
            <div className="coluna com">
              <h3>Com o Marco</h3>
              <ul className="lista-sobe">
                {["Você entra sabendo o que o território vai cobrar.", "O Radar avisa quando alguma coisa começa a se mexer.", "A mesma régua em todos os municípios, com a fonte de cada número.", "A Tensão marca a série, leitura após leitura."].map(t => (
                  <li key={t}><Vertice fixo />{t}</li>
                ))}
              </ul>
              <Acao href="#leitura" clara>Ler o meu território</Acao>
            </div>
          </div>
        </section>

        {/* 6 · Chamada */}
        <section className="escuro chamada">
          <img className="fundo" src="/arte/relevo-escuro.jpg" alt="" aria-hidden="true" data-escala />
          <div className="largura">
            <h2 className="dividir">Antes de assinar, leia o lugar. <em>A primeira leitura é gratuita e sai na sua tela.</em></h2>
            <div className="busca sobe"><BuscaLeitura variante="hero" /></div>
          </div>
        </section>

        {/* 7 · Dúvidas */}
        <section className="secao" id="duvidas">
          <div className="largura faq-grade">
            <div className="fixo">
              <Rotulo>Dúvidas</Rotulo>
              <h2 className="titulo dividir">As perguntas que travam a decisão</h2>
            </div>
            <div>
              {FAQ.map(f => (
                <details key={f.p}>
                  <summary>{f.p}<Vertice /></summary>
                  <p>{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <DobraCompleta />
      </main>

      <Rodape />
    </div>
  );
}
