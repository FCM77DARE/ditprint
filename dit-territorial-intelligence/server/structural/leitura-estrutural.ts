/**
 * Leitura estrutural gratuita: o que o DIT sabe de QUALQUER município do país
 * sem coleta, sem busca paga e sem LLM.
 *
 * É a primeira metade da isca (a segunda é o teaser do DIT completo, que só
 * existe para território lido). Serve para a pessoa ver, na hora, que o Marco
 * mede de verdade: percentil nacional de indicador oficial, tensão parcial com
 * a Confiança dita em voz alta e a lista honesta do que falta.
 *
 * Fonte única dos números:
 *   - indicadores e percentis: camada estrutural (store.ts, IBGE em lote);
 *   - score por dimensão: scoring.ts (mesma conta do STT em produção);
 *   - tensão, Confiança e faixa: tensao-confianca.ts (só dimensão com
 *     evidência conta como medida; aqui, só as estruturais).
 *
 * Nada é estimado aqui. Indicador ausente vira dimensão não medida, nunca 50.
 */

import type { Leitura } from "../../shared/leitura";
import { DIMENSOES_METODOLOGIA } from "../../shared/metodologia";
import { leituraDeEvidencia, type EvidenciaPorDimensao, type ScoresDimensao } from "../stt/leitura";
import {
  getStructuralScores,
  getStructuralScoresComposite,
  type StructuralScores,
} from "./scoring";
import {
  getStructuralForMunicipality,
  getStructuralStatus,
  listarCodigosENomes,
  type StructuralValue,
} from "./store";
import { buscarCompostoPorNome, buscarCompostoPorSlug } from "../routes/territorios-compostos";
import { estaNoRadar } from "../routes/radar-lancamento";
import { territorioDoSlug } from "../stt/territorio-do-slug";

/** Capitais: "Salvador" sem UF quer dizer a capital da Bahia, não Salvador das Missões. */
export const CAPITAL_IBGE_IDS = new Set<number>([
  1200401, 1302603, 1400100, 1501402, 1600303, 1721000, 2111300, 2211001,
  2304400, 2408102, 2507507, 2611606, 2704302, 2800308, 2927408, 3106200,
  3205309, 3304557, 3550308, 4106902, 4205407, 4314902, 5002704, 5103403,
  5208707, 5300108,
]);

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

// ─── Tipos de saída ──────────────────────────────────────────────────────────

export interface MunicipioEstrutural {
  nome: string;
  uf: string;
  ibgeId: string;
  /** Slug canônico, o mesmo que o /analyze grava: nome-sem-acento + código IBGE. */
  slug: string;
  /** Texto que a isca (POST /api/dit/isca) entende sem ambiguidade: "Galinhos, RN". */
  consulta: string;
  composto?: boolean;
}

export interface IndicadorDoPerfil {
  chave: string;
  rotulo: string;
  valor: number;
  unidade: string;
  /** Ano do dado. */
  periodo: string;
  fonte: string;
  dimensao: string;
  /** Posição entre os municípios do país, 0 a 100 (100 = maior valor do país). */
  percentil: number | null;
}

export interface SustentaDimensao {
  dimensao: string;
  nome: string;
  score: number;
  /** Peso da dimensão na metodologia, 0 a 1. */
  peso: number;
  /** Frase auditável de por que o score é este. */
  frase: string;
  base: IndicadorDoPerfil[];
}

export interface FaltaDimensao {
  dimensao: string;
  nome: string;
  peso: number;
  /** O que a dimensão olha na metodologia. */
  olha: string;
  /** Por que não está medida aqui e o que a mediria. */
  motivo: string;
}

export interface LeituraEstrutural {
  municipio: MunicipioEstrutural;
  leitura: Leitura;
  perfil: IndicadorDoPerfil[];
  sustenta: SustentaDimensao[];
  falta: FaltaDimensao[];
  /** Esta leitura não gasta coleta paga nem LLM. */
  custo: "zero";
  camada: { geradoEm: string | null; fonte: "IBGE, em lote nacional" };
  /** O território está no Radar declarado (leitura completa publicada ou em coleta). */
  noRadar: boolean;
}

export type ResolucaoMunicipio =
  | { tipo: "ok"; municipio: MunicipioEstrutural }
  | { tipo: "ambiguo"; opcoes: MunicipioEstrutural[] }
  | { tipo: "nao_encontrado"; sugestoes: MunicipioEstrutural[] }
  | { tipo: "indisponivel" };

