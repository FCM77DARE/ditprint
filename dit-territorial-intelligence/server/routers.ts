import { spawn } from "child_process";
import * as path from "path";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, dashboardProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllTerritories,
  getTerritoryBySlug,
  seedTerritories,
  getLatestSttScore,
  getSttHistory,
  getAllSttScores,
  upsertSttScore,
  getSignalsByPeriod,
  getSignalsByTerritory,
  updateSignalCuration,
  getPendingSignalsCount,
  upsertSubscriber,
  getAllSubscribers,
  getSubscribersByTerritory,
  getDb,
  getIndexHistory,
  getCollectionSnapshots,
  seedIndexHistory,
  getPublicTerritoryOverview,
  getPublicSampleSignals,
  getAllTerritoriesComparison,
  getPublicTerritoryDetail,
} from "./db";
import { runCollectionPipeline, analyzeSignalsWithLLM } from "./collector";
import { runStructuredDataPipeline } from "./dataCollector";
import { runDailyCollection, getSchedulerStatus, startScheduler, stopScheduler } from "./scheduler";
import { runHistoricalCollection, runHistoricalCollectionForAll, backfillSignalsForExistingPeriods, backfillSignalsForAll } from "./historicalCollector";
import { notifyOwner } from "./_core/notification";
import {
  loginDashboardAdmin,
  signDashboardToken,
  DASHBOARD_JWT_COOKIE,
} from "./dashboardAuth";
import { parse as parseCookies } from "cookie";
import { invokeLLM } from "./_core/llm";
import { signals, sttScores, territories, alertPreferences, alertLog, subscribers } from "../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { orchestrator } from "./agents/orchestrator";
import { sendDailyDigest } from "./alertEngine";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  territories: router({
    list: publicProcedure.query(async () => {
      await seedTerritories();
      return getAllTerritories();
    }),

    listAll: dashboardProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(territories).orderBy(territories.createdAt);
    }),

    bySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => getTerritoryBySlug(input.slug)),

    /** STT history for a territory by slug — used in the subscriber portal. */
    history: publicProcedure
      .input(z.object({ slug: z.string(), limit: z.number().int().min(1).max(24).optional() }))
      .query(async ({ input }) => {
        const territory = await getTerritoryBySlug(input.slug);
        if (!territory) return [];
        return getSttHistory(territory.id, input.limit ?? 6);
      }),

    toggle: dashboardProcedure
      .input(z.object({ id: z.number(), active: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(territories).set({ active: input.active }).where(eq(territories.id, input.id));
        return { success: true };
      }),

    create: dashboardProcedure
      .input(z.object({
        name: z.string().min(3),
        region: z.string().optional(),
        state: z.string().optional(),
        contextDescription: z.string().min(100,
          "Descreva o território com pelo menos 100 caracteres para que a IA possa aplicar a metodologia DIT."
        ),
        inputMode: z.enum(["manual", "pdf"]).default("manual"),
      }))
      .mutation(async ({ ctx, input }) => {
        const slug = input.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const existing = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1);
        if (existing.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: `Território com slug '${slug}' já existe.` });
        }

        await db.insert(territories).values({
          slug,
          name: input.name,
          region: input.region,
          state: input.state,
          active: false,
          onboardingStatus: "processing",
        });

        const [newTerritory] = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1);

        const { DIT_METHODOLOGY } = await import("./territoryContext");

        const llmPrompt = `
Você é um analista sênior de inteligência territorial da Print Territorial Intelligence.
Sua tarefa é aplicar a metodologia DIT (Diagnóstico de Inteligência Territorial) ao território descrito abaixo.

IMPORTANTE:
- Use APENAS as informações fornecidas na descrição. Não invente dados.
- Se uma informação não estiver na descrição, indique como "Não informado" ou use estimativas conservadoras.
- Aplique rigorosamente a fórmula STT = (ITT×0.25) + (ICS×0.20) + (IVS×0.20) + (IVE×0.20) + (ICI×0.15)
- Os scores devem ser justificados com base no contexto fornecido.

${DIT_METHODOLOGY}

TERRITÓRIO: ${input.name}
REGIÃO: ${input.region ?? "Não informado"}
ESTADO: ${input.state ?? "Não informado"}
FONTE: ${input.inputMode === "pdf" ? "Texto extraído de PDF" : "Descrição manual"}

DESCRIÇÃO DO TERRITÓRIO:
${input.contextDescription}

Gere um contexto territorial estruturado seguindo EXATAMENTE este JSON schema:
{
  "historicalBackground": "string (histórico e contexto estrutural do território)",
  "institutionalActors": "string (atores institucionais relevantes: órgãos, empresas, comunidades)",
  "baselineScores": {
    "stt": number (0-100),
    "itt": number (0-100),
    "ics": number (0-100),
    "ivs": number (0-100),
    "ive": number (0-100),
    "ici": number (0-100)
  },
  "keyRisks": "string (principais riscos estruturais identificados)",
  "signalWeights": "string (quais tipos de notícias/dados impactam quais índices)",
  "searchQueries": ["string", "string", "string", "string", "string", "string", "string", "string"],
  "sttHistory": [
    {
      "period": "YYYY-MM",
      "stt": number,
      "activatedIndex": "string",
      "scenario": "estabilidade" | "pressao" | "escalada",
      "note": "string"
    }
  ],
  "llmRationale": "string (explicação detalhada de como os scores foram calculados com base no contexto)"
}

IMPORTANTE: Retorne APENAS o JSON válido, sem markdown, sem explicações adicionais.
`;

        let contextData: Record<string, unknown> = {};
        let onboardingStatus: "ready" | "error" = "ready";

        try {
          const llmResponse = await invokeLLM({
            messages: [
              { role: "system", content: "Você é um especialista em inteligência territorial. Responda APENAS com JSON válido." },
              { role: "user", content: llmPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "territory_context",
                strict: false,
                schema: {
                  type: "object",
                  properties: {
                    historicalBackground: { type: "string" },
                    institutionalActors: { type: "string" },
                    baselineScores: {
                      type: "object",
                      properties: {
                        stt: { type: "number" }, itt: { type: "number" },
                        ics: { type: "number" }, ivs: { type: "number" },
                        ive: { type: "number" }, ici: { type: "number" },
                      },
                    },
                    keyRisks: { type: "string" },
                    signalWeights: { type: "string" },
                    searchQueries: { type: "array", items: { type: "string" } },
                    sttHistory: { type: "array" },
                    llmRationale: { type: "string" },
                  },
                },
              },
            },
          });

          const content = llmResponse.choices?.[0]?.message?.content;
          if (content) {
            contextData = typeof content === "string" ? JSON.parse(content) : content;
          }
        } catch (llmErr) {
          console.error("[Territory Wizard] Erro no LLM:", llmErr);
          onboardingStatus = "error";
        }

        await db.update(territories)
          .set({ contextData, onboardingStatus, active: onboardingStatus === "ready" })
          .where(eq(territories.id, newTerritory.id));

        const { TERRITORY_CONTEXTS } = await import("./territoryContext");
        if (onboardingStatus === "ready" && contextData) {
          (TERRITORY_CONTEXTS as Record<string, unknown>)[slug] = {
            name: input.name,
            region: input.region ?? "",
            area: "Não informado",
            ...(contextData as object),
          };

          // Disparar o backfill de 24 meses em background
          try {
            const scriptPath = path.join(process.cwd(), "scripts", "backfill-single-territory.ts");
            const child = spawn("npx", ["tsx", scriptPath, slug], {
              detached: true,
              stdio: "ignore",
              cwd: process.cwd()
            });
            child.unref(); // Libera o processo pai para não ficar preso
            console.log(`[Territory Wizard] Disparado backfill em background para ${slug}`);
          } catch (e) {
            console.error(`[Territory Wizard] Erro ao disparar backfill:`, e);
          }
        }

        return {
          success: true,
          territoryId: newTerritory.id,
          slug,
          name: input.name,
          onboardingStatus,
          contextData,
        };
      }),
  }),

  stt: router({
    latest: publicProcedure
      .input(z.object({ territoryId: z.number() }))
      .query(async ({ input }) => getLatestSttScore(input.territoryId)),

    history: publicProcedure
      .input(z.object({ territoryId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => getSttHistory(input.territoryId, input.limit ?? 6)),

    all: dashboardProcedure.query(async () => getAllSttScores()),

    upsert: dashboardProcedure
      .input(z.object({
        territoryId: z.number(),
        period: z.string(),
        stt: z.number().min(0).max(100),
        itt: z.number().optional(),
        ics: z.number().optional(),
        ivs: z.number().optional(),
        ive: z.number().optional(),
        ici: z.number().optional(),
        activatedIndex: z.string().optional(),
        variation: z.number().optional(),
        executiveNote: z.string().optional(),
        scenario: z.enum(["estabilidade", "pressao", "escalada"]).optional(),
        published: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        await upsertSttScore({ ...input, publishedAt: input.published ? new Date() : undefined });
        return { success: true };
      }),
  }),

  signals: router({
    list: dashboardProcedure
      .input(z.object({
        territoryId: z.number(),
        status: z.enum(["pending", "relevant", "ignored", "analyzed"]).optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => getSignalsByTerritory(input.territoryId, input.status, input.limit)),

    pendingCount: dashboardProcedure
      .input(z.object({ territoryId: z.number() }))
      .query(async ({ input }) => getPendingSignalsCount(input.territoryId)),

    curate: dashboardProcedure
      .input(z.object({
        signalId: z.number(),
        status: z.enum(["pending", "relevant", "ignored", "analyzed"]),
        note: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateSignalCuration(input.signalId, input.status, input.note ?? null, 0);
        return { success: true };
      }),

    collect: dashboardProcedure
      .input(z.object({ territorySlug: z.string().optional() }))
      .mutation(async ({ input }) => {
        const results = await runCollectionPipeline(input.territorySlug);
        const total = results.reduce((sum, r) => sum + r.total, 0);
        await notifyOwner({
          title: "Coleta Radar Territorial™ concluída",
          content: `${total} novos sinais coletados: ${results.map((r) => `${r.territory}: ${r.total}`).join(", ")}`,
        });
        return { success: true, results };
      }),

    collectStructuredData: dashboardProcedure
      .input(z.object({ territorySlug: z.string().optional() }))
      .mutation(async ({ input }) => {
        const results = await runStructuredDataPipeline(input.territorySlug);
        const total = results.reduce((sum, r) => sum + r.total, 0);
        await notifyOwner({
          title: "Coleta de dados estruturados concluída",
          content: `${total} registros coletados de IBAMA/IBGE/INPE/ANA/QueiroDiário: ${results.map((r) => `${r.territory}: IBAMA=${r.ibama} IBGE=${r.ibge} INPE=${r.inpe} ANA=${r.ana} QD=${r.queiroDiario}`).join(" | ")}`,
        });
        return { success: true, results };
      }),

    analyze: dashboardProcedure
      .input(z.object({ territorySlug: z.string() }))
      .mutation(async ({ input }) => {
        const result = await analyzeSignalsWithLLM(input.territorySlug);
        return { success: true, ...result };
      }),

    listByPeriod: dashboardProcedure
      .input(z.object({
        territoryId: z.number(),
        period: z.string(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => getSignalsByPeriod(input.territoryId, input.period, input.limit ?? 50)),

    confirmStt: dashboardProcedure
      .input(z.object({
        territorySlug: z.string(),
        stt: z.number().min(0).max(100),
        variation: z.number(),
        activatedIndex: z.string(),
        executiveNote: z.string(),
        scenario: z.enum(["estabilidade", "pressao", "escalada"]),
      }))
      .mutation(async ({ input }) => {
        const territory = await getTerritoryBySlug(input.territorySlug);
        if (!territory) throw new TRPCError({ code: "NOT_FOUND", message: "Território não encontrado." });
        const period = new Date().toISOString().substring(0, 7);
        await upsertSttScore({
          territoryId: territory.id,
          period,
          stt: input.stt,
          variation: input.variation,
          activatedIndex: input.activatedIndex,
          executiveNote: input.executiveNote,
          scenario: input.scenario,
          published: false,
        });
        return { success: true, period };
      }),
  }),

  subscribers: router({
    subscribe: publicProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        company: z.string().optional(),
        jobRole: z.string().optional(),
        sector: z.string().optional(),
        territoryInterest: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await upsertSubscriber({
          name: input.name,
          email: input.email,
          company: input.company ?? null,
          jobRole: input.jobRole ?? null,
          sector: input.sector ?? null,
          territoryInterest: input.territoryInterest ?? null,
          plan: "free_alert",
        });
        await notifyOwner({
          title: "Novo assinante Radar Territorial™",
          content: `${input.name} (${input.company ?? "—"}) cadastrou-se para alertas de ${input.territoryInterest ?? "território não especificado"}.`,
        });
        return { success: true };
      }),

    list: dashboardProcedure.query(async () => getAllSubscribers()),

    byTerritory: dashboardProcedure
      .input(z.object({ territorySlug: z.string() }))
      .query(async ({ input }) => getSubscribersByTerritory(input.territorySlug)),
  }),

  onepager: router({
    generate: dashboardProcedure
      .input(z.object({
        territorySlug: z.string(),
        period: z.string().optional(),
        includeSignalIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const territory = await getTerritoryBySlug(input.territorySlug);
        if (!territory) throw new TRPCError({ code: "NOT_FOUND", message: "Território não encontrado." });

        const period = input.period ?? new Date().toISOString().substring(0, 7);

        const [sttScore] = await db
          .select()
          .from(sttScores)
          .where(and(eq(sttScores.territoryId, territory.id), eq(sttScores.period, period)))
          .limit(1);

        let relevantSignals;
        if (input.includeSignalIds && input.includeSignalIds.length > 0) {
          relevantSignals = await db
            .select()
            .from(signals)
            .where(inArray(signals.id, input.includeSignalIds))
            .limit(20);
        } else {
          relevantSignals = await db
            .select()
            .from(signals)
            .where(and(eq(signals.territoryId, territory.id), eq(signals.curationStatus, "relevant")))
            .orderBy(desc(signals.publishedAt))
            .limit(15);
        }

        const signalsList = relevantSignals
          .map((s) => `- [${s.relatedIndex}] ${s.title}${s.llmAnalysis ? ` → ${s.llmAnalysis}` : ""}`)
          .join("\n");

        const sttInfo = sttScore
          ? `STT atual: ${sttScore.stt} (variação: ${sttScore.variation ?? 0 > 0 ? "+" : ""}${sttScore.variation ?? 0})`
          : "STT: dados não disponíveis para este período";

        const prompt = `Você é um analista sênior de inteligência territorial da Print Territorial Intelligence™.

Gere um relatório executivo ONE-PAGER em formato Markdown para o seguinte território:

TERRITÓRIO: ${territory.name}
PERÍODO: ${period}
${sttInfo}
ÍNDICE MAIS ATIVADO: ${sttScore?.activatedIndex ?? "N/A"}
CENÁRIO: ${sttScore?.scenario ?? "N/A"}

SINAIS COLETADOS E CURADOS (${relevantSignals.length} sinais):
${signalsList || "Nenhum sinal curado disponível."}

NOTA EXECUTIVA EXISTENTE: ${sttScore?.executiveNote ?? "Não disponível"}

INSTRUÇÕES:
Gere um one-pager executivo completo com as seguintes seções em Markdown:

# [Nome do Território] — Radar Territorial™
## Período: [mês/ano]

### Síntese Executiva
[2-3 parágrafos com o panorama geral do território no período]

### Score STT: [valor] — [classificação]
[Breve interpretação do score e sua variação]

### Índice Mais Ativado: [índice]
[Explicação do que está movendo o território]

### Principais Sinais do Período
[Lista dos 5-7 sinais mais relevantes com análise de 1 linha cada]

### Cenário Estrutural: [nome do cenário]
[Descrição do cenário atual e implicações estratégicas]

### Recomendação Estratégica
[1-2 parágrafos com recomendações para tomadores de decisão]

---
*Relatório gerado pela Print Territorial Intelligence™ | ${period} | Confidencial*

Use linguagem executiva, precisa e direta. Evite jargões desnecessários. Foco em implicações estratégicas para infraestrutura, energia e recursos naturais.`;

        const response = await invokeLLM({
          messages: [
            { role: "system" as const, content: "Você é um analista de inteligência territorial. Gere relatórios executivos precisos e estratégicos." },
            { role: "user" as const, content: prompt },
          ],
        });

        const rawContent = response.choices?.[0]?.message?.content;
        if (!rawContent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM não retornou conteúdo." });
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

        return {
          success: true,
          territory: territory.name,
          period,
          stt: sttScore?.stt ?? null,
          content,
          signalCount: relevantSignals.length,
        };
      }),
  }),

  analytics: router({
    indexHistory: dashboardProcedure
      .input(z.object({ territoryId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        await seedIndexHistory(input.territoryId);
        return getIndexHistory(input.territoryId, input.limit ?? 24);
      }),

    collectionSnapshots: dashboardProcedure
      .input(z.object({ territoryId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => getCollectionSnapshots(input.territoryId, input.limit ?? 24)),
  }),

  scheduler: router({
    status: dashboardProcedure.query(async () => getSchedulerStatus()),

    runNow: dashboardProcedure.mutation(async () => {
      const results = await runDailyCollection();
      return { success: true, results };
    }),

    toggle: dashboardProcedure
      .input(z.object({ active: z.boolean() }))
      .mutation(async ({ input }) => {
        if (input.active) {
          startScheduler({ runImmediately: false });
        } else {
          stopScheduler();
        }
        return getSchedulerStatus();
      }),

    dailyCards: dashboardProcedure
      .input(z.object({ territoryId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => getCollectionSnapshots(input.territoryId, input.limit ?? 30)),
  }),

  historical: router({
    collect: dashboardProcedure
      .input(z.object({ territorySlug: z.string(), monthsBack: z.number().min(1).max(24).optional() }))
      .mutation(async ({ input }) => {
        const results = await runHistoricalCollection(input.territorySlug, input.monthsBack ?? 24);
        const newPeriods = results.filter(r => !r.skipped && !r.error).length;
        const skipped = results.filter(r => r.skipped).length;
        const errors = results.filter(r => r.error).length;
        return { success: true, results, newPeriods, skipped, errors };
      }),

    collectAll: dashboardProcedure
      .input(z.object({ monthsBack: z.number().min(1).max(24).optional() }))
      .mutation(async ({ input }) => {
        const allResults = await runHistoricalCollectionForAll(input.monthsBack ?? 24);
        const summary = Object.entries(allResults).map(([slug, results]) => ({
          slug,
          newPeriods: results.filter(r => !r.skipped && !r.error).length,
          skipped: results.filter(r => r.skipped).length,
          errors: results.filter(r => r.error).length,
        }));
        return { success: true, summary };
      }),

    backfillSignals: dashboardProcedure
      .input(z.object({ territorySlug: z.string(), monthsBack: z.number().min(1).max(24).optional() }))
      .mutation(async ({ input }) => {
        const results = await backfillSignalsForExistingPeriods(input.territorySlug, input.monthsBack ?? 24);
        const periodsWithNewSignals = results.filter(r => r.collected > 0).length;
        const totalNewSignals = results.reduce((acc, r) => acc + r.collected, 0);
        return { success: true, results, periodsWithNewSignals, totalNewSignals };
      }),

    backfillSignalsAll: dashboardProcedure
      .input(z.object({ monthsBack: z.number().min(1).max(24).optional() }))
      .mutation(async ({ input }) => {
        const allResults = await backfillSignalsForAll(input.monthsBack ?? 24);
        const summary = Object.entries(allResults).map(([slug, results]) => ({
          slug,
          periodsWithNewSignals: results.filter(r => r.collected > 0).length,
          totalNewSignals: results.reduce((acc, r) => acc + r.collected, 0),
        }));
        return { success: true, summary };
      }),

    status: dashboardProcedure
      .input(z.object({ territoryId: z.number() }))
      .query(async ({ input }) => {
        const history = await getIndexHistory(input.territoryId, 24);
        const existingPeriods = history.map(h => h.period);
        const now = new Date();
        const allPeriods: string[] = [];
        for (let i = 24; i >= 1; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          allPeriods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
        return {
          existingPeriods,
          missingPeriods: allPeriods.filter(p => !existingPeriods.includes(p)),
          coverage: Math.round((existingPeriods.length / 24) * 100),
        };
      }),
  }),

  publicData: router({
    territories: publicProcedure.query(async () => getPublicTerritoryOverview()),

    territoryDetail: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const detail = await getPublicTerritoryDetail(input.slug);
        if (!detail) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Território não encontrado." });
        }
        return detail;
      }),

    sampleSignals: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(6).optional() }))
      .query(async ({ input }) => getPublicSampleSignals(input.limit ?? 4)),

    territoriesComparison: dashboardProcedure.query(async () => getAllTerritoriesComparison()),
  }),

  dashboardAuth: router({
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(6),
      }))
      .mutation(async ({ ctx, input }) => {
        const admin = await loginDashboardAdmin(input.email, input.password);
        if (!admin) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        }
        const token = await signDashboardToken(admin.id, admin.email);
        const isSecure = ctx.req.protocol === "https" ||
          (ctx.req.headers["x-forwarded-proto"] as string)?.includes("https");
        ctx.res.cookie(DASHBOARD_JWT_COOKIE, token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: isSecure ? "none" : "lax",
          maxAge: 60 * 60 * 8 * 1000,
          path: "/",
        });
        return { success: true, name: admin.name, email: admin.email };
      }),

    me: publicProcedure.query(async ({ ctx }) => {
      const rawCookies = parseCookies(ctx.req.headers.cookie ?? "");
      const token = rawCookies[DASHBOARD_JWT_COOKIE];
      if (!token) return null;
      const { verifyDashboardToken } = await import("./dashboardAuth");
      const payload = await verifyDashboardToken(token);
      if (!payload) return null;
      return payload;
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(DASHBOARD_JWT_COOKIE, { path: "/" });
      return { success: true };
    }),
  }),

  // ─── Dashboard (human-in-the-loop STT publish gate) ──────────────────────
  dashboard: router({
    /** Pending (unpublished) STT scores for a territory — used by SttPublishPanel. */
    getPendingScores: dashboardProcedure
      .input(z.object({ territorySlug: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const territory = await getTerritoryBySlug(input.territorySlug);
        if (!territory) return [];
        return db
          .select()
          .from(sttScores)
          .where(and(eq(sttScores.territoryId, territory.id), eq(sttScores.published, false)))
          .orderBy(desc(sttScores.period))
          .limit(10);
      }),

    /** Publish (or re-publish) an STT score, optionally updating the executive note. */
    publishSttScore: dashboardProcedure
      .input(z.object({ scoreId: z.number().int(), executiveNote: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await db
          .update(sttScores)
          .set({
            published: true,
            publishedAt: new Date(),
            ...(input.executiveNote !== undefined ? { executiveNote: input.executiveNote } : {}),
            updatedAt: new Date(),
          })
          .where(eq(sttScores.id, input.scoreId));
        return { success: true };
      }),
  }),

  // ─── Alert Preferences ────────────────────────────────────────────────────
  alertPreferences: router({
    /** List all alert preferences for a subscriber (by email). */
    list: publicProcedure
      .input(z.object({ subscriberEmail: z.string().email() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const sub = await db
          .select({ id: subscribers.id })
          .from(subscribers)
          .where(eq(subscribers.email, input.subscriberEmail))
          .limit(1);
        if (!sub.length) return [];
        return db
          .select()
          .from(alertPreferences)
          .where(eq(alertPreferences.subscriberId, sub[0].id));
      }),

    /** Upsert alert preferences for a subscriber × territory. */
    upsert: publicProcedure
      .input(z.object({
        subscriberEmail: z.string().email(),
        territoryId: z.number().int(),
        channels: z.array(z.enum(["email", "push", "sse"])).min(1),
        minImpactThreshold: z.number().min(0).max(1).default(0.7),
        quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        digestFrequency: z.enum(["realtime", "daily", "weekly"]).default("realtime"),
        active: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const sub = await db
          .select({ id: subscribers.id })
          .from(subscribers)
          .where(eq(subscribers.email, input.subscriberEmail))
          .limit(1);
        if (!sub.length) throw new TRPCError({ code: "NOT_FOUND", message: "Subscriber not found" });
        await db
          .insert(alertPreferences)
          .values({
            subscriberId: sub[0].id,
            territoryId: input.territoryId,
            channels: input.channels,
            minImpactThreshold: input.minImpactThreshold,
            quietHoursStart: input.quietHoursStart ?? null,
            quietHoursEnd: input.quietHoursEnd ?? null,
            digestFrequency: input.digestFrequency,
            active: input.active,
          })
          .onDuplicateKeyUpdate({
            set: {
              channels: input.channels,
              minImpactThreshold: input.minImpactThreshold,
              quietHoursStart: input.quietHoursStart ?? null,
              quietHoursEnd: input.quietHoursEnd ?? null,
              digestFrequency: input.digestFrequency,
              active: input.active,
              updatedAt: new Date(),
            },
          });
        return { success: true };
      }),

    /** Delete (deactivate) preferences for a subscriber × territory. */
    deactivate: publicProcedure
      .input(z.object({ subscriberEmail: z.string().email(), territoryId: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const sub = await db
          .select({ id: subscribers.id })
          .from(subscribers)
          .where(eq(subscribers.email, input.subscriberEmail))
          .limit(1);
        if (!sub.length) throw new TRPCError({ code: "NOT_FOUND", message: "Subscriber not found" });
        await db
          .update(alertPreferences)
          .set({ active: false, updatedAt: new Date() })
          .where(
            and(
              eq(alertPreferences.subscriberId, sub[0].id),
              eq(alertPreferences.territoryId, input.territoryId)
            )
          );
        return { success: true };
      }),
  }),

  // ─── Alert Log ────────────────────────────────────────────────────────────
  alertLog: router({
    /** Recent alert log entries for a territory. */
    recent: publicProcedure
      .input(z.object({ territoryId: z.number().int(), limit: z.number().int().min(1).max(100).default(50) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return db
          .select()
          .from(alertLog)
          .where(eq(alertLog.territoryId, input.territoryId))
          .orderBy(desc(alertLog.sentAt))
          .limit(input.limit);
      }),

    /** Mark an alert log entry as opened (for email open tracking). */
    markOpened: publicProcedure
      .input(z.object({ alertLogId: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db
          .update(alertLog)
          .set({ opened: true })
          .where(eq(alertLog.id, input.alertLogId));
        return { success: true };
      }),
  }),

  // ─── Agent Health ─────────────────────────────────────────────────────────
  agentHealth: router({
    /** Returns health snapshots for all 39 agents. */
    list: dashboardProcedure.query(() => {
      return orchestrator.getAgentHealth();
    }),
  }),

  // ─── Daily Digest ─────────────────────────────────────────────────────────
  digest: router({
    /** Manually trigger daily digest for a territory (admin use). */
    send: dashboardProcedure
      .input(z.object({
        territoryId: z.number().int(),
        territoryName: z.string(),
        territorySlug: z.string(),
        stt: z.number(),
        executiveNote: z.string().default(""),
        period: z.string().regex(/^\d{4}-\d{2}$/),
      }))
      .mutation(async ({ input }) => {
        await sendDailyDigest(
          input.territoryId,
          input.territoryName,
          input.territorySlug,
          input.stt,
          input.executiveNote,
          input.period
        );
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
