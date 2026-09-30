import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetarColecaoParaTeste } from "./_core/colecao";
import { emailHabilitado, enviarEmail } from "./_core/email-gancho";
import {
  atualizarStatusLead,
  idDoLead,
  leadEntradaSchema,
  listarLeads,
  registrarLead,
} from "./leads";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dit-leads-"));
  process.env.DATA_DIR = dir;
  delete process.env.DATABASE_URL;
  _resetarColecaoParaTeste();
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

describe("B6: validação do lead", () => {
  it("aceita o formulário novo completo", () => {
    const r = leadEntradaSchema.safeParse({
      nome: " Ana Souza ",
      empresa: "Petrolífera SA",
      email: "ANA@Empresa.com.br",
      territorio: "Macaé",
      momento: "operar",
      decisao: "Decidir licenciamento em 60 dias",
      observacao: "Quero ver o Radar",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("ana@empresa.com.br");
      expect(r.data.nome).toBe("Ana Souza");
      expect(r.data.momento).toBe("operar");
    }
  });

  it("aceita o formulário antigo (email e territory) e mapeia para territorio", () => {
    const r = leadEntradaSchema.safeParse({ email: "a@b.co", territory: "Macaé" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.territorio).toBe("Macaé");
  });

  it("recusa e-mail inválido, momento fora da lista e texto enorme", () => {
    expect(leadEntradaSchema.safeParse({ email: "sem-arroba" }).success).toBe(false);
    expect(leadEntradaSchema.safeParse({ email: "a@b.co", momento: "comprar" }).success).toBe(false);
    expect(leadEntradaSchema.safeParse({ email: "a@b.co", observacao: "x".repeat(2001) }).success).toBe(false);
    expect(leadEntradaSchema.safeParse({}).success).toBe(false);
  });
});

describe("B6: gravação em JSON no DATA_DIR e funil", () => {
  it("grava, é idempotente para o mesmo pedido e lista do mais novo ao mais antigo", async () => {
    const a = leadEntradaSchema.parse({ email: "a@b.co", territorio: "Macaé", momento: "entrar", nome: "Ana" });
    const r1 = await registrarLead(a, new Date("2026-09-01T10:00:00Z"));
    expect(r1.novo).toBe(true);
    expect(r1.lead.status).toBe("novo");

    const r2 = await registrarLead(
      leadEntradaSchema.parse({ email: "a@b.co", territorio: "macaé", momento: "entrar", observacao: "de novo" }),
      new Date("2026-09-01T11:00:00Z")
    );
    expect(r2.novo).toBe(false);
    expect(r2.lead.id).toBe(r1.lead.id);
    expect(r2.lead.reenvios).toBe(1);
    expect(r2.lead.nome).toBe("Ana");
    expect(r2.lead.observacao).toBe("de novo");

    await registrarLead(leadEntradaSchema.parse({ email: "c@d.co", territorio: "Cabiúnas" }), new Date("2026-09-02T10:00:00Z"));
    const todos = await listarLeads();
    expect(todos.map((l) => l.email)).toEqual(["c@d.co", "a@b.co"]);
  });

  it("muda o status pelo funil e filtra por status", async () => {
    const { lead } = await registrarLead(leadEntradaSchema.parse({ email: "a@b.co", territorio: "Macaé" }));
    const novo = await atualizarStatusLead(lead.id, "em_contato", "Liguei às 10h");
    expect(novo?.status).toBe("em_contato");
    expect(novo?.notaInterna).toBe("Liguei às 10h");
    expect((await listarLeads({ status: "novo" })).length).toBe(0);
    expect((await listarLeads({ status: "em_contato" })).length).toBe(1);
    expect(await atualizarStatusLead("inexistente", "ganho", undefined)).toBeNull();
  });

  it("o id não depende de caixa do território", () => {
    expect(idDoLead({ email: "a@b.co", territorio: "Macaé", momento: "operar" })).toBe(
      idDoLead({ email: "a@b.co", territorio: "MACAÉ", momento: "operar" })
    );
  });
});

describe("gancho de e-mail", () => {
  it("sem RESEND_API_KEY não envia e não chama a rede", async () => {
    let chamou = false;
    const r = await enviarEmail(
      { para: "a@b.co", assunto: "x", texto: "y" },
      { env: {}, fetchImpl: (async () => { chamou = true; return new Response("{}"); }) as typeof fetch }
    );
    expect(r).toEqual({ enviado: false, motivo: "sem_chave" });
    expect(chamou).toBe(false);
    expect(emailHabilitado({})).toBe(false);
  });

  it("com a chave, envia pelo Resend (fetch simulado, nenhuma chamada real)", async () => {
    let corpo: { to?: string[] } = {};
    const r = await enviarEmail(
      { para: "a@b.co", assunto: "x", texto: "y" },
      {
        env: { RESEND_API_KEY: "re_teste" },
        fetchImpl: (async (_u: unknown, init?: RequestInit) => {
          corpo = JSON.parse(String(init?.body));
          return new Response("{}", { status: 200 });
        }) as typeof fetch,
      }
    );
    expect(r).toEqual({ enviado: true });
    expect(corpo.to).toEqual(["a@b.co"]);
  });
});
