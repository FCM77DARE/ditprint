import { describe, expect, it } from "vitest";
import {
  calcularTensaoConfianca,
  PESOS_METODOLOGIA,
  type DimensaoEntrada,
} from "./tensao-confianca";

const dim = (
  id: DimensaoEntrada["id"],
  score: number,
  estrutural: boolean,
  sinaisVerificados: number
): DimensaoEntrada => ({ id, score, estrutural, sinaisVerificados });

describe("PESOS_METODOLOGIA", () => {
  it("soma 1 nas dimensões D1..D6 e D7 fica fora do cálculo", () => {
    const soma = Object.values(PESOS_METODOLOGIA).reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(1, 6);
    expect(PESOS_METODOLOGIA.D7).toBe(0);
  });
});

describe("calcularTensaoConfianca", () => {
  it("sem nenhuma evidência: tensão nula, confiança 0, faixa 0 a 100", () => {
    const r = calcularTensaoConfianca(
      (["D1", "D2", "D3", "D4", "D5", "D6"] as const).map((id) => dim(id, 100, false, 0))
    );
    expect(r.tensao).toBeNull();
    expect(r.confianca).toBe(0);
    expect(r.faixa).toEqual({ min: 0, max: 100 });
    expect(r.stt_legado).toBe(100);
    expect(r.dimensoes.every((d) => d.medida === false && d.score === null && d.fonte === "nenhuma")).toBe(true);
  });

  it("tudo medido: tensão igual ao legado, confiança 100 e faixa colapsada", () => {
    const r = calcularTensaoConfianca([
      dim("D1", 60, true, 2),
      dim("D2", 50, true, 1),
      dim("D3", 40, true, 3),
      dim("D4", 30, false, 4),
      dim("D5", 20, false, 1),
      dim("D6", 10, false, 5),
    ]);
    expect(r.confianca).toBe(100);
    expect(r.tensao).toBe(Math.round(r.stt_legado));
    expect(r.faixa.min).toBe(r.faixa.max);
  });

  it("caso Macaé: D1 e D5 sem evidência valem 37 pontos do legado", () => {
    // D2, D3, D4 com camada estrutural; D6 com sinal verificado; D1 e D5 vazias (legado = 100).
    const r = calcularTensaoConfianca([
      dim("D1", 100, false, 0),
      dim("D2", 65, true, 0),
      dim("D3", 62, true, 1),
      dim("D4", 80, true, 2),
      dim("D5", 100, false, 0),
      dim("D6", 90, false, 6),
    ]);
    expect(r.confianca).toBe(63);
    expect(r.tensao).toBe(74);
    expect(r.faixa).toEqual({ min: 47, max: 84 });
    expect(r.stt_legado).toBeCloseTo(83.6, 0);
    const d1 = r.dimensoes.find((d) => d.id === "D1")!;
    expect(d1).toMatchObject({ score: null, medida: false, fonte: "nenhuma", peso: 0.22 });
    expect(r.dimensoes.find((d) => d.id === "D2")).toMatchObject({ medida: true, fonte: "estrutural", score: 65 });
    expect(r.dimensoes.find((d) => d.id === "D6")).toMatchObject({ medida: true, fonte: "sinal", score: 90 });
    expect(r.dimensoes.find((d) => d.id === "D3")).toMatchObject({ medida: true, fonte: "ambos" });
  });

  it("dimensão vazia não puxa a tensão para 100 (renormaliza só as medidas)", () => {
    const so_uma = calcularTensaoConfianca([
      dim("D1", 100, false, 0),
      dim("D2", 40, true, 0),
      dim("D3", 100, false, 0),
      dim("D4", 100, false, 0),
      dim("D5", 100, false, 0),
      dim("D6", 100, false, 0),
    ]);
    expect(so_uma.tensao).toBe(40);
    expect(so_uma.confianca).toBe(15);
    expect(so_uma.faixa.min).toBe(6); // 0,15 * 40
    expect(so_uma.faixa.max).toBe(91); // 6 + 0,85 * 100
  });

  it("score de dimensão com evidência inválida é tratado como não medido", () => {
    const r = calcularTensaoConfianca([
      { id: "D2", score: Number.NaN, estrutural: true, sinaisVerificados: 3 },
      dim("D4", 50, false, 1),
    ]);
    expect(r.dimensoes.find((d) => d.id === "D2")).toMatchObject({ medida: false, score: null });
    expect(r.tensao).toBe(50);
  });

  it("respeita peso explícito da entrada e ignora dimensão de peso zero", () => {
    const r = calcularTensaoConfianca([
      { id: "D1", score: 80, peso: 0.5, estrutural: true, sinaisVerificados: 0 },
      { id: "D2", score: 20, peso: 0.5, estrutural: false, sinaisVerificados: 0 },
      { id: "D7", score: 99, peso: 0, estrutural: false, sinaisVerificados: 9 },
    ]);
    expect(r.confianca).toBe(50);
    expect(r.tensao).toBe(80);
    expect(r.faixa).toEqual({ min: 40, max: 90 });
  });

  it("sinal só conta se verificado (>= 1) e estrutural sozinho basta", () => {
    const r = calcularTensaoConfianca([
      dim("D1", 70, false, 1),
      dim("D2", 70, true, 0),
      dim("D3", 70, false, 0),
    ]);
    expect(r.dimensoes.map((d) => d.fonte)).toEqual(["sinal", "estrutural", "nenhuma"]);
  });

  it("não muta a entrada e limita scores a 0..100", () => {
    const entrada = [dim("D1", 140, true, 0), dim("D2", -5, true, 0)];
    const copia = JSON.parse(JSON.stringify(entrada));
    const r = calcularTensaoConfianca(entrada);
    expect(entrada).toEqual(copia);
    expect(r.dimensoes[0].score).toBe(100);
    expect(r.dimensoes[1].score).toBe(0);
  });
});
