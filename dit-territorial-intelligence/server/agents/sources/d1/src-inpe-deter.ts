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
    const query = `(desmatamento OR DETER OR INPE) ${territory.name}`;

    let tbs = "";
    if (options.dateStart && options.dateEnd) {
      tbs = `&tbs=cdr:1,cd_min:${options.dateStart},cd_max:${options.dateEnd}`;
    }
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=10${tbs}&api_key=${SERPAPI_KEY}`;

    try {
      const res = await fetch(url, { signal: options.signal });
      if (!res.ok) return [];

      const data = await res.json();
      const results = data.organic_results ?? [];

      for (const item of results) {
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
