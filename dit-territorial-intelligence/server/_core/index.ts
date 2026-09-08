import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startScheduler } from "../scheduler";
import { globalApiLimiter, loginLimiter } from "./rateLimit";
import { logger } from "./logger";
import { registerSseClient } from "../alertEngine";
import { ditLandingRouter } from "../routes/ditLanding";

const log = logger.child({ module: "server" });

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Behind a reverse proxy (e.g., Render/Railway/Fly), trust X-Forwarded-For
  // so express-rate-limit sees real client IPs instead of the proxy IP.
  app.set("trust proxy", 1);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ─── DIT Landing — análise pública, sem autenticação ─────────────────────
  // POST /api/dit/analyze — qualquer território, consome LLM diretamente
  app.use("/api/dit", ditLandingRouter);

  // Rate limiting — strict login limiter runs first, then global API limiter.
  app.use("/api/trpc", loginLimiter, globalApiLimiter);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ─── SSE: Real-time alert feed ───────────────────────────────────────────
  // GET /api/alerts/stream?territoryId=1
  // Authenticated clients (dashboard / subscriber portal) receive live AlertPayload events.
  app.get("/api/alerts/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering
    res.flushHeaders();

    const territoryId = req.query.territoryId ? parseInt(req.query.territoryId as string) : undefined;
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Evento "hello" imediato — força `EventSource.onmessage` do cliente a
    // disparar AGORA, confirmando a conexão como "ao vivo" mesmo se o buffer
    // de replay estiver vazio (container reiniciou recentemente).
    res.write(`data: ${JSON.stringify({
      alertType: "signal",
      dimension: "GERAL",
      territoryId: 0,
      territoryName: "DIT Engine",
      territorySlug: "system",
      signalTitle: "Conectado à malha de monitoramento PRINT",
      impactScore: 0,
    })}\n\n`);

    // Heartbeat 15s — sufficient pra atravessar idle timeout Railway/proxies
    // (Railway dropa em 60s sem tráfego; 15s dá margem 4x).
    const heartbeat = setInterval(() => {
      try { res.write(": heartbeat\n\n"); } catch { /* connection gone */ }
    }, 15000);

    const unregister = registerSseClient(
      clientId,
      (data) => res.write(data),
      territoryId
    );

    req.on("close", () => {
      clearInterval(heartbeat);
      unregister();
    });
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    // Produção: home React é a única tela de pesquisa.
    // A página estática /pesquisa.html permanece no repositório como
    // referência histórica do design, mas NÃO é servida — qualquer
    // tentativa de acesso redireciona pra "/" (mesmo pra URLs antigas
    // /land-dit.html já compartilhadas).
    app.get(["/pesquisa.html", "/land-dit.html"], (_req, res) =>
      res.redirect(301, "/")
    );
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    log.warn({ preferredPort, port }, "Porta preferida ocupada, usando alternativa");
  }

  server.listen(port, () => {
    log.info({ port }, `Servidor DIT iniciado em http://localhost:${port}/`);

    // ─── Camada estrutural ────────────────────────────────────────────────
    // Garante que a base oficial dos 5.570 municípios exista antes de a
    // coleta rodar. São 8 requisições ao IBGE para o Brasil inteiro (~8s), e
    // o resultado fica no volume, então isto só custa alguma coisa no
    // primeiro boot depois de um deploy novo ou quando a carga envelhece.
    //
    // Sem ela o STT volta a depender só de sinal, que é o comportamento que
    // fazia 28 de 31 territórios saírem em "escalada".
    void ensureStructuralLayer()
      .then(() => ensureCanonicalSlugs())
      .finally(() => {
      // runImmediately: true em produção → primeira coleta popula o buffer SSE
      // logo após o deploy, evitando "Aguardando próximo sinal…" na tela.
      startScheduler({ runImmediately: process.env.NODE_ENV === "production" });
    });
  });
}

/**
 * Reunifica territórios que ficaram com séries partidas.
 *
 * O slug saía do texto digitado, então o mesmo lugar acumulou histórico sob
 * nomes diferentes — galinhos-rn e galinhos-rio-grande-do-norte, lajeado e
 * lajeado-rs. Como a promessa do momento Operar depende de série diária,
 * histórico partido ao meio é a promessa não se cumprindo.
 *
 * Idempotente: slug já canônico é ignorado, então isto roda em todo boot sem
 * efeito depois da primeira vez.
 */
async function ensureCanonicalSlugs(): Promise<void> {
  try {
    const { migrateCanonicalSlugs } = await import("../stt/slug-migration");
    const report = await migrateCanonicalSlugs({ apply: true });
    if (report.merged > 0 || report.renamed > 0) {
      logger.info(
        {
          fundidos: report.merged,
          renomeados: report.renamed,
          semResolucao: report.unresolved,
        },
        "Slugs canônicos aplicados — séries históricas reunificadas"
      );
    }
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "Migração de slugs falhou — territórios seguem com as chaves atuais"
    );
  }
}

/**
 * Carrega a camada estrutural se ela não existir ou estiver velha.
 *
 * Recarga mensal: os indicadores são anuais ou de divulgação esparsa, então
 * dado de 30 dias ainda é o mesmo dado. Falha aqui não derruba o servidor —
 * o DIT segue com o que tiver e o `/api/dit/ops` mostra a idade da carga.
 */
async function ensureStructuralLayer(): Promise<void> {
  const MAX_AGE_DAYS = Number(process.env.STRUCTURAL_MAX_AGE_DAYS ?? "30");
  try {
    const { getStructuralStatus, loadNationalStructuralData, resetStructuralCache } =
      await import("../structural/store");
    const status = await getStructuralStatus();

    if (status.available && (status.ageDays ?? 0) < MAX_AGE_DAYS) {
      logger.info(
        { municipios: status.municipalityCount, idadeDias: status.ageDays },
        "Camada estrutural em dia"
      );
      return;
    }

    logger.info(
      { disponivel: status.available, idadeDias: status.ageDays, maxAgeDays: MAX_AGE_DAYS },
      "Carregando camada estrutural nacional"
    );
    const store = await loadNationalStructuralData();
    resetStructuralCache();
    logger.info(
      { municipios: store.municipalityCount, indicadores: store.indicatorCount },
      "Camada estrutural pronta"
    );
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "Falha ao preparar camada estrutural — DIT segue com o que houver em disco"
    );
  }
}

startServer().catch((err) => {
  logger.fatal({ err }, "Falha ao iniciar o servidor");
  process.exit(1);
});
