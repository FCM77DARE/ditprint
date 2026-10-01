import { spawn } from "child_process";
import * as path from "path";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, dashboardProcedure, portalProcedure, router } from "./_core/trpc";
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
  getLatestIndexHistory,
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
import { registrar } from "./_core/aprendiz";
import { signals, sttScores, territories, alertPreferences, alertLog, subscribers } from "../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { orchestrator } from "./agents/orchestrator";
import { sendDailyDigest } from "./alertEngine";
import { anexarLeitura, anexarLeituraMulti, leituraDoTerritorio, leituraPorId, scoresDeLinha } from "./stt/leitura";
import { gateAtivo, portalAuthAtivo, primeiroParagrafo, ultimaPublicacao } from "./stt/publicacao-logica";
import {
  devolver as devolverRascunho,
  lerPublicacoes,
  montarFilaPublicacao,
  publicadosDoSlug,
  publicadosPorTerritorio,
  publicar as publicarRascunho,
  rascunhosDoSlug,
} from "./publicacao";
import {
  camposPublicados,
  deltaDoUltimoPonto,
  leituraDaPublicacao,
  linhaCompativel,
  publicacoesPorPeriodo,
} from "./visao-publica";
import {
  MOMENTOS,
  STATUS_LEAD,
  atualizarStatusLead,
  listarLeads,
} from "./leads";
import {
  identidadeDaRequisicao,
  PORTAL_COOKIE,
  assinarToken,
  linkDeAcesso,
  listarAssinantes,
  marcarSolicitacaoAtendida,
  obterAssinante,
  podeVerTerritorio,
  registrarAcesso,
  registrarSolicitacao,
  salvarAssinante,
  sessaoDoToken,
  solicitacoesPendentes,
  tokenDaRequisicao,
  TOKEN_DIAS,
} from "./portal";
import { emailHabilitado, enviarEmail } from "./_core/email-gancho";
import { lerSaudeDasFontes } from "./stt/saude-fontes";

/** Leitura do último período do index_history; null se não houver ou se falhar. */
async function leituraDoUltimoIndice(territoryId: number) {
  try {
    const row = await getLatestIndexHistory(territoryId);
    return row ? await leituraPorId(territoryId, scoresDeLinha(row)) : null;
  } catch {
    return null;
  }
}

/** Slug do território pelo id (só em modo MySQL). */
async function slugDoTerritoryId(id: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [t] = await db.select({ slug: territories.slug }).from(territories).where(eq(territories.id, id)).limit(1);
  return t?.slug ?? null;
}

/** Notas publicadas: a área pública e stt.* mostram só o primeiro parágrafo; o portal mostra inteira. */
async function historicoPublicado(slug: string, limite: number, notaCompleta: boolean) {
  const tp = await publicadosDoSlug(slug);
  if (!tp) return [];
  const ultimo = ultimaPublicacao(tp.pubs);
  const leituraUltimo = await leituraDaPublicacao(tp, ultimo);
  return publicacoesPorPeriodo(tp.pubs)
    .slice(0, limite)
    .map((p) =>
      linhaCompativel(
        p,
        p.publishedAt === ultimo?.publishedAt ? leituraUltimo : p.leitura,
        notaCompleta ? p.notaExecutiva : primeiroParagrafo(p.notaExecutiva)
      )
    );
}

/**
 * Quem é o dono das preferências de alerta (B2). Com DIT_PORTAL_AUTH ligado
 * (padrão), o e-mail vem da SESSÃO e o e-mail enviado pelo cliente é ignorado;
 * operador pode informar o e-mail de quem ele atende. Com a flag desligada,
 * volta ao comportamento antigo (e-mail do cliente).
 */
async function donoDasPreferencias(
  req: Parameters<typeof identidadeDaRequisicao>[0],
  informado: string | undefined
): Promise<{ email: string; territorios: string[] | "*" }> {
  if (!portalAuthAtivo()) {
    if (!informado) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o e-mail." });
    return { email: informado, territorios: "*" };
  }
  const id = await identidadeDaRequisicao(req);
  if (!id) throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre com o link de acesso." });
  if (id.tipo === "operador") {
    if (!informado) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o e-mail do assinante." });
    return { email: informado, territorios: "*" };
  }
  return { email: id.email, territorios: id.territorios };
}

