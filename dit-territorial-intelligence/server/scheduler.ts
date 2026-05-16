/**
 * Scheduler de Coleta Automática — Radar Territorial™
 *
 * Executa coleta de notícias + dados estruturados a cada 24h para todos os territórios ativos.
 * Armazena cada execução como um "card diário" (collection_snapshot) para acesso histórico.
 *
 * Ciclo:
 *   1. Busca todos os territórios ativos
 *   2. Para cada território: coleta notícias RSS + dados estruturados
 *   3. Grava snapshot diário com contagens por fonte
 *   4. Notifica o admin via sistema de notificações
 */

import { getAllTerritories, insertCollectionSnapshot } from "./db";
import { runCollectionPipeline } from "./collector";
import { runStructuredDataPipeline } from "./dataCollector";
import { orchestrator } from "./agents/orchestrator";
import { notifyOwner } from "./_core/notification";
import { logger } from "./_core/logger";

const log = logger.child({ module: "scheduler" });

// Intervalo padrão: 4 horas em ms (6 ciclos/dia → sinais ao vivo no ticker)
const COLLECTION_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Controle de estado
let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let lastRunAt: Date | null = null;
let nextRunAt: Date | null = null;

export interface DailyCollectionResult {
  territorySlug: string;
  territoryName: string;
  newsTotal: number;
  structuredTotal: number;
  snapshotId: number | null;
  runAt: Date;
  error?: string;
}

/**
 * Executa uma rodada completa de coleta para todos os territórios ativos.
 * Retorna um resumo dos resultados por território.
 */
