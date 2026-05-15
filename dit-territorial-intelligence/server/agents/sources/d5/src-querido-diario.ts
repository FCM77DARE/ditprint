/**
 * src-querido-diario — Querido Diário (Open Knowledge Brasil)
 *
 * Official municipal gazette publications: contracts, ordinances, TACs, public notices.
 * Dimension: D5 (Governança) — Indicadores 5.1.1.2, 5.3.1.1, 5.3.1.3
 *
 * API: https://queridodiario.ok.org.br/api/docs
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";

const QD_BASE = "https://queridodiario.ok.org.br/api";

export class SrcQueridoDiario extends BaseSourceAgent {
  readonly id: SourceId = "src-querido-diario";
  readonly dimension: DimensionId = "D5";
  readonly name = "Querido Diário — Diários Oficiais Municipais";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const ctx = territory.contextData as Record<string, unknown> | null;
    const ibgeCodes = (ctx?.ibgeMunicipios as string[]) ?? [];
    if (ibgeCodes.length === 0) return [];

    const signals: RawSignal[] = [];
    const keywords = [
      "TAC", "termo de ajustamento", "ação civil pública", "conselho municipal",
      "audiência pública", "orçamento participativo", "improbidade", "licitação irregular",
    ];

    for (const code of ibgeCodes.slice(0, 2)) {
      for (const kw of keywords.slice(0, 3)) {
        try {
          const url =
            `${QD_BASE}/gazettes?territory_ids=${code}&querystring=${encodeURIComponent(kw)}` +
            `&size=5&sort_by=relevance`;

          const res = await fetch(url, { signal: options.signal });
          if (!res.ok) continue;

          const data = (await res.json()) as {
            gazettes?: Array<{
              date: string;
              url: string;
              excerpts: string[];
              territory_name: string;
            }>;
          };

          for (const gazette of data.gazettes ?? []) {
            signals.push({
              title: `Querido Diário: "${kw}" em ${gazette.territory_name} — ${gazette.date}`,
              summary: gazette.excerpts[0] ?? `Menção a "${kw}" no diário oficial de ${gazette.territory_name}.`,
              url: gazette.url,
              publishedAt: gazette.date ? new Date(gazette.date) : new Date(),
              sourceAgentId: this.id,
              metadata: { keyword: kw, territory: gazette.territory_name },
            });
          }
        } catch {
          continue;
        }
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
