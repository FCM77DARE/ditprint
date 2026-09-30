import { describe, expect, it } from "vitest";
import {
  evidenciaDeConsolidado,
  ibgeDoContexto,
  leituraDeConsolidado,
  leituraDeDimensoes,
  scoresDeLinha,
} from "./leitura";

const vazio = { signals: 0, structural: 0 };

// Macaé como o consolidador a entrega: D1 e D5 vazias (100), D2/D3/D4 com camada
// estrutural, D6 com sinais verificados.
const macae = {
  dimensions: { D1: 100, D2: 65, D3: 62, D4: 80, D5: 100, D6: 90, D7: 100 },
  dimensionDetail: {
    D1: vazio,
    D2: { signals: 0, structural: 0 },
    D3: { signals: 1, structural: 0 },
    D4: { signals: 2, structural: 0 },
    D5: vazio,
    D6: { signals: 6, structural: 0 },
    D7: vazio,
  },
  structuralBasis: {
    D2: { score: 65, confidence: 1, rationale: "", basis: [] },
    D3: { score: 62, confidence: 1, rationale: "", basis: [] },
    D4: { score: 80, confidence: 1, rationale: "", basis: [] },
  },
};

describe("leituraDeConsolidado", () => {
  it("Macaé: tensão 74, faixa 47 a 84, confiança 63%, D1 e D5 sem score", () => {
    const l = leituraDeConsolidado(macae);
    expect(l.tensao).toBe(74);
    expect(l.faixa).toEqual({ min: 47, max: 84 });
    expect(l.confianca).toBe(63);
    expect(l.dimensoes.filter((d) => !d.medida).map((d) => d.id)).toEqual(["D1", "D5"]);
    expect(l.dimensoes.filter((d) => !d.medida).every((d) => d.score === null)).toBe(true);
    expect(l.dimensoes).toHaveLength(6);
  });

  it("sinal de fonte estrutural conta como estrutural e não como sinal", () => {
    const ev = evidenciaDeConsolidado({
      dimensionDetail: { ...macae.dimensionDetail, D1: { signals: 3, structural: 3 } },
      structuralBasis: undefined,
    });
    expect(ev.D1).toEqual({ estrutural: true, sinaisVerificados: 0 });
    expect(ev.D6).toEqual({ estrutural: false, sinaisVerificados: 6 });
  });
});

describe("leituraDeDimensoes", () => {
  it("sem consolidado usa os sinais do dia e nenhuma estrutura", () => {
    const l = leituraDeDimensoes({
      D1: { score: 40, signals: [{}, {}] },
      D2: { score: 100, signals: [] },
    });
    expect(l.dimensoes.find((d) => d.id === "D1")).toMatchObject({ medida: true, fonte: "sinal" });
    expect(l.dimensoes.find((d) => d.id === "D2")).toMatchObject({ medida: false, score: null });
    expect(l.tensao).toBe(40);
  });
});

describe("scoresDeLinha e ibgeDoContexto", () => {
  it("lê d1Score..d6Score e troca ausente por null", () => {
    const s = scoresDeLinha({ d1Score: 10, d2Score: null, d3Score: 30 });
    expect(s).toMatchObject({ D1: 10, D2: null, D3: 30, D4: null });
  });
  it("extrai ibge do contexto como o orchestrator", () => {
    expect(ibgeDoContexto({ ibgeId: 3302403 })).toEqual({ ibgeId: 3302403, lista: undefined });
    expect(ibgeDoContexto({ ibgeMunicipios: [1, 2] })).toEqual({ ibgeId: "1", lista: ["1", "2"] });
    expect(ibgeDoContexto(null)).toEqual({ ibgeId: null, lista: undefined });
  });
});
