/**
 * Registry de Casos Estratégicos.
 * Adicione novos casos aqui conforme entrarem em produção:
 *   • TERRAS_RARAS    ✅
 *   • DATA_CENTERS    ✅
 *   • HIDROGENIO_VERDE (futuro)
 *   • LITIO           (futuro)
 *   • BIOECONOMIA     (futuro)
 */

import type { StrategicCaseResult, TerritoryStrategicContext } from "../types";
import { analyzeTerrasRaras } from "./terras-raras";
import { analyzeDataCenters } from "./data-centers";

export async function runAllCases(
  ctx: TerritoryStrategicContext
): Promise<StrategicCaseResult[]> {
  const results = await Promise.allSettled([
    analyzeTerrasRaras(ctx),
    analyzeDataCenters(ctx),
  ]);

  const cases: StrategicCaseResult[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") cases.push(r.value);
  }
  return cases;
}
