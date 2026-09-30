/**
 * Medição em dois números: Tensão + Confiança.
 *
 * Problema: no modelo "Complexidade Residual" uma dimensão sem evidência vale
 * 100 ("não sei" vira tensão máxima). Em Macaé isso deu STT 84 com D1 e D5
 * sem dado: 37 dos 84 pontos eram ausência de dado, não tensão medida.
 *
 * Esta função é pura (sem banco, sem rede) e roda SEMPRE, em qualquer modo.
 * O que muda entre modos é só qual número vira o principal publicado
 * (ver `modeloMedicao` e o orquestrador).
 *
 *   tensao    = média ponderada só das dimensões COM evidência (pesos
 *               renormalizados entre elas)
 *   confianca = soma dos pesos das dimensões com evidência (0 a 1)
 *   faixa.min = Σ peso×valor (medidas) + Σ peso (não medidas) × 0
 *   faixa.max = Σ peso×valor (medidas) + Σ peso (não medidas) × 100
 *
 * Tudo na escala 0 a 100, exceto `confianca` (0 a 1, exibir como %).
 */

import type { DimensionId } from "../indicators";

export type ModeloMedicao = "stt" | "tensao_confianca";

/**
 * Lê DIT_MODELO_MEDICAO. Padrão `stt` (comportamento histórico intocado).
 * Qualquer valor desconhecido cai em `stt`.
 */
export function modeloMedicao(): ModeloMedicao {
  return process.env.DIT_MODELO_MEDICAO === "tensao_confianca" ? "tensao_confianca" : "stt";
}

export interface MedicaoDoisNumeros {
  /** Média ponderada das dimensões com evidência, 0 a 100. Null se nenhuma tem evidência. */
  tensao: number | null;
  /** Soma dos pesos das dimensões com evidência, 0 a 1 */
  confianca: number;
  /** Intervalo em que o STT cairia conforme o que falta medir */
  faixa: { min: number; max: number };
  /** Dimensões com peso > 0 que não têm evidência */
  dimensoesSemEvidencia: DimensionId[];
}

const arred1 = (n: number) => Math.round(n * 10) / 10;

/**
 * @param valores   valor 0 a 100 de cada dimensão (o que hoje alimenta o STT)
 * @param pesos     pesos da metodologia (D7 com peso 0 fica de fora da conta)
 * @param temEvidencia  true quando a dimensão tem sinal verificado na janela
 *                      e/ou camada estrutural
 */
export function calcularMedicao(
  valores: Partial<Record<DimensionId, number>>,
  pesos: Record<DimensionId, number>,
  temEvidencia: Partial<Record<DimensionId, boolean>>
): MedicaoDoisNumeros {
  let somaMedida = 0; // Σ peso × valor das medidas
  let pesoMedido = 0;
  let pesoNaoMedido = 0;
  const semEvidencia: DimensionId[] = [];

  for (const id of Object.keys(pesos) as DimensionId[]) {
    const w = pesos[id] ?? 0;
    if (w <= 0) continue;
    if (temEvidencia[id]) {
      somaMedida += w * (valores[id] ?? 0);
      pesoMedido += w;
    } else {
      pesoNaoMedido += w;
      semEvidencia.push(id);
    }
  }

  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return {
    tensao: pesoMedido > 0 ? arred1(clamp(somaMedida / pesoMedido)) : null,
    confianca: Math.round(pesoMedido * 1000) / 1000,
    faixa: {
      min: arred1(clamp(somaMedida)),
      max: arred1(clamp(somaMedida + pesoNaoMedido * 100)),
    },
    dimensoesSemEvidencia: semEvidencia,
  };
}
