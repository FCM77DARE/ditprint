// 02/10: escudo contra varredura (portado do Só 5). Robôs batem em /.env, /.git, /wp-login.php atrás de senha esquecida.
// Antes o servidor devolvia a landing (200) para tudo isso, pelo fallback do SPA.
// Agora: caminho de varredura leva 404 seco, e quem insiste fica bloqueado por uma hora.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

const log = logger.child({ module: "escudo" });

const EXTENSAO_PROIBIDA =
  /\.(php\d?|phtml|aspx?|jsp|cgi|pl|env|bak|backup|old|orig|save|swp|sql|sqlite3?|db|ini|log|ya?ml|toml|conf|config|cfg|pem|key|crt|p12|sh|bash|tar|tgz|gz|zip|rar|7z|war|jar)$/i;
const CAMINHO_PROIBIDO =
  /(^|\/)(wp-admin|wp-login|wp-content|wp-includes|wp-json|xmlrpc|phpmyadmin|pma|cgi-bin|vendor|actuator|server-status|server-info|_ignition|telescope|debug|console|owa|autodiscover|boaform|hnap1|solr|druid|jenkins|\.?aws|\.?ssh|\.?docker)(\/|$)/i;

/**
 * Caminho que nenhum visitante de verdade pede: arquivo oculto, extensão de servidor ou painel de outro sistema.
 * Rotas reais do DIT conferidas contra a lista: nenhuma colide (ver escudo.test.ts).
 * /api/trpc fica de fora da regra de extensão, porque ali o ponto separa roteador e procedimento (ex.: portal.config).
 */
export function ehVarredura(pathname: string): boolean {
  let p = pathname;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  if (p.includes("\0") || p.includes("..")) return true;
  // qualquer pedaço começando com ponto (/.env, /.git/config, /.DS_Store), menos /.well-known (certificado, apps)
  if (p.split("/").some(s => s.startsWith(".") && s !== ".well-known")) return true;
  if (CAMINHO_PROIBIDO.test(p)) return true;
  if (p.startsWith("/api/trpc/")) return false;
  return EXTENSAO_PROIBIDA.test(p);
}

/** IP real do visitante. A borda da Railway põe o IP em X-Real-IP; o último item do X-Forwarded-For é o que ela anexou. */
export function ipDe(req: IncomingMessage): string {
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real) return real.trim();
  const xff = req.headers["x-forwarded-for"];
  const lista = (Array.isArray(xff) ? xff.join(",") : (xff ?? ""))
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return lista.at(-1) ?? req.socket.remoteAddress ?? "?";
}

const LIMITE = 5; // tentativas de varredura antes do bloqueio
const JANELA = 10 * 60_000;
const BLOQUEIO = 60 * 60_000;

export function criarEscudo(agora: () => number = Date.now) {
  const tentativas = new Map<string, { n: number; desde: number }>();
  const bloqueados = new Map<string, number>();

  function limpar(t: number) {
    if (tentativas.size + bloqueados.size < 5000) return;
    tentativas.forEach((v, ip) => { if (t - v.desde > JANELA) tentativas.delete(ip); });
    bloqueados.forEach((ate, ip) => { if (ate <= t) bloqueados.delete(ip); });
  }

  /** true quando o pedido já foi respondido (404 ou 403) e não deve seguir. */
  function barrar(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
    const t = agora();
    const ip = ipDe(req);
    const ate = bloqueados.get(ip);
    if (ate && ate > t) return fechar(res, 403);
    if (ate) bloqueados.delete(ip);
    if (!ehVarredura(pathname)) return false;
    const v = tentativas.get(ip);
    const atual = v && t - v.desde <= JANELA ? { n: v.n + 1, desde: v.desde } : { n: 1, desde: t };
    tentativas.set(ip, atual);
    if (atual.n >= LIMITE) {
      bloqueados.set(ip, t + BLOQUEIO);
      tentativas.delete(ip);
      log.warn({ ip, varreduras: atual.n, ultima: pathname.slice(0, 80) }, "IP bloqueado por 1h");
    }
    limpar(t);
    return fechar(res, 404);
  }

  return { barrar, bloqueados: () => bloqueados.size };
}

function fechar(res: ServerResponse, status: 403 | 404): true {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-robots-tag": "noindex",
  });
  res.end(status === 404 ? "não encontrado" : "bloqueado");
  return true;
}

/** Cabeçalhos de segurança em toda resposta. Sem CSP de propósito: o pixel da Meta e o do TikTok carregam script de fora. */
export function cabecalhosSeguros(res: ServerResponse) {
  res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "SAMEORIGIN");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
}

/** Middleware Express: registrar ANTES do static, do fallback do SPA e de qualquer contagem. */
export function escudoMiddleware(escudo = criarEscudo()) {
  return (req: Request, res: Response, next: NextFunction) => {
    cabecalhosSeguros(res);
    const pathname = (req.originalUrl || req.url).split("?")[0];
    if (escudo.barrar(req, res, pathname)) return;
    next();
  };
}
