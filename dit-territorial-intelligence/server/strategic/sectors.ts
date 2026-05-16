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
 * Avaliação de maturidade BASEADA EM EVIDÊNCIA (não em STT/tensão).
 *
 * Histórico do bug: o classificador antigo lia `dimScores` (escala de tensão
 * 0-100 onde alto = escalada/pior) como se fosse "maior = mais maduro". Em
 * municípios estáveis (STT baixo), todo setor saía Inexistente — exatamente
 * o oposto do real.
 *
 * Agora cada setor olha pra:
 *  - Recursos territoriais nas categorias relevantes
 *  - Casos estratégicos com relevância ≥ POTENCIAL
 *  - Hotspots georreferenciados
 *  - Tipo de território (capital, hub conhecido)
 */

import type { Resource, StrategicCaseResult, Hotspot } from "./types";

export interface SectorEvidenceCtx {
  resources: Resource[];
  cases: StrategicCaseResult[];
  hotspots: Hotspot[];
  isCapital: boolean;
  hasIbge: boolean;
}

interface SectorRule {
  /** Categorias de recurso que contribuem para este setor. */
  resourceCategories: Array<Resource["category"]>;
  /** caseIds que indicam vetor estratégico relevante (S1). */
  caseIds: string[];
  /** Tipos de hotspot que reforçam maturidade do setor. */
  hotspotTypes: Array<import("./types").HotspotType>;
  /** Bônus quando o território é capital estadual. */
  capitalBonus: number;
  /** Score mínimo por existir no IBGE (base do município). */
  baseline: number;
}

const SECTOR_RULES: Record<string, SectorRule> = {
  S1: {
    resourceCategories: ["minerais"],
    caseIds: ["TERRAS_RARAS", "DATA_CENTERS"],
    hotspotTypes: ["risco", "potencial"],
    capitalBonus: 15,
    baseline: 10,
  },
  S2: {
    resourceCategories: ["agricolas", "minerais"],
    caseIds: [],
    hotspotTypes: [],
    capitalBonus: 5,
    baseline: 25, // toda cidade tem alguma base produtiva tradicional
  },
  S3: {
    resourceCategories: [],
    caseIds: [],
    hotspotTypes: ["vulnerabilidade"],
    capitalBonus: 10,
    baseline: 30, // todo município tem dinâmica socioterritorial
  },
  S4: {
    resourceCategories: ["hidricos", "florestais", "ambientais"],
    caseIds: [],
    hotspotTypes: [],
    capitalBonus: 0,
    baseline: 20,
  },
  S5: {
    resourceCategories: ["energeticos"],
    caseIds: ["DATA_CENTERS"],
    hotspotTypes: [],
    capitalBonus: 20,
    baseline: 20,
  },
  S6: {
    resourceCategories: [],
    caseIds: [],
    hotspotTypes: [],
    capitalBonus: 30,
    baseline: 15,
  },
};

/**
 * Score de maturidade do setor (0-100), derivado de evidência concreta.
 * Resultado calibrado para que:
 *  - município comum no IBGE caia em ~25-40 (Latente)
 *  - cidade com 1-2 ativos relevantes vá pra ~45-65 (Em Desenvolvimento)
 *  - hub confirmado (capital + recursos + caso) chegue a 70+ (Alta Maturidade)
 */
export function computeSectorScore(sector: Sector, ctx: SectorEvidenceCtx): number {
  const rule = SECTOR_RULES[sector.id];
  if (!rule) return 0;

  let score = ctx.hasIbge ? rule.baseline : 0;

  // Cada recurso na categoria relevante adiciona 8-15 pontos
  const relevantResources = ctx.resources.filter(r =>
    rule.resourceCategories.includes(r.category)
  );
  for (const r of relevantResources) {
    score += r.abundance === "abundante" ? 15 : r.abundance === "presente" ? 10 : 5;
  }

  // Casos estratégicos
  for (const c of ctx.cases) {
    if (!rule.caseIds.includes(c.caseId)) continue;
    if (c.relevance === "ESTRATÉGICO") score += 25;
    else if (c.relevance === "POTENCIAL") score += 15;
    else if (c.relevance === "LATENTE") score += 8;
  }

  // Hotspots reforçam
  const relevantHotspots = ctx.hotspots.filter(h => rule.hotspotTypes.includes(h.type));
  score += Math.min(relevantHotspots.length * 3, 12);

  // Capital
  if (ctx.isCapital) score += rule.capitalBonus;

  return Math.min(Math.round(score), 100);
}

export function classifyMaturity(
  score: number
): "Alta Maturidade" | "Em Desenvolvimento" | "Latente" | "Inexistente" {
  if (score >= 70) return "Alta Maturidade";
  if (score >= 45) return "Em Desenvolvimento";
  if (score >= 20) return "Latente";
  return "Inexistente";
}
