import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

export class SrcCptecInpe extends BaseSourceAgent {
  readonly id = "src-cptec-inpe";
  readonly dimension = "D1";
  readonly name = "CPTEC/INPE - Previsão Climática Estendida";

    protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    const signals: RawSignal[] = [];
    const query = territory.name;
    const searchString = `site:cptec.inpe.br OR site:inpe.br "${query}"`;
    
    let tbs = "";
    if (options.dateStart && options.dateEnd) {
      tbs = `&tbs=cdr:1,cd_min:${options.dateStart},cd_max:${options.dateEnd}`;
    }
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchString)}&num=3${tbs}&api_key=${SERPAPI_KEY}`;

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
          metadata: { query }
        });
      }
    } catch {
      // ignore
    }

    return signals;
  }
}
