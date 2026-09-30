/**
 * Leitura estrutural gratuita, para qualquer município do país.
 *
 *   GET /api/dit/estrutural?q=<município, "Município, UF", slug ou código IBGE>
 *   GET /api/dit/estrutural/sugestoes?q=<começo do nome>
 *
 * Custo zero por chamada: só lê a camada estrutural já baixada em lote. Sem
 * LLM, sem busca paga, sem coleta. É a primeira metade da isca: a pessoa vê o
 * que o Marco mede antes de qualquer cadastro.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { logger } from "../_core/logger";
import { lerEstrutural, sugerirMunicipios } from "../structural/leitura-estrutural";

const log = logger.child({ module: "estrutural" });

export const estruturalRouter = Router();

// Limite próprio e folgado: o autocomplete chama a cada pausa de digitação.
const JANELA_MS = 60_000;
const MAXIMO = 120;
const chamadas = new Map<string, number[]>();

function limitado(ip: string): boolean {
  const agora = Date.now();
  const recentes = (chamadas.get(ip) ?? []).filter((t) => agora - t < JANELA_MS);
  recentes.push(agora);
  chamadas.set(ip, recentes);
  return recentes.length > MAXIMO;
}

const consulta = z.object({ q: z.string().trim().min(2).max(120) });

function ipDe(req: Request): string {
  return (req.ip ?? req.socket.remoteAddress ?? "unknown").slice(0, 50);
}

estruturalRouter.get("/estrutural/sugestoes", async (req: Request, res: Response) => {
  if (limitado(ipDe(req))) {
    res.status(429).json({ error: "Muitas requisições. Aguarde 1 minuto." });
    return;
  }
  const parsed = consulta.safeParse({ q: req.query.q });
  if (!parsed.success) {
    res.json({ sugestoes: [] });
    return;
  }
  try {
    res.json({ sugestoes: await sugerirMunicipios(parsed.data.q, 8) });
  } catch (err) {
    log.error({ err: (err as Error).message }, "Falha nas sugestões de município");
    res.status(500).json({ error: "Não foi possível buscar municípios." });
  }
});

estruturalRouter.get("/estrutural", async (req: Request, res: Response) => {
  if (limitado(ipDe(req))) {
    res.status(429).json({ error: "Muitas requisições. Aguarde 1 minuto." });
    return;
  }
  const parsed = consulta.safeParse({ q: req.query.q });
  if (!parsed.success) {
    res.status(400).json({
      error: "Informe o município",
      detail: "Use o nome do município (mínimo 2 letras), com o estado se houver homônimo, ou o código IBGE.",
    });
    return;
  }
  try {
    const r = await lerEstrutural(parsed.data.q);
    log.info({ status: r.status }, "Leitura estrutural servida");
    res.status(r.status).json(r.corpo);
  } catch (err) {
    log.error({ err: (err as Error).message }, "Falha na leitura estrutural");
    res.status(500).json({ error: "Não foi possível montar a leitura estrutural." });
  }
});
