import type { DimensaoLeitura, Leitura } from "@shared/leitura";

/**
 * Adaptador da leitura: usa o campo `leitura` do backend quando vem; senao monta
 * uma Leitura a partir dos campos antigos (stt, d1Score..d6Score).
 * Regras: dimensao sem valor fica `medida:false` com score null (nunca 100) e,
 * sem `leitura` do backend, a confianca NAO e conhecida (`derivada: true`):
 * quem mostra confianca precisa checar esse campo.
 */
export type LeituraAdaptada = Leitura & {
  /** true quando montada dos campos antigos: confianca, faixa e pesos nao sao reais. */
  derivada: boolean;
};

export interface TerritorioLegado {
  stt?: number | null;
  d1Score?: number | null;
  d2Score?: number | null;
  d3Score?: number | null;
  d4Score?: number | null;
  d5Score?: number | null;
  d6Score?: number | null;
  leitura?: Leitura | null;
}

const NOMES: Array<[string, string, keyof TerritorioLegado]> = [
  ["D1", "Socioambiental", "d1Score"],
  ["D2", "Socioeconômica", "d2Score"],
  ["D3", "Infraestrutura", "d3Score"],
  ["D4", "Dinâmica territorial", "d4Score"],
  ["D5", "Governança", "d5Score"],
  ["D6", "Reputação", "d6Score"],
];

export function adaptarLeitura(t: TerritorioLegado | null | undefined): LeituraAdaptada {
  if (t?.leitura) return { ...t.leitura, derivada: false };
  const tensao = typeof t?.stt === "number" ? t.stt : null;
  const dimensoes: DimensaoLeitura[] = NOMES.map(([id, nome, campo]) => {
    const v = t?.[campo];
    const medida = typeof v === "number";
    return {
      id,
      nome,
      score: medida ? (v as number) : null,
      peso: 0, // peso real so vem do backend (B8); aqui nao se inventa
      medida,
      fonte: medida ? "sinal" : "nenhuma",
    };
  });
  return {
    tensao,
    confianca: 0,
    faixa: { min: tensao ?? 0, max: tensao ?? 0 },
    dimensoes,
    derivada: true,
  };
}
