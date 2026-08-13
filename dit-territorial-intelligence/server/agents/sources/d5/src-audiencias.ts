/**
 * src-audiencias — Audiências Públicas / Vídeos do Legislativo
 *
 * Fonte oficial primária: YouTube Data API v3 (chave gratuita YOUTUBE_API_KEY).
 * Buscamos vídeos de audiências públicas / câmaras municipais do território
 * publicados nos últimos 24 meses.
 *
 * SerpAPI é fallback quando a quota YouTube estoura.
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";
import axios from "axios";

interface YoutubeSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    channelTitle?: string;
  };
}

export class SrcAudiencias extends BaseSourceAgent {
  readonly id: SourceId = "src-audiencias";
  readonly dimension: DimensionId = "D5";
  readonly name = "Audiências Públicas (Legislativo)";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // ── YouTube Data API v3 (primária) ──
    signals.push(...(await this.fetchYoutube(territory, options)));

    // ── Fallback SerpAPI ──
    if (signals.length === 0) {
      signals.push(...(await this.fetchSerpapiFallback(territory, options)));
    }

    return signals;
  }

  private async fetchYoutube(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const YT_KEY = process.env.YOUTUBE_API_KEY ?? "";
    if (!YT_KEY) return [];

    const signals: RawSignal[] = [];
    // Data mínima: 24 meses atrás
    const publishedAfter = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString();
    const q = `audiência pública "${territory.name}" ${territory.state || ""} câmara municipal`;

    const url =
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
      `&q=${encodeURIComponent(q)}&order=date&maxResults=10&publishedAfter=${publishedAfter}` +
      `&key=${YT_KEY}`;

    try {
      const res = await axios.get(url, {
        signal: options.signal,
        timeout: 12000,
        headers: { "User-Agent": "DIT-PRINT/1.0" },
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200 || !res.data) return signals;
      const payload = res.data as { items?: YoutubeSearchItem[] };
      const items = payload.items ?? [];

      for (const it of items) {
        const title = it.snippet?.title ?? "";
        const desc = it.snippet?.description ?? "";
        const combined = `${title} ${desc}`;
        if (!matchesTerritory(combined, territory)) continue;
        const vid = it.id?.videoId;
        if (!vid) continue;

        signals.push({
          title: `YouTube · ${title.slice(0, 140)}`,
          summary: `Vídeo do canal "${it.snippet?.channelTitle ?? "n/d"}" identificado como audiência pública ou sessão do legislativo. ${desc.slice(0, 220)}`,
          url: `https://www.youtube.com/watch?v=${vid}`,
          sourceAgentId: this.id,
          publishedAt: it.snippet?.publishedAt ? new Date(it.snippet.publishedAt) : new Date(),
          rawValue: 0.6,
          metadata: {
            videoId: vid,
            channel: it.snippet?.channelTitle,
            source: "youtube-api-oficial",
          },
        });
      }
    } catch (err) {
      this.log.warn({ err: (err as Error).message }, "YouTube API falhou (Audiências)");
    }

    return signals;
  }

  private async fetchSerpapiFallback(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];
    const signals: RawSignal[] = [];
    const searchString = enrichGeoQuery(
      `site:youtube.com (audiência pública OR câmara municipal OR sessão ordinária)`,
      territory
    );
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchString)}&num=5&api_key=${SERPAPI_KEY}`;
    try {
      const data = (await serpapiCachedFetch(url, options.signal)) as
        | { organic_results?: Array<{ title: string; snippet?: string; link: string }> }
        | null;
      if (!data) return signals;
      for (const item of data.organic_results ?? []) {
        const combined = `${item.title ?? ""} ${item.snippet ?? ""}`;
        if (!matchesTerritory(combined, territory)) continue;
        signals.push({
          title: `Audiência: ${item.title}`,
          summary: item.snippet ?? "",
          url: item.link,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          metadata: { source: "serpapi-fallback" },
        });
      }
    } catch {
      // ignore
    }
    return signals;
  }
}
