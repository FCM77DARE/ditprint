/**
 * src-geni-uff — GENI/UFF · Grupo de Estudos dos Novos Ilegalismos
 *
 * GENI publica boletins territoriais de violência armada, milícias e grupos
 * armados. Não há API estruturada pública, então:
 *
 *   1) Tenta feed RSS do observatório (geni.uff.br/feed)
 *   2) Tenta scrape leve do índice de publicações
 *   3) Fallback SerpAPI restrito ao domínio geni.uff.br
 *
 * NOTA: GENI é primariamente sobre RJ/BA/SP metropolitanos. Fora dessas UFs
 * é normal retornar vazio — não é erro.
 */

import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import { enrichGeoQuery, matchesTerritory, fold } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";
import axios from "axios";

// UFs com cobertura conhecida da GENI (todo o resto vira baseline vazio)
const GENI_COVERED_UFS = new Set(["RJ", "SP", "BA", "PE", "PA", "CE"]);

export class SrcGeniUff extends BaseSourceAgent {
  readonly id = "src-geni-uff";
  readonly dimension = "D4";
  readonly name = "Grupo de Estudos dos Novos Ilegalismos (GENI/UFF)";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const uf = (territory.state || "").toUpperCase();

    // Fora das UFs cobertas, sinal baseline explicando ausência
    if (uf && !GENI_COVERED_UFS.has(uf)) {
      signals.push({
        title: `GENI/UFF · Cobertura territorial fora do escopo (${uf})`,
        summary: `Observatório GENI/UFF concentra estudos em RJ, SP, BA, PE, PA, CE. ${territory.name}/${uf} não está no escopo atual do observatório — ausência de sinais aqui não indica ausência de fenômeno no território.`,
        url: "https://geni.uff.br/",
        sourceAgentId: this.id,
        publishedAt: new Date(),
        rawValue: 0,
        metadata: { uf, source: "geni-baseline-fora-escopo" },
      });
      return signals;
    }

    // ── 1) Tenta feed RSS do observatório ──
    try {
      const res = await axios.get("https://geni.uff.br/feed/", {
        signal: options.signal,
        timeout: 12000,
        headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/rss+xml, application/xml" },
        validateStatus: (s) => s < 500,
      });
      if (res.status === 200 && typeof res.data === "string") {
        // Parse XML minimalista — extrai <item><title>, <link>, <description>, <pubDate>
        const items = Array.from(
          res.data.matchAll(/<item>([\s\S]*?)<\/item>/g)
        ).slice(0, 20);
        const munFold = fold(territory.name || "");

        for (const [, itemXml] of items) {
          const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(itemXml)?.[1] ?? "";
          const link = /<link>([\s\S]*?)<\/link>/.exec(itemXml)?.[1] ?? "";
          const desc = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(itemXml)?.[1] ?? "";
          const pubDate = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemXml)?.[1] ?? "";
          const combined = fold(`${title} ${desc}`);
          if (!munFold || !combined.includes(munFold)) continue;

          signals.push({
            title: `GENI/UFF · ${title.slice(0, 140)}`,
            summary: desc.replace(/<[^>]+>/g, "").slice(0, 320),
            url: link.trim() || "https://geni.uff.br/",
            sourceAgentId: this.id,
            publishedAt: pubDate ? new Date(pubDate) : new Date(),
            rawValue: 0.75,
            metadata: { source: "geni-rss-oficial" },
          });
        }
      }
    } catch {
      // silencioso
    }

    // ── Fallback SerpAPI se RSS não retornou nada ──
    if (signals.length === 0) {
      signals.push(...(await this.fetchSerpapiFallback(territory, options)));
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
    const searchString = enrichGeoQuery(`site:geni.uff.br OR site:uff.br violência OR milícia OR "grupos armados"`, territory);
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchString)}&num=3&api_key=${SERPAPI_KEY}`;
    try {
      const data = (await serpapiCachedFetch(url, options.signal)) as
        | { organic_results?: Array<{ title: string; snippet?: string; link: string }> }
        | null;
      if (!data) return signals;
      for (const item of data.organic_results ?? []) {
        const combined = `${item.title ?? ""} ${item.snippet ?? ""}`;
        if (!matchesTerritory(combined, territory)) continue;
        signals.push({
          title: `GENI: ${item.title}`,
          summary: item.snippet,
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
