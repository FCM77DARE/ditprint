/**
 * src-redes-sociais — Engajamento em redes sociais
 *
 * APIs oficiais (Instagram/Twitter/TikTok) exigem auth pesada.
 * Estratégia pragmática:
 *   - Plano A: Apify (apify/google-search-scraper) quando APIFY_API_TOKEN existir.
 *   - Plano B: SerpAPI engine=google restrita aos domínios das redes.
 *
 * Dimensão: D6 (Reputação).
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN ?? "";

export class SrcRedesSociais extends BaseSourceAgent {
  readonly id: SourceId = "src-redes-sociais";
  readonly dimension: DimensionId = "D6";
  readonly name = "Engajamento em Redes Sociais";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const query = territory.name;
    const searchString = `(site:twitter.com OR site:x.com OR site:instagram.com OR site:tiktok.com) "${query}"`;

    if (APIFY_TOKEN) {
      const apify = await this.collectViaApify(searchString, query, options);
      if (apify.length > 0) return apify;
    }

    return this.collectViaSerpApi(searchString, query, options);
  }

  private async collectViaApify(
    searchString: string,
    query: string,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    try {
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${APIFY_TOKEN}&waitForFinish=60`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queries: [searchString],
            resultsPerPage: 10,
            countryCode: "br",
          }),
          signal: options.signal,
        }
      );

      if (!runRes.ok) return [];

      const runData = (await runRes.json()) as { data?: { defaultDatasetId?: string } };
      const datasetId = runData.data?.defaultDatasetId;
      if (!datasetId) return [];

      const datasetRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`,
        { signal: options.signal }
      );
      if (!datasetRes.ok) return [];

      const items = (await datasetRes.json()) as Array<{
        organicResults?: Array<{ title: string; url: string; description: string }>;
      }>;

      const signals: RawSignal[] = [];
      for (const item of items) {
        for (const result of item.organicResults ?? []) {
          signals.push({
            title: `Redes Sociais: ${result.title}`,
            summary: result.description,
            url: result.url,
            publishedAt: new Date(),
            sourceAgentId: this.id,
            metadata: { query, engine: "apify:google-search-scraper" },
          });
        }
      }
      return signals;
    } catch (err) {
      this.log.error({ err }, "Erro na coleta Apify (Redes Sociais)");
      return [];
    }
  }

  private async collectViaSerpApi(
    searchString: string,
    query: string,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    let tbs = "";
    if (options.dateStart && options.dateEnd) {
      tbs = `&tbs=cdr:1,cd_min:${options.dateStart},cd_max:${options.dateEnd}`;
    }
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchString)}&num=10${tbs}&api_key=${SERPAPI_KEY}`;

    const signals: RawSignal[] = [];
    try {
      const res = await fetch(url, { signal: options.signal });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        organic_results?: Array<{ title: string; snippet?: string; link: string }>;
      };
      const results = data.organic_results ?? [];

      for (const item of results) {
        signals.push({
          title: `Redes Sociais: ${item.title}`,
          summary: item.snippet ?? "",
          url: item.link,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          metadata: { query, engine: "serpapi:google" },
        });
      }
    } catch (err) {
      this.log.error({ err }, "Erro na coleta SerpAPI (Redes Sociais)");
    }

    return signals;
  }
}
