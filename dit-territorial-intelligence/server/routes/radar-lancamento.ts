/**
 * Radar de lançamento — os territórios que entram no ar em 30/09/2026.
 *
 * POR QUE UMA LISTA FECHADA
 *
 * O gerador aberto foi desligado (`DIT_PUBLIC_ANALYZE=false`). O que o mercado
 * vê no lançamento é isto aqui: territórios coletados todo dia, com série
 * histórica de verdade e publicação analisada. Território fora da lista vira
 * pedido — que é o funil do modelo de negócio (Radar por assinatura,
 * Diagnóstico por ticket).
 *
 * O CORTE
 *
 * Doze de tese e oito de contraste.
 *
 *   TESE       onde a PRINT tem cliente, repertório e o que dizer. É o que
 *              sustenta conversa comercial no dia seguinte.
 *   CONTRASTE  territórios escolhidos para a régua aparecer inteira. Se todo
 *              o Radar for petróleo e porto do Sudeste, o STT parece um número
 *              que não varia. Com Rodelas e Altamira no topo e Galinhos na
 *              base, dá para mostrar que o score lê o território.
 *
 * A base estrutural de cada um está em `pnpm territorios:perfil` — só as
 * dimensões que a camada cobre (D2, D3, D4), sem a camada de sinal.
 */

export type EixoRadar = "tese" | "contraste";

export interface TerritorioRadar {
  /** Nome como se digita na busca. Composto usa o nome do recorte. */
  consulta: string;
  uf: string;
  eixo: EixoRadar;
  /** Por que este território está no Radar */
  tese: string;
  /** Base estrutural observada em 08/09/2026 — referência, não meta */
  baseObservada?: number;
}

export const RADAR_LANCAMENTO: TerritorioRadar[] = [
  // ── TESE ────────────────────────────────────────────────────────────────
  { consulta: "Macaé", uf: "RJ", eixo: "tese", tese: "Petróleo, bacia de Campos", baseObservada: 54 },
  { consulta: "Rio das Ostras", uf: "RJ", eixo: "tese", tese: "Petróleo e expansão urbana acelerada", baseObservada: 60 },
  { consulta: "Itaguaí", uf: "RJ", eixo: "tese", tese: "Porto e logística", baseObservada: 57 },
  { consulta: "Maricá", uf: "RJ", eixo: "tese", tese: "Royalties e projeto portuário", baseObservada: 64 },
  { consulta: "Magé", uf: "RJ", eixo: "tese", tese: "Baía de Guanabara e saneamento", baseObservada: 66 },
  { consulta: "Duque de Caxias", uf: "RJ", eixo: "tese", tese: "Refino e vulnerabilidade social", baseObservada: 55 },
  { consulta: "Baía de Guanabara", uf: "RJ", eixo: "tese", tese: "Recorte composto, 7 municípios com orla" },
  { consulta: "Camaçari", uf: "BA", eixo: "tese", tese: "Polo petroquímico", baseObservada: 68 },
  { consulta: "Dias d'Ávila", uf: "BA", eixo: "tese", tese: "Polo de Camaçari", baseObservada: 72 },
  { consulta: "Candeias", uf: "BA", eixo: "tese", tese: "Refino, entorno da RLAM", baseObservada: 66 },
  { consulta: "Catu", uf: "BA", eixo: "tese", tese: "Petróleo onshore", baseObservada: 70 },
  { consulta: "Santo Amaro", uf: "BA", eixo: "tese", tese: "Passivo ambiental histórico, contaminação por chumbo", baseObservada: 77 },

  // ── CONTRASTE ───────────────────────────────────────────────────────────
  { consulta: "Rodelas", uf: "BA", eixo: "contraste", tese: "Hidrelétrica e reassentamento — topo da régua", baseObservada: 83 },
  { consulta: "Senhor do Bonfim", uf: "BA", eixo: "contraste", tese: "Mineração no semiárido", baseObservada: 79 },
  { consulta: "Altamira", uf: "PA", eixo: "contraste", tese: "Belo Monte, escala amazônica", baseObservada: 78 },
  { consulta: "Porto Seguro", uf: "BA", eixo: "contraste", tese: "Turismo e populações tradicionais", baseObservada: 76 },
  { consulta: "Eldorado", uf: "SP", eixo: "contraste", tese: "Vale do Ribeira, comunidades quilombolas", baseObservada: 70 },
  { consulta: "Caarapó", uf: "MS", eixo: "contraste", tese: "Agronegócio e terra indígena", baseObservada: 64 },
  { consulta: "Trairi", uf: "CE", eixo: "contraste", tese: "Eólica no litoral", baseObservada: 70 },
  { consulta: "Galinhos", uf: "RN", eixo: "contraste", tese: "Eólica em município de 2 mil habitantes — base da régua", baseObservada: 41 },
];

/** Texto de consulta com UF, como a resolução espera. */
export function consultaCompleta(t: TerritorioRadar): string {
  // Composto não leva UF: o nome já é único e a UF viria como sufixo estranho.
  return t.consulta === "Baía de Guanabara" ? t.consulta : `${t.consulta}, ${t.uf}`;
}

export function radarPorEixo(eixo: EixoRadar): TerritorioRadar[] {
  return RADAR_LANCAMENTO.filter((t) => t.eixo === eixo);
}

function chave(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const RADAR_INDEX = new Set(
  RADAR_LANCAMENTO.map((t) => `${chave(t.consulta)}|${t.uf.toLowerCase()}`)
);

/**
 * Este território faz parte do Radar declarado?
 *
 * A porta do lançamento precisa reconhecê-los ANTES de existirem no snapshot
 * store — senão a primeira coleta de cada um seria recusada como
 * "sob_demanda", e o Radar nunca sairia do papel.
 *
 * Casa por município e UF, não por slug: o slug canônico depende do código
 * IBGE, que esta declaração não carrega de propósito.
 */
export function estaNoRadar(municipio: string, uf: string, slug?: string): boolean {
  if (slug && RADAR_LANCAMENTO.some((t) => chave(t.consulta) === chave(slug))) return true;
  return RADAR_INDEX.has(`${chave(municipio)}|${uf.toLowerCase()}`);
}
