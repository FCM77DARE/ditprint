import express from "express";
import type { AddressInfo } from "node:net";
import type { Server, IncomingMessage, ServerResponse } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarEscudo, ehVarredura, escudoMiddleware, ipDe } from "./escudo";

describe("ehVarredura", () => {
  it("pega o que os robôs procuram", () => {
    for (const p of [
      "/.env", "/.env.bak", "/.env.staging", "/.git/config", "/app/.env", "/wp-login.php",
      "/wp-admin/", "/phpmyadmin/index.php", "/backup.sql", "/config.yml", "/%2e%2e/etc/passwd",
      "/.DS_Store", "/vendor/phpunit/x", "/api/dit/../../.env", "/id_rsa.key", "/site.zip", "/%",
    ])
      expect(ehVarredura(p), p).toBe(true);
  });

  it("deixa passar as rotas reais do DIT (SPA, API, estáticos)", () => {
    for (const p of [
      "/", "/diagnostico", "/radar", "/metodologia", "/territorio/macae-3302403", "/entrar",
      "/leitura/macae-3302403", "/diagnostico/relatorio/macae-3302403", "/portal", "/portal/alertas",
      "/mesa", "/mesa/login", "/mesa/analise/macae-3302403", "/sistema", "/marco", "/est", "/sobre",
      "/pesquisa.html", "/land-dit.html", "/pix_qr.png", "/arte/relevo-hero.jpg", "/brand/print-logo.png",
      "/assets/index-Bf_32m1F.js", "/assets/index-BYI_5O98.css", "/assets/vendor-x.js", "/__manus__/debug-collector.js",
      "/.well-known/acme-challenge/x", "/api/dit/health", "/api/dit/ops", "/api/dit/custos",
      "/api/dit/estrutural", "/api/dit/estrutural/sugestoes", "/api/dit/lendo-agora", "/api/dit/history/macae-3302403",
      "/api/dit/monitored", "/api/dit/analyze", "/api/dit/lead", "/api/dit/isca", "/api/dit/learning/stats",
      "/api/alerts/stream", "/api/oauth/callback", "/api/trpc/auth.me", "/api/trpc/portal.config?batch=1",
    ])
      expect(ehVarredura(p), p).toBe(false);
  });

  it("nenhum procedimento tRPC real é tratado como varredura", async () => {
    process.env.JWT_SECRET ||= "t".repeat(48);
    delete process.env.DATABASE_URL;
    const { appRouter } = await import("../routers");
    const nomes = Object.keys((appRouter as any)._def.procedures as Record<string, unknown>);
    expect(nomes.length).toBeGreaterThan(0);
    for (const n of nomes) expect(ehVarredura(`/api/trpc/${n}`), n).toBe(false);
  });
});

function pedido(ip: string) {
  return { headers: { "x-real-ip": ip }, socket: {} } as unknown as IncomingMessage;
}
function resposta() {
  const r = { status: 0, writeHead(s: number) { r.status = s; return r; }, end() { return r; } };
  return r as unknown as ServerResponse & { status: number };
}

describe("escudo", () => {
  it("404 na varredura, bloqueia o IP depois de 5 e solta em 1h", () => {
    let t = 0;
    const e = criarEscudo(() => t);
    for (let i = 0; i < 4; i++) {
      const r = resposta();
      expect(e.barrar(pedido("1.1.1.1"), r, "/.env")).toBe(true);
      expect(r.status).toBe(404);
    }
    expect(e.barrar(pedido("1.1.1.1"), resposta(), "/diagnostico")).toBe(false);
    e.barrar(pedido("1.1.1.1"), resposta(), "/.git/config");
    const bloqueado = resposta();
    expect(e.barrar(pedido("1.1.1.1"), bloqueado, "/diagnostico")).toBe(true);
    expect(bloqueado.status).toBe(403);
    expect(e.barrar(pedido("2.2.2.2"), resposta(), "/diagnostico")).toBe(false);
    t += 61 * 60_000;
    expect(e.barrar(pedido("1.1.1.1"), resposta(), "/diagnostico")).toBe(false);
  });

  it("tentativas fora da janela de 10 min não somam", () => {
    let t = 0;
    const e = criarEscudo(() => t);
    for (let i = 0; i < 4; i++) e.barrar(pedido("5.5.5.5"), resposta(), "/.env");
    t += 11 * 60_000;
    e.barrar(pedido("5.5.5.5"), resposta(), "/.env");
    expect(e.barrar(pedido("5.5.5.5"), resposta(), "/"), "").toBe(false);
  });

  it("usa o IP que a borda anexou, não o que o cliente inventou", () => {
    const req = { headers: { "x-forwarded-for": "9.9.9.9, 3.3.3.3" }, socket: {} } as unknown as IncomingMessage;
    expect(ipDe(req)).toBe("3.3.3.3");
    expect(ipDe(pedido("8.8.8.8"))).toBe("8.8.8.8");
  });
});

describe("escudoMiddleware (express real)", () => {
  let servidor: Server;
  let base: string;
  beforeAll(async () => {
    const app = express();
    app.use(escudoMiddleware(criarEscudo()));
    app.get("/api/dit/health", (_q, r) => void r.json({ ok: true }));
    app.use("*", (_q, r) => void r.status(200).send("landing"));
    await new Promise<void>(ok => { servidor = app.listen(0, "127.0.0.1", () => ok()); });
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>(ok => servidor.close(() => ok())));

  it("rota real 200 com cabeçalhos de segurança, sem CSP", async () => {
    for (const p of ["/", "/api/dit/health"]) {
      const r = await fetch(base + p, { headers: { "x-real-ip": "10.0.0.1" } });
      expect(r.status, p).toBe(200);
      expect(r.headers.get("strict-transport-security")).toContain("max-age=31536000");
      expect(r.headers.get("x-content-type-options")).toBe("nosniff");
      expect(r.headers.get("x-frame-options")).toBe("SAMEORIGIN");
      expect(r.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(r.headers.get("permissions-policy")).toContain("camera=()");
      expect(r.headers.get("content-security-policy")).toBeNull();
    }
  });

  it("varredura 404 seco, e o 5º do mesmo IP vira bloqueio total por 1h", async () => {
    const h = { "x-real-ip": "10.0.0.2" };
    for (const p of ["/.env", "/.env.bak", "/.git/config", "/wp-login.php"]) {
      const r = await fetch(base + p, { headers: h });
      expect(r.status, p).toBe(404);
      expect(await r.text()).not.toContain("landing");
      expect(r.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    }
    expect((await fetch(base + "/.env", { headers: h })).status).toBe(404); // 5ª tentativa
    expect((await fetch(base + "/", { headers: h })).status).toBe(403); // agora bloqueado
    expect((await fetch(base + "/", { headers: { "x-real-ip": "10.0.0.3" } })).status).toBe(200);
  });
});
