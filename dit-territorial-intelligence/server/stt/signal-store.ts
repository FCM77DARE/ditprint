/**
 * Signal Store em disco (JSON Lines) — fallback ao DB MySQL.
 *
 * CONTEXTO: o ambiente Railway de produção do DIT hoje (jun/2026) NÃO tem
 * DATABASE_URL configurado, então `getDb()` sempre retorna null e os sinais
 * nunca eram persistidos. Sem persistência não há STT cumulativo.
 *
 * Este módulo provê um storage de sinais em arquivo .jsonl (uma linha JSON
 * por sinal) no diretório `data/signals/{slug}.jsonl`. O orchestrator chama
 * este store quando o DB indisponível, e o consolidator lê dele.
 *
 * Características:
 *   • Append-only com dedupe por (sourceAgentId, url || titleHash)
 *   • Janela canônica de 24 meses — trunca arquivo periodicamente
 *   • Atomicidade básica via fs.appendFileSync (escrita serializada por linha)
 *   • Cap por território: 10000 sinais (mais que suficiente em 24mo)
 */

import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { logger } from "../_core/logger";

const log = logger.child({ module: "signal-store" });

// STORE_DIR persistente: em prod Railway usa /data/signals (volume montado).
// Em dev local, usa ./data/signals. Override por env var DATA_DIR.
const STORE_DIR = join(process.env.DATA_DIR || join(process.cwd(), "data"), "signals");
const WINDOW_MS = 24 * 30 * 24 * 60 * 60 * 1000; // 24 meses
const MAX_PER_TERRITORY = 10_000;

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
}

function storePath(slug: string): string {
  ensureDir();
  const safe = slug.replace(/[^a-z0-9-]/gi, "_").toLowerCase();
  return join(STORE_DIR, `${safe}.jsonl`);
}

export interface StoredSignal {
  source: string;
  dimension: "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "GERAL";
  impact: number;
  publishedAt: string; // ISO
  storedAt: string; // ISO — quando entrou no store
  title: string;
  summary?: string;
  url?: string;
  indicatorCode?: string;
  structural?: boolean;
  metadata?: Record<string, unknown>;
}

function dedupeKey(s: Pick<StoredSignal, "source" | "url" | "title">): string {
  const ident = s.url && s.url.length > 0 ? s.url : (s.title ?? "");
  const h = createHash("sha1").update(`${s.source}|${ident}`).digest("hex");
  return h.slice(0, 16);
}

/**
 * Lê todas as linhas existentes no arquivo do território. Retorna [] se não
 * existe. Em paralelo, descarta linhas mais antigas que a janela canônica.
 */
async function readAll(slug: string): Promise<StoredSignal[]> {
  const path = storePath(slug);
  try {
    const content = await fs.readFile(path, "utf8");
    const lines = content.split("\n").filter((l) => l.trim());
    const cutoff = Date.now() - WINDOW_MS;
    const out: StoredSignal[] = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as StoredSignal;
        const t = new Date(obj.publishedAt).getTime();
        if (Number.isFinite(t) && t >= cutoff) out.push(obj);
      } catch {
        // linha corrompida — ignora
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Persiste um lote de sinais no arquivo do território, deduplicando contra
 * o que já existe. Compacta o arquivo se passar de MAX_PER_TERRITORY.
 */
export async function persistSignalsToStore(
  slug: string,
  signalsToAdd: Array<{
    source: string;
    dimension: "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "GERAL";
    impact: number;
    publishedAt?: Date | string | null;
    title: string;
    summary?: string | null;
    url?: string | null;
    indicatorCode?: string;
    structural?: boolean;
    metadata?: Record<string, unknown> | null;
  }>
): Promise<number> {
  if (signalsToAdd.length === 0) return 0;

  const existing = await readAll(slug);
  const seenKeys = new Set(
    existing.map((s) => dedupeKey({ source: s.source, url: s.url, title: s.title }))
  );

  const now = new Date().toISOString();
  const toWrite: StoredSignal[] = [];

  for (const sig of signalsToAdd) {
    const stored: StoredSignal = {
      source: sig.source,
      dimension: sig.dimension,
      impact: Math.max(0, Math.min(1, sig.impact)),
      publishedAt: sig.publishedAt
        ? typeof sig.publishedAt === "string"
          ? sig.publishedAt
          : sig.publishedAt.toISOString()
        : now,
      storedAt: now,
      title: sig.title.slice(0, 500),
      summary: sig.summary?.slice(0, 1000) ?? undefined,
      url: sig.url ?? undefined,
      indicatorCode: sig.indicatorCode,
      structural: sig.structural || undefined,
      metadata: sig.metadata ?? undefined,
    };
    const key = dedupeKey({ source: stored.source, url: stored.url, title: stored.title });
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    toWrite.push(stored);
  }

  if (toWrite.length === 0) {
    log.debug({ slug, dedupedAll: signalsToAdd.length }, "Todos sinais já existiam (dedupe)");
    return 0;
  }

  const path = storePath(slug);
  const lines = toWrite.map((s) => JSON.stringify(s)).join("\n") + "\n";

  try {
    await fs.appendFile(path, lines, "utf8");

    // Compactação: se passou de MAX, reescreve o arquivo só com os MAX mais recentes.
    const total = existing.length + toWrite.length;
    if (total > MAX_PER_TERRITORY) {
      const allSorted = [...existing, ...toWrite].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      const trimmed = allSorted.slice(0, MAX_PER_TERRITORY);
      const compactContent = trimmed.map((s) => JSON.stringify(s)).join("\n") + "\n";
      await fs.writeFile(path, compactContent, "utf8");
      log.info({ slug, compactedTo: MAX_PER_TERRITORY }, "Arquivo de sinais compactado");
    }

    log.info(
      { slug, added: toWrite.length, deduped: signalsToAdd.length - toWrite.length, total: total },
      "Sinais persistidos em disco"
    );
    return toWrite.length;
  } catch (err) {
    log.error({ err, slug }, "Falha ao persistir sinais em disco");
    return 0;
  }
}

/**
 * Lê sinais nos últimos N meses (default 24) do território.
 * Retorna em ordem cronológica reversa (mais recentes primeiro).
 */
export async function readSignalsInWindow(
  slug: string,
  windowMonths: number = 24
): Promise<StoredSignal[]> {
  const all = await readAll(slug);
  const cutoff = Date.now() - windowMonths * 30 * 24 * 60 * 60 * 1000;
  const filtered = all.filter((s) => new Date(s.publishedAt).getTime() >= cutoff);
  filtered.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  return filtered;
}
