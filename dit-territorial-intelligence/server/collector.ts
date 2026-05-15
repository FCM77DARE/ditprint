/**
 * Radar Territorial™ — Pipeline de Coleta Automatizada v2
 *
 * Fontes:
 * 1. Google News RSS — notícias regionais (principal, sem limite)
 * 2. NewsAPI — complementar com imagens
 * 3. ANA (Agência Nacional de Águas) — dados hídricos públicos
 *
 * Cada sinal é salvo com imageUrl quando disponível.
 * Análise LLM é feita separadamente via analyzeSignals().
 */

import { insertSignal, getAllTerritories, getTerritoryBySlug, getSignalsByTerritory, insertCollectionSnapshot, insertIndexHistory, getLatestIndexHistory } from "./db";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { signals, sttScores } from "../drizzle/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { buildTerritoryContextPrompt, TERRITORY_CONTEXTS } from "./territoryContext";
import { logger } from "./_core/logger";

const log = logger.child({ module: "collector" });

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE = "https://newsapi.org/v2/everything";

import type { TerritoryContextData } from "./stt/types";

// ─── Queries por Território (fallback estático — novos territórios usam contextData) ────

const TERRITORY_QUERIES_FALLBACK: Record<string, {
  googleRss: string[];
  newsapi: string[];
}> = {
  "baia-guanabara": {
    googleRss: [
      "Baía de Guanabara poluição",
      "Baía de Guanabara licença ambiental",
      "Baía de Guanabara porto dragagem",
      "Baía de Guanabara IBAMA INEA",
      "Baía de Guanabara comunidade pescadores",
      "Baía de Guanabara petróleo refinaria",
      "Baía de Guanabara saneamento esgoto",
      "Baía de Guanabara conflito territorial",
    ],
    newsapi: [
      "Baía de Guanabara",
      "Porto do Rio poluição ambiental",
      "INEA Rio de Janeiro licença",
    ],
  },
  "teles-pires": {
    googleRss: [
      "Rio Teles Pires hidrelétrica",
      "Teles Pires indígena Munduruku",
      "Bacia Teles Pires licença ambiental",
      "Teles Pires conflito territorial",
      "Munduruku Kayabi Apiaká",
      "UHE Teles Pires IBAMA",
      "Teles Pires pesca ictiofauna",
    ],
    newsapi: [
      "Bacia Teles Pires",
      "Rio Teles Pires hidrelétrica indígena",
    ],
  },
};

function getRssQueries(slug: string, ctx: TerritoryContextData | null): string[] {
  return ctx?.rssQueries ?? TERRITORY_QUERIES_FALLBACK[slug]?.googleRss ?? [slug];
}

function getNewsApiQueries(slug: string, ctx: TerritoryContextData | null): string[] {
  return ctx?.newsApiQueries ?? TERRITORY_QUERIES_FALLBACK[slug]?.newsapi ?? [slug];
}

// ─── Mapeamento de Dimensões PRINT ───────────────────────────────────────────

