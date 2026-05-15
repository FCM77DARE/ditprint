/**
 * CLI: Bootstrap histórico retroativo — Print Territorial Intelligence™
 *
 * Verifica todos os territórios ativos e preenche os últimos N meses de
 * cobertura histórica (index_history) que estiverem faltando.
 *
 * Uso:
 *   pnpm tsx scripts/bootstrap-history.ts [--months=24] [--territory=<slug>]
 *
 * Exemplos:
 *   pnpm tsx scripts/bootstrap-history.ts
 *   pnpm tsx scripts/bootstrap-history.ts --months=12
 *   pnpm tsx scripts/bootstrap-history.ts --territory=baia-guanabara
 */

import "dotenv/config";
import { getAllTerritories, getIndexHistory } from "../server/db";
import { runHistoricalCollectionForAll, runHistoricalCollection } from "../server/historicalCollector";
import { logger } from "../server/_core/logger";

const log = logger.child({ module: "bootstrap-history" });

function parseArgs(): { months: number; territory?: string } {
  const args = process.argv.slice(2);
  let months = 24;
  let territory: string | undefined;
  for (const arg of args) {
    const [key, value] = arg.split("=");
    if (key === "--months" && value) months = parseInt(value, 10);
    if (key === "--territory" && value) territory = value;
  }
  return { months, territory };
}

async function main() {
  const { months, territory } = parseArgs();

  log.info({ months, territory }, "Iniciando bootstrap histórico");

  const territories = await getAllTerritories();
  const activeTerritories = territories.filter((t) => t.active);

  if (territory) {
    const target = activeTerritories.find((t) => t.slug === territory);
    if (!target) {
      log.error({ slug: territory }, "Território não encontrado ou inativo");
      process.exit(1);
    }
    activeTerritories.length = 0;
    activeTerritories.push(target);
  }

  // Generate required periods
  const now = new Date();
  const requiredPeriods: string[] = [];
  for (let i = months; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    requiredPeriods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  let hasWork = false;

  for (const t of activeTerritories) {
    const history = await getIndexHistory(t.id, months);
    const existing = new Set(history.map((h) => h.period));
    const missing = requiredPeriods.filter((p) => !existing.has(p));

    if (missing.length > 0) {
      hasWork = true;
      log.info({ territory: t.name, missing: missing.length, existing: existing.size }, "Períodos faltando");
    } else {
      log.info({ territory: t.name }, "Cobertura histórica completa");
    }
  }

  if (!hasWork) {
    log.info("Todos os territórios com cobertura histórica completa. Nada a fazer.");
    process.exit(0);
  }

  log.info("Iniciando coleta retroativa...");

  if (territory) {
    const results = await runHistoricalCollection(territory, months);
    const newPeriods = results.filter((r) => !r.skipped && !r.error).length;
    const errors = results.filter((r) => r.error).length;
    log.info({ territory, newPeriods, errors }, "Coleta concluída");
  } else {
    const allResults = await runHistoricalCollectionForAll(months);
    const summary = Object.entries(allResults).map(([slug, results]) => ({
      slug,
      newPeriods: results.filter((r) => !r.skipped && !r.error).length,
      errors: results.filter((r) => r.error).length,
    }));
    log.info({ summary }, "Coleta histórica concluída para todos os territórios");
  }

  process.exit(0);
}

main().catch((err) => {
  log.fatal({ err }, "Erro fatal no bootstrap histórico");
  process.exit(1);
});