// ─── Texto ───────────────────────────────────────────────────────────────────

export function normalizar(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mesma regra de slug do /analyze (makeSlug em ditLanding.ts). */
export function slugDoNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function separarNomeUf(nomeIbge: string): { nome: string; uf: string } {
  const m = nomeIbge.match(/^(.*) - ([A-Z]{2})$/);
  return m ? { nome: m[1], uf: m[2] } : { nome: nomeIbge, uf: "" };
}

function paraMunicipio(ibgeId: string, nomeIbge: string): MunicipioEstrutural {
  const { nome, uf } = separarNomeUf(nomeIbge);
  return {
    nome,
    uf,
    ibgeId,
    slug: `${slugDoNome(nome)}-${ibgeId}`,
    consulta: uf ? `${nome}, ${uf}` : nome,
  };
}

/** Aceita "Galinhos", "Galinhos, RN", "Galinhos RN", "Galinhos - RN", "Galinhos/RN", "Galinhos (RN)". */
export function separarEntrada(bruto: string): { nome: string; uf: string | null } {
  const m = bruto.trim().match(/^(.*?)[\s,/\-(]+([A-Za-z]{2})\)?\s*$/);
  if (m && UFS.has(m[2].toUpperCase()) && m[1].trim()) {
    return { nome: m[1].trim(), uf: m[2].toUpperCase() };
  }
  return { nome: bruto.trim(), uf: null };
}

// ─── Resolução ───────────────────────────────────────────────────────────────

interface Indice {
  lista: MunicipioEstrutural[];
  porCodigo: Map<string, MunicipioEstrutural>;
}

async function carregarIndice(): Promise<Indice | null> {
  const pares = await listarCodigosENomes();
  if (pares.length === 0) return null;
  const lista = pares.map(([id, nome]) => paraMunicipio(id, nome));
  return { lista, porCodigo: new Map(lista.map((m) => [m.ibgeId, m])) };
}

/**
 * Municípios cujo nome começa pelo texto digitado. Para o autocomplete:
 * prefixo no início do nome, depois no início de qualquer palavra.
 */
export async function sugerirMunicipios(texto: string, limite = 8): Promise<MunicipioEstrutural[]> {
  const indice = await carregarIndice();
  if (!indice) return [];
  const { nome, uf } = separarEntrada(texto);
  const alvo = normalizar(nome);
  const alvoCompleto = normalizar(texto);
  if (alvo.length < 2 && alvoCompleto.length < 2) return [];

  const pontua = (m: MunicipioEstrutural, q: string): number => {
    const n = normalizar(m.nome);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(" ").some((p) => p.startsWith(q))) return 2;
    return 99;
  };

  const candidatos = indice.lista
    .map((m) => {
      const base = Math.min(
        uf && m.uf === uf ? pontua(m, alvo) : uf ? 99 : pontua(m, alvo),
        pontua(m, alvoCompleto)
      );
      const capital = CAPITAL_IBGE_IDS.has(Number(m.ibgeId)) ? -0.5 : 0;
      return { m, p: base === 99 ? 99 : base + capital };
    })
    .filter((x) => x.p < 99)
    .sort((a, b) => a.p - b.p || a.m.nome.localeCompare(b.m.nome, "pt-BR") || a.m.uf.localeCompare(b.m.uf));
  return candidatos.slice(0, limite).map((x) => x.m);
}

/**
 * Resolve o texto para UM município da malha, ou diz por que não deu.
 *
 * Entradas aceitas: código IBGE de 7 dígitos, slug canônico (nome-1234567),
 * nome com ou sem UF. Homônimo sem UF e sem capital é ambíguo, nunca sorteado.
 */
