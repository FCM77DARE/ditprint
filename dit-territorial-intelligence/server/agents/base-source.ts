/**
 * BaseSourceAgent — Abstract base class for all 32 DIT source agents.
 *
 * Each concrete source agent implements `collect()` to fetch data from one
 * external source (API, RSS feed, scraper) and return an array of RawSignals.
 * The base class handles health tracking, retries, and timeout management.
 */

import type { Territory } from "../../drizzle/schema";
import type { DimensionId, SourceId } from "../indicators";
import type { AgentHealth, CollectOptions, RawSignal } from "./types";
import { logger } from "../_core/logger";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3_000;

export abstract class BaseSourceAgent {
  /** Unique identifier — must match a value in SOURCE_IDS */
  abstract readonly id: SourceId;
  /** Which PRINT dimension this source feeds into */
  abstract readonly dimension: DimensionId;
  /** Human-readable display name */
  abstract readonly name: string;
  /** Time-to-live for cached results in ms (0 = no cache) */
  readonly cacheTtlMs: number = 0;

  private _lastRunAt: Date | null = null;
  private _lastError: string | null = null;
  private _successCount = 0;
  private _errorCount = 0;
  private _latencies: number[] = [];

  protected log = logger.child({ module: "source-agent", agent: this.constructor.name });

  // ─── Abstract interface ─────────────────────────────────────────────────────

  /**
   * Fetch raw signals from this source for the given territory.
   * Implementations should respect `options.signal` for cancellation.
   */
  protected abstract fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]>;

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run this source agent with timeout, retry, and health tracking.
   * Returns an empty array on failure (errors are logged and tracked internally).
   */
  async collect(territory: Territory, options: CollectOptions = {}): Promise<RawSignal[]> {
    const start = Date.now();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      const mergedOptions: CollectOptions = {
        ...options,
        signal: controller.signal,
      };

      try {
        const signals = await this.fetchSignals(territory, mergedOptions);
        clearTimeout(timeoutId);

        const latency = Date.now() - start;
        this._recordSuccess(latency);

        this.log.debug(
          { territory: territory.slug, signals: signals.length, latencyMs: latency },
          "Source agent collected signals"
        );

        return signals;
      } catch (err) {
        clearTimeout(timeoutId);

        const isAbort = err instanceof Error && err.name === "AbortError";
        const isLastAttempt = attempt === MAX_RETRIES;

        if (isLastAttempt || isAbort) {
          const message = err instanceof Error ? err.message : String(err);
          this._recordError(message);
          this.log.warn(
            { err, territory: territory.slug, attempt },
            "Source agent failed after retries"
          );
          return [];
        }

        this.log.debug(
          { err, territory: territory.slug, attempt },
          `Source agent failed, retrying in ${RETRY_DELAY_MS}ms...`
        );
        await sleep(RETRY_DELAY_MS);
      }
    }

    return [];
  }

  /** Current health snapshot */
  get health(): AgentHealth {
    const total = this._successCount + this._errorCount;
    const recentLatencies = this._latencies.slice(-10);
    const avgLatencyMs =
      recentLatencies.length > 0
        ? recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length
        : 0;

    return {
      id: this.id,
      lastRunAt: this._lastRunAt,
      lastError: this._lastError,
      successCount: this._successCount,
      errorCount: this._errorCount,
      avgLatencyMs: Math.round(avgLatencyMs),
      successRate: total > 0 ? this._successCount / total : 1,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _recordSuccess(latencyMs: number) {
    this._lastRunAt = new Date();
    this._lastError = null;
    this._successCount++;
    this._latencies.push(latencyMs);
    if (this._latencies.length > 100) this._latencies.shift();
  }

  private _recordError(message: string) {
    this._lastRunAt = new Date();
    this._lastError = message;
    this._errorCount++;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
