/**
 * Environment configuration with fail-fast validation.
 *
 * Critical secrets (JWT_SECRET) and required connections (DATABASE_URL)
 * are validated at import time. The process exits immediately with a
 * clear message if requirements are not met — no silent fallbacks.
 */

import "dotenv/config";

const MIN_JWT_SECRET_LENGTH = 32;

type ValidationResult = { ok: true; value: string } | { ok: false; reason: string };

function requireString(key: string, raw: string | undefined, minLength = 1): ValidationResult {
  if (!raw || raw.trim().length === 0) {
    return { ok: false, reason: `${key} is required but missing or empty.` };
  }
  if (raw.length < minLength) {
    return {
      ok: false,
      reason: `${key} must be at least ${minLength} characters (got ${raw.length}).`,
    };
  }
  return { ok: true, value: raw };
}

function fatal(errors: string[]): never {
  const lines = [
    "",
    "╔═══════════════════════════════════════════════════════════════════╗",
    "║  FATAL: Environment configuration is invalid — cannot start.     ║",
    "╚═══════════════════════════════════════════════════════════════════╝",
    ...errors.map((e) => `  • ${e}`),
    "",
    "  Fix your .env file and restart.",
    "",
  ];
  // Use console.error directly (logger not initialized yet at module load time)
  console.error(lines.join("\n"));
  process.exit(1);
}

function validateEnv() {
  const errors: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  // JWT_SECRET — mandatory in all environments, must be strong.
  const jwt = requireString("JWT_SECRET", process.env.JWT_SECRET, MIN_JWT_SECRET_LENGTH);
  if (!jwt.ok) errors.push(jwt.reason);

  // DATABASE_URL — mandatory in production; optional in dev (in-memory fallback allowed).
  const db = requireString("DATABASE_URL", process.env.DATABASE_URL);
  if (!db.ok && isProduction) errors.push(db.reason);

  if (errors.length > 0) fatal(errors);

  return {
    appId: process.env.VITE_APP_ID ?? "",
    cookieSecret: jwt.ok ? jwt.value : "",
    databaseUrl: db.ok ? db.value : "",
    oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
    ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
    isProduction,
    // Forge (Manus) takes priority; falls back to standard OPENAI_API_KEY
    forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL || "https://api.openai.com",
    forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY || "",
  };
}

export const ENV = validateEnv();
