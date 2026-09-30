/**
 * Monta os dados do Diagnóstico completo (relatório Marco) a partir do que o
 * pipeline já produz: o resultado do /analyze (ou o snapshot dele) e os sinais
 * verificados do store de sinais.
 *
 * Função pura, sem rede, sem disco, sem LLM. Usada pela rota tRPC
 * `portal.relatorio` e pelo gerador estático (scripts/gerar-relatorio-marco.ts).
 * Nada aqui inventa dado: o que não está no resultado vira lista vazia ou null,
 * e o renderizador escreve "não medido" em vez de preencher.
 */

import { DIMENSAO_DA_FONTE, FONTES_DE_IMPRENSA } from "../../shared/fontes-dimensao";
import type {
  CasoRel,
  DadosRelatorio,
  DimensaoRel,
  FonteNaoMedida,
  FonteRel,
  IndicadorRel,
  PontoRel,
  RecomendacaoRel,
  RecursoRel,
  SetorRel,
  SinalRel,
} from "../../shared/relatorio-marco/tipos";

/** Forma mínima de um sinal do store (server/stt/signal-store.ts). */
export interface SinalDoStore {
  source: string;
  dimension: string;
  impact: number;
  publishedAt: string;
  title: string;
  summary?: string;
  url?: string;
  indicatorCode?: string;
  structural?: boolean;
  metadata?: Record<string, unknown>;
}

export interface EntradaMontagem {
  /** Resultado do /analyze (ou `result` de um snapshot). */
  analyze: Record<string, any>;
  sinais: SinalDoStore[];
  /** Série do snapshot store (history.jsonl), para "o que mudou". */
  historico?: Array<{ date: string; stt: number }>;
  buscasBarradas?: number | null;
  agora?: Date;
}

// Mesma regra de ruído de selecionarSinaisRecentes (ditLanding.ts): manchete que
// não diz nada sobre o território. Duplicada aqui para o módulo seguir puro.
const RUIDO =
  /previs[aã]o do tempo|tempo hoje|hor[oó]scopo|resultado d[ao] (mega|lotof|quina)|loteria|jingle|playlist|ao vivo agora|copa rio|ferj|concurso\b.*edital|qconcursos/i;

const DIMS = ["D1", "D2", "D3", "D4", "D5", "D6"] as const;
const MAX_OFICIAIS = 8;
const MAX_IMPRENSA = 6;

const s = (v: unknown): string => (typeof v === "string" ? v : "");
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = <T = any>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function tipoDaFonte(id: string, nome: string): "oficial" | "imprensa" | "busca" {
  if (/^busca aberta/i.test(nome)) return "busca";
  if (FONTES_DE_IMPRENSA.has(id)) return "imprensa";
  return "oficial";
}

function dimensaoDoSinal(sig: SinalDoStore): string | null {
  if ((DIMS as readonly string[]).includes(sig.dimension)) return sig.dimension;
  const porFonte = DIMENSAO_DA_FONTE[sig.source];
  if (porFonte) return porFonte;
  const d = sig.indicatorCode?.match(/^([1-6])\./)?.[1];
  return d ? `D${d}` : null;
}