async function exigirTerritorioPorId(dono: { territorios: string[] | "*" }, territoryId: number) {
  if (dono.territorios === "*") return;
  const slug = await slugDoTerritoryId(territoryId);
  if (!slug || !podeVerTerritorio({ tipo: "assinante", territorios: dono.territorios }, slug)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Este território não está no seu contrato." });
  }
}

/** Garante que o assinante da sessão pode ver o território; operador e portal aberto veem todos. */
function exigirTerritorio(portal: { tipo: string; territorios: string[] | "*" }, slug: string) {
  if (!podeVerTerritorio(portal as never, slug)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Este território não está no seu contrato." });
  }
}


/**
 * Publicação gravada sem MySQL guarda o slug no lugar do nome ("macae-3302403").
 * O slug canônico termina no código IBGE: o nome legível sai da camada estrutural.
 */
async function nomeLegivel(slug: string, nome: string | null | undefined): Promise<string> {
  const m = /-(\d{7})$/.exec(slug);
  if (nome && nome !== slug && !/-\d{7}$/.test(nome)) return nome;
  if (m) {
    try {
      const { getMunicipalityName } = await import("./structural/store");
      const n = await getMunicipalityName(m[1]);
      if (n && n !== m[1]) return n;
    } catch {
      /* camada estrutural ausente: cai no slug */
    }
  }
  return nome || slug;
}

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
        // Portão (B1): só o publicado. Funciona com MySQL e em modo disco.
        if (gateAtivo()) return historicoPublicado(input.slug, input.limit ?? 6, false);
        const territory = await getTerritoryBySlug(input.slug);
        if (!territory) return [];
        // `leitura` (Tensão/Confiança/faixa) é campo novo; os antigos seguem iguais.
        return anexarLeitura(territory.id, await getSttHistory(territory.id, input.limit ?? 6));
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
            role: "extracao",
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

        // Rede de aprendizado: só registrar (o onboarding gera o baseline do STT).
        registrar("dit_onboarding", onboardingStatus === "ready"
          ? { ok: true, fez: "contexto territorial de território novo" }
          : { ok: false, erro: "LLM do onboarding falhou" });

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
    /**
     * Último STT PUBLICADO. Aceita `territoryId` (antigo) ou `slug` (funciona
     * sem MySQL). Campos novos: notaExecutiva (primeiro parágrafo), delta7,
     * delta30, serie, publicado, publishedAt, publishedBy.
     */
    latest: publicProcedure
      .input(
        z
          .object({ territoryId: z.number().optional(), slug: z.string().optional() })
          .refine((v) => v.territoryId !== undefined || !!v.slug, "Informe territoryId ou slug.")
      )
      .query(async ({ input }) => {
        const slug =
          input.slug ??
          (input.territoryId !== undefined ? await slugDoTerritoryId(input.territoryId) : null);
        if (!gateAtivo() && input.territoryId !== undefined) {
          const row = await getLatestSttScore(input.territoryId);
          if (!row) return null;
          const extra = slug ? camposPublicados(await lerPublicacoes(slug), { notaCompleta: false }) : null;
          return { ...row, leitura: await leituraPorId(row.territoryId, scoresDeLinha(row)), ...(extra ?? {}) };
        }
        if (!slug) return null;
        const tp = await publicadosDoSlug(slug);
        const ultima = tp ? ultimaPublicacao(tp.pubs) : null;
        if (!tp || !ultima) return null;
        return {
          ...linhaCompativel(
            ultima,
            await leituraDaPublicacao(tp, ultima),
            primeiroParagrafo(ultima.notaExecutiva),
            deltaDoUltimoPonto(tp.pubs)
          ),
          ...camposPublicados(tp.pubs, { notaCompleta: false }),
        };
      }),

    history: publicProcedure
      .input(
        z
          .object({ territoryId: z.number().optional(), slug: z.string().optional(), limit: z.number().optional() })
          .refine((v) => v.territoryId !== undefined || !!v.slug, "Informe territoryId ou slug.")
      )
      .query(async ({ input }) => {
        if (!gateAtivo() && input.territoryId !== undefined) {
          return anexarLeitura(input.territoryId, await getSttHistory(input.territoryId, input.limit ?? 6));
        }
        const slug =
          input.slug ??
          (input.territoryId !== undefined ? await slugDoTerritoryId(input.territoryId) : null);
        return slug ? historicoPublicado(slug, input.limit ?? 6, false) : [];
      }),

    all: dashboardProcedure.query(async () => anexarLeituraMulti(await getAllSttScores())),

    upsert: dashboardProcedure
      .input(z.object({
        territoryId: z.number(),
        period: z.string(),
        stt: z.number().min(0).max(100),
        // Dimensões PRINT — a tabela stt_scores já tinha as colunas
        // d1Score..d7Score; só este schema de entrada tinha ficado no modelo
        // antigo, e o painel de publicação não conseguia gravá-las.
        d1Score: z.number().optional(),
        d2Score: z.number().optional(),
        d3Score: z.number().optional(),
        d4Score: z.number().optional(),
        d5Score: z.number().optional(),
        d6Score: z.number().optional(),
        d7Score: z.number().optional(),
        // Índices legados (modelo de 5 eixos) — mantidos só por compatibilidade.
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
        // Um único caminho de publicação (B5): `dashboard.publishSttScore`.
        // O campo `published` segue aceito para não quebrar chamadores antigos,
        // mas aqui é ignorado: upsert só grava rascunho.
        await upsertSttScore({ ...input, published: false, publishedAt: undefined });
        return { success: true, published: false };
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
          role: "relatorio",
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
    territories: publicProcedure.query(async () => {
      if (gateAtivo()) {
        // Portão (B1): só o número publicado por um humano, congelado na publicação.
        const lista = await publicadosPorTerritorio({ incluirSemPublicacao: true });
        return Promise.all(
          lista.map(async (t) => {
            const ultima = ultimaPublicacao(t.pubs);
            return {
              id: t.territoryId,
              slug: t.slug,
              name: t.nome,
              region: t.regiao,
              state: t.estado,
              stt: ultima?.stt ?? null,
              scenario: ultima?.scenario ?? null,
              period: ultima?.period ?? null,
              sttDelta: deltaDoUltimoPonto(t.pubs),
              activatedIndex: ultima?.activatedIndex ?? null,
              leitura: await leituraDaPublicacao(t, ultima),
              ...camposPublicados(t.pubs, { notaCompleta: false }),
            };
          })
        );
      }
      const lista = await getPublicTerritoryOverview();
      return Promise.all(
        lista.map(async (t) => ({ ...t, leitura: await leituraDoUltimoIndice(t.id) }))
      );
    }),

    /**
     * Só territórios com publicação, para a Landing e o /radar: tensão,
     * confiança e variação em 30 dias. Sem publicação, o território não entra.
     */
    territoriosPublicados: publicProcedure.query(async () => {
      const lista = await publicadosPorTerritorio();
      return Promise.all(
        lista.map(async (t) => {
          const ultima = ultimaPublicacao(t.pubs)!;
          const leitura = await leituraDaPublicacao(t, ultima);
          const campos = camposPublicados(t.pubs, { notaCompleta: false });
          return {
            slug: t.slug,
            nome: await nomeLegivel(t.slug, t.nome),
            estado: t.estado,
            regiao: t.regiao,
            tensao: ultima.tensao ?? leitura?.tensao ?? null,
            confianca: ultima.confianca ?? leitura?.confianca ?? null,
            stt: ultima.stt,
            scenario: ultima.scenario,
            period: ultima.period,
            delta30: campos.delta30,
            publishedAt: ultima.publishedAt,
          };
        })
      );
    }),

    territoryDetail: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        if (gateAtivo()) {
          const tp = await publicadosDoSlug(input.slug);
          if (!tp) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Território não encontrado." });
          }
          const ultima = ultimaPublicacao(tp.pubs);
          return {
            id: tp.territoryId,
            slug: tp.slug,
            name: await nomeLegivel(tp.slug, tp.nome),
            region: tp.regiao,
            state: tp.estado,
            stt: ultima?.stt ?? null,
            scenario: ultima?.scenario ?? null,
            period: ultima?.period ?? null,
            d1Score: ultima?.dims.d1 ?? null,
            d2Score: ultima?.dims.d2 ?? null,
            d3Score: ultima?.dims.d3 ?? null,
            d4Score: ultima?.dims.d4 ?? null,
            d5Score: ultima?.dims.d5 ?? null,
            d6Score: ultima?.dims.d6 ?? null,
            d7Score: ultima?.dims.d7 ?? null,
            contextData: tp.contextData,
            leitura: await leituraDaPublicacao(tp, ultima),
            ...camposPublicados(tp.pubs, { notaCompleta: false }),
          };
        }
        const detail = await getPublicTerritoryDetail(input.slug);
        if (!detail) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Território não encontrado." });
        }
        const leitura = await leituraDoTerritorio(
          { id: detail.id, slug: detail.slug, contextData: detail.contextData },
          scoresDeLinha(detail)
        );
        return { ...detail, leitura };
      }),

    sampleSignals: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(6).optional() }))
      .query(async ({ input }) => getPublicSampleSignals(input.limit ?? 4)),

    territoriesComparison: dashboardProcedure.query(async () => {
      const lista = await getAllTerritoriesComparison();
      return Promise.all(
        lista.map(async (t) => ({ ...t, leitura: await leituraDoUltimoIndice(t.id) }))
      );
    }),
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
        if (!db) {
          // Modo disco (sem MySQL): os rascunhos do livro, no formato de linha.
          return (await rascunhosDoSlug(input.territorySlug)).map((r) => ({
            id: r.scoreId ?? 0,
            territoryId: r.territoryId,
            slug: r.slug,
            period: r.period,
            stt: r.stt,
            d1Score: r.dims.d1 ?? null,
            d2Score: r.dims.d2 ?? null,
            d3Score: r.dims.d3 ?? null,
            d4Score: r.dims.d4 ?? null,
            d5Score: r.dims.d5 ?? null,
            d6Score: r.dims.d6 ?? null,
            d7Score: r.dims.d7 ?? null,
            activatedIndex: r.activatedIndex,
            executiveNote: r.notaExecutiva,
            scenario: r.scenario,
            published: false,
            leitura: r.leitura,
          }));
        }
        const territory = await getTerritoryBySlug(input.territorySlug);
        if (!territory) return [];
        const pendentes = await db
          .select()
          .from(sttScores)
          .where(and(eq(sttScores.territoryId, territory.id), eq(sttScores.published, false)))
          .orderBy(desc(sttScores.period))
          .limit(10);
        return anexarLeitura(territory.id, pendentes);
      }),

    /**
     * O ÚNICO caminho de publicação (B5). Referência por `scoreId` (linha de
     * stt_scores, como o painel antigo) ou por `slug` + `period` (rascunho do
     * motor, funciona sem MySQL). Grava publishedBy/publishedAt e congela
     * tensão e confiança. Flag: DIT_GATE_PUBLICACAO.
     */
    publishSttScore: dashboardProcedure
      .input(
        z.object({
          scoreId: z.number().int().optional(),
          slug: z.string().optional(),
          period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
          executiveNote: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const pub = await publicarRascunho(
          { scoreId: input.scoreId, slug: input.slug, period: input.period },
          { notaExecutiva: input.executiveNote, por: ctx.admin.email }
        );
        return {
          success: true,
          publicacao: {
            slug: pub.slug,
            period: pub.period,
            stt: pub.stt,
            tensao: pub.tensao,
            confianca: pub.confianca,
            publishedAt: pub.publishedAt,
            publishedBy: pub.publishedBy,
          },
        };
      }),

    /** Fila única da mesa: todos os territórios com tensão nova ainda não publicada. */
    filaPublicacao: dashboardProcedure
      .input(z.object({ incluirDevolvidos: z.boolean().default(false) }).default({ incluirDevolvidos: false }))
      .query(async ({ input }) => montarFilaPublicacao({ incluirDevolvidos: input.incluirDevolvidos })),

    /** Devolve o rascunho ao motor, com motivo. Sai da fila até o motor calcular de novo. */
    devolverAoMotor: dashboardProcedure
      .input(
        z.object({
          scoreId: z.number().int().optional(),
          slug: z.string().optional(),
          period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
          motivo: z.string().trim().min(5, "Diga o motivo em pelo menos 5 caracteres.").max(500),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const d = await devolverRascunho(
          { scoreId: input.scoreId, slug: input.slug, period: input.period },
          { motivo: input.motivo, por: ctx.admin.email }
        );
        return { success: true, devolucao: d };
      }),

    /** Saúde das fontes persistida. `motivo`: cota_serpapi | defeito | ok. */
    saudeFontes: dashboardProcedure.query(async () => {
      let cotaEsgotada = false;
      try {
        const { getSerpapiUsage } = await import("./agents/serpapi-quota");
        const { canSpend } = await import("./_core/budget");
        const u = await getSerpapiUsage();
        const orc = await canSpend("serpapi");
        cotaEsgotada = u.monthlyCount >= u.monthlyLimit || u.dailyCount >= u.dailyLimit || !orc.ok;
      } catch {
        cotaEsgotada = false;
      }
      const fontes = await lerSaudeDasFontes({ agora: new Date(), cotaSerpapiEsgotada: cotaEsgotada });
      return {
        cotaSerpapiEsgotada: cotaEsgotada,
        resumo: {
          total: fontes.length,
          ok: fontes.filter((f) => f.estado === "ok").length,
          mudas: fontes.filter((f) => f.estado === "muda").length,
          falhando: fontes.filter((f) => f.estado === "falhando").length,
          porCota: fontes.filter((f) => f.motivo === "cota_serpapi").length,
          porDefeito: fontes.filter((f) => f.motivo === "defeito").length,
        },
        fontes,
      };
    }),

    leads: router({
      list: dashboardProcedure
        .input(z.object({ status: z.enum(STATUS_LEAD).optional() }).default({}))
        .query(async ({ input }) => listarLeads({ status: input.status })),

      updateStatus: dashboardProcedure
        .input(
          z.object({
            id: z.string().min(1),
            status: z.enum(STATUS_LEAD),
            notaInterna: z.string().max(2000).optional(),
          })
        )
        .mutation(async ({ input }) => {
          const l = await atualizarStatusLead(input.id, input.status, input.notaInterna);
          if (!l) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado." });
          return { success: true, lead: l };
        }),
    }),

    assinantes: router({
      /** Assinantes com territórios, mais os pedidos de acesso ainda não atendidos. */
      list: dashboardProcedure.query(async () => {
        const [lista, pedidos] = await Promise.all([listarAssinantes(), solicitacoesPendentes()]);
        const pendentes = new Set(pedidos.map((p) => p.email));
        return {
          assinantes: lista.map((a) => ({ ...a, pediuAcesso: pendentes.has(a.email) })),
          pedidosDeAcesso: pedidos,
          emailAtivo: emailHabilitado(),
        };
      }),

      upsert: dashboardProcedure
        .input(
          z.object({
            email: z.string().trim().toLowerCase().email(),
            nome: z.string().trim().max(160).nullable().optional(),
            territorios: z.array(z.string().trim().min(1).max(120)).max(200),
            revogarLinks: z.boolean().default(false),
          })
        )
        .mutation(async ({ input }) => {
          const a = await salvarAssinante(input);
          // Com MySQL, o assinante também entra em `subscribers`, que as
          // preferências de alerta usam (alertPreferences). Melhor esforço.
          try {
            await upsertSubscriber({
              name: a.nome ?? a.email.split("@")[0],
              email: a.email,
              company: null,
              jobRole: null,
              sector: null,
              territoryInterest: a.territorios[0] ?? null,
              plan: "radar",
            });
          } catch {
            /* sem MySQL: só o registro do portal */
          }
          return { success: true, assinante: a };
        }),

      /**
       * Gera o link de acesso e o DEVOLVE AO OPERADOR (sem serviço de e-mail).
       * Se RESEND_API_KEY existir, também envia ao assinante.
       */
      gerarLink: dashboardProcedure
        .input(z.object({ email: z.string().trim().toLowerCase().email(), baseUrl: z.string().url().optional() }))
        .mutation(async ({ ctx, input }) => {
          const a = await obterAssinante(input.email);
          if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Cadastre o assinante antes de gerar o link." });
          if (a.territorios.length === 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "O assinante não tem território. Vincule ao menos um." });
          }
          const { token, expiraEm } = await assinarToken(a);
          const proto = (ctx.req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ?? ctx.req.protocol;
          const host = (ctx.req.headers["x-forwarded-host"] as string | undefined) ?? ctx.req.headers.host;
          const base = input.baseUrl ?? process.env.PUBLIC_BASE_URL ?? `${proto}://${host}`;
          const link = linkDeAcesso(base, token);
          await marcarSolicitacaoAtendida(a.email);
          const envio = await enviarEmail({
            para: a.email,
            assunto: "Seu acesso ao Radar Territorial PRINT",
            texto: `Use este link para entrar no portal (vale ${TOKEN_DIAS} dias):\n\n${link}\n\nPRINT Comunicação`,
          });
          return { success: true, link, expiraEm, emailEnviado: envio.enviado };
        }),
    }),
  }),

  // ─── Portal do assinante (B2) ─────────────────────────────────────────────
  portal: router({
    /**
     * Pede acesso. Resposta IGUAL para e-mail conhecido ou não, e nunca traz o
     * link: o pedido vai para a mesa (`dashboard.assinantes.list`), onde o
     * operador gera o link. Com RESEND_API_KEY o operador pode também enviar.
     */
    solicitarAcesso: publicProcedure
      .input(z.object({ email: z.string().trim().toLowerCase().email().max(320) }))
      .mutation(async ({ input }) => {
        await registrarSolicitacao(input.email);
        return {
          ok: true,
          mensagem: "Se este e-mail tem acesso, a equipe da PRINT envia o link em breve.",
        };
      }),

    /**
     * Valida o token (do link, do cookie ou do cabeçalho x-dit-portal-token),
     * grava o cookie httpOnly quando o token vem no input e devolve a sessão.
     * Sem sessão válida: null.
     */
    sessao: publicProcedure
      .input(z.object({ token: z.string().min(20).max(2000).optional() }).default({}))
      .mutation(async ({ ctx, input }) => {
        const token = input.token ?? tokenDaRequisicao(ctx.req);
        if (!token) return null;
        const sessao = await sessaoDoToken(token);
        if (!sessao) return null;
        if (input.token) {
          const seguro =
            ctx.req.protocol === "https" ||
            ((ctx.req.headers["x-forwarded-proto"] as string | undefined) ?? "").includes("https");
          ctx.res.cookie(PORTAL_COOKIE, input.token, {
            httpOnly: true,
            secure: seguro,
            sameSite: "lax",
            maxAge: TOKEN_DIAS * 24 * 60 * 60 * 1000,
            path: "/",
          });
          await registrarAcesso(sessao.email);
        }
        return sessao;
      }),

    sair: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(PORTAL_COOKIE, { path: "/" });
      return { success: true };
    }),

    /** Território(s) do assinante com o último publicado, delta 7/30 e série. */
    hoje: portalProcedure.query(async ({ ctx }) => {
      const todos = await publicadosPorTerritorio();
      const meus = todos.filter((t) => podeVerTerritorio(ctx.portal, t.slug));
      return Promise.all(
        meus.map(async (t) => {
          const ultima = ultimaPublicacao(t.pubs)!;
          return {
            slug: t.slug,
            nome: await nomeLegivel(t.slug, t.nome),
            estado: t.estado,
            stt: ultima.stt,
            scenario: ultima.scenario,
            period: ultima.period,
            leitura: await leituraDaPublicacao(t, ultima),
            ...camposPublicados(t.pubs, { notaCompleta: true }),
          };
        })
      );
    }),

    /** Leitura completa de um território do assinante, com a nota executiva inteira. */
    territorio: portalProcedure
      .input(z.object({ slug: z.string(), limit: z.number().int().min(1).max(24).default(12) }))
      .query(async ({ ctx, input }) => {
        exigirTerritorio(ctx.portal, input.slug);
        const tp = await publicadosDoSlug(input.slug);
        const ultima = tp ? ultimaPublicacao(tp.pubs) : null;
        if (!tp || !ultima) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Este território ainda não tem leitura publicada." });
        }
        return {
          slug: tp.slug,
          nome: tp.nome,
          estado: tp.estado,
          regiao: tp.regiao,
          atual: linhaCompativel(ultima, await leituraDaPublicacao(tp, ultima), ultima.notaExecutiva),
          historico: await historicoPublicado(input.slug, input.limit, true),
          ...camposPublicados(tp.pubs, { notaCompleta: true }),
        };
      }),

    /**
     * Diagnóstico completo (relatório Marco) de um território: o último /analyze
     * salvo (snapshot) + os sinais verificados com data e link. Operador vê todos;
     * assinante só os territórios do contrato (exigirTerritorio).
     */
    relatorio: portalProcedure
      .input(z.object({ slug: z.string().min(2).max(120) }))
      .query(async ({ ctx, input }) => {
        exigirTerritorio(ctx.portal, input.slug);
        const { getLatestSnapshot, getSttHistory: historicoDoSnapshot } = await import("./stt/dit-snapshot-store");
        const snap = await getLatestSnapshot(input.slug);
        if (!snap || typeof snap.result !== "object" || snap.result === null) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Este território ainda não tem diagnóstico completo gerado." });
        }
        const { montarDados } = await import("./relatorio/montar-dados");
        const { lerSinaisDoTerritorio } = await import("./relatorio/ler-sinais");
        const historico = (await historicoDoSnapshot(input.slug)).map((h) => ({ date: h.date, stt: h.stt }));
        return montarDados({
          analyze: snap.result as Record<string, any>,
          sinais: lerSinaisDoTerritorio(input.slug),
          historico,
          agora: snap.computedAt ? new Date(snap.computedAt) : undefined,
        });
      }),

    /** Histórico publicado de um território do assinante. */
    historico: portalProcedure
      .input(z.object({ slug: z.string(), limit: z.number().int().min(1).max(24).default(12) }))
      .query(async ({ ctx, input }) => {
        exigirTerritorio(ctx.portal, input.slug);
        return historicoPublicado(input.slug, input.limit, true);
      }),
  }),

  // ─── Alert Preferences ────────────────────────────────────────────────────
  alertPreferences: router({
    /** List all alert preferences for a subscriber (by email). */
    list: publicProcedure
      .input(z.object({ subscriberEmail: z.string().email().optional() }).default({}))
      .query(async ({ ctx, input }) => {
        const dono = await donoDasPreferencias(ctx.req, input.subscriberEmail);
        const db = await getDb();
        if (!db) return [];
        const sub = await db
          .select({ id: subscribers.id })
          .from(subscribers)
          .where(eq(subscribers.email, dono.email))
          .limit(1);
        if (!sub.length) return [];
        const prefs = await db
          .select()
          .from(alertPreferences)
          .where(eq(alertPreferences.subscriberId, sub[0].id));
        if (dono.territorios === "*") return prefs;
        const permitidos: typeof prefs = [];
        for (const p of prefs) {
          const slug = await slugDoTerritoryId(p.territoryId);
          if (slug && podeVerTerritorio({ tipo: "assinante", territorios: dono.territorios }, slug)) permitidos.push(p);
        }
        return permitidos;
      }),

    /** Upsert alert preferences for a subscriber × territory. */
    upsert: publicProcedure
      .input(z.object({
        subscriberEmail: z.string().email().optional(),
        territoryId: z.number().int(),
        channels: z.array(z.enum(["email", "push", "sse"])).min(1),
        minImpactThreshold: z.number().min(0).max(1).default(0.7),
        quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        digestFrequency: z.enum(["realtime", "daily", "weekly"]).default("realtime"),
        active: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const dono = await donoDasPreferencias(ctx.req, input.subscriberEmail);
        await exigirTerritorioPorId(dono, input.territoryId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const sub = await db
          .select({ id: subscribers.id })
          .from(subscribers)
          .where(eq(subscribers.email, dono.email))
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
      .input(z.object({ subscriberEmail: z.string().email().optional(), territoryId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const dono = await donoDasPreferencias(ctx.req, input.subscriberEmail);
        await exigirTerritorioPorId(dono, input.territoryId);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const sub = await db
          .select({ id: subscribers.id })
          .from(subscribers)
          .where(eq(subscribers.email, dono.email))
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
      .query(async ({ ctx, input }) => {
        // B2: com DIT_PORTAL_AUTH ligado exige sessão e só devolve territórios do assinante.
        if (portalAuthAtivo()) {
          const id = await identidadeDaRequisicao(ctx.req);
          if (!id) throw new TRPCError({ code: "UNAUTHORIZED", message: "Entre com o link de acesso." });
          if (id.tipo === "assinante") await exigirTerritorioPorId({ territorios: id.territorios }, input.territoryId);
        }
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
