/**
 * 6 Setores PRINT — lógica SSE-like (sem usar indicadores SSE)
 *
 * Cada setor cruza múltiplas dimensões D1-D6 com pesos próprios.
 * A maturidade do setor é derivada combinando os scores dimensionais
 * com sinais específicos do setor (recursos, infra, casos).
 */

import type { Sector } from "./types";

export const SECTORS: Sector[] = [
  {
    id: "S1",
    name: "Estratégico-Nacional",
    focus: "Terras raras, data centers, lítio, semicondutores, hidrogênio verde",
    description:
      "Setores prioritários da política industrial e tecnológica brasileira. " +
      "Avalia se o território é hub, polo emergente ou potencial latente para esses vetores.",
    dimensionContribution: { D3: 0.30, D4: 0.30, D5: 0.20, D1: 0.10, D6: 0.10 },
  },
  {
    id: "S2",
    name: "Produtivo Tradicional",
    focus: "Agronegócio, pecuária, mineração tradicional, indústria de transformação",
    description:
      "Base produtiva consolidada do território. Mede vocação econômica e densidade industrial/agrícola.",
    dimensionContribution: { D3: 0.40, D2: 0.30, D1: 0.20, D4: 0.10 },
  },
  {
    id: "S3",
    name: "Socioterritorial",
    focus: "Comunidades tradicionais, assentamentos, urbanização, conflitos fundiários",
    description:
      "Dinâmica de ocupação humana, tensões territoriais e presença de populações vulneráveis ou tradicionais.",
    dimensionContribution: { D4: 0.50, D2: 0.30, D5: 0.20 },
  },
  {
    id: "S4",
    name: "Hidroambiental",
    focus: "Biomas, água, áreas protegidas, biodiversidade",
    description:
      "Patrimônio natural do território — base para conservação, pagamento por serviços ambientais, ecoturismo.",
    dimensionContribution: { D1: 0.70, D4: 0.20, D5: 0.10 },
  },
  {
    id: "S5",
    name: "Logístico-Energético",
    focus: "Transporte (rodo/ferro/hidro/aéreo), energia, conectividade digital",
    description:
      "Infraestrutura crítica que habilita ou bloqueia investimentos. Decisivo para data centers e indústria.",
    dimensionContribution: { D3: 0.70, D4: 0.20, D6: 0.10 },
  },
  {
    id: "S6",
    name: "Reputacional-Científico",
    focus: "Universidades, pesquisa, mídia, atração de talento",
    description:
      "Capital simbólico e intelectual do território. Habilita parcerias acadêmicas e investimentos em P&D.",
    dimensionContribution: { D6: 0.70, D5: 0.20, D2: 0.10 },
  },
];

export const SECTORS_MAP: Record<string, Sector> = Object.fromEntries(
  SECTORS.map(s => [s.id, s])
);

/**
 * Calcula score interno do setor a partir dos scores dimensionais.
 * É a soma ponderada de Di × contribuiçãoi.
 */
export function computeSectorScore(
  sector: Sector,
  dimScores: Partial<Record<"D1" | "D2" | "D3" | "D4" | "D5" | "D6", number>>
): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const [dimId, weight] of Object.entries(sector.dimensionContribution)) {
    const score = dimScores[dimId as "D1"];
    if (typeof score === "number") {
      weighted += score * weight;
      totalWeight += weight;
    }
  }
  return totalWeight > 0 ? weighted / totalWeight : 0;
}

/** Classifica maturidade a partir do score interno + sinais qualitativos. */
export function classifyMaturity(score: number): "Alta Maturidade" | "Em Desenvolvimento" | "Latente" | "Inexistente" {
  if (score >= 70) return "Alta Maturidade";
  if (score >= 45) return "Em Desenvolvimento";
  if (score >= 20) return "Latente";
  return "Inexistente";
}
