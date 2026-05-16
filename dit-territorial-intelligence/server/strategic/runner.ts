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
import { SECTORS, computeSectorScore, classifyMaturity, type SectorEvidenceCtx } from "./sectors";
import { collectResources } from "./resources";
import { collectOsmHotspots } from "./hotspots/osm-overpass";
import { runAllCases } from "./cases";
import type {
  Hotspot,
  Resource,
  SectorResult,
  StrategicCaseResult,
  StrategicLayerResult,
  TerritoryStrategicContext,
} from "./types";

const log = logger.child({ module: "strategic.runner" });

type DimScores = Partial<Record<"D1" | "D2" | "D3" | "D4" | "D5" | "D6", number>>;

// 26 capitais brasileiras + DF (IBGE IDs)
const CAPITAL_IBGE_IDS = new Set<number>([
  1200401, 1302603, 1400100, 1501402, 1600303, 1721000, 2111300, 2211001,
  2304400, 2408102, 2507507, 2611606, 2704302, 2800308, 2927408, 3106200,
  3205309, 3304557, 3550308, 4106902, 4205407, 4314902, 5002704, 5103403,
  5208707, 5300108,
]);

function describeEvidence(
  sectorId: string,
  resources: Resource[],
  cases: StrategicCaseResult[]
): string[] {
  const out: string[] = [];
  const matchRes = resources.filter(r => {
    if (sectorId === "S2") return r.category === "agricolas" || r.category === "minerais";
    if (sectorId === "S4")
      return r.category === "hidricos" || r.category === "florestais" || r.category === "ambientais";
    if (sectorId === "S5") return r.category === "energeticos";
    if (sectorId === "S1") return r.category === "minerais";
    return false;
  });
  for (const r of matchRes.slice(0, 3)) {
    out.push(`${r.name} (${r.abundance})`);
  }
  for (const c of cases) {
    if (sectorId === "S1" && (c.caseId === "TERRAS_RARAS" || c.caseId === "DATA_CENTERS")) {
      out.push(`${c.caseId} → ${c.relevance}`);
    }
    if (sectorId === "S5" && c.caseId === "DATA_CENTERS") {
      out.push(`Hub digital: ${c.relevance}`);
    }
  }
  return out;
}

function buildSectorInsight(
  sectorName: string,
  maturity: string,
  evidence: string[]
): string {
  const evidenceStr = evidence.length > 0 ? ` Sinais: ${evidence.join("; ")}.` : "";
  const map: Record<string, string> = {
    "Alta Maturidade": `${sectorName} apresenta alta maturidade no território.${evidenceStr}`,
    "Em Desenvolvimento": `${sectorName} em desenvolvimento ativo.${evidenceStr}`,
    "Latente": `${sectorName} com presença latente — base existe, oportunidades não consolidadas.${evidenceStr}`,
    "Inexistente": `${sectorName} sem evidência relevante neste território.`,
  };
  return map[maturity] ?? `${sectorName} em avaliação.${evidenceStr}`;
}

function computeSectors(
  ctx: TerritoryStrategicContext,
  resources: Resource[],
  cases: StrategicCaseResult[],
  hotspots: Hotspot[]
): SectorResult[] {
  const evidenceCtx: SectorEvidenceCtx = {
    resources,
    cases,
    hotspots,
    isCapital: ctx.ibgeId ? CAPITAL_IBGE_IDS.has(ctx.ibgeId) : false,
    hasIbge: !!ctx.ibgeId,
  };

  return SECTORS.map(sector => {
    const score = computeSectorScore(sector, evidenceCtx);
    const maturity = classifyMaturity(score);
    const evidence = describeEvidence(sector.id, resources, cases);

    return {
      sectorId: sector.id,
      name: sector.name,
      maturity,
      maturityNote: `${maturity} — score evidencial ${score}`,
      internalScore: score,
      insight: buildSectorInsight(sector.name, maturity, evidence),
      signals: evidence,
    };
  });
}

export async function runStrategicLayer(
  ctx: TerritoryStrategicContext,
  _dimScores: DimScores
): Promise<StrategicLayerResult> {
  log.info({ territory: ctx.name, state: ctx.state }, "Strategic layer iniciado");

  // Execução paralela das três frentes externas + cases
  const [resources, osmHotspots, strategicCases] = await Promise.all([
    collectResources(ctx),
    collectOsmHotspots(ctx),
    runAllCases(ctx),
  ]);

  // Casos estratégicos: só os que realmente se aplicam ao território.
  // "NÃO APLICÁVEL" é noise — escondemos para não diluir o sinal.
  const relevantCases = strategicCases.filter(c => c.relevance !== "NÃO APLICÁVEL");

  // Consolida todos hotspots (OSM + cases relevantes) para o mapa unificado
  const caseHotspots: Hotspot[] = relevantCases.flatMap(c => c.hotspots);
  const allHotspots: Hotspot[] = [...caseHotspots, ...osmHotspots];

  // Setores agora derivam de EVIDÊNCIA (recursos + casos + hotspots), não de STT.
  // Mantemos todos os 6 sectorIds, mas filtramos os realmente "Inexistente"
  // (sem nenhuma evidência) pra não mostrar boilerplate.
  const sectors = computeSectors(ctx, resources, relevantCases, allHotspots).filter(
    s => s.maturity !== "Inexistente"
  );

  log.info(
    {
      territory: ctx.name,
      sectorsVisible: sectors.length,
      sectorsFiltered: 6 - sectors.length,
      resources: resources.length,
      hotspots: allHotspots.length,
      casesVisible: relevantCases.length,
      casesFiltered: strategicCases.length - relevantCases.length,
    },
    "Strategic layer concluído"
  );

  return {
    sectors,
    resources,
    hotspots: allHotspots,
    strategicCases: relevantCases,
    completedAt: new Date().toISOString(),
  };
}
