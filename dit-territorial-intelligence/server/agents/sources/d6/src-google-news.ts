/**
 * src-google-news — Google News RSS
 *
 * News articles mentioning the territory. The existing RSS collection
 * logic in collector.ts is the production implementation; this agent
 * wraps it for compatibility with the agent framework.
 * Dimension: D6 (Reputação) — Indicador 6.1.1.2
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory, stateName } from "../../geo-filter";

// Google News RSS base URL
const GNEWS_BASE = "https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-BR&q=";

export class SrcGoogleNews extends BaseSourceAgent {
  readonly id: SourceId = "src-google-news";
  readonly dimension: DimensionId = "D6";
  readonly name = "Google News RSS";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const ctx = territory.contextData as Record<string, unknown> | null;
    const queries = (ctx?.rssQueries as string[]) ?? [territory.name];

    const signals: RawSignal[] = [];

    // Janela temporal T-24mo → T (Google News RSS aceita after:/before: como query op).
    const sinceIso = options.dateStart ? toIso(options.dateStart) : undefined;
    const untilIso = options.dateEnd ? toIso(options.dateEnd) : undefined;
    const sinceDate = sinceIso ? new Date(sinceIso) : null;
    const untilDate = untilIso ? new Date(untilIso) : null;
    const dateOp =
      sinceIso && untilIso ? ` after:${sinceIso} before:${untilIso}` : "";

    for (const rawQuery of queries.slice(0, 5)) {
      try {
        // FILTRO GEOGRÁFICO: força UF + "Brasil" na query — evita homônimos
        // (ex: "Cairu" puro retorna cooperativa Cairu/RS; "São João" rebate
        // em São João del Rei/MG). Ver server/agents/geo-filter.ts.
        const base = rawQuery.toLowerCase().includes(territory.name.toLowerCase())
          ? rawQuery
          : `${rawQuery} ${territory.name}`;
        const query = enrichGeoQuery(base, territory) + dateOp;

        const url = `${GNEWS_BASE}${encodeURIComponent(query)}&num=10`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
          signal: options.signal,
        });
        if (!res.ok) continue;

        const xml = await res.text();
        const items = parseRssItems(xml);

        for (const item of items) {
          const published = item.pubDate ? new Date(item.pubDate) : new Date();
          // Filtro client-side: descarta itens fora da janela T-24mo
          if (sinceDate && published < sinceDate) continue;
          if (untilDate && published > untilDate) continue;
          // VALIDAÇÃO DE MATCH: descarta o item se nem título nem descrição
          // mencionam o município ou a UF — significa que o motor entregou
          // homônimo / fragmento parcial.
          const combinedText = `${item.title} ${item.description}`;
          if (!matchesTerritory(combinedText, territory)) continue;
          signals.push({
            title: item.title,
            summary: item.description,
            url: item.link,
            publishedAt: published,
            sourceAgentId: this.id,
            metadata: { query, state: stateName(territory.state) },
          });
        }
      } catch {
        continue;
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    return signals.filter((s) => {
      if (!s.url || seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
  }
}

/** Converte "MM/DD/YYYY" → "YYYY-MM-DD". */
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
      .replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim();
    const description = (block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "")
      .replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "").trim();

    if (title && link) items.push({ title, link, description, pubDate });
  }

  return items;
}
