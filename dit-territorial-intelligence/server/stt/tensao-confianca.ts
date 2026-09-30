/**
 * Tensão e Confiança: o STT separado em "quanto pressiona" e "quanto sabemos".
 *
 * O PROBLEMA
 *
 * O STT legado parte de 100 e só desce quando chega evidência (consolidator.ts,
 * modelo "Complexidade Residual"). Dimensão sem evidência continua em 100 e
 * entra na soma com o peso cheio. Em Macaé, D1 e D5 sem evidência valiam 37 dos
 * 84 pontos: o número mede, em boa parte, quanto a malha não sabe.
 *
 * A CORREÇÃO (proposta de 24/09/2026, ainda não publicada)
 *
 *   Tensão    0-100, só com o que tem evidência. Os pesos das dimensões
 *             medidas são renormalizados para somar 1.
 *   Confiança 0-100, fração do peso da metodologia que foi de fato medida.
 *   Faixa     mínimo e máximo possíveis se as dimensões não medidas fossem
 *             0 ou 100. Tem a largura exata da ignorância.
 *
 * Regra de "medida": a dimensão tem camada estrutural OU pelo menos 1 sinal
 * verificado. Nada mais conta (cobertura de fonte sem sinal não é evidência).
 *
 * Módulo puro: sem IO, sem banco, sem relógio. O contrato de saída é
 * `Leitura`, em shared/leitura.ts, que o front importa.
 */

import type { DimensaoLeitura, FonteDimensao, Leitura } from "../../shared/leitura";

export type { DimensaoLeitura, FonteDimensao, Leitura };

export type DimensaoId = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7";

/**
 * Pesos que o STT em produção usa de fato (mesmos de consolidator.ts e
 * calculator.ts, Σ = 1). Atenção: server/indicators.ts carrega OUTRA tabela
 * (D1 0,20 ... D7 0,10) que só serve a calculateSTT, caminho que o consolidador
 * não usa. Este módulo segue o consolidador porque é o número que o cliente vê.
 */
export const PESOS_METODOLOGIA: Record<DimensaoId, number> = {
  D1: 0.22,
  D2: 0.15,
  D3: 0.15,
  D4: 0.22,
  D5: 0.15,
  D6: 0.11,
  D7: 0,
};

export const NOMES_DIMENSAO: Record<DimensaoId, string> = {
  D1: "Socioambiental",
  D2: "Socioeconômica",
  D3: "Infraestrutura e Serviços",
  D4: "Dinâmica Territorial",
  D5: "Governança e Articulação",
  D6: "Reputação e Visibilidade",
  D7: "Recursos Naturais e Potencial",
};

export interface DimensaoEntrada {
  id: DimensaoId;
  /** Score da dimensão como o STT legado o tem (0-100; vazia costuma vir 100). */
  score: number | null | undefined;
  /** Peso na metodologia, 0-1. Omitido: PESOS_METODOLOGIA[id]. */
  peso?: number;
  /** A camada estrutural (IBGE, percentil nacional) cobre esta dimensão. */
  estrutural: boolean;
  /** Sinais que passaram pelo verificador nesta dimensão. */
  sinaisVerificados: number;
}

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const arredonda1 = (v: number) => Math.round(v * 10) / 10;

function fonteDe(estrutural: boolean, sinais: number): FonteDimensao {
  const temSinal = sinais >= 1;
  if (estrutural && temSinal) return "ambos";
  if (estrutural) return "estrutural";
  if (temSinal) return "sinal";
  return "nenhuma";
}

export function calcularTensaoConfianca(entrada: DimensaoEntrada[]): Leitura {
  const itens = entrada.map((d) => {
    const peso = Math.max(0, d.peso ?? PESOS_METODOLOGIA[d.id] ?? 0);
    const scoreValido = typeof d.score === "number" && Number.isFinite(d.score);
    const fonteBruta = fonteDe(Boolean(d.estrutural), Math.max(0, d.sinaisVerificados || 0));
    // Evidência sem número utilizável não mede nada.
    const medida = fonteBruta !== "nenhuma" && scoreValido;
    return {
      id: d.id,
      peso,
      medida,
      fonte: medida ? fonteBruta : ("nenhuma" as FonteDimensao),
      score: medida ? clamp(d.score as number) : null,
      // Como o legado enxerga a dimensão: o score dado, ou 100 quando não há.
      legado: scoreValido ? clamp(d.score as number) : 100,
    };
  });

  const pesoTotal = itens.reduce((a, i) => a + i.peso, 0);
  const pesoMedido = itens.filter((i) => i.medida).reduce((a, i) => a + i.peso, 0);
  const somaMedida = itens.filter((i) => i.medida).reduce((a, i) => a + i.peso * (i.score as number), 0);
  const pesoNaoMedido = pesoTotal - pesoMedido;

  const tensao = pesoMedido > 0 ? Math.round(somaMedida / pesoMedido) : null;
  const confianca = pesoTotal > 0 ? Math.round((pesoMedido / pesoTotal) * 100) : 0;

  const faixa =
    pesoTotal > 0
      ? {
          min: Math.round(somaMedida / pesoTotal),
          max: Math.round((somaMedida + pesoNaoMedido * 100) / pesoTotal),
        }
      : { min: 0, max: 100 };

  const stt_legado =
    pesoTotal > 0 ? arredonda1(itens.reduce((a, i) => a + i.peso * i.legado, 0) / pesoTotal) : 100;

  const dimensoes: DimensaoLeitura[] = itens.map((i) => ({
    id: i.id,
    nome: NOMES_DIMENSAO[i.id] ?? i.id,
    score: i.score,
    peso: i.peso,
    medida: i.medida,
    fonte: i.fonte,
  }));

  return { tensao, confianca, faixa, dimensoes, stt_legado };
}
