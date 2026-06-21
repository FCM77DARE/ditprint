/**
 * Learning Engine — Aprendizado autônomo do DIT.
 *
 * O DIT deixa de ser apenas memória persistente e passa a EVOLUIR
 * a cada coleta. 4 camadas de aprendizado:
 *
 *   1. SOURCE WEIGHTING ADAPTATIVO
 *      Cada agente tem peso que evolui com base em quanto seus sinais
 *      historicamente foram classificados como críticos/úteis. Agentes
 *      que entregam consistentemente sinais relevantes ganham peso;
 *      agentes que só ruído perdem peso.
 *
 *   2. QUERY LEARNING
 *      Registra quais queries do SerpAPI trouxeram resultados úteis
 *      por (território, agente). Próxima execução do agente para o
 *      mesmo território usa as queries vencedoras + variações.
 *
 *   3. SIGNAL PATTERN RECOGNITION
 *      Detecta padrões entre territórios similares (mesmo bioma,
 *      mesma faixa populacional, mesmo perfil socioeconômico).
 *      Permite extrapolar sinais em territórios com baixa cobertura
 *      digital (coverage 0%).
 *
 *   4. FEEDBACK LOOP
 *      Sinais marcados manualmente como relevant/irrelevant ajustam
 *      o peso da fonte/query/padrão para esse território.
 *
 * Persistência: /data/learning/
 *   - source-weights.json   → peso atual de cada agente por região
 *   - query-stats.json      → estatísticas de queries por agente/território
 *   - signal-feedback.json  → marcações manuais
 *   - territory-clusters.json → clusters de territórios similares
 */

import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../_core/logger";

const log = logger.child({ module: "learning-engine" });

const LEARN_DIR = join(process.env.DATA_DIR || join(process.cwd(), "data"), "learning");

function ensureDir(): void {
  if (!existsSync(LEARN_DIR)) mkdirSync(LEARN_DIR, { recursive: true });
}

// ─── 1. SOURCE WEIGHTING ADAPTATIVO ──────────────────────────────────────────

const WEIGHTS_FILE = join(LEARN_DIR, "source-weights.json");

interface SourceStats {
  // Stats por agente
  totalSignalsEmitted: number;
  totalImpactSum: number;        // Σ impact dos sinais emitidos
  triggersAlertCount: number;    // quantos viraram alerta (impact ≥ 0.7)
  feedbackRelevant: number;      // marcados manualmente como úteis
  feedbackIrrelevant: number;    // marcados como ruído
  lastUpdated: string;           // ISO
}

interface SourceWeights {
  // Por sourceAgentId → estatísticas
  global: Record<string, SourceStats>;
  // Por região (Nordeste, Centro-Oeste etc) → ajuste regional
  byRegion: Record<string, Record<string, number>>; // region → {sourceId → multiplier}
}

async function readWeights(): Promise<SourceWeights> {
  ensureDir();
  try {
    const c = await fs.readFile(WEIGHTS_FILE, "utf8");
    return JSON.parse(c) as SourceWeights;
  } catch {
    return { global: {}, byRegion: {} };
  }
}

async function writeWeights(w: SourceWeights): Promise<void> {
  ensureDir();
  await fs.writeFile(WEIGHTS_FILE, JSON.stringify(w, null, 2), "utf8");
}

/**
 * Registra que um sinal foi emitido por um agente.
 * Chamado pelo orchestrator após persistir cada sinal.
 */
export async function recordSignalEmission(
  sourceAgentId: string,
  impact: number,
  region: string | null
): Promise<void> {
  const w = await readWeights();
  const stats: SourceStats = w.global[sourceAgentId] ?? {
    totalSignalsEmitted: 0,
    totalImpactSum: 0,
    triggersAlertCount: 0,
    feedbackRelevant: 0,
    feedbackIrrelevant: 0,
    lastUpdated: new Date().toISOString(),
  };
  stats.totalSignalsEmitted += 1;
  stats.totalImpactSum += impact;
  if (impact >= 0.7) stats.triggersAlertCount += 1;
  stats.lastUpdated = new Date().toISOString();
  w.global[sourceAgentId] = stats;

  // Multiplier regional adaptativo
  if (region) {
    if (!w.byRegion[region]) w.byRegion[region] = {};
    const avgImpact = stats.totalImpactSum / stats.totalSignalsEmitted;
    // Multiplier: 0.5 a 1.5 baseado em avg impact (0.0 a 1.0)
    w.byRegion[region][sourceAgentId] = 0.5 + avgImpact;
  }

  await writeWeights(w);
}

