/**
 * Renderizador do Diagnóstico completo (relatório Marco).
 *
 * Devolve STRING de HTML. A rota React injeta essa string e o gerador estático a
 * embrulha num documento: por isso a marcação é a MESMA nos dois lugares, sem
 * divergência possível. Todo dado passa por `t()` (limpeza + escape) ou `esc()`.
 *
 * Regras de texto que valem para tudo que sai daqui:
 *  - nome de produto é Marco; "DIT" e "STT" do texto gerado viram Marco e Tensão;
 *  - travessão nunca aparece (travessão de dado vira vírgula ou hífen);
 *  - número sem fonte não entra: sem dado, o bloco diz que não foi medido.
 */

import type {
  DadosRelatorio,
  DimensaoRel,
  RecomendacaoRel,
  SinalRel,
} from "./tipos";

// ─── utilidades de texto ────────────────────────────────────────────────────

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v: unknown): string => String(v ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

/** Limpa o texto vindo do pipeline antes de escapar. */
export function limpar(v: unknown): string {
  return String(v ?? "")
    .replace(/\bDIT\b/g, "Marco")
    .replace(/\bSTT Global\b/g, "Tensão")
    .replace(/\bSTT\b/g, "Tensão")
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/[—–]/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
}
const t = (v: unknown): string => esc(limpar(v));

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dataLonga = (iso: string | null | undefined): string => {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : "";
};
const dataCurta = (iso: string | null | undefined): string => {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const int = (x: number): string => Math.round(x).toLocaleString("pt-BR");
const dec = (x: number, casas = 2): string => x.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const pesoPct = (p: number): string => `${Math.round(p * 100)}%`;

function coordenada(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return "";
  return `${dec(Math.abs(lat), 4)}° ${lat < 0 ? "S" : "N"} · ${dec(Math.abs(lng), 4)}° ${lng < 0 ? "O" : "L"}`;
}

function hostDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
const link = (url: string | null, texto: string): string =>
  url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${texto}</a>` : texto;

// ─── escala de tensão ───────────────────────────────────────────────────────

const FAIXAS = [
  { id: 1, rotulo: "Baixa" },
  { id: 2, rotulo: "Moderada" },
  { id: 3, rotulo: "Elevada" },
  { id: 4, rotulo: "Alta" },
  { id: 5, rotulo: "Crítica" },
] as const;
const faixaDe = (v: number) => FAIXAS[Math.min(4, Math.max(0, Math.floor(v / 20)))];
const marcaFaixa = (id: number): string =>
  `<span class="mf" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<i${i <= id ? ' class="on"' : ""}></i>`).join("")}</span>`;

// ─── curvas de nível deterministas (uma assinatura por município) ───────────

function semente(txt: string): () => number {
  let h = 2166136261;
  for (const ch of txt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function curvas(chave: string): string {
  const r = semente(chave || "marco");
  const f1 = 2 + Math.floor(r() * 2), f2 = 3 + Math.floor(r() * 3), p1 = r() * 6.28, p2 = r() * 6.28;
  const a1 = 0.1 + r() * 0.06, a2 = 0.05 + r() * 0.05;
  const cx = 300, cy = 300, N = 72;
  const aneis: string[] = [];
  for (let k = 1; k <= 11; k++) {
    const base = 26 * k + 10;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2;
      const rad = base * (1 + a1 * Math.sin(f1 * ang + p1 + k * 0.11) + a2 * Math.sin(f2 * ang + p2 - k * 0.07));
      pts.push([cx + rad * Math.cos(ang) * 1.12, cy + rad * Math.sin(ang) * 0.92]);
    }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N], p1_ = pts[i], p2_ = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
      const c1 = [p1_[0] + (p2_[0] - p0[0]) / 6, p1_[1] + (p2_[1] - p0[1]) / 6];
      const c2 = [p2_[0] - (p3[0] - p1_[0]) / 6, p2_[1] - (p3[1] - p1_[1]) / 6];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2_[0].toFixed(1)} ${p2_[1].toFixed(1)}`;
    }
    aneis.push(`<path d="${d}Z"${k % 4 === 0 ? ' class="mestra"' : ""}/>`);
  }
  return `<svg class="rl-curvas" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${aneis.join("")}</svg>`;
}

// ─── blocos ─────────────────────────────────────────────────────────────────

const MARCA_SVG = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false"><path d="M16 4.5 28 25.5H4Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="miter"/><circle cx="16" cy="19" r="2.2" fill="var(--bronze)"/></svg>`;

const rv = (extra = ""): string => `class="rv${extra ? " " + extra : ""}"`;

function barraTensao(v: number | null, faixa: { min: number; max: number } | null, grande = false): string {
  const ticks = [0, 20, 40, 60, 80, 100].map((x) => `<span style="left:${x}%">${x}</span>`).join("");
  if (v === null) {
    return `<div class="tz${grande ? " grande" : ""}"><div class="tz-trilho"><div class="tz-vazio"></div></div><div class="tz-ticks">${ticks}</div></div>`;
  }
  const f = faixaDe(v);
  const band =
    faixa && faixa.max > faixa.min
      ? `<div class="tz-faixa" style="left:${faixa.min}%;width:${faixa.max - faixa.min}%" title="Faixa possível: ${faixa.min} a ${faixa.max}"></div>`
      : "";
  return `<div class="tz${grande ? " grande" : ""} f${f.id}">
    <div class="tz-trilho">${band}<div class="tz-fill bar" style="--v:${v}"></div><div class="tz-marca" style="left:${v}%"></div></div>
    <div class="tz-ticks" aria-hidden="true">${ticks}</div>
  </div>`;
}

function capa(d: DadosRelatorio): string {
  const { territorio: tr, leitura: l, coleta: c } = d;
  const f = l.tensao !== null ? faixaDe(l.tensao) : null;
  const largura = l.faixa.max - l.faixa.min;
  const meta = [
    tr.ibge ? `<span class="chip mono">IBGE ${esc(tr.ibge)}</span>` : "",
    coordenada(tr.lat, tr.lng) ? `<span class="chip mono">${esc(coordenada(tr.lat, tr.lng))}</span>` : "",
    tr.regiao ? `<span class="chip">${t(tr.regiao)}</span>` : "",
    tr.microrregiao ? `<span class="chip">Microrregião ${t(tr.microrregiao)}</span>` : "",
  ]
    .filter(Boolean)
    .join("");
  const lido = dataLonga(c.coletadoEm ?? d.geradoEm);
  return `<header id="capa" class="rl-capa gutter">
  ${curvas(tr.ibge ?? tr.nome)}
  <div class="rl-capa-texto">
    <p class="eyebrow rv">Marco · Diagnóstico completo</p>
    <h1 class="rv d1">${t(tr.nome)}<small>${esc(tr.uf)}</small></h1>
    <div class="capa-meta rv d2">${meta}</div>
    <p class="capa-lido rv d3">Leitura de ${esc(lido)}${c.fontesConsultadas ? `, sobre ${int(c.fontesConsultadas)} fontes consultadas` : ""}. Todo número tem fonte e data; o que não foi medido está dito.</p>
  </div>
  <aside class="rl-capa-card rv d2" aria-label="Tensão e Confiança">
    <div class="cc-topo"><span class="cc-rot">Tensão</span>${f ? `<span class="cc-faixa f${f.id}">${marcaFaixa(f.id)}${f.rotulo}</span>` : ""}</div>
    <div class="cc-num">${l.tensao !== null ? `<b>${l.tensao}</b><span>de 100</span>` : `<b class="sem">Não medida</b>`}</div>
    ${barraTensao(l.tensao, l.tensao !== null ? l.faixa : null, true)}
    <dl class="cc-dados">
      <div><dt>Confiança</dt><dd><b>${l.confianca}%</b><span class="mini"><i class="bar" style="--v:${l.confianca}"></i></span></dd></div>
      <div><dt>Faixa possível</dt><dd><b>${l.faixa.min} a ${l.faixa.max}</b></dd></div>
    </dl>
    <p class="cc-nota">${
      l.tensao === null
        ? "Nenhuma dimensão tem evidência suficiente para medir a tensão."
        : largura === 0
          ? `As seis dimensões foram medidas: a faixa se fecha no valor.`
          : `A faixa tem largura ${largura} porque ${100 - l.confianca}% do peso da metodologia não foi medido. O número fica entre ${l.faixa.min} e ${l.faixa.max}.`
    }</p>
  </aside>
</header>`;
}

function secao(id: string, num: string, titulo: string, sub: string | null, corpo: string): string {
  return `<section id="${id}" class="cap gutter">
  <div class="cap-cabeca rv"><span class="cap-num mono">${num}</span><h2>${titulo}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}</div>
  ${corpo}
</section>`;
}

function sintese(d: DadosRelatorio): string {
  if (!d.sintese.length) {
    return secao("sintese", "01", "Síntese", null, `<p class="vazio-txt">A leitura não trouxe síntese executiva para este território.</p>`);
  }
  const [lead, ...resto] = d.sintese;
  const l = d.leitura;
  const f = l.tensao !== null ? faixaDe(l.tensao) : null;
  const titulo = f
    ? `${t(d.territorio.nome)} está em tensão ${f.rotulo.toLowerCase()}, com confiança de ${l.confianca}%.`
    : `${t(d.territorio.nome)}: tensão ainda não medida.`;
  return secao(
    "sintese",
    "01",
    titulo,
    null,
    `<div class="sintese">
    <p class="lead rv">${t(lead)}</p>
    <div class="colunas rv">${resto.map((p) => `<p>${t(p)}</p>`).join("")}</div>
  </div>`
  );
}

function mudouEDecide(d: DadosRelatorio): string {
  const m = d.mudou;
  const hist = m.anterior
    ? `<p class="comp">Leitura anterior: <b class="num">${dec(m.anterior.valor, 0)}</b> em ${dataCurta(m.anterior.data)} (série histórica do índice).</p>`
    : `<p class="comp">Primeira leitura publicada deste território: não há leitura anterior para comparar. O Marco Radar passa a medir a mudança a partir daqui.</p>`;
  const semana = m.semana.length
    ? `<ul class="linha-tempo">${m.semana
        .map(
          (x) =>
            `<li><time class="mono">${dataCurta(x.data)}</time><div>${link(x.url, t(x.fato))}<span class="origem">${t(x.fonte)}${x.url ? ` · ${esc(hostDe(x.url))}` : ""}</span></div></li>`
        )
        .join("")}</ul>`
    : `<p class="vazio-txt">Nenhum fato novo verificado nos últimos 30 dias para este território.</p>`;
  const decide = d.decide.length
    ? d.decide
        .map(
          (x, i) =>
            `<article class="decide rv d${(i % 3) + 1}"><span class="urg">${t(x.urgencia)}</span><h3>${t(x.titulo)}</h3><p>${t(x.texto)}</p></article>`
        )
        .join("")
    : `<p class="vazio-txt">A leitura não trouxe ações para decidir.</p>`;
  return secao(
    "mudou",
    "02",
    "O que mudou e o que decide",
    null,
    `<div class="duas">
    <div class="bloco rv"><h3>O que mudou</h3>${hist}${semana}</div>
    <div class="decides">${decide}</div>
  </div>`
  );
}

function identidade(d: DadosRelatorio): string {
  const i = d.identidade;
  const linha = (rot: string, txt: string, vazio: string) =>
    `<div class="id-item rv"><h3>${rot}</h3>${txt ? `<p>${t(txt)}</p>` : `<p class="vazio-txt">${vazio}</p>`}</div>`;
  const lista = (itens: string[], vazio: string) =>
    itens.length ? `<ul>${itens.map((x) => `<li>${t(x)}</li>`).join("")}</ul>` : `<p class="vazio-txt">${vazio}</p>`;
  const ind = i.indicadores.length
    ? `<div class="indicadores rv">${i.indicadores
        .map(
          (x) =>
            `<div class="ind"><span class="ind-v num">${t(x.valor)}</span><span class="ind-r">${t(x.rotulo)}</span><span class="ind-f">${t(x.fonte)}${x.ano ? `, ${esc(x.ano)}` : ""}</span></div>`
        )
        .join("")}</div>`
    : `<p class="vazio-txt rv">Nenhum indicador oficial por município foi carregado para esta leitura.</p>`;
  return secao(
    "identidade",
    "03",
    "Identidade do território",
    "Quem é o lugar antes de ser um número: onde fica, pelo que é conhecido e o que o caracteriza.",
    `<div class="id-grade">
    ${linha("Onde fica", i.localizacao, "Localização não descrita nesta leitura.")}
    ${linha("Conhecido por", i.conhecidoPor, "A leitura não identificou marco próprio nos sinais coletados.")}
    ${linha("Problema característico", i.problema, "Nenhum problema característico foi identificado com base nos sinais coletados.")}
  </div>
  ${ind}
  <div class="duas fortes">
    <div class="bloco rv"><h3>Forças</h3>${lista(i.forcas, "Nenhuma força identificada com fonte.")}</div>
    <div class="bloco rv"><h3>Fragilidades</h3>${lista(i.fragilidades, "Nenhuma fragilidade identificada com fonte.")}</div>
  </div>`
  );
}

function rotuloFonteDim(d: DimensaoRel): string {
  if (!d.medida) return "Não medida";
  return { estrutural: "Só camada estrutural", sinal: "Só sinais verificados", ambos: "Estrutural e sinais", nenhuma: "Sem evidência" }[d.fonte];
}

function linhaSinal(s: SinalRel): string {
  const quando = s.data ? dataCurta(s.data) : s.periodo ? `ref. ${esc(s.periodo)}` : "";
  const origem = `${t(s.fonte)}${s.url ? ` · ${esc(hostDe(s.url))}` : ""}`;
  const prov = !s.url && s.procedencia ? `<span class="prov">${t(s.procedencia)}</span>` : "";
  return `<li class="sn"><time class="mono">${quando || "sem data"}</time>
    <div class="sn-c">${link(s.url, t(s.titulo))}<span class="origem">${origem}${s.url ? "" : s.estrutural ? " · indicador oficial" : ""}</span>${prov}</div>
    <span class="sn-i num" title="Peso do sinal no cálculo (0 a 1)">${dec(s.impacto)}</span></li>`;
}

function blocoDimensao(dm: DimensaoRel): string {
  const f = dm.score !== null ? faixaDe(dm.score) : null;
  const primeiros = dm.sustentam.slice(0, 5);
  const resto = dm.sustentam.slice(5);
  const sustenta = dm.sustentam.length
    ? `<ul class="sinais-lista">${primeiros.map(linhaSinal).join("")}</ul>${
        resto.length
          ? `<details class="mais"><summary>Ver mais ${resto.length} sinal(is) verificado(s)</summary><ul class="sinais-lista">${resto.map(linhaSinal).join("")}</ul></details>`
          : ""
      }${
        dm.totalSinais > dm.sustentam.length
          ? `<p class="nota">Mostrados ${dm.sustentam.length} de ${dm.totalSinais} sinais verificados desta dimensão, por peso e data.</p>`
          : ""
      }`
    : `<p class="vazio-txt">Nenhum sinal verificado sustenta esta dimensão na janela de análise.</p>`;
  const buscas = dm.naoMedido.filter((x) => x.tipo === "busca");
  const outros = dm.naoMedido.filter((x) => x.tipo !== "busca");
  const nomesCurtos = (xs: typeof dm.naoMedido) => xs.map((x) => `<li>${t(x.nome.replace(/^Busca aberta\s*[—–-]\s*/i, ""))}</li>`).join("");
  const naoMedido = dm.naoMedido.length
    ? `<div class="nao-medido"><h4>O que não foi medido</h4>
      <p>${dm.fontesConsultadas} fonte(s) desta dimensão foram consultadas; ${dm.naoMedido.length} voltaram sem sinal verificado.${
        !dm.medida ? " Sem evidência suficiente, a dimensão não recebe nota: não medido não é risco zero nem risco cheio." : ""
      }</p>
      <details class="mais"><summary>Ver as ${dm.naoMedido.length} fonte(s) sem retorno</summary>
        ${outros.length ? `<p class="nota">Fontes oficiais e de imprensa sem retorno para o município</p><ul class="pontos">${nomesCurtos(outros)}</ul>` : ""}
        ${buscas.length ? `<p class="nota">Fontes de busca aberta, que dependem de busca paga e não rodaram nesta coleta</p><ul class="pontos">${nomesCurtos(buscas)}</ul>` : ""}
      </details></div>`
    : `<div class="nao-medido ok"><h4>O que não foi medido</h4><p>Todas as fontes desta dimensão retornaram.</p></div>`;
  return `<article id="dim-${esc(dm.id)}" class="dim${dm.medida ? "" : " sem"}${f ? " f" + f.id : ""} rv">
    <div class="dim-topo">
      <div class="dim-id"><span class="dim-cod mono">${esc(dm.id)}</span><h3>${t(dm.nome)}</h3></div>
      <div class="dim-meta"><span>Peso ${pesoPct(dm.peso)}</span><span class="sep">·</span><span>${rotuloFonteDim(dm)}</span></div>
    </div>
    <div class="dim-medida">
      <div class="dim-nota num">${dm.score !== null ? `<b>${Math.round(dm.score)}</b><span>${f ? marcaFaixa(f.id) + f.rotulo : ""}</span>` : `<b class="sem">Não medida</b>`}</div>
      <div class="dim-barra">${barraTensao(dm.score, null)}</div>
    </div>
    ${dm.resumo ? `<p class="dim-resumo">${t(dm.resumo)}</p>` : ""}
    <div class="dim-corpo">
      <div><h4>O que a leitura diz</h4>${dm.leitura ? `<p>${t(dm.leitura)}</p>` : `<p class="vazio-txt">A leitura não trouxe texto para esta dimensão.</p>`}</div>
      <div><h4>O que sustenta, com fonte e data</h4>${sustenta}</div>
    </div>
    ${naoMedido}
  </article>`;
}

function dimensoes(d: DadosRelatorio): string {
  const medidas = d.dimensoes.filter((x) => x.medida);
  const topo = [...medidas].sort((x, y) => (y.score ?? 0) - (x.score ?? 0))[0];
  const titulo = medidas.length
    ? `${medidas.length} de ${d.dimensoes.length} dimensões foram medidas; a que mais pesa é ${t(topo.nome)} (${Math.round(topo.score ?? 0)}).`
    : "Nenhuma das dimensões tem evidência para receber nota.";
  const resumo = d.dimensoes
    .slice()
    .sort((x, y) => (y.score ?? -1) - (x.score ?? -1))
    .map((x) => {
      const f = x.score !== null ? faixaDe(x.score) : null;
      return `<a class="rk${x.medida ? "" : " sem"}${f ? " f" + f.id : ""}" href="#dim-${esc(x.id)}"><span class="rk-n">${t(x.nome)}</span><span class="rk-b">${barraTensao(x.score, null)}</span><span class="rk-v num">${x.score !== null ? Math.round(x.score) : "n/m"}</span></a>`;
    })
    .join("");
  return secao(
    "dimensoes",
    "04",
    titulo,
    "Cada barra parte do zero. Dimensão sem evidência não recebe nota: aparece como não medida e não entra na conta como se fosse risco.",
    `<div class="ranking rv">${resumo}</div>
    <div class="dims">${d.dimensoes.map(blocoDimensao).join("")}</div>`
  );
}

function sinaisChave(d: DadosRelatorio): string {
  if (!d.sinaisChave.length) {
    return secao("sinais", "05", "Sinais-chave", null, `<p class="vazio-txt">A leitura não destacou sinais-chave.</p>`);
  }
  const linhas = [...d.sinaisChave]
    .sort((a, b) => b.impacto - a.impacto)
    .map(
      (s) => `<tr class="rv"><td class="c-fonte"><b>${t(s.fonte)}</b><span class="mono">${esc(s.dimensao)}</span></td><td class="c-txt">${t(s.texto)}</td><td class="c-imp"><span class="mini"><i class="bar" style="--v:${Math.round(s.impacto * 100)}"></i></span><b class="num">${dec(s.impacto)}</b></td></tr>`
    )
    .join("");
  return secao(
    "sinais",
    "05",
    "Os sinais que mais pesam no cálculo",
    "Peso alto é o impacto que a regra do motor atribui ao sinal, não um juízo de que a notícia é ruim: a polaridade vem da fonte.",
    `<div class="tabela rv"><table><thead><tr><th>Fonte</th><th>O que foi registrado</th><th>Peso</th></tr></thead><tbody>${linhas}</tbody></table></div>`
  );
}

function previsao(d: DadosRelatorio): string {
  const p = d.previsao;
  if (!p.texto && !p.riscos.length && !p.oportunidades) {
    return secao("previsao", "06", "Previsão", null, `<p class="vazio-txt">A leitura não trouxe previsão.</p>`);
  }
  return secao(
    "previsao",
    "06",
    "Previsão",
    p.horizonte ? `Horizonte: ${t(p.horizonte)}.` : null,
    `<p class="lead menor rv">${t(p.texto)}</p>
    <div class="duas">
      <div class="bloco rv"><h3>Riscos</h3>${p.riscos.length ? `<ol class="num-lista">${p.riscos.map((x) => `<li>${t(x)}</li>`).join("")}</ol>` : `<p class="vazio-txt">Nenhum risco listado.</p>`}</div>
      <div class="bloco rv"><h3>Oportunidades</h3>${p.oportunidades ? `<p>${t(p.oportunidades)}</p>` : `<p class="vazio-txt">Nenhuma oportunidade listada.</p>`}</div>
    </div>
    <p class="nota rv">Previsão escrita a partir dos sinais coletados, sem dado externo. Ela descreve tendência e não é garantia.</p>`
  );
}

const MOMENTOS: Array<{ id: RecomendacaoRel["momento"]; nome: string; quando: string }> = [
  { id: "entrar", nome: "Entrar", quando: "Antes de decidir investir ou operar" },
  { id: "operar", nome: "Operar", quando: "Acompanhar e ajustar a operação" },
  { id: "responder", nome: "Responder", quando: "Agir agora diante do que se vê" },
];

function recomendacoes(d: DadosRelatorio): string {
  const cols = MOMENTOS.map((m) => {
    const itens = d.recomendacoes.filter((r) => r.momento === m.id);
    return `<div class="momento rv"><header><span class="quando">${m.quando}</span><h3>${m.nome}</h3></header>${
      itens.length
        ? itens.map((r) => `<article><span class="urg">${t(r.urgencia)}</span><h4>${t(r.titulo)}</h4><p>${t(r.texto)}</p></article>`).join("")
        : `<p class="vazio-txt">Sem recomendação para este momento nesta leitura.</p>`
    }</div>`;
  }).join("");
  return secao(
    "recomendacoes",
    "07",
    "Recomendações por momento",
    "Cada recomendação cita o sinal que a sustenta. O momento é definido pela urgência declarada no texto.",
    `<div class="momentos">${cols}</div>`
  );
}

function estrategica(d: DadosRelatorio): string {
  const e = d.estrategica;
  if (!e.recursos.length && !e.setores.length && !e.pontos.length && !e.casos.length) return "";
  const cats: Record<string, string> = {
    minerais: "Minerais",
    hidricos: "Hídricos",
    energeticos: "Energéticos",
    florestais: "Florestais",
    agricolas: "Agrícolas",
    ambientais: "Ambientais",
  };
  const recursos = e.recursos.length
    ? `<div class="grade3 rv">${e.recursos
        .map(
          (r) =>
            `<article class="card"><span class="quando">${esc(cats[r.categoria] ?? r.categoria)} · ${t(r.abundancia)}</span><h4>${t(r.nome)}</h4><p>${t(r.nota)}</p>${r.fontes.length ? `<span class="origem">Fonte: ${r.fontes.map(t).join(", ")}</span>` : ""}</article>`
        )
        .join("")}</div>`
    : "";
  const setores = e.setores.length
    ? `<h3 class="sub-h rv">Setores</h3><div class="grade3 rv">${e.setores
        .map(
          (s) =>
            `<article class="card"><span class="quando">${t(s.maturidade)}</span><h4>${t(s.nome)}</h4><p>${t(s.insight)}</p></article>`
        )
        .join("")}</div>`
    : "";
  const pontosTop = e.pontos.slice(0, 12);
  const pontosResto = e.pontos.slice(12);
  const linhaPonto = (p: (typeof e.pontos)[number]) =>
    `<tr><td><b>${t(p.nome)}</b><span class="nota">${t(p.categoria)}</span></td><td>${t(p.tipo)}</td><td>${t(p.fonte)}</td><td class="mono">${p.lat != null && p.lng != null ? `${dec(p.lat, 4)}, ${dec(p.lng, 4)}` : "sem coordenada"}</td></tr>`;
  const pontos = e.pontos.length
    ? `<h3 class="sub-h rv">Pontos georreferenciados</h3><div class="tabela rv"><table><thead><tr><th>Ponto</th><th>Tipo</th><th>Fonte</th><th>Coordenada</th></tr></thead><tbody>${pontosTop.map(linhaPonto).join("")}</tbody></table>${
        pontosResto.length
          ? `<details class="mais"><summary>Ver mais ${pontosResto.length} ponto(s)</summary><table><tbody>${pontosResto.map(linhaPonto).join("")}</tbody></table></details>`
          : ""
      }</div>`
    : "";
  const casos = e.casos.length
    ? `<h3 class="sub-h rv">Casos estratégicos</h3><div class="grade3 rv">${e.casos
        .map(
          (c) =>
            `<article class="card"><span class="quando">${t(c.relevancia)}</span><h4>${t(c.titulo)}</h4><p>${t(c.tese)}</p>${c.potencial ? `<p>${t(c.potencial)}</p>` : ""}${c.fontes.length ? `<span class="origem">Fonte: ${c.fontes.map(t).join(", ")}</span>` : ""}</article>`
        )
        .join("")}</div>`
    : "";
  return secao(
    "estrategica",
    "08",
    "Ativos, vocações e pontos no território",
    "Recursos, setores e locais com coordenada. Perfil por mesorregião e OpenStreetMap: contexto, não medição de tensão.",
    `${recursos}${setores}${casos}${pontos}`
  );
}

function procedencia(d: DadosRelatorio): string {
  const c = d.coleta;
  const respondeu = d.fontes.filter((f) => f.status === "respondeu").sort((a, b) => b.sinais - a.sinais);
  const vazias = d.fontes.filter((f) => f.status === "vazia");
  const buscas = vazias.filter((f) => f.tipo === "busca");
  const kpi = (n: string, r: string) => `<div class="kpi"><b class="num">${n}</b><span>${r}</span></div>`;
  const kpis = [
    c.fontesConsultadas != null ? kpi(int(c.fontesConsultadas), "fontes consultadas") : "",
    c.fontesComSinal != null ? kpi(int(c.fontesComSinal), "responderam com sinal") : "",
    c.fontesVazias != null ? kpi(int(c.fontesVazias), "sem retorno") : "",
    c.cobertura != null ? kpi(`${Math.round(c.cobertura * 100)}%`, "cobertura da malha") : "",
    c.sinaisNaJanela != null ? kpi(int(c.sinaisNaJanela), `sinais em ${c.janelaMeses ?? 24} meses`) : "",
  ].join("");
  const linhaFonte = (f: (typeof d.fontes)[number]) =>
    `<tr><td>${t(f.nome)}</td><td class="mono">${f.dimensao ?? "estrutural"}</td><td class="num">${f.sinais}</td><td class="num">${f.rejeitados || ""}</td></tr>`;
  const conf = d.semLastro.length
    ? `<p class="conf alerta">Conferência do texto: ${d.semLastro.length} número(s) escritos na leitura não foram localizados literalmente nos dados coletados (${d.semLastro.map((x) => `<b>${t(x)}</b>`).join(", ")}). Podem ser arredondamento ou nome próprio; confira antes de citar.</p>`
    : `<p class="conf">Conferência do texto: todos os números escritos na leitura foram localizados nos dados coletados.</p>`;
  const barradas =
    buscas.length || c.buscasBarradas
      ? `<p class="conf alerta">${
          buscas.length ? `${buscas.length} fonte(s) de busca aberta não rodaram nesta coleta` : "Fontes de busca aberta não rodaram nesta coleta"
        }${c.buscasBarradas ? ` (${c.buscasBarradas} buscas barradas pela cota do período)` : ""}. As dimensões que dependem delas podem ter mais evidência numa próxima coleta, e a Confiança sobe junto.</p>`
      : "";
  return secao(
    "procedencia",
    "09",
    "Procedência e cobertura por fonte",
    "Quem respondeu, quanto, e o que o verificador descartou por citar outro lugar.",
    `<div class="kpis rv">${kpis}</div>
    ${conf}${barradas}
    <div class="tabela rv"><table><thead><tr><th>Fonte que respondeu</th><th>Dimensão</th><th>Sinais</th><th>Descartados</th></tr></thead><tbody>${respondeu.map(linhaFonte).join("")}</tbody></table>
    ${
      vazias.length
        ? `<details class="mais"><summary>Ver as ${vazias.length} fonte(s) sem retorno</summary><table><tbody>${vazias.map(linhaFonte).join("")}</tbody></table></details>`
        : ""
    }</div>
    <p class="nota rv">Descartado é sinal que a fonte devolveu mas o verificador barrou por não ser sobre este município. Coleta de ${esc(dataLonga(c.coletadoEm ?? d.geradoEm))}.</p>`
  );
}

function metodologia(d: DadosRelatorio): string {
  const pesos = d.dimensoes
    .map((x) => `<li><span class="mono">${esc(x.id)}</span> ${t(x.nome)} <b class="num">${pesoPct(x.peso)}</b></li>`)
    .join("");
  const escala = FAIXAS.map(
    (f, i) => `<div class="esc f${f.id}"><b>${f.rotulo}</b><span class="num">${i * 20} a ${i * 20 + 20}</span></div>`
  ).join("");
  return secao(
    "metodologia",
    "10",
    "Como a leitura é feita",
    null,
    `<div class="metodo">
    <div class="bloco rv"><h3>Tensão</h3><p>Média das dimensões medidas, ponderada pelos pesos da metodologia e renormalizada entre elas. Dimensão sem evidência fica de fora: não medido não é tratado como risco máximo.</p></div>
    <div class="bloco rv"><h3>Confiança</h3><p>Fração do peso da metodologia que foi de fato medida. É o quanto se sabe, e não o quanto se teme.</p></div>
    <div class="bloco rv"><h3>Faixa</h3><p>Intervalo em que a Tensão ficaria se as dimensões não medidas valessem 0 ou 100. Tem a largura exata da ignorância.</p></div>
    <div class="bloco rv"><h3>Duas camadas</h3><p>Estrutural: indicadores oficiais por município, em percentil nacional entre os 5.570 municípios (peso 0,6). Sinal: notícia, diário e alerta, verificados e datados (peso 0,4). Cada sinal é classificado por regra, sem IA.</p></div>
    <div class="bloco rv"><h3>O texto</h3><p>A IA escreve a leitura uma vez por território, apenas sobre os sinais coletados, e todo número do texto é conferido contra os dados. A nota é publicada por uma pessoa.</p></div>
    <div class="bloco rv"><h3>Pesos por dimensão</h3><ul class="pesos">${pesos}</ul></div>
  </div>
  <div class="escala rv" role="img" aria-label="Escala de tensão: Baixa 0 a 20, Moderada 20 a 40, Elevada 40 a 60, Alta 60 a 80, Crítica 80 a 100">${escala}</div>
  <p class="nota rv">Tensão alta não é juízo de valor sobre o território. É quanto ele pressiona quem entra ou opera nele.</p>`
  );
}

function escada(): string {
  const passos = [
    { n: "1", t: "Leitura gratuita", p: "A busca ao vivo do território: Tensão e Confiança na hora.", s: "feito" },
    { n: "2", t: "Diagnóstico completo", p: "Toda a informação da base sobre o território, com fonte, data e o que não foi medido. É este documento.", s: "aqui" },
    { n: "3", t: "Marco Radar", p: "A mesma leitura atualizada todo dia, com alerta quando algo relevante muda. É o momento Operar.", s: "" },
    { n: "4", t: "Diagnóstico no local com a PRINT", p: "A equipe da PRINT confere em campo o que a base não alcança e fecha as dimensões que ficaram sem medida.", s: "" },
  ];
  return secao(
    "escada",
    "11",
    "Do que a base sabe ao que só o campo mostra",
    "As dimensões não medidas e os pontos que pedem conferência são o caminho natural para os próximos degraus.",
    `<ol class="escada">${passos
      .map(
        (p) =>
          `<li class="degrau rv${p.s === "aqui" ? " atual" : ""}${p.s === "feito" ? " feito" : ""}"><span class="dg-n mono">${p.n}</span><h3>${p.t}</h3><p>${p.p}</p>${
            p.s ? `<span class="dg-tag">${p.s === "aqui" ? "Você está aqui" : "Concluído"}</span>` : ""
          }</li>`
      )
      .join("")}</ol>`
  );
}

function rodape(d: DadosRelatorio, logos: { clara: string; escura: string }): string {
  return `<footer class="rl-rodape gutter">
    <div class="assinatura">
      <span class="marca-mini">${MARCA_SVG}<b>MARCO</b></span>
      <span class="powered">powered by <img class="logo-clara" src="${esc(logos.clara)}" alt="PRINT" height="26"><img class="logo-escura" src="${esc(logos.escura)}" alt="PRINT" height="26"></span>
    </div>
    <p class="nota">Marco, inteligência territorial da PRINT. Diagnóstico completo de ${t(d.territorio.nome)}${d.territorio.uf ? `, ${esc(d.territorio.uf)}` : ""}, gerado em ${esc(dataLonga(d.geradoEm))}. Leitura com base em fontes públicas e oficiais; não substitui diligência em campo.</p>
  </footer>`;
}

function barra(d: DadosRelatorio): string {
  return `<nav class="rl-barra" aria-label="Seções do diagnóstico"><div class="rl-barra-in gutter">
    <a class="marca-mini" href="#capa" aria-label="Marco, início do diagnóstico">${MARCA_SVG}<b>MARCO</b></a>
    <span class="barra-terr">${t(d.territorio.nome)}</span>
    <div class="rl-nav">
      <a href="#sintese">Síntese</a><a href="#dimensoes">Dimensões</a><a href="#previsao">Previsão</a><a href="#recomendacoes">Recomendações</a><a href="#procedencia">Procedência</a>
    </div>
    <button type="button" class="imprimir" onclick="window.print()">Salvar em PDF</button>
  </div></nav>`;
}

// ─── API ────────────────────────────────────────────────────────────────────

export interface OpcoesRender {
  logos?: { clara: string; escura: string };
}

/** Marcação completa do relatório, raiz `.mrel`. Idêntica na rota e no HTML estático. */
export function renderRelatorio(d: DadosRelatorio, o: OpcoesRender = {}): string {
  const logos = o.logos ?? { clara: "/brand/print-logo.png", escura: "/brand/print-logo-white.png" };
  return `<div class="mrel" data-territorio="${esc(d.territorio.slug)}">
${barra(d)}
<main>
${capa(d)}
${sintese(d)}
${mudouEDecide(d)}
${identidade(d)}
${dimensoes(d)}
${sinaisChave(d)}
${previsao(d)}
${recomendacoes(d)}
${estrategica(d)}
${procedencia(d)}
${metodologia(d)}
${escada()}
</main>
${rodape(d, logos)}
</div>`;
}

/**
 * Motion de leitura. Fonte única para a rota (new Function) e o HTML estático.
 * Só transform e opacity. Sem JS tudo aparece; com prefers-reduced-motion nada anima.
 */
export const MOVIMENTO_SRC = `(function(root){
  if(!root||root.__mrel)return; root.__mrel=1;
  var reduz=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els=root.querySelectorAll('.rv,.bar');
  if(reduz||!('IntersectionObserver' in window)){for(var i=0;i<els.length;i++)els[i].classList.add('on');}
  else{
    root.classList.add('js');
    // Barra com scaleX(0) tem área zero e nunca cruza o limiar: observa-se o pai.
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){var a=e.target;a.classList.add('on');(a.__barras||[]).forEach(function(b){b.classList.add('on');});io.unobserve(a);}});},{rootMargin:'0px 0px -8% 0px',threshold:0.08});
    for(var j=0;j<els.length;j++){var el=els[j];if(el.classList.contains('bar')){var pai=el.parentElement;(pai.__barras=pai.__barras||[]).push(el);io.observe(pai);}else io.observe(el);}
  }
  var abertos=[];
  window.addEventListener('beforeprint',function(){abertos=[];root.querySelectorAll('details').forEach(function(d){if(!d.open){abertos.push(d);d.open=true;}});root.classList.add('imprimindo');for(var k=0;k<els.length;k++)els[k].classList.add('on');});
  window.addEventListener('afterprint',function(){abertos.forEach(function(d){d.open=false;});root.classList.remove('imprimindo');});
})`;

export const RELATORIO_CSS = `
.mrel{--papel:#ECEBE3;--papel-2:#E1E0D6;--papel-3:#D6D5CA;--superficie:#F5F4EE;--tinta:#18201B;--tinta-2:#48534B;--tinta-3:#6A746C;--curva:#A9B2A3;--regua:#C7C8BC;--bronze:#9A6224;--bronze-fundo:#E9DBC4;
--t1:#5E8A6F;--t2:#8C8A45;--t3:#B38A2F;--t4:#B0582D;--t5:#8A3F22;--hachura:rgba(24,32,27,.18);--faixa:#B9B8AE;
color-scheme:light;background:var(--papel);color:var(--tinta);font-family:"Archivo",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:17px;line-height:1.58;-webkit-font-smoothing:antialiased;overflow-x:clip;min-height:100vh}
@media (prefers-color-scheme:dark){.mrel{--papel:#111713;--papel-2:#0B100D;--papel-3:#1B231E;--superficie:#161E19;--tinta:#E4E5DC;--tinta-2:#AEB5AA;--tinta-3:#8A9388;--curva:#34403A;--regua:#2C3630;--bronze:#D49C57;--bronze-fundo:#2E2418;--t1:#7FB08F;--t2:#A8A65E;--t3:#D8AE55;--t4:#D98460;--t5:#E0876A;--hachura:rgba(228,229,220,.16);--faixa:#4A544C;color-scheme:dark}}
.mrel *,.mrel *::before,.mrel *::after{box-sizing:border-box}
.mrel h1,.mrel h2,.mrel h3,.mrel h4,.mrel p,.mrel ul,.mrel ol,.mrel dl,.mrel dd,.mrel figure{margin:0;padding:0}
.mrel h1,.mrel h2,.mrel h3,.mrel h4{font-family:inherit;letter-spacing:normal;color:var(--tinta)}
.mrel ul,.mrel ol{list-style:none}
.mrel p{margin-bottom:14px}.mrel p:last-child{margin-bottom:0}
.mrel a{color:var(--bronze);text-underline-offset:3px}
.mrel :focus-visible{outline:2px solid var(--bronze);outline-offset:3px;border-radius:2px}
.mrel .mono{font-family:"IBM Plex Mono",ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums}
.mrel .num{font-variant-numeric:tabular-nums}
.mrel .gutter{padding-inline:clamp(16px,3.2vw,56px);max-width:1440px;margin-inline:auto}
.mrel .nota{font-size:13px;color:var(--tinta-3);line-height:1.45}
.mrel .origem{display:block;font-size:13px;color:var(--tinta-3);margin-top:2px}
.mrel .vazio-txt{color:var(--tinta-3);font-size:15px;border:1px dashed var(--curva);border-radius:8px;padding:12px 14px}

/* motion de leitura: só com JS, só transform e opacity */
.mrel.js .rv{opacity:0;transform:translateY(18px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
.mrel.js .rv.on{opacity:1;transform:none}
.mrel.js .rv.d1{transition-delay:.08s}.mrel.js .rv.d2{transition-delay:.18s}.mrel.js .rv.d3{transition-delay:.28s}
.mrel .bar{transform-origin:left center;transform:scaleX(calc(var(--v,0) / 100))}
.mrel.js .bar{transform:scaleX(0);transition:transform 1.1s cubic-bezier(.16,1,.3,1) .15s}
.mrel.js .bar.on{transform:scaleX(calc(var(--v,0) / 100))}
@media (prefers-reduced-motion:reduce){.mrel.js .rv,.mrel.js .bar{transition:none!important;opacity:1!important;transform:none}.mrel.js .bar{transform:scaleX(calc(var(--v,0) / 100))!important}}

/* barra */
.mrel .rl-barra{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--papel) 90%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--regua)}
.mrel .rl-barra-in{display:flex;align-items:center;gap:16px;height:56px}
.mrel .marca-mini{display:inline-flex;align-items:center;gap:9px;color:var(--tinta);text-decoration:none;flex-shrink:0}
.mrel .marca-mini svg{width:22px;height:22px}
.mrel .marca-mini b{font-variation-settings:"wdth" 125;font-weight:800;font-size:16px;letter-spacing:.07em}
.mrel .barra-terr{color:var(--tinta-3);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.mrel .rl-nav{display:flex;gap:2px;margin-left:auto;overflow-x:auto;scrollbar-width:none}
.mrel .rl-nav::-webkit-scrollbar{display:none}
.mrel .rl-nav a{color:var(--tinta-2);text-decoration:none;font-size:14px;white-space:nowrap;padding:7px 10px;border-radius:6px}
.mrel .rl-nav a:hover{background:var(--papel-2);color:var(--tinta)}
.mrel .imprimir{font:inherit;font-size:14px;font-weight:600;background:var(--tinta);color:var(--papel);border:0;border-radius:6px;padding:9px 14px;cursor:pointer;flex-shrink:0;min-height:38px}
.mrel .imprimir:hover{background:var(--bronze)}

/* capa */
.mrel .rl-capa{position:relative;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.95fr);gap:clamp(24px,5vw,80px);align-items:center;min-height:min(92vh,880px);padding-block:clamp(40px,7vw,96px);border-bottom:1px solid var(--regua);overflow:hidden;max-width:none}
.mrel .rl-capa::before{content:"";position:absolute;inset:0 auto 0 0;width:100%;pointer-events:none}
.mrel .rl-curvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.55}
.mrel .rl-curvas path{fill:none;stroke:var(--curva);stroke-width:1;opacity:.6;vector-effect:non-scaling-stroke}
.mrel .rl-curvas path.mestra{stroke-width:1.6;opacity:1}
.mrel .rl-capa>*:not(svg){position:relative}
.mrel .eyebrow{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--bronze);font-weight:600;margin-bottom:18px}
.mrel .rl-capa h1{font-variation-settings:"wdth" 125;font-weight:850;font-size:clamp(42px,8.2vw,124px);line-height:.94;letter-spacing:-.015em;text-wrap:balance;margin-bottom:26px}
.mrel .rl-capa h1 small{display:inline-block;margin-left:.22em;font-size:.28em;font-weight:700;letter-spacing:.06em;color:var(--bronze);vertical-align:.9em}
.mrel .capa-meta{display:flex;flex-wrap:wrap;gap:8px}
.mrel .chip{display:inline-block;border:1px solid var(--curva);background:color-mix(in srgb,var(--superficie) 80%,transparent);border-radius:99px;padding:5px 13px;font-size:14px;color:var(--tinta-2)}
.mrel .chip.mono{font-size:13px}
.mrel .capa-lido{margin-top:26px;max-width:52ch;color:var(--tinta-2);font-size:18px}
.mrel .rl-capa-card{background:var(--superficie);border:1px solid var(--curva);border-radius:12px;padding:clamp(20px,2.4vw,34px);display:grid;gap:18px}
.mrel .cc-topo{display:flex;justify-content:space-between;align-items:center;gap:12px}
.mrel .cc-rot{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--tinta-3);font-weight:600}
.mrel .cc-faixa{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:17px;color:var(--cor-f)}
.mrel .cc-num{display:flex;align-items:baseline;gap:12px}
.mrel .cc-num b{font-variation-settings:"wdth" 125;font-weight:850;font-size:clamp(76px,9vw,132px);line-height:.9;letter-spacing:-.02em}
.mrel .cc-num b.sem{font-size:clamp(34px,4vw,52px);color:var(--tinta-3);font-weight:700}
.mrel .cc-num span{color:var(--tinta-3);font-size:16px}
.mrel .cc-dados{display:grid;grid-template-columns:1fr 1fr;gap:14px;border-top:1px solid var(--regua);padding-top:16px}
.mrel .cc-dados dt{font-size:13px;color:var(--tinta-3);margin-bottom:4px}
.mrel .cc-dados dd{display:flex;flex-direction:column;gap:7px}
.mrel .cc-dados dd b{font-size:24px;font-variation-settings:"wdth" 118;font-weight:800;font-variant-numeric:tabular-nums}
.mrel .cc-nota{font-size:14px;color:var(--tinta-2);margin:0}
.mrel .mini{display:block;height:6px;background:var(--papel-3);border-radius:3px;overflow:hidden;width:100%;min-width:60px}
.mrel .mini .bar{display:block;height:100%;background:var(--tinta-2);border-radius:3px}
.mrel .f1{--cor-f:var(--t1)}.mrel .f2{--cor-f:var(--t2)}.mrel .f3{--cor-f:var(--t3)}.mrel .f4{--cor-f:var(--t4)}.mrel .f5{--cor-f:var(--t5)}
.mrel .mf{display:inline-flex;gap:2px;align-items:flex-end}
.mrel .mf i{display:block;width:4px;height:12px;background:var(--papel-3);border-radius:1px}
.mrel .mf i.on{background:var(--cor-f,var(--tinta-2))}

/* barra de tensão: comprimento a partir do zero */
.mrel .tz{position:relative}
.mrel .tz-trilho{position:relative;height:14px;background:var(--papel-3);border-radius:3px;overflow:hidden}
.mrel .tz.grande .tz-trilho{height:22px}
.mrel .tz-fill{position:absolute;inset:0;background:var(--cor-f,var(--tinta-2));border-radius:3px}
.mrel .tz-faixa{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(135deg,var(--hachura) 0 5px,transparent 5px 10px);border-inline:1px solid var(--faixa);z-index:1}
.mrel .tz-marca{position:absolute;top:-2px;bottom:-2px;width:3px;background:var(--tinta);transform:translateX(-1.5px);z-index:2;border-radius:1px}
.mrel .tz-vazio{position:absolute;inset:0;background:repeating-linear-gradient(135deg,var(--hachura) 0 6px,transparent 6px 12px)}
.mrel .tz-ticks{position:relative;height:16px;margin-top:5px;font-size:11px;color:var(--tinta-3);font-family:"IBM Plex Mono",monospace}
.mrel .tz-ticks span{position:absolute;transform:translateX(-50%)}
.mrel .tz-ticks span:first-child{transform:none}.mrel .tz-ticks span:last-child{transform:translateX(-100%)}

/* seções */
.mrel section.cap{padding-block:clamp(56px,7vw,112px);border-bottom:1px solid var(--regua)}
.mrel .cap-cabeca{display:grid;gap:12px;margin-bottom:clamp(28px,3.4vw,52px)}
.mrel .cap-num{font-size:13px;color:var(--bronze);letter-spacing:.12em}
.mrel .cap h2{font-variation-settings:"wdth" 118;font-weight:800;font-size:clamp(28px,3.8vw,56px);line-height:1.06;letter-spacing:-.01em;max-width:26ch;text-wrap:balance}
.mrel .sub{font-size:clamp(17px,1.3vw,20px);color:var(--tinta-2);max-width:64ch;margin:0}
.mrel h3{font-size:20px;font-weight:700;margin-bottom:8px;text-wrap:balance}
.mrel h4{font-size:13px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--tinta-3);margin-bottom:10px}
.mrel .sub-h{margin:clamp(28px,3vw,44px) 0 16px;font-size:24px}
.mrel .bloco,.mrel .card{background:var(--superficie);border:1px solid var(--regua);border-radius:10px;padding:clamp(18px,2vw,30px);min-width:0}
.mrel .duas{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:clamp(16px,1.8vw,28px);align-items:start}
.mrel .duas.fortes{margin-top:clamp(16px,1.8vw,28px)}
.mrel .grade3{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:clamp(14px,1.6vw,24px)}
.mrel .card h4{text-transform:none;letter-spacing:0;font-size:19px;color:var(--tinta);margin-bottom:8px}
.mrel .quando{display:block;font-size:13px;font-weight:600;color:var(--bronze);margin-bottom:8px}

/* síntese */
.mrel .lead{font-size:clamp(21px,2.3vw,32px);line-height:1.34;font-weight:500;max-width:46ch;text-wrap:pretty;margin-bottom:clamp(20px,2.4vw,36px)}
.mrel .lead.menor{font-size:clamp(19px,1.7vw,24px);max-width:60ch}
.mrel .colunas{columns:2 380px;column-gap:clamp(24px,3vw,56px);color:var(--tinta-2)}
.mrel .colunas p{break-inside:avoid}

/* mudou e decide */
.mrel .comp{color:var(--tinta-2);font-size:15px}
.mrel .linha-tempo{border-left:2px solid var(--curva);margin-top:16px;display:grid;gap:14px;padding-left:16px}
.mrel .linha-tempo li{display:grid;grid-template-columns:86px minmax(0,1fr);gap:12px;font-size:15px}
.mrel .linha-tempo time{font-size:12.5px;color:var(--tinta-3);padding-top:3px}
.mrel .decides{display:grid;gap:clamp(14px,1.6vw,22px)}
.mrel .decide{background:var(--superficie);border:1px solid var(--regua);border-left:3px solid var(--bronze);border-radius:0 10px 10px 0;padding:18px 22px}
.mrel .decide h3{font-size:18px;text-transform:none;line-height:1.25}
.mrel .decide p{font-size:15px;color:var(--tinta-2);margin:0}
.mrel .urg{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:.1em;color:var(--bronze);background:var(--bronze-fundo);border-radius:99px;padding:3px 10px;margin-bottom:10px}

/* identidade */
.mrel .id-grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:clamp(18px,2.4vw,40px);margin-bottom:clamp(24px,3vw,44px)}
.mrel .id-item h3{font-size:14px;letter-spacing:.09em;text-transform:uppercase;color:var(--bronze);margin-bottom:10px}
.mrel .id-item p{font-size:17px;color:var(--tinta)}
.mrel .indicadores{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));border:1px solid var(--regua);border-radius:10px;overflow:hidden;background:var(--superficie)}
.mrel .ind{padding:18px 20px;border-right:1px solid var(--regua);border-bottom:1px solid var(--regua);display:flex;flex-direction:column;gap:4px;margin-right:-1px;margin-bottom:-1px}
.mrel .ind-v{font-variation-settings:"wdth" 118;font-weight:800;font-size:26px;line-height:1.1;overflow-wrap:anywhere}
.mrel .ind-r{font-size:14px;color:var(--tinta-2)}
.mrel .ind-f{font-size:12.5px;color:var(--tinta-3)}
.mrel .bloco ul:not(.pesos):not(.pontos) li{position:relative;padding-left:18px;margin-bottom:10px;font-size:16px}
.mrel .bloco ul:not(.pesos):not(.pontos) li::before{content:"";position:absolute;left:0;top:.7em;width:8px;height:2px;background:var(--bronze)}
.mrel .num-lista{counter-reset:r}
.mrel .num-lista li{counter-increment:r;position:relative;padding-left:34px;margin-bottom:12px;font-size:16px}
.mrel .num-lista li::before{content:counter(r,decimal-leading-zero);position:absolute;left:0;top:.15em;font-family:"IBM Plex Mono",monospace;font-size:13px;color:var(--bronze)}

/* ranking + dimensões */
.mrel .ranking{display:grid;gap:10px;background:var(--superficie);border:1px solid var(--regua);border-radius:10px;padding:clamp(16px,2vw,28px);margin-bottom:clamp(24px,3vw,44px)}
.mrel .rk{display:grid;grid-template-columns:minmax(150px,240px) 1fr 46px;gap:16px;align-items:center;text-decoration:none;color:var(--tinta);padding:7px 0;font-size:16px}
.mrel .rk:hover .rk-n{color:var(--bronze)}
.mrel .rk-v{text-align:right;font-weight:700}
.mrel .rk.sem .rk-v{font-weight:400;color:var(--tinta-3);font-size:13px}
.mrel .rk .tz-ticks{display:none}
.mrel .dims{display:grid;gap:clamp(18px,2vw,30px)}
.mrel .dim{background:var(--superficie);border:1px solid var(--regua);border-radius:12px;padding:clamp(20px,2.6vw,40px);scroll-margin-top:72px}
.mrel .dim-topo{display:flex;justify-content:space-between;align-items:flex-end;gap:12px 24px;flex-wrap:wrap;margin-bottom:20px}
.mrel .dim-id{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.mrel .dim-cod{font-size:14px;color:var(--bronze);border:1px solid var(--bronze);border-radius:5px;padding:2px 8px}
.mrel .dim h3{font-variation-settings:"wdth" 118;font-weight:800;font-size:clamp(24px,2.6vw,36px);margin:0;line-height:1.1}
.mrel .dim-meta{font-size:14px;color:var(--tinta-3);display:flex;gap:8px;flex-wrap:wrap}
.mrel .dim-medida{display:grid;grid-template-columns:minmax(140px,220px) minmax(0,1fr);gap:clamp(16px,3vw,44px);align-items:center;padding:18px 0;border-block:1px solid var(--regua)}
.mrel .dim-nota{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.mrel .dim-nota b{font-variation-settings:"wdth" 125;font-weight:850;font-size:clamp(48px,5.4vw,76px);line-height:1}
.mrel .dim-nota b.sem{font-size:clamp(24px,2.4vw,32px);color:var(--tinta-3);font-weight:700}
.mrel .dim-nota span{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:16px;color:var(--cor-f)}
.mrel .dim-resumo{margin:18px 0 0;font-size:16px;color:var(--tinta-2);font-weight:500;border-left:3px solid var(--bronze);padding-left:14px}
.mrel .dim-corpo{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.3fr);gap:clamp(20px,3vw,48px);margin-top:26px}
.mrel .dim-corpo p{font-size:16px;color:var(--tinta-2)}
.mrel .sinais-lista{display:grid;gap:0;border-top:1px solid var(--regua)}
.mrel .sn{display:grid;grid-template-columns:78px minmax(0,1fr) 42px;gap:12px;padding:11px 0;border-bottom:1px solid var(--regua);font-size:15px;align-items:start}
.mrel .sn time{font-size:12px;color:var(--tinta-3);padding-top:3px}
.mrel .sn-c a,.mrel .sn-c{overflow-wrap:anywhere}
.mrel .sn-i{font-size:13px;color:var(--tinta-3);text-align:right;padding-top:2px}
.mrel .prov{display:block;font-size:12.5px;color:var(--tinta-3);margin-top:3px;font-style:italic}
.mrel .nao-medido{margin-top:26px;border:1px dashed var(--curva);border-radius:10px;padding:16px 20px;background:color-mix(in srgb,var(--papel) 60%,transparent)}
.mrel .nao-medido h4{margin-bottom:6px}
.mrel .nao-medido p{font-size:15px;color:var(--tinta-2)}
.mrel .dim.sem{background:repeating-linear-gradient(135deg,transparent 0 14px,color-mix(in srgb,var(--hachura) 40%,transparent) 14px 15px),var(--superficie)}
.mrel details.mais{margin-top:12px}
.mrel details.mais summary{cursor:pointer;font-size:14px;font-weight:600;color:var(--bronze);padding:8px 0;min-height:36px}
.mrel .pontos{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:4px 24px;margin-bottom:12px}
.mrel .pontos li{font-size:14px;color:var(--tinta-2);padding-left:14px;position:relative}
.mrel .pontos li::before{content:"";position:absolute;left:0;top:.7em;width:6px;height:1px;background:var(--tinta-3)}

/* tabelas */
.mrel .tabela{border:1px solid var(--regua);border-radius:10px;overflow:hidden;background:var(--superficie);overflow-x:auto}
.mrel table{width:100%;border-collapse:collapse;font-size:15px}
.mrel th{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--tinta-3);text-align:left;padding:12px 16px;border-bottom:1px solid var(--regua);background:var(--papel-2);font-weight:700}
.mrel td{padding:13px 16px;border-bottom:1px solid var(--regua);vertical-align:top}
.mrel tr:last-child td{border-bottom:0}
.mrel td.num,.mrel th:last-child:not(:first-child){font-variant-numeric:tabular-nums}
.mrel .c-fonte{width:190px}
.mrel .c-fonte b{display:block;font-size:15px}
.mrel .c-fonte span{font-size:12px;color:var(--tinta-3)}
.mrel .c-imp{width:130px;white-space:nowrap}
.mrel .c-imp .mini{display:inline-block;width:70px;vertical-align:middle;margin-right:10px}
.mrel .tabela details.mais{padding:0 16px 8px;border-top:1px solid var(--regua)}
.mrel .tabela details.mais table{margin-top:4px}

/* momentos */
.mrel .momentos{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:clamp(14px,1.8vw,26px);align-items:start}
.mrel .momento{background:var(--superficie);border:1px solid var(--regua);border-top:3px solid var(--bronze);border-radius:10px;padding:clamp(18px,2.2vw,32px);display:grid;gap:18px}
.mrel .momento header .quando{margin-bottom:4px}
.mrel .momento h3{font-variation-settings:"wdth" 125;font-weight:850;font-size:clamp(30px,3vw,44px);margin:0;line-height:1}
.mrel .momento article{border-top:1px solid var(--regua);padding-top:16px}
.mrel .momento article h4{text-transform:none;letter-spacing:0;font-size:17px;line-height:1.3;color:var(--tinta);font-weight:700;margin-bottom:6px}
.mrel .momento article p{font-size:15px;color:var(--tinta-2)}

/* procedência */
.mrel .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));border:1px solid var(--regua);border-radius:10px;overflow:hidden;background:var(--superficie);margin-bottom:20px}
.mrel .kpi{padding:18px 20px;border-right:1px solid var(--regua);display:flex;flex-direction:column;gap:2px}
.mrel .kpi b{font-variation-settings:"wdth" 125;font-weight:850;font-size:36px;line-height:1.05}
.mrel .kpi span{font-size:14px;color:var(--tinta-2)}
.mrel .conf{font-size:15px;color:var(--tinta-2);border-left:3px solid var(--curva);padding:4px 0 4px 14px;margin-bottom:14px}
.mrel .conf.alerta{border-color:var(--bronze)}

/* metodologia */
.mrel .metodo{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:clamp(14px,1.6vw,24px)}
.mrel .metodo .bloco p{font-size:15.5px;color:var(--tinta-2)}
.mrel .pesos{display:grid;gap:6px}
.mrel .pesos li{display:flex;gap:8px;align-items:baseline;font-size:15px;border-bottom:1px dotted var(--curva);padding-bottom:5px}
.mrel .pesos li b{margin-left:auto}
.mrel .pesos .mono{font-size:12.5px;color:var(--bronze)}
.mrel .escala{display:grid;grid-template-columns:repeat(5,1fr);border-radius:10px;overflow:hidden;margin-top:clamp(18px,2vw,30px)}
.mrel .esc{padding:14px 16px;color:#fff;background:var(--cor-f);display:flex;flex-direction:column;gap:2px}
.mrel .esc b{font-size:17px}
.mrel .esc span{font-size:13px;opacity:.92}
.mrel #metodologia .nota{margin-top:14px}

/* escada */
.mrel .escada{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:0;border:1px solid var(--curva);border-radius:12px;overflow:hidden;background:var(--superficie)}
.mrel .degrau{position:relative;padding:clamp(20px,2.2vw,32px);border-right:1px solid var(--regua);display:flex;flex-direction:column;gap:8px}
.mrel .degrau:last-child{border-right:0}
.mrel .dg-n{font-size:13px;color:var(--bronze)}
.mrel .degrau h3{font-size:21px;margin:0;line-height:1.2}
.mrel .degrau p{font-size:15px;color:var(--tinta-2);margin:0 0 8px}
.mrel .dg-tag{margin-top:auto;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--tinta-3)}
.mrel .degrau.atual{background:var(--bronze-fundo);box-shadow:inset 0 3px 0 var(--bronze)}
.mrel .degrau.atual .dg-tag{color:var(--bronze)}

/* rodapé */
.mrel .rl-rodape{padding-block:40px 56px;display:grid;gap:18px}
.mrel .assinatura{display:flex;align-items:center;justify-content:space-between;gap:18px 40px;flex-wrap:wrap;border-top:1px solid var(--regua);padding-top:24px}
.mrel .powered{display:inline-flex;align-items:center;gap:12px;font-size:14px;color:var(--tinta-3)}
.mrel .powered img{height:26px;width:auto;display:block}
.mrel .logo-escura{display:none!important}
@media (prefers-color-scheme:dark){.mrel .logo-clara{display:none!important}.mrel .logo-escura{display:block!important}}
.mrel .rl-rodape .nota{max-width:80ch}

/* responsivo */
@media (max-width:1000px){
  .mrel .rl-capa{grid-template-columns:1fr;min-height:0}
  .mrel .dim-corpo{grid-template-columns:1fr}
  .mrel .rl-nav{display:none}
  .mrel .imprimir{margin-left:auto}
}
@media (max-width:640px){
  .mrel{font-size:16px}
  .mrel .rk{grid-template-columns:1fr 40px;gap:4px 12px}
  .mrel .rk-b{grid-column:1/-1;grid-row:2}
  .mrel .rk-n{grid-column:1}.mrel .rk-v{grid-column:2;grid-row:1}
  .mrel .dim-medida{grid-template-columns:1fr}
  .mrel .sn{grid-template-columns:1fr 38px;gap:2px 10px}
  .mrel .sn time{grid-column:1/-1}
  .mrel .linha-tempo li{grid-template-columns:1fr;gap:2px}
  .mrel .escala{grid-template-columns:1fr 1fr}
  .mrel .degrau{border-right:0;border-bottom:1px solid var(--regua)}
  .mrel .barra-terr{display:none}
  .mrel .cc-dados{grid-template-columns:1fr 1fr}
  .mrel .c-fonte{width:auto}
  .mrel .c-imp{width:auto}
  .mrel th,.mrel td{padding:10px 12px}
  .mrel .tz-ticks span:nth-child(even){display:none}
}

/* impressão: papel claro, sem barra, sem corte no meio de bloco */
@page{size:A4;margin:14mm 12mm}
@media print{
  .mrel,.mrel.js{--papel:#fff;--papel-2:#f1f0ea;--papel-3:#e2e1d8;--superficie:#fff;--tinta:#111;--tinta-2:#333;--tinta-3:#555;--curva:#bdbdb2;--regua:#d4d3c9;--bronze:#7F501D;--bronze-fundo:#f0e4d0;--t1:#3f7a55;--t2:#7a7a30;--t3:#9a7410;--t4:#a2471f;--t5:#7d3318;--hachura:rgba(0,0,0,.2);--faixa:#999;color-scheme:light;font-size:11.5pt;background:#fff;min-height:0}
  .mrel .rl-barra,.mrel .imprimir,.mrel .rl-curvas{display:none!important}
  .mrel .rv,.mrel.js .rv{opacity:1!important;transform:none!important;transition:none!important}
  .mrel .bar,.mrel.js .bar{transform:scaleX(calc(var(--v,0) / 100))!important;transition:none!important}
  .mrel *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .mrel .gutter{padding-inline:0;max-width:none}
  .mrel .rl-capa{min-height:0;height:auto;padding-block:8mm 10mm;grid-template-columns:1.2fr .9fr;gap:10mm;break-after:page}
  .mrel .rl-capa h1{font-size:44pt}
  .mrel .cc-num b{font-size:66pt}
  .mrel section.cap{padding-block:9mm;break-inside:auto}
  .mrel .cap-cabeca{break-after:avoid;margin-bottom:6mm}
  .mrel .cap h2{font-size:21pt}
  .mrel .dim,.mrel .bloco,.mrel .card,.mrel .decide,.mrel .momento,.mrel .degrau,.mrel .nao-medido,.mrel .tabela tr,.mrel .sn,.mrel .kpis,.mrel .escala{break-inside:avoid}
  .mrel .dim{padding:6mm}
  .mrel .dim h3{font-size:19pt}
  .mrel .lead{font-size:15pt}
  .mrel details.mais summary{display:none}
  .mrel .tabela{overflow:visible}
  .mrel a{color:inherit;text-decoration:none}
  .mrel .esc{color:#fff}
}
`;

/** Documento HTML autossuficiente (CSS, JS e logos embutidos). */
export function documentoHtml(d: DadosRelatorio, logos: { clara: string; escura: string }): string {
  const nome = limpar(d.territorio.nome);
  const titulo = `${nome}${d.territorio.uf ? ", " + d.territorio.uf : ""} · Diagnóstico completo · Marco`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>html{scroll-behavior:smooth}body{margin:0;background:#ECEBE3}@media (prefers-color-scheme:dark){body{background:#111713}}@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{body{background:#fff}}
${RELATORIO_CSS}</style>
</head>
<body>
${renderRelatorio(d, { logos })}
<script>(${MOVIMENTO_SRC})(document.querySelector('.mrel'));</script>
</body>
</html>
`;
}
