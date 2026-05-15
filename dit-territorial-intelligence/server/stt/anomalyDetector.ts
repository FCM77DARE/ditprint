/**
 * Anomaly Detector — Detecção de Anomalias no STT
 *
 * Roda após o cálculo do STT diário e identifica dois padrões:
 *
 *   1. DESVIO ESTATÍSTICO: STT atual > média_30d + 2σ
 *      → sinaliza comportamento fora do padrão histórico
 *
 *   2. ACELERAÇÃO: delta(STT) > 5 pontos em 24h
 *      → sinaliza escalada rápida que pode exigir ação imediata
 *
 * Ambos os flags são persistidos no indexHistory e usados pelo
 * alerta engine para disparar notificações de prioridade máxima.
 */

import { getDb } from "../db";
import { indexHistory } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { AnomalyResult } from "./types";
import { logger } from "../_core/logger";

const log = logger.child({ module: "anomaly-detector" });

// Thresholds — from approved plan governance decisions
const SIGMA_THRESHOLD = 2.0;     // 2σ → anomaly
const ACCELERATION_THRESHOLD = 5; // >5 points in 24h → escalation

/**
 * Run anomaly detection for a territory after a new STT is computed.
 *
 * @param territoryId - DB id of the territory
 * @param currentStt - The freshly computed STT for today
 * @param previousStt - Yesterday's STT (or last known, for delta)
 */
export async function detectAnomalies(
  territoryId: number,
  currentStt: number,
  previousStt: number | null
): Promise<AnomalyResult> {
  const dayDelta = previousStt !== null ? currentStt - previousStt : 0;

  // Fetch last 30 days of STT history
  const history30d = await fetchHistory30d(territoryId);

  if (history30d.length < 3) {
    // Not enough history to compute meaningful statistics
    log.debug({ territoryId, historyLen: history30d.length }, "Insufficient history for anomaly detection");
    return {
      isAnomaly: false,
      isEscalation: Math.abs(dayDelta) > ACCELERATION_THRESHOLD,
      sigmaDeviation: 0,
      dayDelta,
      mean30d: currentStt,
      sigma30d: 0,
    };
  }

  const { mean, sigma } = computeStats(history30d);
  const sigmaDeviation = sigma > 0 ? (currentStt - mean) / sigma : 0;
  const isAnomaly = sigmaDeviation > SIGMA_THRESHOLD;
  const isEscalation = Math.abs(dayDelta) > ACCELERATION_THRESHOLD;

  if (isAnomaly || isEscalation) {
    log.warn(
      {
        territoryId,
        currentStt,
        mean30d: mean.toFixed(1),
        sigma30d: sigma.toFixed(1),
        sigmaDeviation: sigmaDeviation.toFixed(2),
        dayDelta,
        isAnomaly,
        isEscalation,
      },
      isEscalation ? "ESCALAÇÃO RÁPIDA detectada" : "ANOMALIA ESTATÍSTICA detectada"
    );
  }

  return {
    isAnomaly,
    isEscalation,
    sigmaDeviation: parseFloat(sigmaDeviation.toFixed(2)),
    dayDelta: parseFloat(dayDelta.toFixed(1)),
    mean30d: parseFloat(mean.toFixed(1)),
    sigma30d: parseFloat(sigma.toFixed(1)),
  };
}

/**
 * Given a series of STT values, determine whether the trend is accelerating.
 * Returns the annualized acceleration (points per 7-day period).
 */
export function computeTrend(
  history: Array<{ stt: number | null }>
): { direction: "up" | "down" | "stable"; weeklyAcceleration: number } {
  const values = history
    .map((h) => h.stt)
    .filter((v): v is number => v !== null && !isNaN(v));

  if (values.length < 4) return { direction: "stable", weeklyAcceleration: 0 };

  // Simple linear regression over last N points
  const n = Math.min(values.length, 14); // last 14 periods
  const slice = values.slice(-n);
  const xMean = (n - 1) / 2;
  const yMean = slice.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * ((slice[i] ?? 0) - yMean);
    denominator += (i - xMean) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const weeklyAcceleration = parseFloat((slope * 7).toFixed(2));

  const direction = slope > 0.3 ? "up" : slope < -0.3 ? "down" : "stable";
  return { direction, weeklyAcceleration };
}

/**
 * Generate a human-readable anomaly summary for inclusion in the executive note.
 */
export function formatAnomalySummary(anomaly: AnomalyResult): string | null {
  if (!anomaly.isAnomaly && !anomaly.isEscalation) return null;

  const parts: string[] = [];

  if (anomaly.isEscalation) {
    const direction = anomaly.dayDelta > 0 ? "subiu" : "caiu";
    parts.push(
      `⚠️ ESCALAÇÃO: O STT ${direction} ${Math.abs(anomaly.dayDelta).toFixed(1)} pontos em 24h ` +
      `(acima do limiar de ${ACCELERATION_THRESHOLD} pontos).`
    );
  }

  if (anomaly.isAnomaly) {
    parts.push(
      `📊 ANOMALIA: STT atual está ${anomaly.sigmaDeviation.toFixed(1)}σ acima da média de 30 dias ` +
      `(média: ${anomaly.mean30d.toFixed(1)}, σ: ${anomaly.sigma30d.toFixed(1)}).`
    );
  }

  return parts.join(" ");
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchHistory30d(
  territoryId: number
): Promise<Array<{ stt: number | null }>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({ stt: indexHistory.stt })
      .from(indexHistory)
      .where(eq(indexHistory.territoryId, territoryId))
      .orderBy(desc(indexHistory.period))
      .limit(30);

    return rows;
  } catch (err) {
    log.warn({ err, territoryId }, "Failed to fetch history for anomaly detection");
    return [];
  }
}

function computeStats(history: Array<{ stt: number | null }>): {
  mean: number;
  sigma: number;
} {
  const values = history
    .map((h) => h.stt)
    .filter((v): v is number => v !== null && !isNaN(v));

  if (values.length === 0) return { mean: 0, sigma: 0 };

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const sigma = Math.sqrt(variance);

  return { mean, sigma };
}
