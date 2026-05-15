/**
 * Rate limiting middleware for the DIT API surface.
 *
 * Two tiers:
 *  • globalApiLimiter — broad protection against abusive bursts on any /api route.
 *  • loginLimiter — strict per-IP limit on dashboard login attempts to block
 *    credential-stuffing / brute force attacks.
 *
 * Note: tRPC may batch multiple procedures in a single HTTP request. The URL
 * still contains the procedure name (e.g., `/api/trpc/dashboard.login`), so we
 * gate the login limiter on a substring match.
 */

import type { RequestHandler, Request } from "express";
import rateLimit, { type Options } from "express-rate-limit";

const DEFAULTS: Partial<Options> = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
};

export const globalApiLimiter = rateLimit({
  ...DEFAULTS,
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 600, // 600 requests / 15 min / IP — generous for normal dashboard usage
  message: { error: "Too many requests. Try again shortly." },
});

const strictLoginLimiter = rateLimit({
  ...DEFAULTS,
  windowMs: 15 * 60 * 1000,
  limit: 5, // 5 login attempts per 15 min per IP
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

/**
 * Conditional middleware: apply strict login limit only when the request
 * targets `dashboard.login` (single or batch). For all other requests, passes through.
 */
export const loginLimiter: RequestHandler = (req, res, next) => {
  if (isLoginRequest(req)) {
    return strictLoginLimiter(req, res, next);
  }
  return next();
};

function isLoginRequest(req: Request): boolean {
  // tRPC paths look like /api/trpc/dashboard.login or /api/trpc/dashboard.login,other.proc
  return req.path.includes("dashboard.login");
}
