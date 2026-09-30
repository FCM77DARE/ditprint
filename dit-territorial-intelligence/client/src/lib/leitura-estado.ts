/**
 * Estado da primeira leitura ao vivo. Puro: sem React, sem rede.
 *
 * O servidor (GET /api/dit/leitura/stream) manda frames JSON com um campo
 * `tipo`; `reduzir` transforma a sequência em um estado que a tela só desenha.
 * Número nenhum nasce aqui: tudo vem de um frame ou fica vazio.
 */

import type { Leitura } from "@shared/leitura";

// ─── Contrato dos frames (espelha server/routes/leitura-stream.ts) ───────────

export interface Municipio {
  nome: string;
  uf: string;
  ibgeId: string;
  slug: string;
  /** Texto que o servidor entende sem ambiguidade: "Galinhos, RN". */
  consulta: string;
  composto?: boolean;
  /** Nome do lugar quando a pessoa pesquisou um distrito ou localidade. */
  lugar?: string;
}

export interface IndicadorPerfil {
  chave: string;
  rotulo: string;
  valor: number;
  unidade: string;
  periodo: string;
  fonte: string;
  dimensao: string;
  /** 0 a 100, posição entre os municípios do país; null quando não há. */
  percentil: number | null;
}

export interface SustentaDimensao {
  dimensao: string;
  nome: string;
  score: number;
  peso: number;
  frase: string;
  base: IndicadorPerfil[];
}

export interface FaltaDimensao {
  dimensao: string;
  nome: string;
  peso: number;
  olha: string;
  motivo: string;
}

export interface LeituraEstrutural {
  municipio: Municipio;
  leitura: Leitura;
  perfil: IndicadorPerfil[];
  sustenta: SustentaDimensao[];
  falta: FaltaDimensao[];
  custo: "zero";
  camada: { geradoEm: string | null; fonte: string };
  noRadar: boolean;
}

export interface Identidade {
  localizacao?: string;
  conhecidoPor?: string;
  problemaCaracteristico?: string;
  forcas?: string[];
  fragilidades?: string[];
  semana?: Array<{ fato?: string; fonte?: string; data?: string }>;
}

export interface SinalChave {
  source?: string;
  dimension?: string;
  text?: string;
  impact?: number;
  status?: string;
}

/** Teaser do DIT completo (derivarIsca, no servidor). Tudo opcional: cache antigo não tem todos os campos. */
export interface Isca {
  territory?: string;
  region?: string;
  leitura?: Leitura | null;
  identidade?: Identidade | null;
  executiveSummaryTeaser?: string;
  dimensionsTeaser?: Array<{ code: string; name: string; complexity: string }>;
  keySignalsTeaser?: SinalChave[];
  forecastTeaser?: { horizon?: string; risks?: string[]; opportunity?: string | null } | null;
  coverageScore?: number | null;
}

export type EtapaId = "coleta" | "verificacao" | "consolidacao" | "redacao";

export type Frame =
  | { tipo: "inicio"; consulta: string }
  | { tipo: "resolvido"; municipio: Municipio; noRadar?: boolean }
  | { tipo: "estrutural"; leitura: LeituraEstrutural }
  | { tipo: "cache"; mensagem: string }
  | { tipo: "etapa"; id: EtapaId; rotulo: string; detalhe?: string }
  | { tipo: "fonte"; dimensao: string; fonte: string; nome: string; ok: boolean; brutos: number }
  | {
      tipo: "sinal";
      dimensao: string;
      fonte: string;
      titulo: string;
      data: string | null;
      url: string | null;
      impacto: "alto" | "medio" | "baixo";
    }
  | { tipo: "dimensao"; id: string; nome: string; sinais: number; fontesOk: number; fontesTotal: number }
  | { tipo: "teaser"; isca: Isca }
  | {
      tipo: "sem_leitura";
      motivo: "cobertura_insuficiente" | "teto" | "coleta_falhou" | "erro" | "sob_demanda";
      detalhe: string;
      extra?: { causa?: "orcamento" | "limite_ip"; cobertura?: number | null; minimo?: number | null };
    }
  | { tipo: "ambiguo"; detalhe: string; options: Array<Partial<Municipio> & { nome: string; uf: string; consulta?: string }> }
  | { tipo: "nao_encontrado"; detalhe: string; sugestoes: Municipio[] }
  | { tipo: "fim"; status: string };

// ─── Estado ──────────────────────────────────────────────────────────────────

export type Fase =
  | "conectando"
  | "estrutural"
  | "coletando"
  | "pronta"
  | "sem_leitura"
  | "ambiguo"
  | "nao_encontrado"
  | "erro";

export interface FonteVista {
  dimensao: string;
  fonte: string;
  nome: string;
  ok: boolean;
  brutos: number;
}

export interface SinalVisto {
  dimensao: string;
  fonte: string;
  titulo: string;
  data: string | null;
  url: string | null;
  impacto: "alto" | "medio" | "baixo";
}

export interface DimensaoFechada {
  id: string;
  nome: string;
  sinais: number;
  fontesOk: number;
  fontesTotal: number;
}

export interface EstadoLeitura {
  fase: Fase;
  municipio: Municipio | null;
  noRadar: boolean;
  estrutural: LeituraEstrutural | null;
  /** Etapas do motor já vistas, na ordem; a última é a atual. */
  etapas: Array<{ id: EtapaId; rotulo: string; detalhe?: string }>;
  fontes: FonteVista[];
  sinais: SinalVisto[];
  dimensoes: DimensaoFechada[];
  /** A leitura do dia já estava pronta e foi reproduzida. */
  doCache: boolean;
  teaser: Isca | null;
  semLeitura: Extract<Frame, { tipo: "sem_leitura" }> | null;
  opcoes: Array<Partial<Municipio> & { nome: string; uf: string; consulta?: string }>;
  sugestoes: Municipio[];
  detalhe: string | null;
  finalizado: boolean;
}

