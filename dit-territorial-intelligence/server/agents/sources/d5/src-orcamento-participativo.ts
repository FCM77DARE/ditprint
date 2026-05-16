/**
 * src-orcamento-participativo — Orçamento Participativo / PPA / Prestação de contas
 *
 * Coleta menções a orçamento participativo, PPA e prestações de contas do
 * território, e cruza com o Portal da Transparência federal.
 * Dimensão: D5 (Governança).
 *
 * Implementation: duas queries via SerpAPI (engine=google).
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";

export class SrcOrcamentoParticipativo extends BaseSourceAgent {
  readonly id: SourceId = "src-orcamento-participativo";
  readonly dimension: DimensionId = "D5";
  readonly name = "Orçamento Participativo / LOA / LDO";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    const signals: RawSignal[] = [];
    const query = territory.name;

    let tbs = "";
    if (options.dateStart && options.dateEnd) {
      tbs = `&tbs=cdr:1,cd_min:${options.dateStart},cd_max:${options.dateEnd}`;
    }

    const queries: Array<{ q: string; scope: string }> = [
      {
        q: `(orçamento participativo OR "prestação de contas" OR "plano plurianual") "${query}"`,
        scope: "geral",
      },
      {
        q: `site:portaldatransparencia.gov.br "${query}"`,
        scope: "portal-transparencia",
      },
    ];

    for (const { q, scope } of queries) {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&num=5${tbs}&api_key=${SERPAPI_KEY}`;

      try {
        const res = await fetch(url, { signal: options.signal });
        if (!res.ok) continue;

        const data = (await res.json()) as {
          organic_results?: Array<{ title: string; snippet?: string; link: string }>;
        };
        const results = data.organic_results ?? [];

        for (const item of results) {
          signals.push({
            title: item.title,
            summary: item.snippet ?? "",
            url: item.link,
            sourceAgentId: this.id,
            publishedAt: new Date(),
            metadata: { query, engine: "serpapi:google", scope },
          });
        }
      } catch (err) {
        this.log.error({ err, scope }, "Erro na coleta SerpAPI (OP)");
      }
    }

    return signals;
  }
}
