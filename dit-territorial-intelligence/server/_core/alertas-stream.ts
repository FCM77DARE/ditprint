/**
 * GET /api/alerts/stream?territoryId=1 (SSE).
 *
 * B9: exige sessão de operador (cookie do dashboard) ou de assinante (token do
 * portal) e filtra por território: assinante só recebe os do contrato dele.
 * Sem sessão: 401. DIT_PORTAL_AUTH=false devolve o comportamento antigo.
 */

import type { Request, Response } from "express";
import { registerSseClient } from "../alertEngine";
import { identidadeDaRequisicao } from "../portal";
import { portalAuthAtivo } from "../stt/publicacao-logica";

export async function alertasStreamHandler(req: Request, res: Response): Promise<void> {
  let slugsPermitidos: string[] | undefined;
  if (portalAuthAtivo()) {
    const id = await identidadeDaRequisicao(req);
    if (!id) {
      res.status(401).json({ error: "Sessão necessária para o feed de alertas." });
      return;
    }
    if (id.tipo === "assinante") slugsPermitidos = id.territorios;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering
  res.flushHeaders();

  const territoryId = req.query.territoryId ? parseInt(req.query.territoryId as string) : undefined;
  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Evento "hello" imediato: força `EventSource.onmessage` do cliente a
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

  // Heartbeat 15s: sufficient pra atravessar idle timeout Railway/proxies
  // (Railway dropa em 60s sem tráfego; 15s dá margem 4x).
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { /* connection gone */ }
  }, 15000);

  const unregister = registerSseClient(
    clientId,
    (data) => res.write(data),
    territoryId,
    slugsPermitidos
  );

  req.on("close", () => {
    clearInterval(heartbeat);
    unregister();
  });
}
