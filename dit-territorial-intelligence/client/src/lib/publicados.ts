/**
 * Campos que o portao de publicacao (B1/B3) acrescenta as leituras publicas. As procedures
 * devolvem uniao de tipos porque a flag DIT_GATE_PUBLICACAO pode voltar ao caminho antigo,
 * onde esses campos nao existem: por isso todos sao opcionais aqui e a tela trata a falta.
 */
export interface CamposPublicados {
  notaExecutiva?: string | null;
  delta7?: number | null;
  delta30?: number | null;
  serie?: Array<{ data: string; valor: number }>;
  publicado?: boolean;
  publishedAt?: string | null;
  publishedBy?: string | null;
}

export function camposPublicados(t: object): CamposPublicados {
  return t as CamposPublicados;
}
