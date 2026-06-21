/**
 * src-inpe-deter — INPE / DETER via SerpAPI (Google) — fallback
 *
 * O WFS oficial do TerraBrasilis é instável; usamos SerpAPI como
 * proxy para capturar notícias e relatórios públicos de DETER.
 * Modelado em src-mp-ambiental.ts.
 * Dimension: D1 (Ambiental).
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";

export class SrcInpeDeter extends BaseSourceAgent {
  readonly id: SourceId = "src-inpe-deter";
  readonly dimension: DimensionId = "D1";
  readonly name = "INPE - TerraBrasilis (Alertas DETER)";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    const signals: RawSignal[] = [];
    const query = enrichGeoQuery(`(desmatamento OR DETER OR INPE)`, territory);

    let tbs = "";
    if (options.dateStart && options.dateEnd) {
      tbs = `&tbs=cdr:1,cd_min:${options.dateStart},cd_max:${options.dateEnd}`;
    }
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=10${tbs}&api_key=${SERPAPI_KEY}`;

    try {
      const data = (await serpapiCachedFetch(url, options.signal)) as
        | { organic_results?: Array<{ title: string; snippet?: string; link: string }> }
        | null;
      if (!data) return [];
      const results = data.organic_results ?? [];

      for (const item of results) {
        const combinedText = `${item.title ?? ""} ${item.snippet ?? ""}`;
        if (!matchesTerritory(combinedText, territory)) continue;
        signals.push({
          title: item.title,
          summary: item.snippet,
          url: item.link,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          metadata: { query },
        });
      }
    } catch {
      return [];
    }

    return signals;
  }
}
