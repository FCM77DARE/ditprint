/**
 * src-youtube-territorio — YouTube Data API v3 (search)
 *
 * Vídeos publicados mencionando o território. Usa a API oficial do YouTube
 * para coletar conteúdo audiovisual relevante (canais regionais, jornalismo
 * em vídeo, reportagens). Filtra por região BR + idioma pt e valida match
 * geográfico pós-fetch para descartar homônimos.
 * Dimension: D6 (Reputação) — Indicador 6.1.3.x (Engajamento / repercussão).
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory, stateName } from "../../geo-filter";

const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

export class SrcYoutubeTerritorio extends BaseSourceAgent {
  readonly id: SourceId = "src-youtube-territorio";
  readonly dimension: DimensionId = "D6";
  readonly name = "YouTube Data API (Território)";
  readonly cacheTtlMs = 24 * 60 * 60 * 1000; // 24h

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      this.log.debug("YOUTUBE_API_KEY not set, skipping");
      return [];
    }

    const sinceIso = options.dateStart ? toIsoDate(options.dateStart) : undefined;
    const untilIso = options.dateEnd ? toIsoDate(options.dateEnd) : undefined;
    const publishedAfter = sinceIso ? `${sinceIso}T00:00:00Z` : undefined;
    const publishedBefore = untilIso ? `${untilIso}T23:59:59Z` : undefined;

    const query = enrichGeoQuery(territory.name, territory);
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      regionCode: "BR",
      relevanceLanguage: "pt",
      order: "date",
      maxResults: "20",
      q: query,
      key: apiKey,
    });
    if (publishedAfter) params.set("publishedAfter", publishedAfter);
    if (publishedBefore) params.set("publishedBefore", publishedBefore);

    const signals: RawSignal[] = [];

    try {
      const res = await fetch(`${YT_SEARCH_URL}?${params.toString()}`, {
        signal: options.signal,
      });
      if (!res.ok) {
        this.log.debug({ status: res.status }, "YouTube API non-OK response");
        return [];
      }
      const data = (await res.json()) as YoutubeSearchResponse;
      const items = data.items ?? [];

      for (const item of items) {
        if (!item?.id?.videoId || !item.snippet) continue;
        const snippet = item.snippet;
        const combinedText = `${snippet.title ?? ""} ${snippet.description ?? ""}`;
        if (!matchesTerritory(combinedText, territory)) continue;

        signals.push({
          title: `${snippet.title ?? "(sem título)"} (canal: ${snippet.channelTitle ?? "desconhecido"})`,
          summary: snippet.description ?? "",
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : new Date(),
          sourceAgentId: this.id,
          metadata: {
            channelId: snippet.channelId,
            channelTitle: snippet.channelTitle,
            videoId: item.id.videoId,
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

/** Converte "MM/DD/YYYY" → "YYYY-MM-DD". */
function toIsoDate(usDate: string): string {
  const [mm, dd, yyyy] = usDate.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

interface YoutubeSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelId?: string;
      channelTitle?: string;
      publishedAt?: string;
    };
  }>;
}
