/**
 * DIT Agent System — Shared Types
 *
 * Defines the contracts for all agents in the 3-layer hierarchy:
 *   Source Agents (32) → Dimension Agents (6) → Orchestrator (1)
 */

import type { Territory } from "../../drizzle/schema";
import type { DimensionId, SourceId } from "../indicators";

// ─── Raw Signal (output of a source agent) ───────────────────────────────────

export interface RawSignal {
  /** Short, human-readable headline */
  title: string;
  /** Longer description or excerpt */
  summary?: string;
  /** Canonical URL for the original source */
  url?: string;
  /** When the event occurred or the article was published */
  publishedAt?: Date;
  /** Machine-readable source identifier (matches signals.source enum where possible) */
  sourceAgentId: SourceId;
  /** Numeric value when the signal carries structured data (e.g. 340 km² of DETER alerts) */
  rawValue?: number;
  /** Unit for rawValue: "%", "km²", "eventos", "R$", etc. */
  unit?: string;
  /** Free-form extra data — kept for drill-down / audit */
  metadata?: Record<string, unknown>;
}

// ─── Classified Signal (output of a dimension agent's classifier) ─────────────

export type ImpactLevel = "high" | "medium" | "low" | "negligible";

export interface ClassifiedSignal extends RawSignal {
  /** Which indicator this signal is evidence for */
  indicatorCode: string;
  /** Normalized impact score 0.0–1.0 (deterministic, no LLM) */
  impactScore: number;
  /** Human-readable impact level derived from impactScore */
  impactLevel: ImpactLevel;
  /** Confidence in classification (0.0–1.0) */
  confidence: number;
  /** True when this signal should trigger a real-time alert */
  triggersAlert: boolean;
}

// ─── Dimension Result ─────────────────────────────────────────────────────────

export interface DimensionResult {
  dimensionId: DimensionId;
  /** Normalized score 0–100 */
  score: number;
  /** Number of source agents that ran successfully */
  sourcesOk: number;
  /** Number of source agents that failed */
  sourcesError: number;
  /** Classified signals collected this run */
  signals: ClassifiedSignal[];
  /** Per-indicator breakdown: indicatorCode → score */
  indicatorScores: Record<string, number>;
  /** ISO timestamp */
  collectedAt: string;
}

// ─── Orchestrator Result ──────────────────────────────────────────────────────

export interface OrchestratorResult {
  territoryId: number;
  territorySlug: string;
  period: string;
  /** Final consolidated STT score 0–100 */
  stt: number;
  /** Per-dimension scores */
  dimensions: Record<DimensionId, DimensionResult>;
  /** Signals that triggered real-time alerts (impactScore ≥ 0.7) */
  alerts: ClassifiedSignal[];
  /** Total signals collected across all dimensions */
  totalSignals: number;
  /** Coverage Score (0–1): fração de fontes que entregaram pelo menos 1 sinal real
   * pro território. Essencial pra interpretar STT: município pequeno com baixa
   * cobertura tende a ter STT artificialmente baixo (vácuo ≠ estabilidade). */
  coverageScore?: number;
  /** Detalhe da cobertura: total de fontes ativadas, fontes com retorno, com erro */
  coverageDetail?: {
    totalSources: number;
    sourcesWithSignals: number;
    sourcesEmpty: number;
    sourcesError: number;
  };
  /** Consolidação histórica de 24 meses — o STT publicado é o cumulativo,
   * NÃO o snapshot do dia. Frontend pode exibir "X sinais nos últimos 24 meses"
   * e "Y sinais novos hoje" pra mostrar que o score é cumulativo, não fotográfico. */
  historicalConsolidation?: {
    stt: number;
    signalsInWindow: number;
    signalsToday: number;
    structuralSignals: number;
    oldestSignalAt: string | null;
    newestSignalAt: string | null;
    windowMonths: number;
    halfLifeMonths: number;
    /** STT calculado a partir do snapshot do dia (não publicado, só pra debug) */
    snapshotSttForComparison: number;
  } | null;
  /** ISO timestamp of when this run completed */
  completedAt: string;
}

// ─── Agent Health ─────────────────────────────────────────────────────────────

export interface AgentHealth {
  id: string;
  lastRunAt: Date | null;
  lastError: string | null;
  successCount: number;
  errorCount: number;
  /** Average latency in ms for the last 10 runs */
  avgLatencyMs: number;
  /** 0.0–1.0, computed as successCount / (successCount + errorCount) */
  successRate: number;
}

// ─── Collection options ───────────────────────────────────────────────────────

export interface CollectOptions {
  /** Specific year/month in "YYYY-MM" format for historical collection */
  period?: string;
  /** Start date filter in "MM/DD/YYYY" format */
  dateStart?: string;
  /** End date filter in "MM/DD/YYYY" format */
  dateEnd?: string;
  /** Previous period scores for cumulative memory calculation */
  previousScores?: { stt: number; d1?: number; d2?: number; d3?: number; d4?: number; d5?: number; d6?: number } | null;
  /** Max number of signals to return (default: unlimited) */
  limit?: number;
  /** Abort signal for timeout control */
  signal?: AbortSignal;
}
