/**
 * Coletor Histórico Retroativo — Print Territorial Intelligence™
 *
 * Coleta dados dos últimos 24 meses (mês a mês) para um território,
 * usando queries com framing de data para o Google News RSS.
 *
 * Após cada mês coletado, calcula o STT automaticamente via LLM
 * e grava no index_history. Não requer intervenção manual.
 *
 * Fluxo:
 *   1. Para cada mês dos últimos 24 meses (do mais antigo ao mais recente):
 *      a. Verifica se já existe index_history para aquele período
 *      b. Se não existe: coleta notícias com framing de data
 *      c. Calcula STT via LLM com contexto do período
 *      d. Grava no index_history e collection_snapshots
 *   2. Retorna resumo com períodos coletados e scores calculados
 */

import { getAllTerritories, getTerritoryBySlug, insertSignal, insertCollectionSnapshot, insertIndexHistory, getDb } from "./db";
import type { TerritoryContextData } from "./stt/types";
import { invokeLLM } from "./_core/llm";
import { buildTerritoryContextPrompt, TERRITORY_CONTEXTS } from "./territoryContext";
import { indexHistory, signals, sttScores } from "../drizzle/schema";
import { eq, and, desc, between, gte, lte } from "drizzle-orm";
import { logger } from "./_core/logger";

const log = logger.child({ module: "historicalCollector" });

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface HistoricalCollectionResult {
  period: string;          // "2024-03"
  territory: string;
  signalsCollected: number;
  stt: number;
  itt: number;
  ics: number;
  ivs: number;
  ive: number;
  ici: number;
  scenario: string;
  skipped: boolean;        // true se já havia dados para este período
  error?: string;
}

// ─── Queries por Território (fallback estático — novos territórios usam contextData) ──

const TERRITORY_QUERIES_FALLBACK: Record<string, string[]> = {
  "baia-guanabara": [
    "Baía de Guanabara poluição",
    "Baía de Guanabara licença ambiental IBAMA",
    "Baía de Guanabara porto pescadores conflito",
    "Baía de Guanabara saneamento esgoto",
    "Baía de Guanabara petróleo refinaria REDUC",
    "INEA Rio de Janeiro licença ambiental",
    "Porto Rio de Janeiro dragagem",
  ],
  "teles-pires": [
    "Rio Teles Pires hidrelétrica indígena",
    "Munduruku Kayabi Apiaká conflito",
    "UHE Teles Pires IBAMA licença",
    "Bacia Teles Pires garimpo ilegal",
    "Teles Pires demarcação terra indígena",
    "UHE São Manoel STF decisão",
    "Teles Pires pesca ictiofauna",
  ],
};

function getHistoricalRssQueries(slug: string, ctx: TerritoryContextData | null): string[] {
  return ctx?.rssQueries ?? TERRITORY_QUERIES_FALLBACK[slug] ?? [slug];
}

// ─── Parser RSS ───────────────────────────────────────────────────────────────

interface ParsedArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
}

function parseGoogleRss(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g));

  for (const match of itemMatches) {
    const item = match[1];
    const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = item.match(/<link>(https?:\/\/[^\s<]+)/);
    const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);

    if (!titleMatch || !linkMatch) continue;

    const cleanTitle = titleMatch[1]
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
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

// ─── Detecção de Dimensão PRINT ──────────────────────────────────────────────

