/**
 * src-conselhos — Conselhos Municipais + Sindicatos
 *
 * Meeting minutes, composition, and activity of municipal councils.
 * Dimension: D5 (Governança) — Indicadores 5.1.1.1, 5.1.1.2
 *
 * Implementation: Apify scraper targeting council portals + Querido Diário
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN ?? "";

export class SrcConselhos extends BaseSourceAgent {
  readonly id: SourceId = "src-conselhos";
  readonly dimension: DimensionId = "D5";
  readonly name = "Conselhos Municipais (via Apify)";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    if (!APIFY_TOKEN) {
      this.log.warn("APIFY_API_TOKEN não configurado.");
      return [];
    }

    // Buscaremos menções a atas de conselhos do território
    const query = `Ata de reunião conselho municipal "${territory.name}"`;

    try {
      // 1. Inicia o Actor (ex: apify/google-search-scraper) e espera concluir
      const runRes = await fetch(
        `https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${APIFY_TOKEN}&waitForFinish=60`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queries: [query],
            resultsPerPage: 3,
            countryCode: "br",
          }),
          signal: options.signal,
        }
      );

      if (!runRes.ok) return [];
      
      const runData = (await runRes.json()) as { data?: { defaultDatasetId?: string } };
      const datasetId = runData.data?.defaultDatasetId;
      if (!datasetId) return [];

      // 2. Busca os resultados
      const datasetRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`,
        { signal: options.signal }
      );
      
      if (!datasetRes.ok) return [];

      const items = (await datasetRes.json()) as Array<{
        organicResults?: Array<{ title: string; url: string; description: string }>;
      }>;

      const signals: RawSignal[] = [];
      
      for (const item of items) {
        for (const result of item.organicResults ?? []) {
          signals.push({
            title: `Conselho Municipal: ${result.title}`,
            summary: result.description,
            url: result.url,
            publishedAt: new Date(),
            sourceAgentId: this.id,
            metadata: { query },
          });
        }
      }

      return signals;
    } catch (err) {
      this.log.error({ err }, "Erro na coleta do Apify (Conselhos)");
      return [];
    }
  }
}
