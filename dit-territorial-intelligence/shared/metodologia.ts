/**
 * Metodologia do STT para as paginas publicas (/metodologia, /territorio).
 *
 * Fonte dos numeros: pesos exatos de DIM_WEIGHTS em server/stt/calculator.ts
 * (os mesmos de consolidator.ts e de PESOS_METODOLOGIA em
 * server/stt/tensao-confianca.ts) e STRUCTURAL_WEIGHT em
 * server/structural/scoring.ts. Nao digitar pesos em JSX: importar daqui.
 * O teste server/stt/metodologia.test.ts compara esta tabela com o motor e
 * falha se os dois divergirem.
 */

export type DimensaoMetodologiaId = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7";

export interface DimensaoMetodologia {
  id: DimensaoMetodologiaId;
  nome: string;
  /** 0-1, igual ao motor. */
  peso: number;
  /** O que a dimensao olha (objetos de estudo de server/indicators.ts). */
  olha: string;
  /** true quando a dimensao esta fora do calculo ate a calibracao terminar. */
  emCalibracao?: boolean;
}

export const DIMENSOES_METODOLOGIA: DimensaoMetodologia[] = [
  { id: "D1", nome: "Socioambiental", peso: 0.22, olha: "Bioma, vulnerabilidade ambiental e passivos ambientais" },
  { id: "D2", nome: "Socioeconômica", peso: 0.15, olha: "População e desigualdade" },
  { id: "D3", nome: "Infraestrutura e Serviços", peso: 0.15, olha: "Acesso a políticas públicas, indústrias e serviços, logística" },
  { id: "D4", nome: "Dinâmica Territorial", peso: 0.22, olha: "Uso e ocupação, conflitos de uso, expansão urbana, populações tradicionais e assentamentos" },
  { id: "D5", nome: "Governança e Articulação", peso: 0.15, olha: "Capacidade institucional, participação social, articulação com o poder público" },
  { id: "D6", nome: "Reputação e Visibilidade", peso: 0.11, olha: "Mídia e interesse científico" },
  { id: "D7", nome: "Recursos Naturais e Potencial", peso: 0, olha: "Recursos naturais e minerais, potencial energético e tecnológico", emCalibracao: true },
];

/** Peso da camada estrutural (percentil nacional) na dimensao, onde ela existe. */
export const PESO_ESTRUTURAL = 0.6;
/** O restante da dimensao vem dos sinais verificados. */
export const PESO_SINAL = Math.round((1 - PESO_ESTRUTURAL) * 100) / 100;

/** Impacto do sinal a partir do qual dispara alerta (ALERT_THRESHOLD em base-dimension.ts). */
export const LIMITE_ALERTA = 0.7;
/** Impacto minimo para o sinal entrar no calculo (STT_INCLUDE_THRESHOLD). */
export const LIMITE_ENTRA_NO_CALCULO = 0.3;

// ─── Constantes do motor, fonte unica (B8) ───────────────────────────────────
// calculator.ts, consolidator.ts, tensao-confianca.ts e orchestrator.ts
// importam daqui. Os valores sao os que ja rodavam em producao; o teste
// server/stt/constantes-compartilhadas.test.ts trava os numeros.

/** Pesos por dimensao (soma 1; D7 fora ate a calibracao). Mesma forma do motor. */
export const PESOS_POR_DIMENSAO: Record<DimensaoMetodologiaId, number> = {
  D1: 0.22,
  D2: 0.15,
  D3: 0.15,
  D4: 0.22,
  D5: 0.15,
  D6: 0.11,
  D7: 0,
};

/** Faixas do STT: >= 75 escalada, 50 a 74 pressao, abaixo disso estabilidade. */
export const FAIXA_ESCALADA_MIN = 75;
export const FAIXA_PRESSAO_MIN = 50;

export type CenarioStt = "estabilidade" | "pressao" | "escalada";

export function cenarioDoStt(stt: number): CenarioStt {
  if (stt >= FAIXA_ESCALADA_MIN) return "escalada";
  if (stt >= FAIXA_PRESSAO_MIN) return "pressao";
  return "estabilidade";
}