export const ESTADO_INICIAL: EstadoLeitura = {
  fase: "conectando",
  municipio: null,
  noRadar: false,
  estrutural: null,
  etapas: [],
  fontes: [],
  sinais: [],
  dimensoes: [],
  doCache: false,
  teaser: null,
  semLeitura: null,
  opcoes: [],
  sugestoes: [],
  detalhe: null,
  finalizado: false,
};

/** Teto de itens guardados: a tela mostra os mais recentes, o servidor já limita. */
const MAX_SINAIS = 60;

export function reduzir(s: EstadoLeitura, f: Frame): EstadoLeitura {
  switch (f.tipo) {
    case "inicio":
      return s;
    case "resolvido":
      return { ...s, municipio: f.municipio, noRadar: Boolean(f.noRadar) };
    case "estrutural":
      return { ...s, estrutural: f.leitura, municipio: f.leitura.municipio, noRadar: f.leitura.noRadar, fase: s.fase === "conectando" ? "estrutural" : s.fase };
    case "cache":
      return { ...s, doCache: true };
    case "etapa": {
      const igual = s.etapas.find((e) => e.id === f.id);
      const etapas = igual
        ? s.etapas.map((e) => (e.id === f.id ? { id: f.id, rotulo: f.rotulo, detalhe: f.detalhe } : e))
        : [...s.etapas, { id: f.id, rotulo: f.rotulo, detalhe: f.detalhe }];
      return { ...s, etapas, fase: "coletando" };
    }
    case "fonte":
      return {
        ...s,
        fase: s.fase === "estrutural" || s.fase === "conectando" ? "coletando" : s.fase,
        fontes: s.fontes.some((x) => x.fonte === f.fonte && x.dimensao === f.dimensao)
          ? s.fontes
          : [...s.fontes, { dimensao: f.dimensao, fonte: f.fonte, nome: f.nome, ok: f.ok, brutos: f.brutos }],
      };
    case "sinal":
      return {
        ...s,
        sinais: [...s.sinais, { dimensao: f.dimensao, fonte: f.fonte, titulo: f.titulo, data: f.data, url: f.url, impacto: f.impacto }].slice(-MAX_SINAIS),
      };
    case "dimensao":
      return {
        ...s,
        dimensoes: s.dimensoes.some((d) => d.id === f.id)
          ? s.dimensoes
          : [...s.dimensoes, { id: f.id, nome: f.nome, sinais: f.sinais, fontesOk: f.fontesOk, fontesTotal: f.fontesTotal }],
      };
    case "teaser":
      return { ...s, teaser: f.isca, fase: "pronta" };
    case "sem_leitura":
      return { ...s, semLeitura: f, fase: "sem_leitura" };
    case "ambiguo":
      return { ...s, fase: "ambiguo", opcoes: f.options, detalhe: f.detalhe };
    case "nao_encontrado":
      return { ...s, fase: "nao_encontrado", sugestoes: f.sugestoes ?? [], detalhe: f.detalhe };
    case "fim":
      return { ...s, finalizado: true };
  }
}

// ─── Derivados que a tela usa ────────────────────────────────────────────────

/** Nome para exibir: "Galinhos, RN" (ou o lugar pesquisado, com o município entre parênteses). */
export function nomeExibido(m: Municipio | null): string {
  if (!m) return "";
  const base = m.composto ? m.nome : m.uf ? `${m.nome}, ${m.uf}` : m.nome;
  return m.lugar && m.lugar !== m.nome ? `${m.lugar} (${base})` : base;
}

/** A leitura que manda na tela: a completa (estrutural + sinais) quando existe, senão a estrutural parcial. */
export function leituraPrincipal(s: EstadoLeitura): { leitura: Leitura | null; completa: boolean } {
  const completa = s.teaser?.leitura;
  if (completa && completa.tensao !== null) return { leitura: completa, completa: true };
  return { leitura: s.estrutural?.leitura ?? null, completa: false };
}

/** Etapa que o motor está fazendo agora (a última vista), ou null. */
export function etapaAtual(s: EstadoLeitura): { id: EtapaId; rotulo: string; detalhe?: string } | null {
  return s.etapas.length > 0 ? s.etapas[s.etapas.length - 1] : null;
}

/** Quantas fontes responderam e quantas falharam até agora. */
export function contagemFontes(s: EstadoLeitura): { ok: number; falhas: number; total: number } {
  const ok = s.fontes.filter((f) => f.ok).length;
  return { ok, falhas: s.fontes.length - ok, total: s.fontes.length };
}

/** Texto da observação que o lead leva, lido pela Mesa. Começa sempre por "origem: primeira leitura". */
export function observacaoDoLead(p: { interesse: string; situacao: string }): string {
  return `origem: primeira leitura. Interesse: ${p.interesse}. Situação: ${p.situacao}.`;
}

export const ORIGEM_PRIMEIRA_LEITURA = "origem: primeira leitura";

/** A observação de um lead marca a origem "primeira leitura"? (Mesa) */
export function ehPrimeiraLeitura(observacao: string | null | undefined): boolean {
  return (observacao ?? "").trim().toLowerCase().startsWith(ORIGEM_PRIMEIRA_LEITURA);
}

/** Trecho da observação depois da origem, para a Mesa mostrar interesse e situação. */
export function detalheDaOrigem(observacao: string | null | undefined): string {
  const o = (observacao ?? "").trim();
  return o.slice(ORIGEM_PRIMEIRA_LEITURA.length).replace(/^[.\s]+/, "");
}
