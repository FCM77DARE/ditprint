/**
 * Structured logger for the DIT server.
 *
 * In development: pretty-printed with colours via pino-pretty.
 * In production:  JSON lines to stdout — ready for log aggregators
 *                 (Datadog, Loki, CloudWatch, etc.).
 *
 * Usage:
 *   import { logger } from "./_core/logger";
 *   const log = logger.child({ module: "collector" });
 *   log.info({ territory: slug, stt: 78 }, "STT calculado");
 *   log.error({ err }, "Falha na coleta");
 */

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    // Include Error objects as structured fields, not bare strings.
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
    // Redact sensitive fields before they hit log output.
    redact: {
      paths: ["req.headers.cookie", "req.headers.authorization", "password", "passwordHash"],
      censor: "[REDACTED]",
    },
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      })
    : undefined // JSON to stdout in production
);