function dia(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

function momentoDe(r: { momento?: string; urgency?: string }): RecomendacaoRel["momento"] {
  const m = (r.momento ?? "").toLowerCase();
  if (m === "entrar" || m === "operar" || m === "responder") return m;
  // Mapeamento provisório quando o relatório não traz o momento: a urgência
  // que o texto já declara decide em qual dos três momentos a ação cabe.
  const u = (r.urgency ?? "").toUpperCase();
  if (u.startsWith("IMEDIATO")) return "responder";
  if (u.startsWith("CURTO")) return "operar";
  return "entrar";
}

export function montarDados(e: EntradaMontagem): DadosRelatorio {
  const a = e.analyze;
  const agora = e.agora ?? new Date();
  const res = (a.resolution ?? {}) as Record<string, any>;
  const geo = (a.territoryGeo ?? null) as { centroid?: { lat: number; lng: number } } | null;
  const integ = (a.dataIntegrity ?? {}) as Record<string, any>;
  const det = (a.coverageDetail ?? integ ?? {}) as Record<string, any>;
  const regiaoTexto = s(a.region);
  const ufDoTexto = regiaoTexto.match(/,\s*([A-Z]{2})\s*$/)?.[1] ?? "";

  // ── fontes (a malha inteira, o que respondeu e o que não) ──────────────────
  const breakdown = arr<{ id: string; name: string; signals: number; rejeitados?: number }>(
    integ.sourceBreakdown ?? a.sourceBreakdown
  );
  const fontes: FonteRel[] = breakdown.map((b) => ({
    id: b.id,
    nome: b.name,
    dimensao: DIMENSAO_DA_FONTE[b.id] ?? null,
    sinais: b.signals ?? 0,
    rejeitados: b.rejeitados ?? 0,
    status: (b.signals ?? 0) > 0 ? "respondeu" : "vazia",
    tipo: tipoDaFonte(b.id, b.name),
  }));
  const nomeFonte = new Map(fontes.map((f) => [f.id, f.nome]));

  // ── sinais verificados por dimensão ────────────────────────────────────────
  const porDim = new Map<string, SinalRel[]>();
  const vistos = new Set<string>();
  for (const sig of e.sinais) {
    const verificado = sig.structural === true || (sig.metadata as any)?.verificado === true;
    if (!verificado) continue;
    const dim = dimensaoDoSinal(sig);
    if (!dim) continue;
    const titulo = sig.title.trim();
    if (RUIDO.test(titulo)) continue;
    const chave = `${sig.source}|${titulo.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const imprensa = FONTES_DE_IMPRENSA.has(sig.source);
    const periodo = s((sig.metadata as any)?.period) || null;
    const item: SinalRel = {
      titulo,
      fonte: nomeFonte.get(sig.source) ?? sig.source,
      fonteId: sig.source,
      data: sig.structural ? null : dia(sig.publishedAt),
      periodo,
      url: /^https?:\/\//i.test(sig.url ?? "") ? (sig.url as string) : null,
      procedencia: sig.structural ? s(sig.summary) || null : s((sig.metadata as any)?.provenance) || null,
      impacto: sig.impact,
      estrutural: sig.structural === true,
      tipo: imprensa ? "imprensa" : "oficial",
    };
    (porDim.get(dim) ?? porDim.set(dim, []).get(dim)!).push(item);
  }

  // ── dimensões: leitura (número) + relatório (texto) + sinais + vazios ──────
  const leitura = (a.leitura ?? null) as {
    tensao: number | null;
    confianca: number;
    faixa: { min: number; max: number };
    dimensoes: Array<{ id: string; nome: string; score: number | null; peso: number; medida: boolean; fonte: any }>;
  } | null;
  const textoDim = new Map(arr<any>(a.dimensions).map((d) => [s(d.code), d]));
  const base =
    leitura?.dimensoes?.filter((d) => DIMS.includes(d.id as never)) ??
    DIMS.map((id) => ({ id, nome: s(textoDim.get(id)?.name) || id, score: null, peso: 0, medida: false, fonte: "nenhuma" }));

  const dimensoes: DimensaoRel[] = base.map((d) => {
    const t = textoDim.get(d.id) ?? {};
    const todos = porDim.get(d.id) ?? [];
    const oficiais = todos
      .filter((x) => x.tipo === "oficial")
      .sort((x, y) => y.impacto - x.impacto || (y.data ?? "").localeCompare(x.data ?? ""));
    const imprensa = todos
      .filter((x) => x.tipo === "imprensa")
      .sort((x, y) => (y.data ?? "").localeCompare(x.data ?? "") || y.impacto - x.impacto);
    const doDim = fontes.filter((f) => f.dimensao === d.id);
    const naoMedido: FonteNaoMedida[] = doDim
      .filter((f) => f.status === "vazia")
      .map((f) => ({ id: f.id, nome: f.nome, tipo: f.tipo }));
    return {
      id: d.id,
      nome: d.nome,
      peso: d.peso,
      score: d.medida ? d.score : null,
      medida: d.medida && d.score !== null,
      fonte: d.fonte,
      resumo: s(t.complexityNote),
      leitura: s(t.insight),
      sustentam: [...oficiais.slice(0, MAX_OFICIAIS), ...imprensa.slice(0, MAX_IMPRENSA)],
      totalSinais: todos.length,
      naoMedido,
      fontesConsultadas: doDim.length,
    };
  });

  // ── identidade + indicadores com fonte e ano ───────────────────────────────
  const ident = (a.identidade ?? {}) as Record<string, any>;
  const indicadores: IndicadorRel[] = [];
  const rotulosVistos = new Set<string>();
  const candidatos = e.sinais
    .filter((x) => x.structural === true || x.source === "src-ibge-censo" || x.source === "src-datasus")
    .sort((x, y) => Date.parse(y.publishedAt) - Date.parse(x.publishedAt));
  for (const sig of candidatos) {
    const i = sig.title.indexOf(":");
    if (i < 2) continue;
    const rotulo = sig.title.slice(0, i).trim();
    const valor = sig.title.slice(i + 1).trim();
    if (!valor || rotulosVistos.has(rotulo.toLowerCase())) continue;
    rotulosVistos.add(rotulo.toLowerCase());
    indicadores.push({
      rotulo,
      valor,
      fonte: nomeFonte.get(sig.source) ?? sig.source,
      ano: s((sig.metadata as any)?.period) || dia(sig.publishedAt)?.slice(0, 4) || null,
    });
    if (indicadores.length >= 8) break;
  }

  // ── o que mudou e o que decide ─────────────────────────────────────────────
  const porTitulo = new Map(e.sinais.map((x) => [x.title.trim().slice(0, 60).toLowerCase(), x]));
  const semana = arr<any>(ident.semana)
    .filter((x) => !RUIDO.test(s(x.fato)))
    .map((x) => {
    const achou = porTitulo.get(s(x.fato).trim().slice(0, 60).toLowerCase());
    return {
      fato: s(x.fato),
      fonte: nomeFonte.get(s(x.fonte)) ?? s(x.fonte),
      data: s(x.data),
      url: /^https?:\/\//i.test(achou?.url ?? "") ? (achou!.url as string) : null,
    };
  });
  const hoje = agora.toISOString().slice(0, 10);
  const anteriores = (e.historico ?? []).filter((h) => h.date < hoje).sort((x, y) => x.date.localeCompare(y.date));
  const ult = anteriores[anteriores.length - 1];

  const recs: RecomendacaoRel[] = arr<any>(a.recommendations).map((r) => ({
    momento: momentoDe(r),
    titulo: s(r.title),
    texto: s(r.text),
    urgencia: s(r.urgency),
  }));
  const ordemUrg = (u: string) => (/IMEDIATO/i.test(u) ? 0 : /CURTO/i.test(u) ? 1 : 2);
  const decide = [...recs]
    .sort((x, y) => ordemUrg(x.urgencia) - ordemUrg(y.urgencia))
    .slice(0, 3)
    .map((r) => ({ titulo: r.titulo, texto: r.texto, urgencia: r.urgencia }));

  // ── camada estratégica ─────────────────────────────────────────────────────
  const recursos: RecursoRel[] = arr<any>(a.resources).map((r) => ({
    categoria: s(r.category),
    nome: s(r.name),
    abundancia: s(r.abundance),
    nota: s(r.notes),
    fontes: arr<string>(r.sources).map(String),
  }));
  const setores: SetorRel[] = arr<any>(a.sectors).map((x) => ({
    nome: s(x.name),
    maturidade: s(x.maturity),
    insight: s(x.insight),
    sinais: arr<string>(x.signals).map(String),
  }));
  const pontos: PontoRel[] = arr<any>(a.hotspots).map((h) => ({
    tipo: s(h.type),
    categoria: s(h.category),
    nome: s(h.name),
    descricao: s(h.description),
    fonte: s(h.source),
    lat: n(h.lat),
    lng: n(h.lng),
  }));
  const casos: CasoRel[] = arr<any>(a.strategicCases).map((c) => ({
    titulo: s(c.title),
    relevancia: s(c.relevance),
    tese: s(c.thesis),
    evidencias: arr<string>(c.evidence).map(String),
    potencial: s(c.potential) || null,
    riscos: arr<string>(c.risks).map(String),
    fontes: arr<string>(c.sources).map(String),
  }));

  const fp = arr<any>(a.forecast?.risks).map(String);
  return {
    versao: 1,
    geradoEm: agora.toISOString(),
    territorio: {
      nome: s(a.territory) || s(res.municipality) || s(res.name),
      uf: s(res.state) || ufDoTexto,
      slug: s(integ.slug) || s(a.slug),
      ibge: res.ibgeId != null ? String(res.ibgeId) : integ.ibgeId != null ? String(integ.ibgeId) : null,
      regiao: s(res.region) || null,
      mesorregiao: s(res.mesoregion) || null,
      microrregiao: s(res.microregion) || null,
      lat: geo?.centroid?.lat ?? null,
      lng: geo?.centroid?.lng ?? null,
    },
    leitura: {
      tensao: leitura?.tensao ?? null,
      confianca: leitura?.confianca ?? 0,
      faixa: leitura?.faixa ?? { min: 0, max: 100 },
    },
    coleta: {
      coletadoEm: s(integ.collectedAt) || null,
      fontesConsultadas: n(det.totalSources ?? integ.sourcesConsulted),
      fontesComSinal: n(det.sourcesWithSignals ?? integ.sourcesWithSignals),
      fontesVazias: n(det.sourcesEmpty),
      fontesComErro: n(det.sourcesError),
      cobertura: n(a.coverageScore ?? integ.coverageScore),
      sinaisNaJanela: n(integ.signalsInWindow),
      janelaMeses: n(integ.windowMonths),
      buscasBarradas: e.buscasBarradas ?? null,
    },
    sintese: arr<string>(a.executiveSummary).map(String),
    mudou: { anterior: ult ? { data: ult.date, valor: ult.stt } : null, semana },
    decide,
    identidade: {
      localizacao: s(ident.localizacao),
      conhecidoPor: s(ident.conhecidoPor),
      problema: s(ident.problemaCaracteristico),
      forcas: arr<string>(ident.forcas).map(String),
      fragilidades: arr<string>(ident.fragilidades).map(String),
      indicadores,
    },
    dimensoes,
    sinaisChave: arr<any>(a.keySignals).map((k) => ({
      fonte: s(k.source),
      dimensao: s(k.dimension),
      texto: s(k.text),
      impacto: n(k.impact) ?? 0,
    })),
    previsao: {
      horizonte: s(a.forecast?.horizon),
      texto: s(a.forecast?.text),
      riscos: fp,
      oportunidades: s(a.forecast?.opportunities),
    },
    recomendacoes: recs,
    estrategica: { recursos, setores, pontos, casos },
    fontes,
    semLastro: arr<string>(integ.afirmacoesSemLastro).map(String),
  };
}
