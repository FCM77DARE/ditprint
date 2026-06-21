import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import { enrichGeoQuery, matchesTerritory } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";

export class SrcIbgeMapbiomas extends BaseSourceAgent {
  readonly id = "src-ibge-mapbiomas";
  readonly dimension = "D1";
  readonly name = "IBGE/MapBiomas - Uso e Ocupação do Solo";

    protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    const signals: RawSignal[] = [];
    const query = territory.name;
    const searchString = enrichGeoQuery(`site:mapbiomas.org OR site:ibge.gov.br`, territory);
    
    let tbs = "";
    if (options.dateStart && options.dateEnd) {
      tbs = `&tbs=cdr:1,cd_min:${options.dateStart},cd_max:${options.dateEnd}`;
    }
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchString)}&num=3${tbs}&api_key=${SERPAPI_KEY}`;

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
          metadata: { query }
        });
      }
    } catch {
      // ignore
    }

    return signals;
  }
}
