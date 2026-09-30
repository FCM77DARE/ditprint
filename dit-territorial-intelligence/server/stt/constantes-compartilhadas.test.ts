import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PESOS_METODOLOGIA } from "./tensao-confianca";
import {
  DIMENSOES_METODOLOGIA,
  FAIXA_ESCALADA_MIN,
  FAIXA_PRESSAO_MIN,
  PESOS_POR_DIMENSAO,
  cenarioDoStt,
} from "../../shared/metodologia";

/**
 * B8: pesos e faixas viraram constante compartilhada SEM mudar valor. Os
 * números abaixo são os que rodavam em calculator.ts (DIM_WEIGHTS),
 * consolidator.ts e orchestrator.ts (scoreToScenario) antes da extração.
 */
const PESOS_ANTES = { D1: 0.22, D2: 0.15, D3: 0.15, D4: 0.22, D5: 0.15, D6: 0.11, D7: 0 };

describe("constantes compartilhadas (B8): os números não mudaram", () => {
  it("pesos por dimensão idênticos aos que o motor usava", () => {
    expect(PESOS_POR_DIMENSAO).toEqual(PESOS_ANTES);
    expect(PESOS_METODOLOGIA).toEqual(PESOS_ANTES);
    for (const d of DIMENSOES_METODOLOGIA) expect(d.peso).toBe(PESOS_ANTES[d.id]);
  });

  it("os pesos somam 1", () => {
    const soma = Object.values(PESOS_POR_DIMENSAO).reduce((a, b) => a + b, 0);
    expect(Math.abs(soma - 1)).toBeLessThan(1e-9);
  });

  it("faixas 75 e 50 e o cenário nas bordas", () => {
    expect(FAIXA_ESCALADA_MIN).toBe(75);
    expect(FAIXA_PRESSAO_MIN).toBe(50);
    expect(cenarioDoStt(100)).toBe("escalada");
    expect(cenarioDoStt(75)).toBe("escalada");
    expect(cenarioDoStt(74.9)).toBe("pressao");
    expect(cenarioDoStt(50)).toBe("pressao");
    expect(cenarioDoStt(49.9)).toBe("estabilidade");
    expect(cenarioDoStt(0)).toBe("estabilidade");
  });

  it("calculator e consolidator importam de shared e não redigitam os pesos", () => {
    for (const arquivo of ["calculator.ts", "consolidator.ts", "tensao-confianca.ts"]) {
      const fonte = readFileSync(join(__dirname, arquivo), "utf8");
      expect(fonte, arquivo).toContain("PESOS_POR_DIMENSAO");
      expect(fonte, arquivo).not.toMatch(/D1:\s*0\.22/);
    }
    const orq = readFileSync(join(__dirname, "..", "agents", "orchestrator.ts"), "utf8");
    expect(orq).toContain("cenarioDoStt");
    expect(orq).not.toMatch(/stt >= 75/);
  });
});
