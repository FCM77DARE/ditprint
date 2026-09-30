/**
 * Integração das procedures novas pelo router real, em modo disco (sem MySQL):
 * portão de publicação, mesa, leads, assinantes e portal com token.
 * JWT_SECRET e DATA_DIR são definidos aqui; nada de rede nem de API paga.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const SEGREDO = "t".repeat(48);
process.env.JWT_SECRET = SEGREDO;
delete process.env.DATABASE_URL;

let dir: string;
let appRouter: typeof import("./routers").appRouter;
let signDashboardToken: typeof import("./dashboardAuth").signDashboardToken;
let DASHBOARD_JWT_COOKIE: string;
let resetar: () => void;
let registrarRascunho: typeof import("./publicacao").registrarRascunho;
let assinarToken: typeof import("./portal").assinarToken;
let PORTAL_COOKIE: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "dit-int-"));
  process.env.DATA_DIR = dir;
  ({ appRouter } = await import("./routers"));
  ({ signDashboardToken, DASHBOARD_JWT_COOKIE } = await import("./dashboardAuth"));
  ({ _resetarColecaoParaTeste: resetar } = await import("./_core/colecao"));
  ({ registrarRascunho } = await import("./publicacao"));
  ({ assinarToken, PORTAL_COOKIE } = await import("./portal"));
});

afterAll(() => {
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

type Cookies = Record<string, string>;
const cookiesEnviados: Array<{ nome: string; valor: string }> = [];

function ctx(cookies: Cookies = {}) {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return {
    req: { headers: cookie ? { cookie, host: "dit.teste" } : { host: "dit.teste" }, protocol: "https" },
    res: {
      cookie: (nome: string, valor: string) => cookiesEnviados.push({ nome, valor }),
      clearCookie: () => undefined,
    },
    user: null,
  } as never;
}

async function comoOperador() {
  const token = await signDashboardToken(0, "operador@print.com.br");
  return appRouter.createCaller(ctx({ [DASHBOARD_JWT_COOKIE]: token }));
}

const anonimo = () => appRouter.createCaller(ctx());

const calculo = (slug: string, stt: number, nota = "Primeiro parágrafo.\n\nResto da nota paga.") => ({
  slug,
  territoryId: 0,
  nome: slug,
  estado: "RJ",
  regiao: "Sudeste",
  period: "2026-09",
  stt,
  dims: { d1: 50, d2: 60, d3: 70, d4: 80, d5: 40, d6: 30, d7: null },
  activatedIndex: "D4",
  notaExecutiva: nota,
  leitura: { tensao: stt, confianca: 66, faixa: { min: stt - 4, max: stt + 4 }, dimensoes: [] },
  nSinais: 9,
});

describe("B1 e B7: o público só vê o publicado", () => {
  it("rascunho não aparece; depois de publicar aparece com nota curta, tensão e confiança", async () => {
    await registrarRascunho(calculo("macae-3302403", 82), new Date("2026-09-01T10:00:00Z"));
    const publico = anonimo();
    expect(await publico.publicData.territoriosPublicados()).toEqual([]);
    expect(await publico.stt.latest({ slug: "macae-3302403" })).toBeNull();
    expect(await publico.stt.history({ slug: "macae-3302403" })).toEqual([]);
    expect(await publico.territories.history({ slug: "macae-3302403" })).toEqual([]);
    await expect(publico.publicData.territoryDetail({ slug: "macae-3302403" })).rejects.toThrow(/não encontrado/i);

    const op = await comoOperador();
    const r = await op.dashboard.publishSttScore({ slug: "macae-3302403", period: "2026-09" });
    expect(r.publicacao.publishedBy).toBe("operador@print.com.br");

    const lista = await publico.publicData.territoriosPublicados();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ slug: "macae-3302403", tensao: 82, confianca: 66, delta30: null });

    const latest = await publico.stt.latest({ slug: "macae-3302403" });
    expect(latest?.notaExecutiva).toBe("Primeiro parágrafo.");
    expect(latest?.executiveNote).toBe("Primeiro parágrafo.");
    // A visão pública nunca expõe o e-mail do operador.
    expect(latest?.publishedBy).toBe("Analista PRINT");
    expect(latest?.serie).toHaveLength(1);

    const detalhe = await publico.publicData.territoryDetail({ slug: "macae-3302403" });
    expect(detalhe.stt).toBe(82);
    expect(detalhe.leitura?.confianca).toBe(66);
    expect(detalhe.notaExecutiva).toBe("Primeiro parágrafo.");
  });

  it("com DIT_GATE_PUBLICACAO=false as leituras públicas voltam ao caminho antigo", async () => {
    await registrarRascunho(calculo("macae-3302403", 82));
    process.env.DIT_GATE_PUBLICACAO = "false";
    // sem MySQL o caminho antigo devolve vazio, e não explode
    expect(await anonimo().publicData.territories()).toEqual([]);
  });

  it("stt.upsert não publica mais (published é ignorado)", async () => {
    const op = await comoOperador();
    const r = await op.stt.upsert({ territoryId: 1, period: "2026-09", stt: 80, published: true });
    expect(r.published).toBe(false);
  });
});

describe("B5: a mesa", () => {
  it("exige operador", async () => {
    await expect(anonimo().dashboard.filaPublicacao()).rejects.toThrow();
    await expect(anonimo().dashboard.devolverAoMotor({ slug: "x", period: "2026-09", motivo: "motivo ok" })).rejects.toThrow();
    await expect(anonimo().dashboard.publishSttScore({ slug: "x", period: "2026-09" })).rejects.toThrow();
  });

  it("fila, devolução com motivo e publicação pelo único caminho", async () => {
    await registrarRascunho(calculo("macae-3302403", 82));
    await registrarRascunho(calculo("belford-roxo-3300456", 55));
    const op = await comoOperador();

    let fila = await op.dashboard.filaPublicacao();
    expect(fila).toHaveLength(2);

    await expect(
      op.dashboard.devolverAoMotor({ slug: "belford-roxo-3300456", period: "2026-09", motivo: "x" })
    ).rejects.toThrow(/motivo/i);
    const d = await op.dashboard.devolverAoMotor({ slug: "belford-roxo-3300456", period: "2026-09", motivo: "Fonte sem lastro" });
    expect(d.devolucao.por).toBe("operador@print.com.br");

    fila = await op.dashboard.filaPublicacao();
    expect(fila.map((i) => i.slug)).toEqual(["macae-3302403"]);

    await op.dashboard.publishSttScore({ slug: "macae-3302403", period: "2026-09", executiveNote: "Nota nova." });
    expect(await op.dashboard.filaPublicacao()).toEqual([]);
  });
});

describe("B6: leads na mesa", () => {
  it("lista e muda o status; exige operador", async () => {
    const { registrarLead, leadEntradaSchema } = await import("./leads");
    const { lead } = await registrarLead(leadEntradaSchema.parse({ email: "a@b.co", territorio: "Macaé", momento: "responder" }));
    await expect(anonimo().dashboard.leads.list()).rejects.toThrow();
    const op = await comoOperador();
    expect((await op.dashboard.leads.list()).map((l) => l.id)).toEqual([lead.id]);
    const r = await op.dashboard.leads.updateStatus({ id: lead.id, status: "proposta" });
    expect(r.lead.status).toBe("proposta");
    expect((await op.dashboard.leads.list({ status: "proposta" })).length).toBe(1);
    await expect(op.dashboard.leads.updateStatus({ id: "nao-existe", status: "ganho" })).rejects.toThrow(/não encontrado/i);
  });
});

describe("B4: saúde das fontes na mesa", () => {
  it("lê do que foi persistido e devolve o resumo por motivo", async () => {
    const { registrarRodadaDeFontes } = await import("./stt/saude-fontes");
    await registrarRodadaDeFontes([
      { id: "src-cemaden", nome: "Cemaden", dimensao: "D1", ok: false, erro: "HTTP 500", sinais: 0 },
      { id: "src-ibge-censo", nome: "Censo", dimensao: "D2", ok: true, sinais: 4 },
    ]);
    const op = await comoOperador();
    const r = await op.dashboard.saudeFontes();
    expect(r.resumo.total).toBe(2);
    expect(r.resumo.falhando).toBe(1);
    expect(r.resumo.porDefeito).toBe(1);
    expect(r.fontes[0].id).toBe("src-cemaden");
    await expect(anonimo().dashboard.saudeFontes()).rejects.toThrow();
  });
});

describe("B2: assinantes, link do operador e portal com token", () => {
  it("solicitarAcesso nunca devolve o link e responde igual para qualquer e-mail", async () => {
    const op = await comoOperador();
    await op.dashboard.assinantes.upsert({ email: "ana@empresa.com", territorios: ["macae-3302403"] });
    const r1 = await anonimo().portal.solicitarAcesso({ email: "ana@empresa.com" });
    const r2 = await anonimo().portal.solicitarAcesso({ email: "desconhecido@x.com" });
    expect(r1).toEqual(r2);
    expect(JSON.stringify(r1)).not.toMatch(/token|entrar\?|https?:/i);

    const lista = await op.dashboard.assinantes.list();
    expect(lista.pedidosDeAcesso.map((p) => p.email).sort()).toEqual(["ana@empresa.com", "desconhecido@x.com"]);
    expect(lista.assinantes[0].pediuAcesso).toBe(true);
  });

  it("gerarLink entrega o link ao operador; sessao valida e grava o cookie; portal restringe ao contrato", async () => {
    await registrarRascunho(calculo("macae-3302403", 70));
    await registrarRascunho(calculo("belford-roxo-3300456", 55));
    const op = await comoOperador();
    await op.dashboard.publishSttScore({ slug: "macae-3302403", period: "2026-09" });
    await op.dashboard.publishSttScore({ slug: "belford-roxo-3300456", period: "2026-09" });
    await op.dashboard.assinantes.upsert({ email: "ana@empresa.com", nome: "Ana", territorios: ["macae-3302403"] });

    const { link, emailEnviado } = await op.dashboard.assinantes.gerarLink({ email: "ana@empresa.com" });
    expect(emailEnviado).toBe(false); // sem RESEND_API_KEY
    expect(link).toMatch(/^https:\/\/dit\.teste\/entrar\?token=/);
    const token = decodeURIComponent(link.split("token=")[1]);

    // sem sessão: portal fechado
    await expect(anonimo().portal.hoje()).rejects.toThrow(/link de acesso/i);

    const sessao = await anonimo().portal.sessao({ token });
    expect(sessao?.email).toBe("ana@empresa.com");
    expect(cookiesEnviados.some((c) => c.nome === PORTAL_COOKIE && c.valor === token)).toBe(true);
    expect(await anonimo().portal.sessao({ token: "x".repeat(40) })).toBeNull();

    const ana = appRouter.createCaller(ctx({ [PORTAL_COOKIE]: token }));
    const hoje = await ana.portal.hoje();
    expect(hoje.map((t) => t.slug)).toEqual(["macae-3302403"]); // só o território dela
    expect(hoje[0].notaExecutiva).toBe("Primeiro parágrafo.\n\nResto da nota paga."); // nota inteira no portal

    const t = await ana.portal.territorio({ slug: "macae-3302403" });
    expect(t.atual.stt).toBe(70);
    await expect(ana.portal.territorio({ slug: "belford-roxo-3300456" })).rejects.toThrow(/contrato/i);
    await expect(ana.portal.historico({ slug: "belford-roxo-3300456" })).rejects.toThrow(/contrato/i);
  });

  it("assinante não entra na mesa, mesmo com token válido", async () => {
    const op = await comoOperador();
    await op.dashboard.assinantes.upsert({ email: "ana@empresa.com", territorios: ["macae-3302403"] });
    const { token } = await assinarToken({ email: "ana@empresa.com", tokenVersion: 1 });
    const ana = appRouter.createCaller(ctx({ [PORTAL_COOKIE]: token, [DASHBOARD_JWT_COOKIE]: token }));
    await expect(ana.dashboard.filaPublicacao()).rejects.toThrow();
    await expect(ana.dashboard.leads.list()).rejects.toThrow();
    await expect(ana.dashboard.assinantes.gerarLink({ email: "ana@empresa.com" })).rejects.toThrow();
  });

  it("alertPreferences e alertLog exigem sessão; com DIT_PORTAL_AUTH=false voltam ao comportamento antigo", async () => {
    await expect(anonimo().alertPreferences.list({ subscriberEmail: "qualquer@x.com" })).rejects.toThrow(/link de acesso/i);
    await expect(anonimo().alertLog.recent({ territoryId: 1 })).rejects.toThrow(/link de acesso/i);

    process.env.DIT_PORTAL_AUTH = "false";
    // sem MySQL, o caminho antigo devolve lista vazia em vez de erro de auth
    expect(await anonimo().alertPreferences.list({ subscriberEmail: "qualquer@x.com" })).toEqual([]);
    expect(await anonimo().alertLog.recent({ territoryId: 1 })).toEqual([]);
    // e o portal fica aberto, como antes
    expect(await anonimo().portal.hoje()).toEqual([]);
  });

  it("assinante ignora o e-mail enviado pelo cliente (usa o da sessão)", async () => {
    const op = await comoOperador();
    await op.dashboard.assinantes.upsert({ email: "ana@empresa.com", territorios: ["macae-3302403"] });
    const { token } = await assinarToken({ email: "ana@empresa.com", tokenVersion: 1 });
    const ana = appRouter.createCaller(ctx({ [PORTAL_COOKIE]: token }));
    // sem MySQL devolve [] sem erro; o importante é que não exige nem usa o e-mail do cliente
    expect(await ana.alertPreferences.list({ subscriberEmail: "outra-pessoa@x.com" })).toEqual([]);
    expect(await ana.alertPreferences.list()).toEqual([]);
  });
});
