/**
 * Rotas REST (express real numa porta efêmera, modo disco, sem rede externa):
 * /api/dit/lead (B6), /api/dit/history e /monitored (B1) e /api/alerts/stream (B9).
 */
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.JWT_SECRET = "r".repeat(48);
delete process.env.DATABASE_URL;

let dir: string;
let servidor: Server;
let base: string;
let resetar: () => void;
let registrarRascunho: typeof import("./publicacao").registrarRascunho;
let publicar: typeof import("./publicacao").publicar;
let salvarAssinante: typeof import("./portal").salvarAssinante;
let assinarToken: typeof import("./portal").assinarToken;
let PORTAL_COOKIE: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "dit-rotas-"));
  process.env.DATA_DIR = dir;
  const { ditLandingRouter } = await import("./routes/ditLanding");
  const { alertasStreamHandler } = await import("./_core/alertas-stream");
  ({ _resetarColecaoParaTeste: resetar } = await import("./_core/colecao"));
  ({ registrarRascunho, publicar } = await import("./publicacao"));
  ({ salvarAssinante, assinarToken, PORTAL_COOKIE } = await import("./portal"));

  const app = express();
  app.use(express.json());
  app.use("/api/dit", ditLandingRouter);
  app.get("/api/alerts/stream", alertasStreamHandler);
  await new Promise<void>((ok) => {
    servidor = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((ok) => servidor.close(() => ok()));
  rmSync(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

beforeEach(() => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  resetar();
  process.env.DIT_GATE_PUBLICACAO = "true";
  process.env.DIT_PORTAL_AUTH = "true";
});

const post = (caminho: string, corpo: unknown) =>
  fetch(`${base}${caminho}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });

const calculo = (slug: string, stt: number) => ({
  slug,
  territoryId: 0,
  nome: slug,
  estado: "RJ",
  regiao: "Sudeste",
  period: "2026-09",
  stt,
  dims: { d1: 50, d2: 60, d3: 70, d4: 80, d5: 40, d6: 30, d7: null },
  activatedIndex: "D4",
  notaExecutiva: "Nota.",
  leitura: null,
  nSinais: 7,
});

describe("B6: POST /api/dit/lead", () => {
  it("aceita o formulário novo e grava em DATA_DIR/leads.json", async () => {
    const r = await post("/api/dit/lead", {
      nome: "Ana",
      empresa: "Petrolífera",
      email: "ana@empresa.com",
      territorio: "Macaé",
      momento: "operar",
      decisao: "Licenciar em 60 dias",
      observacao: "Quero o Radar",
    });
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo).toMatchObject({ saved: true, isNew: true, captured: true });
    expect(typeof corpo.leadId).toBe("string");

    const { listarLeads } = await import("./leads");
    const leads = await listarLeads();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ email: "ana@empresa.com", momento: "operar", status: "novo", empresa: "Petrolífera" });
  });

  it("o formulário antigo (email e territory) continua funcionando e é idempotente", async () => {
    const a = await post("/api/dit/lead", { email: "a@b.co", territory: "Macaé" });
    const b = await post("/api/dit/lead", { email: "a@b.co", territory: "Macaé" });
    expect((await a.json()).isNew).toBe(true);
    expect((await b.json()).isNew).toBe(false);
  });

  it("valida com zod: e-mail inválido e momento fora da lista dão 400", async () => {
    const r1 = await post("/api/dit/lead", { email: "sem-arroba", territorio: "Macaé" });
    expect(r1.status).toBe(400);
    expect((await r1.json()).error).toBe("Email inválido");
    const r2 = await post("/api/dit/lead", { email: "a@b.co", momento: "comprar" });
    expect(r2.status).toBe(400);
    expect((await r2.json()).campos).toContain("momento");
  });
});

describe("B1: /api/dit/history e /monitored mostram só o publicado", () => {
  it("rascunho não vaza; publicado aparece com o número publicado", async () => {
    await registrarRascunho(calculo("macae-3302403", 82), new Date("2026-09-01T10:00:00Z"));
    let h = await (await fetch(`${base}/api/dit/history/macae-3302403`)).json();
    expect(h.history).toEqual([]);
    let m = await (await fetch(`${base}/api/dit/monitored`)).json();
    expect(m).toEqual({ count: 0, territories: [] });

    await publicar({ slug: "macae-3302403", period: "2026-09" }, { por: "op@print.com.br" }, new Date("2026-09-01T12:00:00Z"));
    await registrarRascunho(calculo("macae-3302403", 99), new Date("2026-09-02T10:00:00Z")); // motor sobe, ninguém publicou

    h = await (await fetch(`${base}/api/dit/history/macae-3302403`)).json();
    expect(h.history.map((x: { stt: number }) => x.stt)).toEqual([82]);
    m = await (await fetch(`${base}/api/dit/monitored`)).json();
    expect(m.count).toBe(1);
    expect(m.territories[0]).toMatchObject({ slug: "macae-3302403", latestStt: 82, totalDays: 1 });
  });
});

describe("B9: /api/alerts/stream", () => {
  it("sem sessão responde 401", async () => {
    const r = await fetch(`${base}/api/alerts/stream`);
    expect(r.status).toBe(401);
  });

  it("token inválido responde 401", async () => {
    const r = await fetch(`${base}/api/alerts/stream`, { headers: { cookie: `${PORTAL_COOKIE}=lixo` } });
    expect(r.status).toBe(401);
  });

  it("assinante com token válido abre o stream (200, text/event-stream)", async () => {
    const a = await salvarAssinante({ email: "ana@empresa.com", territorios: ["macae-3302403"] });
    const { token } = await assinarToken(a);
    const ctrl = new AbortController();
    const r = await fetch(`${base}/api/alerts/stream`, { headers: { cookie: `${PORTAL_COOKIE}=${token}` }, signal: ctrl.signal });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    ctrl.abort();
  });

  it("com DIT_PORTAL_AUTH=false volta a abrir sem sessão (comportamento antigo)", async () => {
    process.env.DIT_PORTAL_AUTH = "false";
    const ctrl = new AbortController();
    const r = await fetch(`${base}/api/alerts/stream`, { signal: ctrl.signal });
    expect(r.status).toBe(200);
    ctrl.abort();
  });
});