// Keywords mapped to the 6 PRINT dimensions (D1–D6).
// Order matters — first match wins; more specific entries come first.
const DIMENSION_KEYWORDS: Record<string, string[]> = {
  D1: ["poluição", "licença ambiental", "IBAMA", "embargo", "desmatamento", "contaminação",
       "APA", "APP", "ICMBio", "INPE", "DETER", "PRODES", "derramamento", "fauna", "flora",
       "ecossistema", "CEMADEN", "eventos climáticos", "esgoto", "chorume", "TAC ambiental",
       "ACP ambiental", "degradação ambiental", "queimada", "incêndio florestal"],
  D2: ["desemprego", "informalidade", "pobreza", "renda per capita", "Gini", "IDH",
       "desigualdade", "demissão", "trabalho informal", "salário mínimo", "PNAD",
       "extrema pobreza", "bolsa família", "transferência de renda"],
  D3: ["saneamento", "água tratada", "esgoto", "hospital", "UBS", "saúde pública",
       "IDEB", "educação", "habitação", "déficit habitacional", "lixão", "aterro sanitário",
       "rodovia", "porto", "hidrovia", "aeroporto", "transporte público", "BRT"],
  D4: ["disputa territorial", "demarcação", "invasão", "sobreposição", "fundiário",
       "INCRA", "FUNAI", "terra indígena", "conflito de uso", "zoneamento", "plano diretor",
       "milícia", "poder paralelo", "facção", "conflito armado", "reintegração de posse",
       "assentamento", "quilombola", "comunidade tradicional", "área de risco"],
  D5: ["Diário Oficial", "portaria", "regulação", "ANEEL", "ANP", "ANTAQ", "liminar",
       "tribunal", "decisão judicial", "regulatório", "legislação", "conselho municipal",
       "orçamento participativo", "audiência pública", "transparência", "prestação de contas",
       "liderança comunitária", "associação", "cooperativa", "sindicato", "articulação"],
  D6: ["protesto", "manifestação", "mobilização", "comunidade", "pescador", "indígena",
       "conflito social", "bloqueio", "resistência", "repercussão", "viral", "redes sociais",
       "matéria jornalística", "reportagem", "Google Trends", "pesquisa científica"],
};

type DimensionOrGeral = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "GERAL";

function detectIndex(text: string): DimensionOrGeral {
  const lower = text.toLowerCase();
  for (const [dim, keywords] of Object.entries(DIMENSION_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return dim as DimensionOrGeral;
    }
  }
  return "GERAL";
}

// ─── Extração de Imagem Open Graph ───────────────────────────────────────────

async function extractImageFromUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RadarTerritorial/1.0)" },
    });
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Tentar og:image primeiro
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    
    if (ogMatch?.[1]) return ogMatch[1];
    
    // Tentar twitter:image
    const twitterMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    if (twitterMatch?.[1]) return twitterMatch[1];
    
    return null;
  } catch {
    return null;
  }
}

// ─── Google News RSS ──────────────────────────────────────────────────────────

interface ParsedArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
}

function parseGoogleRss(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  
  // Extrair items do RSS
  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g));
  
  for (const match of itemMatches) {
    const item = match[1];
    
    const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = item.match(/<link>(https?:\/\/[^\s<]+)/);
    const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
    
    if (!titleMatch || !linkMatch) continue;
    
    // Limpar CDATA e HTML entities
    const cleanTitle = titleMatch[1]
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
    
    if (!cleanTitle || cleanTitle.length < 10) continue;
    
    articles.push({
      title: cleanTitle,
      link: linkMatch[1],
      pubDate: pubDateMatch?.[1]?.trim() ?? new Date().toISOString(),
      source: sourceMatch?.[1]?.trim() ?? "Google News",
      description: descMatch?.[1]?.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ").trim() ?? "",
    });
  }
  
  return articles;
}

