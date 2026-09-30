import { describe, it, expect, afterEach } from "vitest";
import { calcularMedicao, modeloMedicao } from "./medicao";
import type { DimensionId } from "../indicators";

// Mesmos pesos do consolidator (D7 com peso 0).
const PESOS: Record<DimensionId, number> = {
  D1: 0.22, D2: 0.15, D3: 0.15, D4: 0.22, D5: 0.15, D6: 0.11, D7: 0,
};

describe("calcularMedicao", () => {
  it("Macaé: D1 e D5 sem evidência dão tensão 74, faixa 47 a 84, confiança 63%", () => {
    const valores = { D1: 100, D2: 29, D3: 95, D4: 78, D5: 100, D6: 98, D7: 100 };
    const evid = { D1: false, D2: true, D3: true, D4: true, D5: false, D6: true, D7: false };
    const m = calcularMedicao(valores, PESOS, evid);

    // STT antigo (ausência de dado = 100): 84,0 (37 pontos vêm de D1 e D5)
    const sttAntigo = (Object.keys(PESOS) as DimensionId[]).reduce((a, id) => a + PESOS[id] * valores[id], 0);
    expect(Math.round(sttAntigo)).toBe(84);

    expect(Math.round(m.tensao!)).toBe(74);
    expect(m.confianca).toBeCloseTo(0.63, 5);
    expect(Math.round(m.faixa.min)).toBe(47);
    expect(Math.round(m.faixa.max)).toBe(84);
    expect(m.dimensoesSemEvidencia).toEqual(["D1", "D5"]);
  });

  it("todas as dimensões medidas: tensão igual ao STT antigo e confiança 100%", () => {
    const valores = { D1: 40, D2: 29, D3: 95, D4: 78, D5: 55, D6: 98, D7: 100 };
    const evid = { D1: true, D2: true, D3: true, D4: true, D5: true, D6: true, D7: false };
    const m = calcularMedicao(valores, PESOS, evid);
    const sttAntigo = (Object.keys(PESOS) as DimensionId[]).reduce((a, id) => a + PESOS[id] * valores[id], 0);

    expect(m.tensao).toBeCloseTo(Math.round(sttAntigo * 10) / 10, 5);
    expect(m.confianca).toBe(1);
    expect(m.faixa.min).toBe(m.faixa.max);
    expect(m.dimensoesSemEvidencia).toEqual([]);
  });

  it("nenhuma evidência: tensão nula, confiança 0, faixa 0 a 100", () => {
    const m = calcularMedicao({}, PESOS, {});
    expect(m.tensao).toBeNull();
    expect(m.confianca).toBe(0);
    expect(m.faixa).toEqual({ min: 0, max: 100 });
    expect(m.dimensoesSemEvidencia).toEqual(["D1", "D2", "D3", "D4", "D5", "D6"]);
  });
});

describe("modeloMedicao (flag DIT_MODELO_MEDICAO)", () => {
  const original = process.env.DIT_MODELO_MEDICAO;
  afterEach(() => {
    if (original === undefined) delete process.env.DIT_MODELO_MEDICAO;
    else process.env.DIT_MODELO_MEDICAO = original;
  });

  it("padrão é stt", () => {
    delete process.env.DIT_MODELO_MEDICAO;
    expect(modeloMedicao()).toBe("stt");
    process.env.DIT_MODELO_MEDICAO = "qualquer";
    expect(modeloMedicao()).toBe("stt");
  });

  it("tensao_confianca liga o modo novo", () => {
    process.env.DIT_MODELO_MEDICAO = "tensao_confianca";
    expect(modeloMedicao()).toBe("tensao_confianca");
  });
});
