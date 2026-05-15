/**
 * src-universidades — Semantic Scholar API
 * 
 * Fetches academic articles and university papers related to the territory.
 * Dimension: D6 (Reputação / Conhecimento)
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";

const ACADEMIC_DOMAINS = [
  "scielo.br",
  "usp.br",
  "unicamp.br",
  "unesp.br",
  "ufrj.br",
  "ufba.br",
  "ufmg.br",
  "periodicos.capes.gov.br",
  "repositorio.unb.br"
];

const RSS_BASE = "https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-BR&q=";

export class SrcUniversidades extends BaseSourceAgent {
  readonly id: SourceId = "src-universidades";
  readonly dimension: DimensionId = "D6";
  readonly name = "Universidades & Artigos (RSS Acadêmico)";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    
    // Constrói a query com filtros de domínio acadêmico
    const domainFilter = ACADEMIC_DOMAINS.map(d => `site:${d}`).join(" OR ");
    const fullQuery = `(${domainFilter}) "${territory.name}"`;
    
    try {
      const url = `${RSS_BASE}${encodeURIComponent(fullQuery)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        signal: options.signal,
      });

      if (!res.ok) return [];

      const xml = await res.text();
      const items = this.parseRssItems(xml);

      for (const item of items) {
        signals.push({
          title: item.title,
          summary: item.description,
          url: item.link,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          sourceAgentId: this.id,
          metadata: { 
            isAcademic: true,
            query: fullQuery
          },
        });
      }
    } catch (err) {
      console.error(`[SrcUniversidades] Erro ao buscar via RSS para ${territory.name}:`, err);
    }

    return signals;
  }

  private parseRssItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
    const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
    const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g));

    for (const match of itemMatches) {
      const block = match[1];
      const title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim();
      const description = (block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
      const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "").trim();

      if (title && link) items.push({ title, link, description, pubDate });
    }
    return items;
  }
}