async function collectFromGoogleRss(
  territoryId: number,
  territorySlug: string,
  ctx: TerritoryContextData | null = null
): Promise<number> {
  const queries = getRssQueries(territorySlug, ctx);
  if (queries.length === 0) return 0;

  let collected = 0;
  const seenTitles = new Set<string>();

  for (const query of queries) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
      
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadarTerritorial/1.0)" },
      });

      if (!response.ok) {
        log.warn(` Google RSS error for "${query}": ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const articles = parseGoogleRss(xml);

      // Pegar os 5 mais recentes por query
      const recent = articles.slice(0, 5);

      for (const article of recent) {
        // Deduplicar por título
        const titleKey = article.title.substring(0, 80).toLowerCase();
        if (seenTitles.has(titleKey)) continue;
        seenTitles.add(titleKey);

        const relatedIndex = detectIndex(`${article.title} ${article.description}`);
        
        // Tentar extrair imagem (com timeout)
        let imageUrl: string | null = null;
        try {
          imageUrl = await extractImageFromUrl(article.link);
        } catch {
          // sem imagem, ok
        }

        await insertSignal({
          territoryId,
          source: "newsapi", // reutilizando enum existente
          relatedIndex,
          title: article.title.substring(0, 499),
          summary: article.description.substring(0, 1000) || null,
          url: article.link,
          imageUrl,
          publishedAt: new Date(article.pubDate),
          metadata: { query, sourceName: article.source, provider: "google_rss" },
        });

        collected++;
      }

      // Respeitar rate limit
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      log.error({ err, query }, "Error collecting Google RSS");
    }
  }

  return collected;
}

// ─── NewsAPI (complementar) ───────────────────────────────────────────────────

interface NewsArticle {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
}

async function collectFromNewsApi(
  territoryId: number,
  territorySlug: string,
  ctx: TerritoryContextData | null = null
): Promise<number> {
  if (!NEWS_API_KEY) return 0;

  const queries = getNewsApiQueries(territorySlug, ctx);
  if (queries.length === 0) return 0;

  let collected = 0;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

  for (const query of queries) {
    try {
      const url = `${NEWS_API_BASE}?q=${encodeURIComponent(query)}&sortBy=publishedAt&from=${fromDate}&pageSize=5&apiKey=${NEWS_API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) continue;

      const data = await response.json() as { status: string; articles: NewsArticle[] };
      if (data.status !== "ok") continue;

      for (const article of data.articles) {
        if (!article.title || article.title === "[Removed]") continue;

        const fullText = `${article.title} ${article.description ?? ""}`;
        const relatedIndex = detectIndex(fullText);

        await insertSignal({
          territoryId,
          source: "newsapi",
          relatedIndex,
          title: article.title.substring(0, 499),
          summary: article.description ?? null,
          url: article.url,
          imageUrl: article.urlToImage ?? null,
          publishedAt: new Date(article.publishedAt),
          metadata: { query, sourceName: article.source.name, provider: "newsapi" },
        });

        collected++;
      }

      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      log.error({ err, query }, "NewsAPI error");
    }
  }

  return collected;
}

// ─── Análise LLM dos Sinais ───────────────────────────────────────────────────

