/**
 * SerpAPI Quota Manager — Cache + Rate Limiting agressivo.
 *
 * CONTEXTO: plano free SerpAPI = 250 buscas/mês. Cada município pesquisado
 * dispara ~24 agentes SerpAPI → estoura cota em 10 municípios.
 *
 * ESTRATÉGIA:
 *   1. CACHE em disco por hash(url) com TTL 30 dias
 *      → mesma busca em 30 dias = 0 buscas consumidas
 *   2. RATE LIMIT diário configurável (SERPAPI_DAILY_LIMIT, default 25)
 *      → distribui as 250/mês ao longo do mês
 *   3. CONTADOR mensal persistido em /data/serpapi-usage.json
 *   4. GRACEFUL fallback: estourou cota → retorna [] sem quebrar
 *
 * USO nos agentes:
 *   const result = await serpapiCachedFetch(url);
 *   if (!result) return [];  // cache miss + cota estourada
 */

import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { logger } from "../_core/logger";

const log = logger.child({ module: "serpapi-quota" });

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const CACHE_DIR = join(DATA_DIR, "serpapi-cache");
const USAGE_FILE = join(DATA_DIR, "serpapi-usage.json");

// Plano free: 250/mês. Cada município consome ~24 buscas = 10 municípios novos/mês.
// Cache 30d garante que re-pesquisar o mesmo município no mesmo mês = 0 buscas extras.
const DAILY_LIMIT = parseInt(process.env.SERPAPI_DAILY_LIMIT || "50", 10);
const MONTHLY_LIMIT = parseInt(process.env.SERPAPI_MONTHLY_LIMIT || "240", 10);
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function ensureDirs(): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

function urlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

interface UsageState {
  month: string;
  monthlyCount: number;
  dailyCounts: Record<string, number>; // YYYY-MM-DD → count
}

async function readUsage(): Promise<UsageState> {
  ensureDirs();
  try {
    const content = await fs.readFile(USAGE_FILE, "utf8");
    const state = JSON.parse(content) as UsageState;
    // Reset mensal automático
    if (state.month !== monthStr()) {
      return { month: monthStr(), monthlyCount: 0, dailyCounts: {} };
    }
    return state;
  } catch {
    return { month: monthStr(), monthlyCount: 0, dailyCounts: {} };
  }
}

async function writeUsage(state: UsageState): Promise<void> {
  try {
    await fs.writeFile(USAGE_FILE, JSON.stringify(state), "utf8");
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Falha ao gravar usage SerpAPI");
  }
}

async function canConsume(): Promise<{ ok: boolean; reason?: string; usage: UsageState }> {
  const state = await readUsage();
  if (state.monthlyCount >= MONTHLY_LIMIT) {
    return { ok: false, reason: `monthly limit ${MONTHLY_LIMIT} hit`, usage: state };
  }
  const today = todayStr();
  const dailyCount = state.dailyCounts[today] || 0;
  if (dailyCount >= DAILY_LIMIT) {
    return { ok: false, reason: `daily limit ${DAILY_LIMIT} hit`, usage: state };
  }
  return { ok: true, usage: state };
}

async function recordConsumption(): Promise<void> {
  const state = await readUsage();
  const today = todayStr();
  state.monthlyCount += 1;
  state.dailyCounts[today] = (state.dailyCounts[today] || 0) + 1;
  // Limpa contadores diários antigos (>35 dias)
  const cutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const date of Object.keys(state.dailyCounts)) {
    if (date < cutoff) delete state.dailyCounts[date];
  }
  await writeUsage(state);
}

async function readCache(hash: string): Promise<unknown | null> {
  const cachePath = join(CACHE_DIR, `${hash}.json`);
  try {
    const content = await fs.readFile(cachePath, "utf8");
    const entry = JSON.parse(content) as { ts: number; data: unknown };
    if (Date.now() - entry.ts < CACHE_TTL_MS) {
      return entry.data;
    }
  } catch { /* miss */ }
  return null;
}

async function writeCache(hash: string, data: unknown): Promise<void> {
  ensureDirs();
  const cachePath = join(CACHE_DIR, `${hash}.json`);
  try {
    await fs.writeFile(cachePath, JSON.stringify({ ts: Date.now(), data }), "utf8");
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Falha ao gravar cache SerpAPI");
  }
}

/**
 * Substituto do `fetch()` direto pra URLs do SerpAPI.
 *
 * Lógica:
 *   1. Hash da URL → tenta cache (30d TTL)
 *   2. Cache hit → retorna direto, custo 0
 *   3. Cache miss + cota disponível → chama API, grava no cache
 *   4. Cache miss + cota esgotada → retorna null (agente trata como [])
 *
 * Retorna `null` em todas as falhas / cotas estouradas.
 */
export async function serpapiCachedFetch(
  url: string,
  signal?: AbortSignal
): Promise<unknown | null> {
  const hash = urlHash(url);

  // 1. Cache hit?
  const cached = await readCache(hash);
  if (cached !== null) {
    log.debug({ hash }, "SerpAPI cache hit");
    return cached;
  }

  // 2. Tem cota?
  const quota = await canConsume();
  if (!quota.ok) {
    log.info(
      { reason: quota.reason, monthly: quota.usage.monthlyCount, daily: quota.usage.dailyCounts[todayStr()] || 0 },
      "SerpAPI cota esgotada — agente retorna []"
    );
    return null;
  }

  // 3. Consome
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      log.warn({ status: res.status }, "SerpAPI request failed");
      return null;
    }
    const data = await res.json();
    await recordConsumption();
    await writeCache(hash, data);
    const newQuota = await readUsage();
    log.info(
      { monthly: newQuota.monthlyCount, monthlyLimit: MONTHLY_LIMIT, daily: newQuota.dailyCounts[todayStr()] || 0, dailyLimit: DAILY_LIMIT },
      "SerpAPI request consumed"
    );
    return data;
  } catch (err) {
    log.warn({ err: (err as Error).message }, "SerpAPI fetch error");
    return null;
  }
}

/**
 * Estado atual da cota — útil pra dashboard / debug.
 */
export async function getSerpapiUsage(): Promise<{
  month: string;
  monthlyCount: number;
  monthlyLimit: number;
  dailyCount: number;
  dailyLimit: number;
  cacheEntries: number;
}> {
  const state = await readUsage();
  let cacheEntries = 0;
  try {
    ensureDirs();
    const files = await fs.readdir(CACHE_DIR);
    cacheEntries = files.filter((f) => f.endsWith(".json")).length;
  } catch { /* ignore */ }
  return {
    month: state.month,
    monthlyCount: state.monthlyCount,
    monthlyLimit: MONTHLY_LIMIT,
    dailyCount: state.dailyCounts[todayStr()] || 0,
    dailyLimit: DAILY_LIMIT,
    cacheEntries,
  };
}