export async function runDailyCollection(): Promise<DailyCollectionResult[]> {
  if (isRunning) {
    log.warn("Coleta já em andamento, ignorando nova execução.");
    return [];
  }

  isRunning = true;
  lastRunAt = new Date();
  const results: DailyCollectionResult[] = [];

  log.info({ startedAt: lastRunAt.toISOString() }, "Iniciando coleta diária");

  try {
    const territories = await getAllTerritories();
    const activeTerritories = territories.filter((t) => t.active);

    for (const territory of activeTerritories) {
      const result: DailyCollectionResult = {
        territorySlug: territory.slug,
        territoryName: territory.name,
        newsTotal: 0,
        structuredTotal: 0,
        snapshotId: null,
        runAt: new Date(),
      };

      try {
        // 1. Agent orchestrator pipeline (6 dimensions × N source agents)
        const orchResult = await orchestrator.run(territory);
        log.info(
          { territory: territory.name, stt: orchResult.stt, alerts: orchResult.alerts.length },
          "Orchestrator pipeline complete"
        );

        // 2. Legacy collection pipelines (RSS + structured data) — kept for compatibility
        //    until all source agents have full implementations.
        const newsResults = await runCollectionPipeline(territory.slug);
        result.newsTotal = newsResults.reduce((sum, r) => sum + r.total, 0);

        // 3. Coleta de dados estruturados
        const structuredResults = await runStructuredDataPipeline(territory.slug);
        result.structuredTotal = structuredResults.reduce((sum, r) => sum + r.total, 0);

        // 3. Grava snapshot diário
        const period = new Date().toISOString().slice(0, 7); // "2026-03"
        const today = new Date().toISOString().slice(0, 10); // "2026-03-01"

        // Mapear resultados estruturados por fonte (runStructuredDataPipeline retorna { territory, ibama, ibge, inpe, ana, queiroDiario, total })
        const structuredByTerritory = structuredResults.find((r) => r.territory === territory.slug);
        const ibamaCount = structuredByTerritory?.ibama ?? 0;
        const ibgeCount = structuredByTerritory?.ibge ?? 0;
        const inpeCount = structuredByTerritory?.inpe ?? 0;
        const anaCount = structuredByTerritory?.ana ?? 0;
        const qdCount = structuredByTerritory?.queiroDiario ?? 0;

        const snapshotId = await insertCollectionSnapshot({
          territoryId: territory.id,
          period,
          collectionType: "full",
          newsCount: result.newsTotal,
          ibamaEmbargoCount: Math.ceil(ibamaCount / 2),
          ibamaAutoCount: Math.floor(ibamaCount / 2),
          ibgeCensoCount: Math.ceil(ibgeCount / 2),
          ibgeRendimentoCount: Math.floor(ibgeCount / 2),
          inpeDeterCount: Math.ceil(inpeCount / 2),
          inpeProdesCount: Math.floor(inpeCount / 2),
          anaHidroCount: Math.ceil(anaCount / 2),
          anaOutorgaCount: Math.floor(anaCount / 2),
          queiroDiarioCount: qdCount,
          totalSignals: result.newsTotal + result.structuredTotal,
          rawData: { ibama: ibamaCount, ibge: ibgeCount, inpe: inpeCount, ana: anaCount, queiroDiario: qdCount, collectedAt: today },
          notes: `Coleta automática diária — ${today}`,
        });

        result.snapshotId = snapshotId;

        log.info({ territory: territory.name, newsTotal: result.newsTotal, structuredTotal: result.structuredTotal, snapshotId }, "Coleta concluída");
      } catch (err) {
        result.error = err instanceof Error ? err.message : String(err);
        log.error({ err, territory: territory.name }, "Erro ao coletar território");
      }

      results.push(result);
    }

    // 4. Notifica o admin
    const totalNews = results.reduce((s, r) => s + r.newsTotal, 0);
    const totalStructured = results.reduce((s, r) => s + r.structuredTotal, 0);
    const errors = results.filter((r) => r.error);

    const summaryLines = results.map(
      (r) =>
        `• ${r.territoryName}: ${r.newsTotal} notícias + ${r.structuredTotal} dados${r.error ? ` ⚠️ ${r.error}` : ""}`
    );

    await notifyOwner({
      title: `📡 Coleta Diária Concluída — ${new Date().toLocaleDateString("pt-BR")}`,
      content: [
        `**Total:** ${totalNews} notícias + ${totalStructured} dados estruturados coletados`,
        `**Territórios:** ${activeTerritories.length} ativos`,
        "",
        ...summaryLines,
        "",
        errors.length > 0
          ? `⚠️ ${errors.length} erro(s) durante a coleta.`
          : "✅ Coleta concluída sem erros.",
      ].join("\n"),
    });
  } catch (err) {
    log.error({ err }, "Erro crítico na coleta diária");
  } finally {
    isRunning = false;
  }

  return results;
}

/**
 * Inicia o agendador de coleta automática.
 * Executa imediatamente na primeira vez se `runImmediately` for true.
 */
export function startScheduler(options: { runImmediately?: boolean } = {}) {
  if (schedulerTimer) {
    log.warn("Agendador já está ativo.");
    return;
  }

  const schedule = () => {
    nextRunAt = new Date(Date.now() + COLLECTION_INTERVAL_MS);
    schedulerTimer = setTimeout(async () => {
      await runDailyCollection();
      schedule(); // reagenda para o próximo ciclo
    }, COLLECTION_INTERVAL_MS);
  };

  if (options.runImmediately) {
    log.info("Executando coleta inicial imediata...");
    runDailyCollection().then(() => schedule());
  } else {
    schedule();
  }

  log.info(
    { nextRunAt: new Date(Date.now() + COLLECTION_INTERVAL_MS).toISOString(), intervalHours: 4 },
    "Agendador iniciado — próxima coleta em 4h"
  );
}

/**
 * Para o agendador.
 */
export function stopScheduler() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    nextRunAt = null;
    log.info("Agendador parado.");
  }
}

/**
 * Retorna o status atual do agendador.
 */
export function getSchedulerStatus() {
  return {
    active: schedulerTimer !== null,
    isRunning,
    lastRunAt: lastRunAt?.toISOString() ?? null,
    nextRunAt: nextRunAt?.toISOString() ?? null,
    intervalHours: COLLECTION_INTERVAL_MS / (60 * 60 * 1000),
  };
}
