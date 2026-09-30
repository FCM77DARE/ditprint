import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { parse as parseCookies } from "cookie";
import type { TrpcContext } from "./context";
import { DASHBOARD_JWT_COOKIE, verifyDashboardToken } from "../dashboardAuth";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Dashboard admin procedure. Verifies the `dit_dashboard_token` cookie and
 * injects the admin payload into ctx. Use this instead of publicProcedure
 * for any endpoint that should only be reachable after a successful
 * `dashboardAuth.login`.
 */
const requireDashboardAdmin = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const cookieHeader = ctx.req.headers.cookie ?? "";
  const rawCookies = parseCookies(cookieHeader);
  const token = rawCookies[DASHBOARD_JWT_COOKIE];
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão expirada." });
  }
  const payload = await verifyDashboardToken(token);
  if (!payload) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Token inválido." });
  }
  return next({
    ctx: {
      ...ctx,
      admin: payload,
    },
  });
});

export const dashboardProcedure = t.procedure.use(requireDashboardAdmin);

// ─── Portal do assinante (B2) ────────────────────────────────────────────────

export type PortalCtx = {
  tipo: "assinante" | "operador" | "aberto";
  email: string | null;
  /** Slugs permitidos, ou "*" (operador, ou portal aberto com DIT_PORTAL_AUTH=false). */
  territorios: string[] | "*";
};

/**
 * Exige sessão de assinante (token do portal) ou de operador. Com
 * DIT_PORTAL_AUTH=false volta ao comportamento antigo: portal aberto, sem
 * restrição de território.
 */
const resolvePortal = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const { portalAuthAtivo } = await import("../stt/publicacao-logica");
  const { identidadeDaRequisicao } = await import("../portal");
  const id = await identidadeDaRequisicao(ctx.req);
  let portal: PortalCtx;
  if (!portalAuthAtivo()) {
    portal = id
      ? { tipo: id.tipo, email: id.email, territorios: "*" }
      : { tipo: "aberto", email: null, territorios: "*" };
  } else {
    if (!id) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre com o link de acesso." });
    }
    portal = {
      tipo: id.tipo,
      email: id.email,
      territorios: id.tipo === "assinante" ? id.territorios : "*",
    };
  }
  return next({ ctx: { ...ctx, portal } });
});

export const portalProcedure = t.procedure.use(resolvePortal);