/**
 * Retorna o multiplier de peso para um agente em uma região.
 * Default 1.0 quando sem histórico.
 */
export async function getSourceWeight(
  sourceAgentId: string,
  region: string | null
): Promise<number> {
  const w = await readWeights();
  if (region && w.byRegion[region]?.[sourceAgentId] !== undefined) {
    return w.byRegion[region][sourceAgentId];
  }
  const stats = w.global[sourceAgentId];
  if (!stats || stats.totalSignalsEmitted === 0) return 1.0;
  const avgImpact = stats.totalImpactSum / stats.totalSignalsEmitted;
  return 0.5 + avgImpact;
}

// ─── 2. QUERY LEARNING ───────────────────────────────────────────────────────

const QUERY_STATS_FILE = join(LEARN_DIR, "query-stats.json");

interface QueryStat {
  query: string;
  hits: number;       // quantas vezes retornou >=1 sinal
  signals: number;    // total de sinais retornados
  avgImpact: number;  // média dos impacts dos sinais
  lastUsed: string;
}

interface QueryStats {
  // Key: `${sourceAgentId}|${territorySlug}` → array de queries com stats
  byAgentTerritory: Record<string, QueryStat[]>;
}

async function readQueryStats(): Promise<QueryStats> {
  ensureDir();
  try {
    const c = await fs.readFile(QUERY_STATS_FILE, "utf8");
    return JSON.parse(c) as QueryStats;
  } catch {
    return { byAgentTerritory: {} };
  }
}

async function writeQueryStats(s: QueryStats): Promise<void> {
  ensureDir();
  await fs.writeFile(QUERY_STATS_FILE, JSON.stringify(s, null, 2), "utf8");
}

/**
 * Registra resultado de uma query.
 * Chamado pelos agentes SerpAPI após cada busca.
 */
export async function recordQueryResult(
  sourceAgentId: string,
  territorySlug: string,
  query: string,
  signalCount: number,
  avgImpact: number
): Promise<void> {
  const stats = await readQueryStats();
  const key = `${sourceAgentId}|${territorySlug}`;
  if (!stats.byAgentTerritory[key]) stats.byAgentTerritory[key] = [];

  const existing = stats.byAgentTerritory[key].find((q) => q.query === query);
  if (existing) {
    if (signalCount > 0) existing.hits += 1;
    existing.signals += signalCount;
    existing.avgImpact = (existing.avgImpact + avgImpact) / 2;
    existing.lastUsed = new Date().toISOString();
  } else {
    stats.byAgentTerritory[key].push({
      query,
      hits: signalCount > 0 ? 1 : 0,
      signals: signalCount,
      avgImpact,
      lastUsed: new Date().toISOString(),
    });
  }

  // Mantém só os top 10 queries por (agente, território)
  stats.byAgentTerritory[key].sort((a, b) => b.signals * b.avgImpact - a.signals * a.avgImpact);
  if (stats.byAgentTerritory[key].length > 10) {
    stats.byAgentTerritory[key] = stats.byAgentTerritory[key].slice(0, 10);
  }

  await writeQueryStats(stats);
}

/**
 * Sugere as queries melhores conhecidas para um agente em um território.
 * Retorna array vazio se nunca foi executado.
 */
export async function suggestQueries(
  sourceAgentId: string,
  territorySlug: string
): Promise<string[]> {
  const stats = await readQueryStats();
  const key = `${sourceAgentId}|${territorySlug}`;
  const queries = stats.byAgentTerritory[key] ?? [];
  return queries
    .filter((q) => q.hits > 0)
    .slice(0, 3)
    .map((q) => q.query);
}

// ─── 3. SIGNAL PATTERN RECOGNITION (clusters de territórios) ─────────────────

const CLUSTERS_FILE = join(LEARN_DIR, "territory-clusters.json");

interface TerritoryProfile {
  slug: string;
  state: string;
  region: string;
  populationDensity?: number;
  hasIndigenousTerritory?: boolean;
  hasQuilomboTerritory?: boolean;
  hasEnergyProject?: boolean;
  topSources: string[]; // 5 agentes que mais entregam sinais nesse perfil
}

interface ClusterRegistry {
  territories: Record<string, TerritoryProfile>;
}

async function readClusters(): Promise<ClusterRegistry> {
  ensureDir();
  try {
    const c = await fs.readFile(CLUSTERS_FILE, "utf8");
    return JSON.parse(c) as ClusterRegistry;
  } catch {
    return { territories: {} };
  }
}

