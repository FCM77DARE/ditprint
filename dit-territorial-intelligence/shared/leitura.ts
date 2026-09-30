/**
 * Contrato da leitura territorial que o backend devolve no campo `leitura`.
 * O front (components/dit) importa daqui; nao duplicar este tipo.
 */

export type FonteDimensao = "estrutural" | "sinal" | "ambos" | "nenhuma";

export interface DimensaoLeitura {
  id: string;
  nome: string;
  /** 0-100, ou null quando a dimensao nao foi medida (nunca preencher com 100). */
  score: number | null;
  /** Peso da dimensao na tensao, 0-1 (ou percentual; a tabela mostra como vier). */
  peso: number;
  medida: boolean;
  fonte: FonteDimensao;
}

export interface FaixaLeitura {
  min: number;
  max: number;
}

export interface Leitura {
  /** 0-100, ou null quando nao ha base para medir. */
  tensao: number | null;
  /** 0-100. */
  confianca: number;
  /** Intervalo plausivel da tensao. */
  faixa: FaixaLeitura;
  dimensoes: DimensaoLeitura[];
  /** Valor do STT antigo, apenas para comparacao durante a transicao. */
  stt_legado?: number;
}