export async function resolverMunicipio(bruto: string): Promise<ResolucaoMunicipio> {
  const texto = bruto.trim();
  const indice = await carregarIndice();
  if (!indice) return { tipo: "indisponivel" };

  // Código IBGE
  if (/^\d{7}$/.test(texto)) {
    const m = indice.porCodigo.get(texto);
    return m ? { tipo: "ok", municipio: m } : { tipo: "nao_encontrado", sugestoes: [] };
  }

  // Slug canônico: nome-1234567 (com sufixo de localidade, vale o município pai)
  const porSlug = texto.match(/^[a-z0-9-]+?-(\d{7})(?:-[a-z0-9-]+)?$/);
  if (porSlug) {
    const m = indice.porCodigo.get(porSlug[1]);
    if (m) return { tipo: "ok", municipio: m };
  }

  const { nome, uf } = separarEntrada(texto);
  const tentativas: Array<{ alvo: string; uf: string | null }> = [{ alvo: normalizar(nome), uf }];
  // "Rio Branco AC" lê como nome + UF; se não casar, tenta o texto inteiro como nome.
  if (uf) tentativas.push({ alvo: normalizar(texto), uf: null });

  for (const t of tentativas) {
    if (!t.alvo) continue;
    let hits = indice.lista.filter((m) => normalizar(m.nome) === t.alvo);
    if (t.uf) hits = hits.filter((m) => m.uf === t.uf);
    if (hits.length === 1) return { tipo: "ok", municipio: hits[0] };
    if (hits.length > 1) {
      const capital = hits.find((m) => CAPITAL_IBGE_IDS.has(Number(m.ibgeId)));
      if (capital) return { tipo: "ok", municipio: capital };
      return {
        tipo: "ambiguo",
        opcoes: hits
          .sort((a, b) => a.uf.localeCompare(b.uf))
          .slice(0, 8),
      };
    }
  }

  return { tipo: "nao_encontrado", sugestoes: await sugerirMunicipios(texto, 5) };
}

// ─── Perfil ──────────────────────────────────────────────────────────────────

/** Indicadores que aparecem no perfil, na ordem de leitura. */
const PERFIL_CHAVES = [
  "populacao_residente",
  "densidade_demografica",
  "salario_medio_mensal",
  "taxa_assalariamento",
  "pib_per_capita",
  "presenca_indigena_por_mil",
] as const;

function indicador(chave: string, v: StructuralValue): IndicadorDoPerfil {
  return {
    chave,
    rotulo: v.label,
    valor: v.value,
    unidade: v.unit,
    periodo: v.period,
    fonte: v.source,
    dimensao: v.dimension,
    percentil: typeof v.pct === "number" ? Math.round(v.pct * 100) : null,
  };
}

function perfilDe(ind: Record<string, StructuralValue>): IndicadorDoPerfil[] {
  return PERFIL_CHAVES.filter((k) => ind[k]).map((k) => indicador(k, ind[k]));
}

// ─── O que falta ─────────────────────────────────────────────────────────────

/**
 * Por que cada dimensão não medida fica de fora e o que a mediria. Texto da
 * metodologia (skill do produto, seção 4), não promessa de prazo.
 */
const MOTIVO_FALTA: Record<string, string> = {
  D1: "Não há indicador oficial em lote para esta dimensão. Precisa de sinais verificados: embargos, áreas protegidas, passivos, TACs e ACPs.",
  D2: "O município não tem salário médio, vínculos formais ou PIB per capita na camada estrutural.",
  D3: "O município não tem densidade nem população na camada estrutural.",
  D4: "O município não tem população indígena por mil habitantes na camada estrutural. Uso e ocupação, conflitos de uso e expansão urbana só entram com sinais verificados.",
  D5: "Não há indicador oficial em lote para esta dimensão. Precisa de sinais verificados de capacidade institucional, participação social e articulação.",
  D6: "Reputação e visibilidade nascem de mídia e buscas. Só existem com coleta dedicada do território.",
};

function faltaDe(scores: StructuralScores): FaltaDimensao[] {
  return DIMENSOES_METODOLOGIA.filter((d) => d.peso > 0 && !scores[d.id as keyof StructuralScores]).map((d) => ({
    dimensao: d.id,
    nome: d.nome,
    peso: d.peso,
    olha: d.olha,
    motivo: MOTIVO_FALTA[d.id] ?? "Sem evidência estrutural para esta dimensão.",
  }));
}