const DIMENSION_KEYWORDS: Record<string, string[]> = {
  D1: ["poluição", "licença ambiental", "IBAMA", "embargo", "desmatamento", "contaminação",
       "APA", "APP", "ICMBio", "INPE", "DETER", "PRODES", "derramamento", "fauna", "flora",
       "ecossistema", "CEMADEN", "eventos climáticos", "esgoto", "chorume", "TAC ambiental",
       "degradação ambiental", "queimada", "incêndio florestal"],
  D2: ["desemprego", "informalidade", "pobreza", "renda per capita", "Gini", "IDH",
       "desigualdade", "demissão", "trabalho informal", "PNAD", "extrema pobreza",
       "bolsa família", "transferência de renda"],
  D3: ["saneamento", "água tratada", "hospital", "UBS", "saúde pública", "IDEB",
       "educação", "habitação", "déficit habitacional", "lixão", "aterro sanitário",
       "rodovia", "porto", "hidrovia", "aeroporto", "transporte público"],
  D4: ["disputa territorial", "demarcação", "invasão", "sobreposição", "fundiário",
       "INCRA", "FUNAI", "terra indígena", "conflito de uso", "zoneamento", "plano diretor",
       "milícia", "poder paralelo", "facção", "conflito armado", "reintegração de posse",
       "assentamento", "quilombola", "comunidade tradicional", "área de risco"],
  D5: ["Diário Oficial", "portaria", "regulação", "ANEEL", "ANP", "liminar", "tribunal",
       "decisão judicial", "conselho municipal", "orçamento participativo", "audiência pública",
       "transparência", "prestação de contas", "liderança comunitária", "associação",
       "cooperativa", "sindicato", "articulação"],
  D6: ["protesto", "manifestação", "mobilização", "comunidade", "pescador", "indígena",
       "conflito social", "bloqueio", "resistência", "repercussão", "viral", "redes sociais",
       "matéria jornalística", "reportagem", "pesquisa científica"],
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

// ─── Coleta RSS com Framing de Data ──────────────────────────────────────────

/**
 * Coleta notícias do Google News RSS para um período específico (mês/ano).
 * Usa o operador `after:` e `before:` para filtrar por data.
 */
async function collectHistoricalRss(
  territoryId: number,
  territorySlug: string,
  year: number,
  month: number, // 1-12
  ctx: TerritoryContextData | null = null
): Promise<number> {
  const queries = getHistoricalRssQueries(territorySlug, ctx);
  if (queries.length === 0) return 0;

  // Calcular datas de início e fim do mês
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // último dia do mês
  const afterStr = startDate.toISOString().split("T")[0];  // "2024-03-01"
  const beforeStr = endDate.toISOString().split("T")[0];   // "2024-03-31"
  const period = `${year}-${String(month).padStart(2, "0")}`;

  let collected = 0;
  const seenTitles = new Set<string>();

  for (const query of queries.slice(0, 5)) { // máx 5 queries por mês para não sobrecarregar
    try {
      // Google News suporta after: e before: no operador de busca
      const framedQuery = `${query} after:${afterStr} before:${beforeStr}`;
      const encodedQuery = encodeURIComponent(framedQuery);
      const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RadarTerritorial/1.0)" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const xml = await response.text();
      const articles = parseGoogleRss(xml);

      // Pegar os 3 mais recentes por query (histórico tem menos volume)
      for (const article of articles.slice(0, 3)) {
        const titleKey = article.title.substring(0, 80).toLowerCase();
        if (seenTitles.has(titleKey)) continue;
        seenTitles.add(titleKey);

        const relatedIndex = detectIndex(`${article.title} ${article.description}`);

        // Para histórico, usar a data do artigo ou o primeiro dia do período
        let publishedAt: Date;
        try {
          publishedAt = new Date(article.pubDate);
          if (isNaN(publishedAt.getTime())) publishedAt = startDate;
        } catch {
          publishedAt = startDate;
        }

        await insertSignal({
          territoryId,
          source: "newsapi",
          relatedIndex,
          title: article.title.substring(0, 499),
          summary: article.description.substring(0, 1000) || null,
          url: article.link,
          imageUrl: null,
          publishedAt,
          // Sinais históricos são marcados como relevantes automaticamente pela IA
          // Curadoria manual é apenas para sinais do mês atual
          curationStatus: "relevant" as const,
          metadata: {
            query,
            sourceName: article.source,
            provider: "google_rss_historical",
            period,
            collectedAt: new Date().toISOString(),
            autoClassified: true,
          },
        });

        collected++;
      }

      // Rate limit gentil para coleta histórica
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      log.warn({ err, query, period }, "Erro na query histórica");
    }
  }

  return collected;
}