export async function analyzeSignalsWithLLM(territorySlug: string): Promise<{
  analyzed: number;
  calculatedStt: number;
  calculatedD1: number;
  calculatedD2: number;
  calculatedD3: number;
  calculatedD4: number;
  calculatedD5: number;
  calculatedD6: number;
  calculatedD7: number;
  activatedIndex: string;
  scenario: "estabilidade" | "pressao" | "escalada";
  executiveNote: string;
  variation: number;
  summary: string;
}> {
  const territory = await getTerritoryBySlug(territorySlug);
  if (!territory) throw new Error(`Territory not found: ${territorySlug}`);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar sinais pendentes sem análise LLM
  const pendingSignals = await db
    .select()
    .from(signals)
    .where(
      and(
        eq(signals.territoryId, territory.id),
        isNull(signals.llmAnalysis)
      )
    )
    .limit(30);

  // Também buscar sinais já analisados recentes para contexto
  const recentAnalyzed = await db
    .select()
    .from(signals)
    .where(
      and(
        eq(signals.territoryId, territory.id),
        eq(signals.curationStatus, "relevant")
      )
    )
    .orderBy(desc(signals.publishedAt))
    .limit(10);

  const ctx = TERRITORY_CONTEXTS[territorySlug];
  const baseline = ctx?.baselineScores ?? { stt: 78, itt: 72, ics: 80, ivs: 82, ive: 85, ici: 70 };

  // Buscar score STT mais recente do banco para calibração
  const [latestDbScore] = await db
    .select()
    .from(sttScores)
    .where(eq(sttScores.territoryId, territory.id))
    .orderBy(desc(sttScores.period))
    .limit(1);

  const currentStt = latestDbScore?.stt ?? baseline.stt;
  const currentItt = latestDbScore?.itt ?? baseline.itt;
  const currentIcs = latestDbScore?.ics ?? baseline.ics;
  const currentIvs = latestDbScore?.ivs ?? baseline.ivs;
  const currentIve = latestDbScore?.ive ?? baseline.ive;
  const currentIci = latestDbScore?.ici ?? baseline.ici;

  // Contexto territorial completo
  const territoryContextPrompt = buildTerritoryContextPrompt(territorySlug);

  // Preparar lista de sinais novos
  const newSignalsList = pendingSignals.length > 0
    ? pendingSignals
        .map((s, i) => `${i + 1}. TÍTULO: ${s.title}${s.summary ? `\n   RESUMO: ${s.summary.substring(0, 300)}` : ""}`)
        .join("\n\n")
    : "Nenhum sinal novo coletado neste ciclo.";

  // Sinais relevantes recentes
  const recentSignalsList = recentAnalyzed.length > 0
    ? recentAnalyzed
        .map((s) => `- [${s.relatedIndex ?? "GERAL"}] ${s.title}${s.llmAnalysis ? ` → ${s.llmAnalysis}` : ""}`)
        .join("\n")
    : "Nenhum.";

  const prompt = `Você é o sistema de inteligência artificial da Print Territorial Intelligence™, responsável por calcular automaticamente o Score de Tensão Territorial (STT) com base em evidências concretas.

${territoryContextPrompt}

=== SCORES ATUAIS (referência para este ciclo de análise) ===
STT: ${currentStt} | ITT: ${currentItt} | ICS: ${currentIcs} | IVS: ${currentIvs} | IVE: ${currentIve} | ICI: ${currentIci}

=== SINAIS CURADOS RECENTES (contexto acumulado) ===
${recentSignalsList}

=== NOVOS SINAIS PARA ANÁLISE (${pendingSignals.length} sinais) ===
${newSignalsList}

=== TAREFA ===

PARTE 1 — Analise cada novo sinal individualmente:
Para cada sinal, determine:
- Qual índice é mais impactado (D1, D2, D3, D4, D5, D6, D7 ou GERAL)
- Score de impacto: 0.0 (irrelevante) a 1.0 (impacto crítico)
- Análise executiva de 1-2 frases: o que este sinal significa para o território?

PARTE 2 — Calcule os novos scores STT completos:
Com base em TODOS os sinais (novos + contexto acumulado) e no histórico do território:

1. Calcule cada sub-índice (0-100):
   - ITT: tensão territorial, disputas de uso, conflitos fundiários
   - ICS: complexidade social, organização de atores, capacidade de mobilização
   - IVS: vulnerabilidade social, exposição de populações tradicionais
   - IVE: vulnerabilidade ecossistêmica, pressão ambiental, poluição
   - ICI: complexidade institucional, fragmentação regulatória, litigiosidade

2. Aplique a fórmula DIT:
   STT = (ITT × 0.25) + (ICS × 0.20) + (IVS × 0.20) + (IVE × 0.20) + (ICI × 0.15)
   Arredonde para 1 casa decimal.

3. Determine:
   - Índice mais ativado no período
   - Cenário: "estabilidade" (STT estável ±1), "pressao" (variação +1 a +3), "escalada" (variação >+3)
   - Nota executiva: síntese estratégica de 3-4 frases para tomadores de decisão

IMPORTANTE:
- Seja conservador nas variações: mudanças de ±5 pontos já são significativas
- Baseie-se em evidências concretas dos sinais, não em suposições
- Se não houver sinais relevantes, mantenha scores próximos ao baseline
- Os sub-índices devem ser coerentes com o STT calculado pela fórmula
`;

  const response = await invokeLLM({
    messages: [
      { role: "system" as const, content: "Você é o sistema de IA da Print Territorial Intelligence™. Calcule scores STT com rigor metodológico. Responda sempre em JSON válido." },
      { role: "user" as const, content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "territorial_stt_calculation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            signals: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  index: { type: "string" },
                  impactScore: { type: "number" },
                  analysis: { type: "string" },
                },
                required: ["id", "index", "impactScore", "analysis"],
                additionalProperties: false,
              },
            },
            calculatedD1: { type: "number" },
            calculatedD2: { type: "number" },
            calculatedD3: { type: "number" },
            calculatedD4: { type: "number" },
            calculatedD5: { type: "number" },
            calculatedD6: { type: "number" },
            calculatedD7: { type: "number" },
            calculatedStt: { type: "number" },
            activatedIndex: { type: "string" },
            scenario: { type: "string" },
            executiveNote: { type: "string" },
          },
          required: ["signals", "calculatedD1", "calculatedD2", "calculatedD3", "calculatedD4", "calculatedD5", "calculatedD6", "calculatedD7", "calculatedStt", "activatedIndex", "scenario", "executiveNote"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("LLM returned empty response");
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

  const result = JSON.parse(content) as {
    signals: { id: number; index: string; impactScore: number; analysis: string }[];
    calculatedD1: number;
    calculatedD2: number;
    calculatedD3: number;
    calculatedD4: number;
    calculatedD5: number;
  calculatedD6: number;
  calculatedD7: number;
    calculatedStt: number;
    activatedIndex: string;
    scenario: string;
    executiveNote: string;
  };

  // ─── Clamp + sanitise LLM outputs ───────────────────────────────────────────
  // LLMs occasionally hallucinate values outside valid ranges; guard hard here.
  const clampScore = (v: number) => Math.min(100, Math.max(0, Number(v) || 0));
  const clampImpact = (v: number) => Math.min(1, Math.max(0, Number(v) || 0));

  const stt  = clampScore(result.calculatedStt);
  const d1  = clampScore(result.calculatedD1);
  const d2  = clampScore(result.calculatedD2);
  const d3  = clampScore(result.calculatedD3);
  const d4  = clampScore(result.calculatedD4);
  const d5  = clampScore(result.calculatedD5);
  const d6  = clampScore(result.calculatedD6);
  const d7  = clampScore(result.calculatedD7);

  // Validar e normalizar o cenário
  const validScenarios = ["estabilidade", "pressao", "escalada"];
  const scenario = validScenarios.includes(result.scenario)
    ? (result.scenario as "estabilidade" | "pressao" | "escalada")
    : "pressao";

  // Validar índice ativado (dimensão PRINT D1–D6 ou GERAL)
  const validIndexes: DimensionOrGeral[] = ["D1", "D2", "D3", "D4", "D5", "D6", "GERAL"];
  const activatedIndex: DimensionOrGeral = validIndexes.includes(result.activatedIndex as DimensionOrGeral)
    ? (result.activatedIndex as DimensionOrGeral)
    : "GERAL";

  // Calcular variação em relação ao score atual
  const variation = parseFloat((stt - currentStt).toFixed(1));

  // Atualizar cada sinal com a análise LLM
  for (let i = 0; i < result.signals.length; i++) {
    const signalAnalysis = result.signals[i];
    const signal = pendingSignals[i];
    if (!signal || !signalAnalysis) continue;

    const suggestedIndex: DimensionOrGeral = validIndexes.includes(signalAnalysis.index as DimensionOrGeral)
      ? (signalAnalysis.index as DimensionOrGeral)
      : "GERAL";

    await db
      .update(signals)
      .set({
        llmAnalysis: signalAnalysis.analysis,
        llmImpactScore: clampImpact(signalAnalysis.impactScore),
        llmSuggestedIndex: suggestedIndex,
        relatedIndex: suggestedIndex,
      })
      .where(eq(signals.id, signal.id));
  }

  log.info(` STT calculado para ${territorySlug}: ${result.calculatedStt} (variação: ${variation > 0 ? "+" : ""}${variation}) | Índice: ${activatedIndex} | Cenário: ${scenario}`);

  // Buscar histórico anterior para calcular deltas por índice
  const prevHistory = await getLatestIndexHistory(territory.id);

  // Extrair eventos críticos (sinais de alto impacto)
  const keyEvents = result.signals
    .filter((s) => s.impactScore >= 0.6)
    .slice(0, 5)
    .map((s, i) => ({
      title: pendingSignals[i]?.title ?? "",
      index: s.index,
      impactScore: s.impactScore,
      analysis: s.analysis,
    }));

  // Salvar no histórico de índices
  const period = new Date().toISOString().substring(0, 7);
  await insertIndexHistory({
    territoryId: territory.id,
    period,
    stt,
    itt,
    ics,
    ivs,
    ive,
    ici,
    sttDelta: variation,
    ittDelta: prevHistory ? parseFloat((itt - (prevHistory.itt ?? 0)).toFixed(1)) : 0,
    icsDelta: prevHistory ? parseFloat((ics - (prevHistory.ics ?? 0)).toFixed(1)) : 0,
    ivsDelta: prevHistory ? parseFloat((ivs - (prevHistory.ivs ?? 0)).toFixed(1)) : 0,
    iveDelta: prevHistory ? parseFloat((ive - (prevHistory.ive ?? 0)).toFixed(1)) : 0,
    iciDelta: prevHistory ? parseFloat((ici - (prevHistory.ici ?? 0)).toFixed(1)) : 0,
    activatedIndex,
    scenario,
    signalCount: pendingSignals.length,
    relevantSignalCount: result.signals.filter((s) => s.impactScore >= 0.4).length,
    keyEvents,
    llmRationale: result.executiveNote,
    source: "llm",
  });

  return {
    analyzed: result.signals.length,
    calculatedStt: stt,
    calculatedD1: d1,
    calculatedD2: d2,
    calculatedD3: d3,
    calculatedD4: d4,
    calculatedD5: d5,
    calculatedD6: d6,
    calculatedD7: d7,
    activatedIndex,
    scenario,
    executiveNote: result.executiveNote,
    variation,
    summary: result.executiveNote,
  };
}

// ─── Orquestrador Principal ───────────────────────────────────────────────────

export async function runCollectionPipeline(territorySlug?: string): Promise<{
  territory: string;
  googleRss: number;
  newsapi: number;
  total: number;
}[]> {
  const results: { territory: string; googleRss: number; newsapi: number; total: number }[] = [];

  let territoriesToProcessFull: { id: number; slug: string; name: string; contextData: TerritoryContextData | null }[] = [];

  if (territorySlug) {
    const t = await getTerritoryBySlug(territorySlug);
    if (t) territoriesToProcessFull = [{ id: t.id, slug: t.slug, name: t.name, contextData: t.contextData as TerritoryContextData | null }];
  } else {
    const all = await getAllTerritories();
    territoriesToProcessFull = all.map((t) => ({ id: t.id, slug: t.slug, name: t.name, contextData: t.contextData as TerritoryContextData | null }));
  }

  for (const territory of territoriesToProcessFull) {
    log.info(` Starting collection for: ${territory.name}`);

    const googleCount = await collectFromGoogleRss(territory.id, territory.slug, territory.contextData);
    const newsCount = await collectFromNewsApi(territory.id, territory.slug, territory.contextData);
    const total = googleCount + newsCount;

    // Salvar snapshot da coleta
    const period = new Date().toISOString().substring(0, 7);
    await insertCollectionSnapshot({
      territoryId: territory.id,
      period,
      collectionType: "news",
      newsCount: total,
      totalSignals: total,
      notes: `Google RSS: ${googleCount} | NewsAPI: ${newsCount}`,
    });

    const result = {
      territory: territory.name,
      googleRss: googleCount,
      newsapi: newsCount,
      total,
    };

    results.push(result);
    log.info(` Collected ${result.total} signals for ${territory.name} (Google RSS: ${googleCount}, NewsAPI: ${newsCount})`);
  }

  return results;
}
