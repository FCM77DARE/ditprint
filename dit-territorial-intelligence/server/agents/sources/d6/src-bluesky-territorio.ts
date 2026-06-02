/**
 * src-bluesky-territorio — Bluesky public AppView (searchPosts)
 *
 * Posts da rede Bluesky mencionando o território. Usa a API pública
 * `app.bsky.feed.searchPosts` (sem autenticação) e valida match geográfico
 * pós-fetch. Fonte mais dinâmica que mídia tradicional — TTL menor (6h).
 * Dimension: D6 (Reputação) — Indicador 6.1.3.x (Engajamento em redes sociais).
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory, stateName } from "../../geo-filter";

const BSKY_SEARCH_URL = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";

export class SrcBlueskyTerritorio extends BaseSourceAgent {
  readonly id: SourceId = "src-bluesky-territorio";
  readonly dimension: DimensionId = "D6";
  readonly name = "Bluesky Public Search";
  readonly cacheTtlMs = 6 * 60 * 60 * 1000; // 6h

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const sinceIso = options.dateStart ? toIsoDateTime(options.dateStart) : undefined;
    const untilIso = options.dateEnd ? toIsoDateTime(options.dateEnd, true) : undefined;
    const sinceDate = sinceIso ? new Date(sinceIso) : null;
    const untilDate = untilIso ? new Date(untilIso) : null;

    const query = enrichGeoQuery(territory.name, territory);
    const params = new URLSearchParams({
      q: query,
      limit: "25",
    });
    if (sinceIso) params.set("since", sinceIso);

    const signals: RawSignal[] = [];

    try {
      const res = await fetch(`${BSKY_SEARCH_URL}?${params.toString()}`, {
        headers: { "Accept": "application/json" },
        signal: options.signal,
      });
      if (!res.ok) return [];

      const data = (await res.json()) as BlueskySearchResponse;
      const posts = data.posts ?? [];

      for (const post of posts) {
        if (!post?.uri || !post.record) continue;
        const text = post.record.text ?? "";
        if (!matchesTerritory(text, territory)) continue;

        const published = post.indexedAt ? new Date(post.indexedAt) : new Date();
        if (sinceDate && published < sinceDate) continue;
        if (untilDate && published > untilDate) continue;

        const handle = post.author?.handle ?? "unknown";
        const postId = post.uri.split("/").pop() ?? "";
        const title = `${text.slice(0, 140)}${text.length > 140 ? "…" : ""} (@${handle})`;

        signals.push({
          title,
          summary: text,
          url: `https://bsky.app/profile/${handle}/post/${postId}`,
          publishedAt: published,
          sourceAgentId: this.id,
          metadata: {
            authorDid: post.author?.did,
            handle,
            displayName: post.author?.displayName,
            likeCount: post.likeCount,
            replyCount: post.replyCount,
            repostCount: post.repostCount,
            state: stateName(territory.state),
          },
        });
      }
    } catch {
      return [];
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

/** Converte "MM/DD/YYYY" → "YYYY-MM-DDTHH:MM:SSZ" ISO. */
function toIsoDateTime(usDate: string, endOfDay = false): string {
  const [mm, dd, yyyy] = usDate.split("/");
  const time = endOfDay ? "23:59:59" : "00:00:00";
  return `${yyyy}-${mm}-${dd}T${time}Z`;
}

interface BlueskySearchResponse {
  posts?: Array<{
    uri?: string;
    indexedAt?: string;
    likeCount?: number;
    replyCount?: number;
    repostCount?: number;
    author?: {
      did?: string;
      handle?: string;
      displayName?: string;
    };
    record?: {
      text?: string;
    };
  }>;
}
