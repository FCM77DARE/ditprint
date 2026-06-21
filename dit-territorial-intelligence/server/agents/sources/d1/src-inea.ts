/**
 * src-inea — INEA (RJ) via SerpAPI (Google)
 *
 * Específico para territórios fluminenses. Detecta RJ via state ou
 * código IBGE (33xxxxx). Substitui stub por busca real via SerpAPI.
 * Dimension: D1 (Ambiental).
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";

export class SrcInea extends BaseSourceAgent {
  readonly id: SourceId = "src-inea";
  readonly dimension: DimensionId = "D1";
  readonly name = "INEA - Instituto Estadual do Ambiente (RJ)";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    // INEA é específico para o Rio de Janeiro.
    const ctx = territory.contextData as Record<string, unknown> | null;
    const ibgeMunicipios = (ctx?.ibgeMunicipios as string[] | undefined) ?? [];
    const isRJ =
      territory.state === "RJ" ||
      ibgeMunicipios.some((code) => typeof code === "string" && code.startsWith("33"));
    if (!isRJ) return [];

    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    const signals: RawSignal[] = [];
    const query = enrichGeoQuery(`INEA`, territory);

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
