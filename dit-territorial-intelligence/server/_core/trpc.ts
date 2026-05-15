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