// ─── Cálculo STT para Período Histórico ──────────────────────────────────────

/**
 * Calcula o STT para um período específico usando os sinais coletados.
 * Usa o contexto territorial + scores do período anterior como baseline.
 */
async function calculateHistoricalStt(
  territoryId: number,
  territorySlug: string,
  year: number,
  month: number,
  previousScores: { stt: number; itt: number; ics: number; ivs: number; ive: number; ici: number },
  signalsForPeriod: { title: string; summary: string | null; relatedIndex: string | null }[]
): Promise<{
  stt: number; itt: number; ics: number; ivs: number; ive: number; ici: number;
  activatedIndex: string; scenario: "estabilidade" | "pressao" | "escalada";
  executiveNote: string;
}> {
  const ctx = TERRITORY_CONTEXTS[territorySlug];
  const territoryContextPrompt = buildTerritoryContextPrompt(territorySlug);
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const monthName = monthNames[month - 1];

  const signalsList = signalsForPeriod.length > 0
    ? signalsForPeriod
        .map((s, i) => `${i + 1}. [${s.relatedIndex ?? "GERAL"}] ${s.title}${s.summary ? `\n   ${s.summary.substring(0, 200)}` : ""}`)
        .join("\n\n")
    : "Nenhum sinal coletado para este período.";

  const prompt = `Você é o sistema de inteligência artificial da Print Territorial Intelligence™.

Calcule o STT histórico para o período: ${monthName}/${year} (${period})

${territoryContextPrompt}

=== SCORES DO PERÍODO ANTERIOR (baseline para ${period}) ===
STT: ${previousScores.stt} | ITT: ${previousScores.itt} | ICS: ${previousScores.ics} | IVS: ${previousScores.ivs} | IVE: ${previousScores.ive} | ICI: ${previousScores.ici}

=== SINAIS COLETADOS PARA ${monthName.toUpperCase()}/${year} (${signalsForPeriod.length} sinais) ===
${signalsList}

=== INSTRUÇÕES ===
1. Calcule os scores para ${monthName}/${year} com base nos sinais coletados e no contexto histórico do território
2. Use os scores do período anterior como referência — variações de ±5 pontos já são significativas
3. Se há poucos sinais, mantenha scores próximos ao baseline com pequenas variações
4. Seja conservador e baseie-se em evidências concretas
5. A nota executiva deve ser específica para o contexto de ${monthName}/${year}

Aplique a fórmula: STT = (ITT × 0.25) + (ICS × 0.20) + (IVS × 0.20) + (IVE × 0.20) + (ICI × 0.15)`;

  const response = await invokeLLM({
    messages: [
      { role: "system" as const, content: "Você é o sistema de IA da Print Territorial Intelligence™. Calcule scores STT históricos com rigor metodológico. Responda em JSON válido." },
      { role: "user" as const, content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "historical_stt",
        strict: true,
        schema: {
          type: "object",
          properties: {
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
          required: ["calculatedD1", "calculatedD2", "calculatedD3", "calculatedD4", "calculatedD5", "calculatedD6", "calculatedD7", "calculatedStt", "activatedIndex", "scenario", "executiveNote"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("LLM returned empty response");
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
  const result = JSON.parse(content);

  const validScenarios = ["estabilidade", "pressao", "escalada"];
  const scenario = validScenarios.includes(result.scenario)
    ? (result.scenario as "estabilidade" | "pressao" | "escalada")
    : "pressao";

  const validIndexes: DimensionOrGeral[] = ["D1", "D2", "D3", "D4", "D5", "D6", "GERAL"];
  const activatedIndex = validIndexes.includes(result.activatedIndex) ? result.activatedIndex : "GERAL";

  return {
    stt: Math.round(result.calculatedStt * 10) / 10,
    d1Score: Math.round(result.calculatedD1 * 10) / 10,
    d2Score: Math.round(result.calculatedD2 * 10) / 10,
    d3Score: Math.round(result.calculatedD3 * 10) / 10,
    d4Score: Math.round(result.calculatedD4 * 10) / 10,
    d5Score: Math.round(result.calculatedD5 * 10) / 10,
          d6Score: Math.round(result.calculatedD6 * 10) / 10,
          d7Score: Math.round(result.calculatedD7 * 10) / 10,
    activatedIndex,
    scenario,
    executiveNote: result.executiveNote,
  };
}

// ─── Pipeline Principal de Coleta Histórica ───────────────────────────────────

/**
 * Executa a coleta histórica retroativa dos últimos N meses para um território.
 * Verifica quais períodos já têm dados antes de coletar.
 */
export async function runHistoricalCollection(
  territorySlug: string,
  monthsBack: number = 24,
  onProgress?: (progress: { current: number; total: number; period: string; status: string }) => void
): Promise<HistoricalCollectionResult[]> {
  const territory = await getTerritoryBySlug(territorySlug);
  if (!territory) throw new Error(`Territory not found: ${territorySlug}`);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const territoryCtx = territory.contextData as TerritoryContextData | null;

  const results: HistoricalCollectionResult[] = [];

  // Gerar lista de períodos dos últimos N meses (do mais antigo ao mais recente)
  const periods: { year: number; month: number; period: string }[] = [];
  const now = new Date();

  for (let i = monthsBack; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const period = `${year}-${String(month).padStart(2, "0")}`;
    periods.push({ year, month, period });
  }

  log.info(` Iniciando coleta histórica para ${territory.name}: ${periods.length} períodos`);

  // Verificar quais períodos já têm dados no index_history
  const existingHistory = await db
    .select({ period: indexHistory.period })
    .from(indexHistory)
    .where(eq(indexHistory.territoryId, territory.id));

  const existingPeriods = new Set(existingHistory.map((h) => h.period));

  // Scores iniciais (baseline do contexto territorial)
  const ctx = TERRITORY_CONTEXTS[territorySlug];
  let previousScores = ctx?.baselineScores ?? { stt: 75, itt: 70, ics: 75, ivs: 75, ive: 75, ici: 70 };

  for (let i = 0; i < periods.length; i++) {
    const { year, month, period } = periods[i];

    onProgress?.({
      current: i + 1,
      total: periods.length,
      period,
      status: existingPeriods.has(period) ? "skipping" : "collecting",
    });

    // Se já existe dados para este período, pular
    if (existingPeriods.has(period)) {
      log.info(` Período ${period} já existe, pulando.`);

      // Buscar scores existentes para usar como baseline do próximo período
      const [existing] = await db
        .select()
        .from(indexHistory)
        .where(and(eq(indexHistory.territoryId, territory.id), eq(indexHistory.period, period)))
        .limit(1);

      if (existing) {
        previousScores = {
          stt: existing.stt ?? previousScores.stt,
          itt: existing.itt ?? previousScores.itt,
          ics: existing.ics ?? previousScores.ics,
          ivs: existing.ivs ?? previousScores.ivs,
          ive: existing.ive ?? previousScores.ive,
          ici: existing.ici ?? previousScores.ici,
        };
      }

      results.push({
        period,
        territory: territory.name,
        signalsCollected: 0,
        stt: previousScores.stt,
        itt: previousScores.itt,
        ics: previousScores.ics,
        ivs: previousScores.ivs,
        ive: previousScores.ive,
        ici: previousScores.ici,
        scenario: "estabilidade",
        skipped: true,
      });
      continue;
    }

    try {
      log.info(` Coletando período ${period} para ${territory.name}...`);

      // 1. Coletar notícias com framing de data
      const signalsCollected = await collectHistoricalRss(territory.id, territorySlug, year, month, territoryCtx);

      // 2. Buscar os sinais recém-coletados para este período
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const periodSignals = await db
        .select({
          title: signals.title,
          summary: signals.summary,
          relatedIndex: signals.relatedIndex,
        })
        .from(signals)
        .where(
          and(
            eq(signals.territoryId, territory.id),
            gte(signals.publishedAt, startDate),
            lte(signals.publishedAt, endDate)
          )
        )
        .limit(20);

      // 3. Calcular STT via LLM para este período
      const sttResult = await calculateHistoricalStt(
        territory.id,
        territorySlug,
        year,
        month,
        previousScores,
        periodSignals
      );

      // 4. Salvar no index_history
      await insertIndexHistory({
        territoryId: territory.id,
        period,
        stt: sttResult.stt,
        itt: sttResult.itt,
        ics: sttResult.ics,
        ivs: sttResult.ivs,
        ive: sttResult.ive,
        ici: sttResult.ici,
        sttDelta: parseFloat((sttResult.stt - previousScores.stt).toFixed(1)),
        ittDelta: parseFloat((sttResult.itt - previousScores.itt).toFixed(1)),
        icsDelta: parseFloat((sttResult.ics - previousScores.ics).toFixed(1)),
        ivsDelta: parseFloat((sttResult.ivs - previousScores.ivs).toFixed(1)),
        iveDelta: parseFloat((sttResult.ive - previousScores.ive).toFixed(1)),
        iciDelta: parseFloat((sttResult.ici - previousScores.ici).toFixed(1)),
        activatedIndex: sttResult.activatedIndex,
        scenario: sttResult.scenario,
        signalCount: signalsCollected,
        relevantSignalCount: Math.ceil(signalsCollected * 0.6),
        keyEvents: [],
        llmRationale: sttResult.executiveNote,
        source: "llm_historical",
      });

      // 5. Salvar snapshot da coleta
      await insertCollectionSnapshot({
        territoryId: territory.id,
        period,
        collectionType: "historical",
        newsCount: signalsCollected,
        totalSignals: signalsCollected,
        notes: `Coleta histórica retroativa — ${period}`,
      });

      // Atualizar scores para o próximo período
      previousScores = {
        stt: sttResult.stt,
        itt: sttResult.itt,
        ics: sttResult.ics,
        ivs: sttResult.ivs,
        ive: sttResult.ive,
        ici: sttResult.ici,
      };

      results.push({
        period,
        territory: territory.name,
        signalsCollected,
        ...sttResult,
        skipped: false,
      });

      log.info(` ${period}: ${signalsCollected} sinais → STT ${sttResult.stt} (${sttResult.scenario})`);

      // Pausa entre períodos para não sobrecarregar APIs
      await new Promise((r) => setTimeout(r, 2000));

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ period, errorMsg }, "Erro no período histórico");

      results.push({
        period,
        territory: territory.name,
        signalsCollected: 0,
        stt: previousScores.stt,
        itt: previousScores.itt,
        ics: previousScores.ics,
        ivs: previousScores.ivs,
        ive: previousScores.ive,
        ici: previousScores.ici,
        scenario: "estabilidade",
        skipped: false,
        error: errorMsg,
      });
    }
  }

  log.info(` Coleta histórica concluída para ${territory.name}: ${results.filter(r => !r.skipped && !r.error).length} períodos novos`);
  return results;
}

/**
 * Executa coleta histórica para todos os territórios ativos.
 */
export async function runHistoricalCollectionForAll(monthsBack: number = 24): Promise<Record<string, HistoricalCollectionResult[]>> {
  const territories = await getAllTerritories();
  const activeTerritories = territories.filter((t) => t.active);
  const allResults: Record<string, HistoricalCollectionResult[]> = {};

  for (const territory of activeTerritories) {
    log.info(` Processando ${territory.name}...`);
    allResults[territory.slug] = await runHistoricalCollection(territory.slug, monthsBack);
  }

  return allResults;
}

/**
 * Recoleta sinais para períodos que já existem no index_history mas têm poucos ou nenhum sinal.
 * Não recalcula o STT — apenas coleta notícias e dados estruturados e atualiza o signalCount.
 * Útil para popular períodos que foram criados via seed ou que tiveram coleta insuficiente.
 */
export async function backfillSignalsForExistingPeriods(
  territorySlug: string,
  monthsBack: number = 24,
  onProgress?: (p: { current: number; total: number; period: string; status: string }) => void
): Promise<{ period: string; collected: number; error?: string }[]> {
  const territory = await getTerritoryBySlug(territorySlug);
  if (!territory) throw new Error(`Território não encontrado: ${territorySlug}`);

  const db = await getDb();
  if (!db) throw new Error("Banco de dados não disponível");

  const territoryCtx = territory.contextData as TerritoryContextData | null;

  // Gerar lista de períodos dos últimos N meses
  const periods: { year: number; month: number; period: string }[] = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const period = `${year}-${String(month).padStart(2, "0")}`;
    periods.push({ year, month, period });
  }

  const results: { period: string; collected: number; error?: string }[] = [];

  for (let i = 0; i < periods.length; i++) {
    const { year, month, period } = periods[i];

    onProgress?.({ current: i + 1, total: periods.length, period, status: "collecting" });

    try {
      log.info(` Recoletando sinais para ${period} — ${territory.name}...`);

      // Verificar quantos sinais já existem para este período
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const existingCount = await db
        .select({ id: signals.id })
        .from(signals)
        .where(
          and(
            eq(signals.territoryId, territory.id),
            gte(signals.publishedAt, startDate),
            lte(signals.publishedAt, endDate)
          )
        );

      // Se já tem 5+ sinais, pular (já tem cobertura suficiente)
      if (existingCount.length >= 5) {
        log.info(` ${period}: já tem ${existingCount.length} sinais, pulando.`);
        results.push({ period, collected: 0 });

        // Atualizar signalCount no index_history
        await db
          .update(indexHistory)
          .set({ signalCount: existingCount.length, relevantSignalCount: existingCount.length })
          .where(and(eq(indexHistory.territoryId, territory.id), eq(indexHistory.period, period)));

        continue;
      }

      // Coletar mais sinais via RSS
      const newlyCollected = await collectHistoricalRss(territory.id, territorySlug, year, month, territoryCtx);

      // Contar total de sinais agora (existentes + novos)
      const totalNow = await db
        .select({ id: signals.id })
        .from(signals)
        .where(
          and(
            eq(signals.territoryId, territory.id),
            gte(signals.publishedAt, startDate),
            lte(signals.publishedAt, endDate)
          )
        );

      // Atualizar signalCount no index_history
      await db
        .update(indexHistory)
        .set({ signalCount: totalNow.length, relevantSignalCount: totalNow.length })
        .where(and(eq(indexHistory.territoryId, territory.id), eq(indexHistory.period, period)));

      log.info(` ${period}: +${newlyCollected} novos sinais (total: ${totalNow.length})`);
      results.push({ period, collected: newlyCollected });

      // Rate limit gentil
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ period, errorMsg }, "Erro no período histórico");
      results.push({ period, collected: 0, error: errorMsg });
    }
  }

  log.info(` Concluído para ${territory.name}: ${results.filter(r => r.collected > 0).length} períodos com novos sinais`);
  return results;
}

/**
 * Executa backfill de sinais para todos os territórios ativos.
 */
export async function backfillSignalsForAll(monthsBack: number = 24): Promise<Record<string, { period: string; collected: number; error?: string }[]>> {
  const territories = await getAllTerritories();
  const activeTerritories = territories.filter((t) => t.active);
  const allResults: Record<string, { period: string; collected: number; error?: string }[]> = {};

  for (const territory of activeTerritories) {
    log.info(` Iniciando backfill para ${territory.name}...`);
    allResults[territory.slug] = await backfillSignalsForExistingPeriods(territory.slug, monthsBack);
  }

  return allResults;
}
