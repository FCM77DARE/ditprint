/**
 * src-orcamento-participativo — Orçamento Participativo / LOA / LDO / PPA
 *
 * Fonte oficial primária: Querido Diário API — indexa Diários Oficiais
 * municipais de +2.500 cidades brasileiras. Busca full-text por
 * "orçamento participativo", "PPA", "LOA", "prestação de contas".
 *
 * SerpAPI é fallback.
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";
import axios from "axios";

interface QdGazette {
  territory_id?: string;
  territory_name?: string;
  state_code?: string;
  date?: string;
  edition_number?: string;
  url?: string;
  excerpts?: string[];
  scraped_at?: string;
}

const QD_API = "https://queridodiario.ok.org.br/api/gazettes";

export class SrcOrcamentoParticipativo extends BaseSourceAgent {
  readonly id: SourceId = "src-orcamento-participativo";
  readonly dimension: DimensionId = "D5";
  readonly name = "Orçamento Participativo / LOA / LDO";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // ── Querido Diário API (primária) ──
    signals.push(...(await this.fetchQueridoDiario(territory, options)));

    // ── Fallback SerpAPI ──
    if (signals.length === 0) {
      signals.push(...(await this.fetchSerpapiFallback(territory, options)));
    }

    return signals;
  }

  private async fetchQueridoDiario(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const ibge = this.getIbgeId(territory);
    if (!ibge) return signals;

    // Query full-text
    const queries = ["orçamento participativo", "plano plurianual PPA", "prestação de contas"];
    // Janela: 24 meses
    const publishedSince = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    for (const q of queries) {
      const params = new URLSearchParams({
        territory_ids: String(ibge),
        querystring: q,
        published_since: publishedSince,
        size: "5",
      });
      const url = `${QD_API}?${params.toString()}`;
      try {
        const res = await axios.get(url, {
          signal: options.signal,
          timeout: 15000,
          headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
          validateStatus: (s) => s < 500,
        });
        if (res.status !== 200 || !res.data) continue;
        const payload = res.data as { gazettes?: QdGazette[]; total_gazettes?: number };
        const items = payload.gazettes ?? [];
        for (const g of items.slice(0, 3)) {
          const excerpt = (g.excerpts ?? []).join(" … ").slice(0, 400);
          signals.push({
            title: `Diário Oficial ${g.territory_name || territory.name} · ${g.date}: menção a "${q}"`,
            summary: excerpt || `Diário Oficial municipal com menção ao termo "${q}". Edição ${g.edition_number || "n/d"}.`,
            url: g.url ?? "https://queridodiario.ok.org.br/",
            sourceAgentId: this.id,
            publishedAt: g.date ? new Date(g.date) : new Date(),
            rawValue: 0.55,
            metadata: {
              termo: q,
              territoryId: ibge,
              edition: g.edition_number,
              source: "querido-diario-api-oficial",
            },
          });
        }
      } catch {
        // silencioso — tenta próximo termo
      }
    }

    return signals;
  }

  private getIbgeId(territory: Territory): number | null {
    const ctx = (territory.contextData ?? null) as Record<string, unknown> | null;
    const raw = ctx?.ibgeId ?? ctx?.ibgeCode ?? territory.ibgeId;
    const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private async fetchSerpapiFallback(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];
    const signals: RawSignal[] = [];
    const searchString = enrichGeoQuery(
      `(orçamento participativo OR "prestação de contas" OR "plano plurianual")`,
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
          title: item.title,
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