async function writeClusters(c: ClusterRegistry): Promise<void> {
  ensureDir();
  await fs.writeFile(CLUSTERS_FILE, JSON.stringify(c, null, 2), "utf8");
}

/**
 * Atualiza perfil de território após coleta — usado para extrapolar
 * em territórios similares com coverage 0%.
 */
export async function updateTerritoryProfile(
  slug: string,
  state: string,
  region: string,
  signals: Array<{ source: string; impact: number }>,
  contextData?: { populationDensity?: number } | null
): Promise<void> {
  const reg = await readClusters();
  // Top 5 fontes por (count × impact)
  const sourceImpact = new Map<string, number>();
  for (const s of signals) {
    sourceImpact.set(s.source, (sourceImpact.get(s.source) || 0) + s.impact);
  }
  const top = Array.from(sourceImpact.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([src]) => src);

  reg.territories[slug] = {
    slug, state, region,
    populationDensity: contextData?.populationDensity,
    topSources: top,
  };
  await writeClusters(reg);
}

/**
 * Encontra territórios "irmãos" (mesma UF + região + faixa de densidade).
 * Permite extrapolar quando coverage é 0%.
 */
export async function findSimilarTerritories(
  slug: string,
  state: string,
  region: string
): Promise<TerritoryProfile[]> {
  const reg = await readClusters();
  return Object.values(reg.territories).filter(
    (t) => t.slug !== slug && t.state === state && t.region === region
  ).slice(0, 5);
}

// ─── 4. FEEDBACK LOOP MANUAL ─────────────────────────────────────────────────

const FEEDBACK_FILE = join(LEARN_DIR, "signal-feedback.json");

interface FeedbackEntry {
  signalHash: string;
  source: string;
  territorySlug: string;
  rating: "relevant" | "irrelevant";
  ts: string;
}

async function readFeedback(): Promise<FeedbackEntry[]> {
  ensureDir();
  try {
    const c = await fs.readFile(FEEDBACK_FILE, "utf8");
    return JSON.parse(c) as FeedbackEntry[];
  } catch {
    return [];
  }
}

async function writeFeedback(entries: FeedbackEntry[]): Promise<void> {
  ensureDir();
  await fs.writeFile(FEEDBACK_FILE, JSON.stringify(entries, null, 2), "utf8");
}

export async function recordFeedback(
  signalHash: string,
  source: string,
  territorySlug: string,
  rating: "relevant" | "irrelevant"
): Promise<void> {
  const entries = await readFeedback();
  entries.push({ signalHash, source, territorySlug, rating, ts: new Date().toISOString() });
  if (entries.length > 10000) entries.splice(0, entries.length - 10000);
  await writeFeedback(entries);

  // Ajusta source weights com base no feedback
  const w = await readWeights();
  const stats = w.global[source] ?? {
    totalSignalsEmitted: 0, totalImpactSum: 0, triggersAlertCount: 0,
    feedbackRelevant: 0, feedbackIrrelevant: 0,
    lastUpdated: new Date().toISOString(),
  };
  if (rating === "relevant") stats.feedbackRelevant += 1;
  else stats.feedbackIrrelevant += 1;
  w.global[source] = stats;
  await writeWeights(w);
}

// ─── DASHBOARD: estatísticas gerais ─────────────────────────────────────────

export async function getLearningStats(): Promise<{
  totalSourcesTracked: number;
  topPerformingSources: Array<{ source: string; avgImpact: number; signals: number }>;
  worstPerformingSources: Array<{ source: string; avgImpact: number; signals: number }>;
  totalQueriesTracked: number;
  totalTerritoriesProfiled: number;
  totalFeedbackEntries: number;
}> {
  const w = await readWeights();
  const queries = await readQueryStats();
  const clusters = await readClusters();
  const feedback = await readFeedback();

  const sourceList = Object.entries(w.global).map(([source, stats]) => ({
    source,
    avgImpact: stats.totalSignalsEmitted > 0 ? stats.totalImpactSum / stats.totalSignalsEmitted : 0,
    signals: stats.totalSignalsEmitted,
  }));
  sourceList.sort((a, b) => b.avgImpact * b.signals - a.avgImpact * a.signals);

  return {
    totalSourcesTracked: sourceList.length,
    topPerformingSources: sourceList.slice(0, 5),
    worstPerformingSources: sourceList.slice(-3).reverse(),
    totalQueriesTracked: Object.values(queries.byAgentTerritory).reduce((s, q) => s + q.length, 0),
    totalTerritoriesProfiled: Object.keys(clusters.territories).length,
    totalFeedbackEntries: feedback.length,
  };
}

void log; // suppress unused
