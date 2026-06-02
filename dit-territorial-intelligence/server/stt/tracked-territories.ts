/**
 * Registro persistente em disco de territórios pesquisados.
 *
 * CONTEXTO: o scheduler do DIT só roda autônomo pra territórios marcados
 * como ativos NO BANCO. Como o Railway prod hoje não tem DATABASE_URL, esse
 * caminho fica vazio — nenhum território é coletado entre pesquisas, o STT
 * nunca acumula histórico real.
 *
 * Este módulo mantém uma lista em arquivo (data/tracked-territories.json)
 * com cada território já pesquisado. O scheduler usa essa lista pra rodar
 * o orquestrador a cada 4h em cada um, fazendo o STT EVOLUIR DIARIAMENTE.
 *
 * Quando o DB voltar, esta lista vira backup / cache redundante.
 */

import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../_core/logger";

const log = logger.child({ module: "tracked-territories" });

const DATA_DIR = join(process.cwd(), "data");
const FILE = join(DATA_DIR, "tracked-territories.json");

export interface TrackedTerritory {
  slug: string;
  name: string;
  state?: string;
  region?: string;
  ibgeId?: number;
  firstSearchedAt: string;
  lastSearchedAt: string;
  lastCollectedAt?: string;
  searchCount: number;
  collectCount: number;
  // Snapshot do último STT consolidado (cache leve)
  lastSttSeen?: number;
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

async function readFile(): Promise<TrackedTerritory[]> {
  try {
    ensureDir();
    const content = await fs.readFile(FILE, "utf8");
    const arr = JSON.parse(content) as TrackedTerritory[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeFile(list: TrackedTerritory[]): Promise<void> {
  try {
    ensureDir();
    await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    log.error({ err }, "Falha ao gravar tracked-territories.json");
  }
}

/**
 * Registra ou atualiza um território no rastreamento. Chamado em todo
 * `/api/dit/analyze`. Idempotente — chamadas repetidas só atualizam timestamps.
 */
export async function trackTerritory(input: {
  slug: string;
  name: string;
  state?: string;
  region?: string;
  ibgeId?: number;
  lastSttSeen?: number;
}): Promise<void> {
  if (!input.slug) return;
  const list = await readFile();
  const now = new Date().toISOString();
  const existing = list.find((t) => t.slug === input.slug);

  if (existing) {
    existing.lastSearchedAt = now;
    existing.searchCount = (existing.searchCount ?? 0) + 1;
    if (input.lastSttSeen !== undefined) existing.lastSttSeen = input.lastSttSeen;
    // Sobrescrever metadata caso tenha mudado (raro)
    if (input.name) existing.name = input.name;
    if (input.state) existing.state = input.state;
    if (input.region) existing.region = input.region;
    if (input.ibgeId) existing.ibgeId = input.ibgeId;
  } else {
    list.push({
      slug: input.slug,
      name: input.name,
      state: input.state,
      region: input.region,
      ibgeId: input.ibgeId,
      firstSearchedAt: now,
      lastSearchedAt: now,
      searchCount: 1,
      collectCount: 0,
      lastSttSeen: input.lastSttSeen,
    });
    log.info(
      { slug: input.slug, total: list.length },
      "Novo território rastreado pra coleta autônoma"
    );
  }

  await writeFile(list);
}

/**
 * Marca uma coleta autônoma completada (chamado pelo scheduler).
 */
export async function markCollected(slug: string, stt?: number): Promise<void> {
  const list = await readFile();
  const existing = list.find((t) => t.slug === slug);
  if (!existing) return;
  existing.lastCollectedAt = new Date().toISOString();
  existing.collectCount = (existing.collectCount ?? 0) + 1;
  if (stt !== undefined) existing.lastSttSeen = stt;
  await writeFile(list);
}

/**
 * Lista todos os territórios rastreados. Usado pelo scheduler.
 */
export async function listTrackedTerritories(): Promise<TrackedTerritory[]> {
  return readFile();
}

/**
 * Lista territórios que precisam de coleta (não coletados nas últimas N horas).
 */
export async function getStaleTerritories(staleHours: number = 4): Promise<TrackedTerritory[]> {
  const list = await readFile();
  const cutoff = Date.now() - staleHours * 60 * 60 * 1000;
  return list.filter((t) => {
    if (!t.lastCollectedAt) return true;
    return new Date(t.lastCollectedAt).getTime() < cutoff;
  });
}
