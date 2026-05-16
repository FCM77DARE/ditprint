/**
 * src-google-trends — Google Trends (via SerpAPI)
 *
 * Search interest volume and trend direction for the territory name.
 * Dimension: D6 (Reputação) — Indicador 6.1.1.1
 *
 * API: https://serpapi.com/google-trends-api
 * Requires: SERPAPI_KEY env var
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";

const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";

export class SrcGoogleTrends extends BaseSourceAgent {
  readonly id: SourceId = "src-google-trends";
  readonly dimension: DimensionId = "D6";
  readonly name = "Google Trends — Volume de Buscas";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    if (!SERPAPI_KEY) return [];

    const query = territory.name;
    // Janela temporal: usa dateStart/dateEnd quando disponíveis (T-24mo → T),
    // senão default "today 5-y" pra capturar a trajetória de longo prazo.
    // SerpAPI aceita "YYYY-MM-DD YYYY-MM-DD" como intervalo customizado.
    const dateParam = options.dateStart && options.dateEnd
      ? `${toIso(options.dateStart)} ${toIso(options.dateEnd)}`
      : "today 2-y";
    const url =
      `https://serpapi.com/search.json?engine=google_trends` +
      `&q=${encodeURIComponent(query)}&data_type=TIMESERIES&date=${encodeURIComponent(dateParam)}` +
      `&geo=BR&api_key=${SERPAPI_KEY}`;

    try {
      const res = await fetch(url, { signal: options.signal });
      if (!res.ok) return [];

      const data = (await res.json()) as {
        interest_over_time?: {
          timeline_data?: Array<{ date: string; values: Array<{ value: number }> }>;
        };
      };

      const timeline = data.interest_over_time?.timeline_data ?? [];
      if (!timeline.length) return [];

      // Detect if latest week is a significant spike (>2x 90-day average)
      const values = timeline.map((t) => t.values?.[0]?.value ?? 0);
      const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
      const latest = values[values.length - 1] ?? 0;
      const latestDate = timeline[timeline.length - 1]?.date ?? "";

      if (latest < 10) return []; // too little signal

      const isSpike = latest > avg * 2;
      const impactNote = isSpike ? ` — PICO de busca (${latest} vs. média ${avg.toFixed(0)})` : "";

      return [
        {
          title: `Google Trends: interesse por "${query}" = ${latest}/100 em ${latestDate}${impactNote}`,
          summary: `Volume de buscas para "${query}" no Brasil nos últimos 3 meses. Média do período: ${avg.toFixed(0)}. Ponto mais recente: ${latest}.`,
          url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}&geo=BR`,
          publishedAt: new Date(),
          sourceAgentId: this.id,
          rawValue: latest,
          unit: "interesse (0-100)",
          metadata: { query, avg: avg.toFixed(0), latest, isSpike },
        },
      ];
    } catch {
      return [];
    }
  }
}

/** Converte "MM/DD/YYYY" → "YYYY-MM-DD" (formato aceito pelo SerpAPI Trends). */
function toIso(usDate: string): string {
  const [mm, dd, yyyy] = usDate.split("/");
  return `${yyyy}-${mm}-${dd}`;
}
