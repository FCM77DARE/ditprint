import { describe, expect, it } from "vitest";
import { comProgresso, emitir, emitirPara, ouvir, _ouvintesParaTeste } from "./leitura-progresso";

const fonte = { tipo: "fonte", dimensao: "D1", fonte: "src-x", nome: "IBAMA", ok: true, brutos: 3 } as const;

describe("leitura-progresso", () => {
  it("emitir dentro do contexto chega só a quem ouve aquele território", async () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    const paraA = ouvir("a-1111111", (e) => a.push(e));
    const paraB = ouvir("b-2222222", (e) => b.push(e));
    await comProgresso("a-1111111", async () => {
      await Promise.resolve(); // atravessa um await: o contexto assíncrono se mantém
      emitir(fonte);
    });
    expect(a).toEqual([fonte]);
    expect(b).toEqual([]);
    paraA();
    paraB();
    expect(_ouvintesParaTeste()).toBe(0);
  });

  it("sem contexto ou sem ouvinte não faz nada e não lança", () => {
    expect(() => emitir(fonte)).not.toThrow();
    expect(() => emitirPara("ninguem-0000000", fonte)).not.toThrow();
  });

  it("ouvinte quebrado não derruba a coleta nem os outros ouvintes", () => {
    const ok: unknown[] = [];
    const p1 = ouvir("c-3333333", () => {
      throw new Error("conexão caída");
    });
    const p2 = ouvir("c-3333333", (e) => ok.push(e));
    expect(() => emitirPara("c-3333333", fonte)).not.toThrow();
    expect(ok).toEqual([fonte]);
    p1();
    p2();
  });
});
