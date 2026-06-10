/**
 * DIT Snapshot Store — Persiste o DIT completo de cada território por dia.
 *
 * PROPÓSITO:
 *   O sinal-store (signal-store.ts) acumula sinais brutos. Este módulo
 *   salva o DIT COMPUTADO — resultado final com STT, dimensões, análise LLM,
 *   camada estratégica — como snapshot diário imutável por território.
 *
 * ESTRUTURA em disco:
 *   /data/dit-snapshots/
 *     {slug}/
 *       YYYY-MM-DD.json   ← DIT completo do dia
 *       history.jsonl     ← linha por dia: { date, stt, scenario, signalsCount }
 *
 * USOS:
 *   1. Auditabilidade: "qual era o STT de Maceió em 15/03/2026?"
 *   2. Base para monitoramento autônomo do scheduler (4h em 4h)
 *   3. Garante que o cache em memória possa ser reconstruído após restart
 *   4. Histórico de evolução do STT — base para gráfico de tendência
 *   5. Consistência isca/full: isca derivada SEMPRE do snapshot do dia
 *
 * RETENÇÃO: mantém os últimos 90 dias de snapshots. History.jsonl
 * mantém no máximo 730 linhas (2 anos de histórico de score).
 */

import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../_core/logger";

const log = logger.child({ module: "dit-snapshot-store" });

const BASE_DIR = join(process.env.DATA_DIR || join(process.cwd(), "data"), "dit-snapshots");
const SNAPSHOT_RETENTION_DAYS = 90;
const HISTORY_MAX_LINES = 730; // 2 anos

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function snapshotDir(slug: string): string {
  const safe = slug.replace(/[^a-z0-9-]/gi, "_").toLowerCase();
  const dir = join(BASE_DIR, safe);
  ensureDir(dir);
  return dir;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export interface SnapshotHistoryEntry {
  date: string;       // YYYY-MM-DD
  stt: number;
  scenario: string;
  signalsCount: number;
  coverageScore?: number;
  computedAt: string; // ISO timestamp
}

/**
 * Salva o DIT completo como snapshot do dia.
 * Idempotente: salvar duas vezes no mesmo dia sobrescreve.
 */
export async function saveDitSnapshot(
  slug: string,
  territoryName: string,
  result: unknown,
  stt: number,
  scenario: string,
  signalsCount: number,
  coverageScore?: number
): Promise<void> {
  const dir = snapshotDir(slug);
  const date = todayStr();
  const snapshotPath = join(dir, `${date}.json`);
  const historyPath = join(dir, "history.jsonl");

  // 1. Salva snapshot completo do dia
  try {
    const payload = {
      slug,
      territory: territoryName,
      date,
      stt,
      scenario,
      signalsCount,
      coverageScore,
      computedAt: new Date().toISOString(),
      result, // DIT completo: LLM + dimensões + strategic layer
    };
    await fs.writeFile(snapshotPath, JSON.stringify(payload), "utf8");
  } catch (err) {
    log.error({ err: (err as Error).message, slug, date }, "Falha ao salvar snapshot DIT");
    return;
  }

  // 2. Atualiza history.jsonl (uma linha por dia)
  try {
    const entry: SnapshotHistoryEntry = {
      date, stt, scenario, signalsCount, coverageScore, computedAt: new Date().toISOString(),
    };
    const line = JSON.stringify(entry) + "\n";

    let lines: string[] = [];
    if (existsSync(historyPath)) {
      const content = await fs.readFile(historyPath, "utf8");
      lines = content.split("\n").filter((l) => l.trim() && !l.includes(`"date":"${date}"`));
    }
    lines.push(line.trim());
    // Mantém só os HISTORY_MAX_LINES mais recentes
    if (lines.length > HISTORY_MAX_LINES) lines = lines.slice(-HISTORY_MAX_LINES);
    await fs.writeFile(historyPath, lines.join("\n") + "\n", "utf8");
  } catch (err) {
    log.warn({ err: (err as Error).message, slug }, "Falha ao atualizar history.jsonl");
  }

  // 3. Limpa snapshots antigos (> RETENTION_DAYS)
  try {
    const files = await fs.readdir(snapshotDir(slug));
    const cutoff = new Date(Date.now() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    for (const f of files) {
      if (f.endsWith(".json") && f < cutoff) {
        await fs.unlink(join(snapshotDir(slug), f)).catch(() => {});
      }
    }
  } catch { /* não-fatal */ }

  log.info({ slug, date, stt, scenario, signalsCount }, "DIT snapshot salvo");
}

/**
 * Lê o snapshot do dia para um território (null se não existe).
 */
export async function getTodaySnapshot(slug: string): Promise<unknown | null> {
  const dir = snapshotDir(slug);
  const path = join(dir, `${todayStr()}.json`);
  if (!existsSync(path)) return null;
  try {
    const content = await fs.readFile(path, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Lê o histórico de STT de um território (array cronológico).
 * Útil para gráfico de tendência no dashboard.
 */
export async function getSttHistory(slug: string): Promise<SnapshotHistoryEntry[]> {
  const dir = snapshotDir(slug);
  const path = join(dir, "history.jsonl");
  if (!existsSync(path)) return [];
  try {
    const content = await fs.readFile(path, "utf8");
    return content
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try { return JSON.parse(l) as SnapshotHistoryEntry; } catch { return null; }
      })
      .filter((x): x is SnapshotHistoryEntry => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

/**
 * Lista todos os territórios que têm snapshot salvo.
 * Usado pelo scheduler para saber quais territórios monitorar.
 */
export async function listTrackedSlugs(): Promise<string[]> {
  ensureDir(BASE_DIR);
  try {
    const entries = await fs.readdir(BASE_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
