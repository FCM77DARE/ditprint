import { describe, expect, it } from "vitest";
import { PESOS_METODOLOGIA } from "./tensao-confianca";
import { DIMENSOES_METODOLOGIA, PESO_ESTRUTURAL, PESO_SINAL } from "../../shared/metodologia";
import { STRUCTURAL_WEIGHT } from "../structural/scoring";

describe("shared/metodologia (paginas publicas) segue o motor", () => {
  it("os pesos por dimensao sao os do motor", () => {
    for (const d of DIMENSOES_METODOLOGIA) {
      expect(d.peso).toBe(PESOS_METODOLOGIA[d.id]);
    }
    expect(DIMENSOES_METODOLOGIA.length).toBe(Object.keys(PESOS_METODOLOGIA).length);
  });

  it("os pesos somam 1 e D7 pesa 0", () => {
    const soma = DIMENSOES_METODOLOGIA.reduce((a, d) => a + d.peso, 0);
    expect(Math.abs(soma - 1)).toBeLessThan(1e-9);
    expect(DIMENSOES_METODOLOGIA.find((d) => d.id === "D7")?.peso).toBe(0);
  });

  it("estrutural e sinal somam 1 e o estrutural e o do motor", () => {
    expect(PESO_ESTRUTURAL).toBe(STRUCTURAL_WEIGHT);
    expect(PESO_ESTRUTURAL + PESO_SINAL).toBeCloseTo(1, 9);
  });
});
