/**
 * src-reddit-br — Reddit JSON public search
 *
 * Posts do Reddit mencionando o território, com foco em subreddits brasileiros
 * (r/brasil + r/<UF>). Faz duas buscas: aberta com nome+UF e restrita a r/brasil.
 * Reddit é sensível a User-Agent — tolera 429/403 retornando [] silenciosamente.
 * Dimension: D6 (Reputação) — Indicador 6.1.3.x (Engajamento em redes sociais).
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory, stateName } from "../../geo-filter";

const REDDIT_SEARCH_URL = "https://www.reddit.com/search.json";
const REDDIT_UA = "DIT-PRINT/1.0 (territorial intelligence)";

export class SrcRedditBr extends BaseSourceAgent {
  readonly id: SourceId = "src-reddit-br";
  readonly dimension: DimensionId = "D6";
  readonly name = "Reddit BR Search";
  readonly cacheTtlMs = 12 * 60 * 60 * 1000; // 12h

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const sinceIso = options.dateStart ? toIsoDate(options.dateStart) : undefined;
    const untilIso = options.dateEnd ? toIsoDate(options.dateEnd) : undefined;
    const sinceDate = sinceIso ? new Date(sinceIso) : null;
    const untilDate = untilIso ? new Date(untilIso) : null;

    const uf = (territory.state ?? "").toUpperCase();
    const ufLower = uf.toLowerCase();

    // Query (a): busca aberta com nome + UF + Brasil
    const openQuery = enrichGeoQuery(territory.name, territory);
    // Query (b): restringe a r/brasil + r/<UF>
    const subredditFilter = uf
      ? `(subreddit:brasil OR subreddit:${ufLower})`
      : `subreddit:brasil`;
    const restrictedQuery = `${territory.name} ${subredditFilter}`;

    const queries = [openQuery, restrictedQuery];
    const signals: RawSignal[] = [];

    for (const q of queries) {
      try {
        const params = new URLSearchParams({
          q,
          sort: "new",
          t: "year",
          limit: "25",
          restrict_sr: "off",
        });
        const res = await fetch(`${REDDIT_SEARCH_URL}?${params.toString()}`, {
          headers: { "User-Agent": REDDIT_UA, "Accept": "application/json" },
          signal: options.signal,
        });
        // Tolera rate-limit / UA block silenciosamente
        if (res.status === 429 || res.status === 403) continue;
        if (!res.ok) continue;

        const data = (await res.json()) as RedditSearchResponse;
        const children = data?.data?.children ?? [];

        for (const child of children) {
          const d = child?.data;
          if (!d?.permalink || !d?.title) continue;

          const text = `${d.title} ${d.selftext ?? ""}`;
          if (!matchesTerritory(text, territory)) continue;

          const published = d.created_utc
            ? new Date(d.created_utc * 1000)
            : new Date();
          if (sinceDate && published < sinceDate) continue;
          if (untilDate && published > untilDate) continue;

          signals.push({
            title: `r/${d.subreddit ?? "?"}: ${d.title}`,
            summary: (d.selftext ?? "").slice(0, 300),
            url: `https://reddit.com${d.permalink}`,
            publishedAt: published,
            sourceAgentId: this.id,
            metadata: {
              subreddit: d.subreddit,
              score: d.ups,
              numComments: d.num_comments,
              author: d.author,
              query: q,
              state: stateName(territory.state),
            },
          });
        }
      } catch {
        continue;
      }
    }

    // Dedup por URL
    const seen = new Set<string>();
    return signals.filter((s) => {
      if (!s.url || seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
  }
}

/** Converte "MM/DD/YYYY" → "YYYY-MM-DD". */
function toIsoDate(usDate: string): string {
  const [mm, dd, yyyy] = usDate.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

interface RedditSearchResponse {
  data?: {
    children?: Array<{
      data?: {
        title?: string;
        selftext?: string;
        permalink?: string;
        subreddit?: string;
        ups?: number;
        num_comments?: number;
        author?: string;
        created_utc?: number;
      };
    }>;
  };
}
