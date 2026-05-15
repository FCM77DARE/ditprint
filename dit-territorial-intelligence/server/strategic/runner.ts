/**
 * Strategic Layer Runner
 *
 * Orquestra a camada estratégica do DIT:
 *   1. Setores PRINT (compute a partir de scores dimensionais)
 *   2. Recursos territoriais (mapeamento determinístico por UF + overrides)
 *   3. Hotspots georreferenciados (OSM Overpass + cases)
 *   4. Casos estratégicos (Terras Raras, Data Centers, ...)
 *
 * Entrada: contexto do território + scores dimensionais (D1-D6).
 * Saída: StrategicLayerResult consolidado, pronto para o frontend.
 */

import { logger } from "../_core/logger";
import { SECTORS, computeSectorScore, classifyMaturity } from "./sectors";
import { collectResources } from "./resources";
import { collectOsmHotspots } from "./hotspots/osm-overpass";
import { runAllCases } from "./cases";
import type {
  Hotspot,
  SectorResult,
  StrategicLayerResult,
  TerritoryStrategicContext,
} from "./types";

const log = logger.child({ module: "strategic.runner" });

type DimScores = Partial<Record<"D1" | "D2" | "D3" | "D4" | "D5" | "D6", number>>;

function buildSectorInsight(
  sectorName: string,
  maturity: string,
  topDim: string
): string {
  const map: Record<string, string> = {
    "Alta Maturidade": `${sectorName} apresenta alta maturidade, com base sólida em ${topDim}.`,
    "Em Desenvolvimento": `${sectorName} mostra desenvolvimento ativo, ancorado em ${topDim}.`,
    "Latente": `${sectorName} é latente — há condições parciais, principalmente em ${topDim}, mas requer investimento.`,
    "Inexistente": `${sectorName} é inexistente ou marginal no território atual.`,
  };
  return map[maturity] ?? `${sectorName} em avaliação.`;
}

function computeSectors(dimScores: DimScores): SectorResult[] {
  return SECTORS.map(sector => {
    const score = computeSectorScore(sector, dimScores);
    const internalScore = Math.round(score * 100) / 100;
    const maturity = classifyMaturity(internalScore);

    // Encontra dimensão de maior contribuição para narrativa
    const topDimEntry = Object.entries(sector.dimensionContribution)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
    const topDim = topDimEntry ? topDimEntry[0] : "D?";

    const signals = Object.entries(sector.dimensionContribution).map(
      ([dim, w]) => `${dim} (peso ${w}) → score ${dimScores[dim as "D1"] ?? "n/d"}`
    );

    return {
      sectorId: sector.id,
      name: sector.name,
      maturity,
      maturityNote: `${maturity} — score interno ${internalScore.toFixed(1)}`,
      internalScore,
      insight: buildSectorInsight(sector.name, maturity, topDim),
      signals,
    };
  });
}

export async function runStrategicLayer(
  ctx: TerritoryStrategicContext,
  dimScores: DimScores
): Promise<StrategicLayerResult> {
  log.info({ territory: ctx.name, state: ctx.state }, "Strategic layer iniciado");

  // Execução paralela das três frentes externas + cases
  const [resources, osmHotspots, strategicCases] = await Promise.all([
    collectResources(ctx),
    collectOsmHotspots(ctx),
    runAllCases(ctx),
  ]);

  // Setores são puramente derivados — não precisam ser async
  const sectors = computeSectors(dimScores);

  // Consolida todos hotspots (OSM + cases) para o mapa unificado do frontend
  const caseHotspots: Hotspot[] = strategicCases.flatMap(c => c.hotspots);
  const allHotspots: Hotspot[] = [...caseHotspots, ...osmHotspots];

  log.info(
    {
      territory: ctx.name,
      sectors: sectors.length,
      resources: resources.length,
      hotspots: allHotspots.length,
      cases: strategicCases.length,
    },
    "Strategic layer concluído"
  );

  return {
    sectors,
    resources,
    hotspots: allHotspots,
    strategicCases,
    completedAt: new Date().toISOString(),
  };
}
