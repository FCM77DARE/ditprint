import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetarColecaoParaTeste } from "../_core/colecao";
import {
  FONTES_SERPAPI,
  aplicarObservacao,
  classificarFonte,
  lerSaudeDasFontes,
  observacoesDaRodada,
  registrarRodadaDeFontes,
  type ObservacaoFonte,
} from "./saude-fontes";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dit-saude-"));
  process.env.DATA_DIR = dir;
  delete process.env.DATABASE_URL;
  _resetarColecaoParaTeste();
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const obs = (id: string, ok: boolean, sinais: number, erro?: string): ObservacaoFonte => ({
  id,
  nome: id,
  dimensao: "D1",
  ok,
  sinais,
  ...(erro ? { erro } : {}),
});

const dia = (n: number) => new Date(`2026-09-${String(n).padStart(2, "0")}T12:00:00Z`);

describe("B4: registro por fonte", () => {
  it("guarda último sucesso, último erro, último sinal e contagem por dia", () => {
    let r = aplicarObservacao(null, obs("src-x", true, 3), dia(1));
    r = aplicarObservacao(r, obs("src-x", false, 0, "timeout"), dia(2));
    expect(r.ultimoSucesso).toBe(dia(1).toISOString());
    expect(r.ultimoErro).toBe(dia(2).toISOString());
    expect(r.ultimoErroMsg).toBe("timeout");
    expect(r.ultimoSinal).toBe(dia(1).toISOString());
    expect(r.dias["2026-09-01"]).toEqual({ rodadas: 1, ok: 1, erro: 0, sinais: 3 });
    expect(r.dias["2026-09-02"]).toEqual({ rodadas: 1, ok: 0, erro: 1, sinais: 0 });
  });

  it("guarda só 7 dias", () => {
    let r = aplicarObservacao(null, obs("src-x", true, 1), dia(1));
    for (let d = 2; d <= 10; d++) r = aplicarObservacao(r, obs("src-x", true, 1), dia(d));
    expect(Object.keys(r.dias)).toHaveLength(7);
    expect(r.dias["2026-09-01"]).toBeUndefined();
    expect(r.dias["2026-09-10"]).toBeDefined();
  });
});

describe("B4: classificação cota_serpapi | defeito | ok", () => {
  const ctx = (cota: boolean, d = 8) => ({ agora: dia(d), cotaSerpapiEsgotada: cota });

  it("fonte viva com sinais é ok", () => {
    const r = aplicarObservacao(null, obs("src-ibge-censo", true, 5), dia(7));
    const c = classificarFonte(r, ctx(false));
    expect(c.estado).toBe("ok");
    expect(c.motivo).toBe("ok");
    expect(c.sinais7d).toBe(5);
  });

  it("fonte SerpAPI muda com a cota esgotada é cota_serpapi", () => {
    expect(FONTES_SERPAPI.has("src-ibama")).toBe(true);
    let r = aplicarObservacao(null, obs("src-ibama", true, 0), dia(6));
    r = aplicarObservacao(r, obs("src-ibama", true, 0), dia(7));
    const c = classificarFonte(r, ctx(true));
    expect(c.estado).toBe("muda");
    expect(c.motivo).toBe("cota_serpapi");
  });

  it("a mesma fonte muda com a cota sobrando é defeito", () => {
    const r = aplicarObservacao(null, obs("src-ibama", true, 0), dia(7));
    const c = classificarFonte(r, ctx(false));
    expect(c.estado).toBe("muda");
    expect(c.motivo).toBe("defeito");
  });

  it("fonte oficial (fora do SerpAPI) muda ou falhando é defeito, mesmo com cota esgotada", () => {
    expect(FONTES_SERPAPI.has("src-cemaden")).toBe(false);
    const muda = classificarFonte(aplicarObservacao(null, obs("src-cemaden", true, 0), dia(7)), ctx(true));
    expect(muda.motivo).toBe("defeito");
    const falha = classificarFonte(aplicarObservacao(null, obs("src-cemaden", false, 0, "HTTP 500"), dia(7)), ctx(true));
    expect(falha.estado).toBe("falhando");
    expect(falha.motivo).toBe("defeito");
  });

  it("erro de cota em fonte SerpAPI é cota_serpapi; erro comum é defeito", () => {
    const cota = classificarFonte(aplicarObservacao(null, obs("src-inea", false, 0, "SerpAPI 429 quota exceeded"), dia(7)), ctx(false));
    expect(cota.estado).toBe("falhando");
    expect(cota.motivo).toBe("cota_serpapi");
    const comum = classificarFonte(aplicarObservacao(null, obs("src-inea", false, 0, "Unexpected token <"), dia(7)), ctx(false));
    expect(comum.motivo).toBe("defeito");
  });

  it("sucesso depois do erro volta a ok", () => {
    let r = aplicarObservacao(null, obs("src-cemaden", false, 0, "timeout"), dia(6));
    r = aplicarObservacao(r, obs("src-cemaden", true, 2), dia(7));
    expect(classificarFonte(r, ctx(false)).estado).toBe("ok");
  });

  it("horas sem sinal", () => {
    const r = aplicarObservacao(null, obs("src-x", true, 1), new Date("2026-09-07T00:00:00Z"));
    const c = classificarFonte(r, { agora: new Date("2026-09-08T06:00:00Z"), cotaSerpapiEsgotada: false });
    expect(c.horasSemSinal).toBe(30);
  });
});

describe("B4: observações da rodada do orquestrador", () => {
  it("erro = errorCount subiu durante a rodada; sinais vêm do breakdown", () => {
    const o = observacoesDaRodada(
      [{ id: "a", errorCount: 1 }, { id: "b", errorCount: 0 }],
      [
        { id: "a", errorCount: 1, lastError: "velho" },
        { id: "b", errorCount: 1, lastError: "novo erro" },
      ],
      [
        { id: "a", name: "Fonte A", signals: 4 },
        { id: "b", name: "Fonte B", signals: 0 },
      ],
      (id) => (id === "a" ? "D1" : "D2")
    );
    expect(o).toEqual([
      { id: "a", nome: "Fonte A", dimensao: "D1", ok: true, sinais: 4 },
      { id: "b", nome: "Fonte B", dimensao: "D2", ok: false, erro: "novo erro", sinais: 0 },
    ]);
  });
});

describe("B4: persistência em JSON no DATA_DIR e leitura classificada", () => {
  it("grava a rodada e devolve as fontes ordenadas por gravidade", async () => {
    await registrarRodadaDeFontes([obs("src-ok", true, 3), obs("src-ruim", false, 0, "HTTP 500"), obs("src-ibama", true, 0)], dia(8));
    // segunda rodada, dia seguinte: acumula
    await registrarRodadaDeFontes([obs("src-ok", true, 2)], dia(9));
    const lista = await lerSaudeDasFontes({ agora: dia(9), cotaSerpapiEsgotada: true });
    expect(lista.map((f) => [f.id, f.estado, f.motivo])).toEqual([
      ["src-ruim", "falhando", "defeito"],
      ["src-ibama", "muda", "cota_serpapi"],
      ["src-ok", "ok", "ok"],
    ]);
    expect(lista.find((f) => f.id === "src-ok")?.sinais7d).toBe(5);
  });
});
