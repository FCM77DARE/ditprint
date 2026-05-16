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
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering
    res.flushHeaders();

    const territoryId = req.query.territoryId ? parseInt(req.query.territoryId as string) : undefined;
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Send a heartbeat comment every 25s to keep the connection alive through proxies
    const heartbeat = setInterval(() => { res.write(": heartbeat\n\n"); }, 25000);

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
    // Produção: Railway agora serve TUDO num único domínio — API + site
    // React (metodologia, dashboard, radar) + página de pesquisa rica
    // (/pesquisa.html, antes hospedada à parte no Vercel).
    //
    // Compat: a antiga URL /land-dit.html redireciona pra /pesquisa.html
    // pra não quebrar links externos já compartilhados.
    app.get("/land-dit.html", (_req, res) => res.redirect(301, "/pesquisa.html"));
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    log.warn({ preferredPort, port }, "Porta preferida ocupada, usando alternativa");
  }

  server.listen(port, () => {
    log.info({ port }, `Servidor DIT iniciado em http://localhost:${port}/`);
    startScheduler({ runImmediately: false });
  });
}

startServer().catch((err) => {
  logger.fatal({ err }, "Falha ao iniciar o servidor");
  process.exit(1);
});
