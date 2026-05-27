/**
 * src-audiencias — Audiências Públicas / Vídeos do Legislativo
 *
 * Coleta vídeos no YouTube de audiências públicas e sessões da câmara
 * municipal do território. Dimensão: D5 (Governança).
 *
 * Implementation: SerpAPI (engine=google) com query restrita a youtube.com.
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory } from "../../geo-filter";

export class SrcAudiencias extends BaseSourceAgent {
  readonly id: SourceId = "src-audiencias";
  readonly dimension: DimensionId = "D5";
  readonly name = "Audiências Públicas (Legislativo)";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    const signals: RawSignal[] = [];
    const query = territory.name;
    const searchString = enrichGeoQuery(`site:youtube.com (audiência pública OR câmara municipal)`, territory);

    let tbs = "";
    if (options.dateStart && options.dateEnd) {
      tbs = `&tbs=cdr:1,cd_min:${options.dateStart},cd_max:${options.dateEnd}`;
    }
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchString)}&num=5${tbs}&api_key=${SERPAPI_KEY}`;

    try {
      const res = await fetch(url, { signal: options.signal });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        organic_results?: Array<{ title: string; snippet?: string; link: string }>;
      };
      const results = data.organic_results ?? [];

      for (const item of results) {
        const combinedText = `${item.title ?? ""} ${item.snippet ?? ""}`;
        if (!matchesTerritory(combinedText, territory)) continue;
        signals.push({
          title: item.title,
          summary: item.snippet ?? "",
          url: item.link,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          metadata: { query, engine: "serpapi:google", scope: "youtube" },
        });
      }
    } catch (err) {
      this.log.error({ err }, "Erro na coleta SerpAPI (Audiências)");
    }

    return signals;
  }
}
