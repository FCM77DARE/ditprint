import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB helpers
vi.mock("./db", () => ({
  getAllTerritories: vi.fn().mockResolvedValue([
    { id: 1, slug: "baia-guanabara", name: "Baía de Guanabara", region: "Sudeste", state: "RJ" },
    { id: 2, slug: "teles-pires", name: "Bacia do Rio Teles Pires", region: "Centro-Oeste", state: "MT" },
  ]),
  getTerritoryBySlug: vi.fn().mockResolvedValue({
    id: 1, slug: "baia-guanabara", name: "Baía de Guanabara", region: "Sudeste", state: "RJ",
  }),
  seedTerritories: vi.fn().mockResolvedValue(undefined),
  getLatestSttScore: vi.fn().mockResolvedValue({ id: 1, stt: 78, period: "2026-03" }),
  getSttHistory: vi.fn().mockResolvedValue([
    { id: 1, stt: 78, period: "2026-03", variation: 0, published: true },
  ]),
  getAllSttScores: vi.fn().mockResolvedValue([]),
  upsertSttScore: vi.fn().mockResolvedValue(undefined),
  getSignalsByTerritory: vi.fn().mockResolvedValue([]),
  updateSignalCuration: vi.fn().mockResolvedValue(undefined),
  getPendingSignalsCount: vi.fn().mockResolvedValue(0),
  upsertSubscriber: vi.fn().mockResolvedValue(undefined),
  getAllSubscribers: vi.fn().mockResolvedValue([]),
  getSubscribersByTerritory: vi.fn().mockResolvedValue([]),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./collector", () => ({
  runCollectionPipeline: vi.fn().mockResolvedValue([
    { territory: "Baía de Guanabara", total: 5, googleRss: 3, newsapi: 2 },
  ]),
  analyzeSignalsWithLLM: vi.fn().mockResolvedValue({
    analyzed: 5,
    suggestedStt: 80,
    suggestedIndex: "D1",
    summary: "Análise de teste: pressão ambiental crescente na região.",
  }),
}));

// Mock dashboardAuth — verifyDashboardToken retorna payload válido para token "valid-token"
vi.mock("./dashboardAuth", () => ({
  loginDashboardAdmin: vi.fn().mockResolvedValue({ id: 1, email: "admin@print.com", name: "Admin Print" }),
  signDashboardToken: vi.fn().mockResolvedValue("valid-token"),
  verifyDashboardToken: vi.fn().mockImplementation(async (token: string) => {
    if (token === "valid-token") return { id: 1, email: "admin@print.com" };
    return null;
  }),
  DASHBOARD_JWT_COOKIE: "dashboard_jwt",
}));

// ─── Helpers de Contexto ──────────────────────────────────────────────────────

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeAdminCtx(): TrpcContext {
  // Admin com cookie JWT válido
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { cookie: "dashboard_jwt=valid-token" },
    } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function makeUnauthCtx(): TrpcContext {
  // Sem cookie de dashboard
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { cookie: "" },
    } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Territories ─────────────────────────────────────────────────────────────

describe("territories.list", () => {
  it("returns list of territories publicly", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.territories.list();
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("baia-guanabara");
  });

  it("returns territory by slug", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.territories.bySlug({ slug: "baia-guanabara" });
    expect(result?.name).toBe("Baía de Guanabara");
  });
});

// ─── STT ─────────────────────────────────────────────────────────────────────

describe("stt", () => {
  it("returns latest STT score publicly", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.stt.latest({ territoryId: 1 });
    expect(result?.stt).toBe(78);
  });

  it("returns STT history publicly", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.stt.history({ territoryId: 1 });
    expect(result).toHaveLength(1);
  });

  it("blocks unauthenticated access to all STT scores", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.stt.all()).rejects.toThrow("Sessão expirada");
  });

  it("allows dashboard admin to list all STT scores", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.stt.all();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Signals ─────────────────────────────────────────────────────────────────

describe("signals", () => {
  it("blocks unauthenticated access to signals", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(
      caller.signals.list({ territoryId: 1 })
    ).rejects.toThrow("Sessão expirada");
  });

  it("allows dashboard admin to list signals", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.signals.list({ territoryId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("allows admin to trigger collection pipeline", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.signals.collect({ territorySlug: "baia-guanabara" });
    expect(result.success).toBe(true);
    expect(result.results[0].total).toBe(5);
  });

  it("allows admin to trigger LLM analysis", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.signals.analyze({ territorySlug: "baia-guanabara" });
    expect(result.success).toBe(true);
    expect(result.analyzed).toBe(5);
    expect(result.suggestedStt).toBe(80);
  });
});

// ─── Subscribers ─────────────────────────────────────────────────────────────

describe("subscribers", () => {
  it("allows public subscription to free alert", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const result = await caller.subscribers.subscribe({
      name: "João Silva",
      email: "joao@empresa.com",
      company: "Empresa Energia S.A.",
      sector: "Energia",
      territoryInterest: "Baía de Guanabara",
    });
    expect(result.success).toBe(true);
  });

  it("blocks unauthenticated access to subscriber list", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.subscribers.list()).rejects.toThrow("Sessão expirada");
  });

  it("allows dashboard admin to list subscribers", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.subscribers.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Dashboard Auth ───────────────────────────────────────────────────────────

describe("dashboardAuth", () => {
  it("returns null for unauthenticated me query", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    const result = await caller.dashboardAuth.me();
    expect(result).toBeNull();
  });

  it("returns admin info for authenticated me query", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.dashboardAuth.me();
    expect(result?.email).toBe("admin@print.com");
  });

  it("allows logout", async () => {
    const caller = appRouter.createCaller(makeAdminCtx());
    const result = await caller.dashboardAuth.logout();
    expect(result.success).toBe(true);
  });
});
