import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetarColecaoParaTeste } from "./_core/colecao";
import {
  PORTAL_COOKIE,
  PORTAL_TOKEN_HEADER,
  assinarToken,
  identidadeDaRequisicao,
  linkDeAcesso,
  marcarSolicitacaoAtendida,
  podeVerTerritorio,
  registrarSolicitacao,
  salvarAssinante,
  sessaoDoToken,
  solicitacoesPendentes,
  tokenDaRequisicao,
  verificarToken,
} from "./portal";

let dir: string;
const SEGREDO = "s".repeat(48);

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dit-portal-"));
  process.env.DATA_DIR = dir;
  process.env.JWT_SECRET = SEGREDO;
  delete process.env.DATABASE_URL;
  _resetarColecaoParaTeste();
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

describe("B2: token de acesso do assinante", () => {
  it("assina (7 dias), verifica e devolve a sessão com os territórios do contrato", async () => {
    const a = await salvarAssinante({ email: "Ana@Empresa.com", nome: "Ana", territorios: ["Macaé-3302403", "macae-3302403", " cabiunas "] });
    expect(a.email).toBe("ana@empresa.com");
    expect(a.territorios).toEqual(["macaé-3302403", "macae-3302403", "cabiunas"]);

    const agora = new Date("2026-09-30T12:00:00Z");
    const { token, expiraEm } = await assinarToken(a, agora);
    expect(new Date(expiraEm).getTime() - agora.getTime()).toBe(7 * 24 * 60 * 60 * 1000);

    const s = await sessaoDoToken(token, new Date("2026-10-05T12:00:00Z"));
    expect(s?.email).toBe("ana@empresa.com");
    expect(s?.territorios).toContain("cabiunas");
  });

  it("expira depois de 7 dias", async () => {
    const a = await salvarAssinante({ email: "a@b.co", territorios: ["x"] });
    const { token } = await assinarToken(a, new Date("2026-09-01T00:00:00Z"));
    expect(await sessaoDoToken(token, new Date("2026-09-09T00:00:01Z"))).toBeNull();
    expect(await sessaoDoToken(token, new Date("2026-09-07T23:59:00Z"))).not.toBeNull();
  });

  it("token adulterado ou assinado com outra chave não vale", async () => {
    const a = await salvarAssinante({ email: "a@b.co", territorios: ["x"] });
    const { token } = await assinarToken(a);
    expect(await verificarToken(token + "x")).toBeNull();
    const falso = await new SignJWT({ type: "assinante", email: "a@b.co", v: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(SEGREDO)); // mesma JWT_SECRET, SEM a derivação do portal
    expect(await verificarToken(falso)).toBeNull();
  });

  it("token de operador (mesma JWT_SECRET, type dashboard) não abre o portal", async () => {
    await salvarAssinante({ email: "a@b.co", territorios: ["x"] });
    const doOperador = await new SignJWT({ adminId: 0, email: "a@b.co", type: "dashboard" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("8h")
      .sign(new TextEncoder().encode(SEGREDO));
    expect(await sessaoDoToken(doOperador)).toBeNull();
  });

  it("revogar links invalida os tokens já emitidos", async () => {
    const a = await salvarAssinante({ email: "a@b.co", territorios: ["x"] });
    const { token } = await assinarToken(a);
    expect(await sessaoDoToken(token)).not.toBeNull();
    await salvarAssinante({ email: "a@b.co", territorios: ["x"], revogarLinks: true });
    expect(await sessaoDoToken(token)).toBeNull();
  });

  it("assinante removido do cadastro perde a sessão", async () => {
    const a = await salvarAssinante({ email: "a@b.co", territorios: ["x"] });
    const { token } = await assinarToken(a);
    const fantasma = await assinarToken({ email: "naoexiste@b.co", tokenVersion: 1 });
    expect(await sessaoDoToken(fantasma.token)).toBeNull();
    expect(await sessaoDoToken(token)).not.toBeNull();
  });

  it("sem JWT_SECRET forte não assina token", async () => {
    process.env.JWT_SECRET = "curto";
    await expect(assinarToken({ email: "a@b.co", tokenVersion: 1 })).rejects.toThrow(/JWT_SECRET/);
  });
});

describe("B2: solicitação de acesso não entrega o link", () => {
  it("registra o pedido, deduplica em 10 minutos e marca como atendido", async () => {
    await salvarAssinante({ email: "a@b.co", territorios: ["x"] });
    await registrarSolicitacao("A@B.co", new Date("2026-09-30T10:00:00Z"));
    await registrarSolicitacao("a@b.co", new Date("2026-09-30T10:05:00Z"));
    let pend = await solicitacoesPendentes();
    expect(pend).toHaveLength(1);
    expect(pend[0].conhecido).toBe(true);

    await registrarSolicitacao("desconhecido@x.co", new Date("2026-09-30T10:06:00Z"));
    pend = await solicitacoesPendentes();
    expect(pend.map((p) => [p.email, p.conhecido])).toEqual([
      ["desconhecido@x.co", false],
      ["a@b.co", true],
    ]);

    await marcarSolicitacaoAtendida("a@b.co");
    expect((await solicitacoesPendentes()).map((p) => p.email)).toEqual(["desconhecido@x.co"]);
  });

  it("o link sai só no formato esperado, para o operador", () => {
    expect(linkDeAcesso("https://dit.exemplo.com/", "abc def")).toBe("https://dit.exemplo.com/entrar?token=abc%20def");
  });
});

describe("B2: requisição para identidade", () => {
  it("lê o token do cabeçalho próprio, do Bearer ou do cookie", () => {
    expect(tokenDaRequisicao({ headers: { [PORTAL_TOKEN_HEADER]: " t1 " } })).toBe("t1");
    expect(tokenDaRequisicao({ headers: { authorization: "Bearer t2" } })).toBe("t2");
    expect(tokenDaRequisicao({ headers: { cookie: `x=1; ${PORTAL_COOKIE}=t3` } })).toBe("t3");
    expect(tokenDaRequisicao({ headers: {} })).toBeNull();
  });

  it("anônimo vira null; assinante com token válido vira identidade com seus territórios", async () => {
    expect(await identidadeDaRequisicao({ headers: {} })).toBeNull();
    const a = await salvarAssinante({ email: "a@b.co", territorios: ["macae-3302403"] });
    const { token } = await assinarToken(a);
    const id = await identidadeDaRequisicao({ headers: { cookie: `${PORTAL_COOKIE}=${token}` } });
    expect(id).toEqual({ tipo: "assinante", email: "a@b.co", territorios: ["macae-3302403"] });
  });

  it("token inválido no cookie é anônimo", async () => {
    expect(await identidadeDaRequisicao({ headers: { cookie: `${PORTAL_COOKIE}=lixo` } })).toBeNull();
  });

  it("restringe ao território do contrato; operador e portal aberto veem todos", () => {
    const assinante = { tipo: "assinante" as const, territorios: ["macae-3302403"] };
    expect(podeVerTerritorio(assinante, "macae-3302403")).toBe(true);
    expect(podeVerTerritorio(assinante, "belford-roxo-3300456")).toBe(false);
    expect(podeVerTerritorio({ tipo: "operador", territorios: "*" }, "qualquer")).toBe(true);
  });
});