function sustentaDe(
  scores: StructuralScores,
  ind: Record<string, StructuralValue> | null
): SustentaDimensao[] {
  const out: SustentaDimensao[] = [];
  for (const d of DIMENSOES_METODOLOGIA) {
    const s = scores[d.id as keyof StructuralScores];
    if (!s || d.peso <= 0) continue;
    const base: IndicadorDoPerfil[] = [];
    for (const b of s.basis) {
      // Município: o valor completo (ano e fonte) vem do store. Composto: só o que o score trouxe.
      const v = ind?.[b.key];
      if (v) base.push(indicador(b.key, v));
      else
        base.push({
          chave: b.key,
          rotulo: b.label,
          valor: b.value,
          unidade: b.unit,
          periodo: "",
          fonte: "IBGE",
          dimensao: d.id,
          percentil: Math.round(b.pct * 100),
        });
    }
    out.push({ dimensao: d.id, nome: d.nome, score: s.score, peso: d.peso, frase: s.rationale, base });
  }
  return out;
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

function leituraDeScores(scores: StructuralScores): Leitura {
  const escores: ScoresDimensao = {};
  const evidencia: EvidenciaPorDimensao = {};
  for (const id of ["D1", "D2", "D3", "D4", "D5", "D6"] as const) {
    const s = scores[id];
    escores[id] = s ? s.score : null;
    evidencia[id] = { estrutural: Boolean(s), sinaisVerificados: 0 };
  }
  return leituraDeEvidencia(escores, evidencia);
}

export async function leituraEstruturalDoMunicipio(m: MunicipioEstrutural): Promise<LeituraEstrutural> {
  const [ind, scores, status] = await Promise.all([
    getStructuralForMunicipality(m.ibgeId),
    getStructuralScores(m.ibgeId),
    getStructuralStatus(),
  ]);
  return {
    municipio: m,
    leitura: leituraDeScores(scores),
    perfil: perfilDe(ind),
    sustenta: sustentaDe(scores, ind),
    falta: faltaDe(scores),
    custo: "zero",
    camada: { geradoEm: status.generatedAt, fonte: "IBGE, em lote nacional" },
    noRadar: estaNoRadar(m.nome, m.uf, m.slug),
  };
}

/** Recorte composto (ex.: Baía de Guanabara): média dos membros ponderada por população. */
export async function leituraEstruturalDoComposto(slug: string): Promise<LeituraEstrutural | null> {
  const composto = buscarCompostoPorSlug(slug);
  if (!composto) return null;
  const rec = await territorioDoSlug(slug);
  const ids = ((rec?.contextData?.ibgeMunicipios as string[] | undefined) ?? []).map(String);
  if (ids.length === 0) return null;
  const [scores, status] = await Promise.all([getStructuralScoresComposite(ids), getStructuralStatus()]);
  return {
    municipio: {
      nome: composto.nome,
      uf: composto.uf,
      ibgeId: ids[0],
      slug: composto.slug,
      consulta: composto.nome,
      composto: true,
    },
    leitura: leituraDeScores(scores),
    perfil: [],
    sustenta: sustentaDe(scores, null),
    falta: faltaDe(scores),
    custo: "zero",
    camada: { geradoEm: status.generatedAt, fonte: "IBGE, em lote nacional" },
    noRadar: estaNoRadar(composto.nome, composto.uf, composto.slug),
  };
}

export type RespostaEstrutural =
  | { status: 200; corpo: LeituraEstrutural }
  | { status: 404; corpo: { error: string; detail: string; sugestoes: MunicipioEstrutural[] } }
  | { status: 409; corpo: { error: string; detail: string; status: "ambiguo"; options: MunicipioEstrutural[] } }
  | { status: 503; corpo: { error: string; detail: string } };

/** Ponto único de entrada do endpoint: texto livre → leitura estrutural ou motivo. */
export async function lerEstrutural(bruto: string): Promise<RespostaEstrutural> {
  const texto = bruto.trim();

  const composto = buscarCompostoPorSlug(texto) ?? buscarCompostoPorNome(texto);
  if (composto) {
    const r = await leituraEstruturalDoComposto(composto.slug);
    if (r) return { status: 200, corpo: r };
  }

  const res = await resolverMunicipio(texto);
  switch (res.tipo) {
    case "indisponivel":
      return {
        status: 503,
        corpo: {
          error: "Camada estrutural indisponível",
          detail: "A base nacional de indicadores ainda não foi carregada neste servidor. Tente de novo em instantes.",
        },
      };
    case "ambiguo":
      return {
        status: 409,
        corpo: {
          error: "Território ambíguo",
          detail: `Existe mais de um município chamado "${texto}". Escolha o estado.`,
          status: "ambiguo",
          options: res.opcoes,
        },
      };
    case "nao_encontrado":
      return {
        status: 404,
        corpo: {
          error: "Município não encontrado",
          detail: `Não achamos "${texto}" na malha municipal do IBGE. Confira a grafia ou informe o estado, como "Galinhos, RN".`,
          sugestoes: res.sugestoes,
        },
      };
    case "ok":
      return { status: 200, corpo: await leituraEstruturalDoMunicipio(res.municipio) };
  }
}
