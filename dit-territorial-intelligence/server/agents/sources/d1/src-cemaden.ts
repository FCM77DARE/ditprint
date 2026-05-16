/**
 * src-cemaden — CEMADEN via Google News RSS
 *
 * Substituímos o stub Math.random() por busca real no Google News RSS,
 * modelado em src-google-news.ts. Filtra pubDate client-side dentro
 * da janela options.dateStart / options.dateEnd.
 * Dimension: D1 (Ambiental).
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";

const GNEWS_BASE = "https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-BR&q=";

export class SrcCemaden extends BaseSourceAgent {
  readonly id: SourceId = "src-cemaden";
  readonly dimension: DimensionId = "D1";
  readonly name = "CEMADEN - Centro Nacional de Monitoramento e Alertas de Desastres Naturais";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    const sinceIso = options.dateStart ? toIso(options.dateStart) : undefined;
    const untilIso = options.dateEnd ? toIso(options.dateEnd) : undefined;
    const sinceDate = sinceIso ? new Date(sinceIso) : null;
    const untilDate = untilIso ? new Date(untilIso) : null;
    const dateOp =
      sinceIso && untilIso ? ` after:${sinceIso} before:${untilIso}` : "";

    const query = `CEMADEN ${territory.name} alerta OR enchente OR deslizamento${dateOp}`;
    const url = `${GNEWS_BASE}${encodeURIComponent(query)}&num=10`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: options.signal,
      });
      if (!res.ok) return [];

      const xml = await res.text();
      const items = parseRssItems(xml);

      for (const item of items) {
        const published = item.pubDate ? new Date(item.pubDate) : new Date();
        if (sinceDate && published < sinceDate) continue;
        if (untilDate && published > untilDate) continue;
        signals.push({
          title: item.title,
          summary: item.description,
          url: item.link,
          publishedAt: published,
          sourceAgentId: this.id,
          metadata: { query },
        });
      }
    } catch {
      return [];
    }

    const seen = new Set<string>();
    return signals.filter((s) => {
      if (!s.url || seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
  }
}

function toIso(usDate: string): string {
  const [mm, dd, yyyy] = usDate.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

function parseRssItems(xml: string): Array<{
  title: string;
  link: string;
  description: string;
  pubDate: string;
}> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g));

  for (const match of itemMatches) {
    const block = match[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "")
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim();
    const description = (block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "")
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "").trim();

    if (title && link) items.push({ title, link, description, pubDate });
  }

  return items;
}
