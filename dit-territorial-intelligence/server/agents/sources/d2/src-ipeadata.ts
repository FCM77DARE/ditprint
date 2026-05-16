import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

interface IpeaValue {
  SERCODIGO: string;
  VALDATA: string;
  VALVALOR: number | string | null;
  TERCODIGO?: string;
  NIVNOME?: string;
}

export class SrcIpeadata extends BaseSourceAgent {
  readonly id = "src-ipeadata";
  readonly dimension = "D2";
  readonly name = "IPEAData - Instituto de Pesquisa Econômica Aplicada";
  readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 30; // 30 dias

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Séries IPEA: Gini de renda (GINIRESBR), Taxa de Pobreza (PNADC_TX5 ou similar)
    const series = [
      { code: "GINIRESBR", label: "Índice de Gini (renda)", unit: "índice" },
      { code: "PNADC_TX5", label: "Taxa de pobreza (PNADC)", unit: "%" },
    ];

    for (const s of series) {
      try {
        const url = `http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='${s.code}')`;
        const res = await fetch(url, {
          signal: options.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) continue;
        const json = (await res.json()) as { value?: IpeaValue[] };
        const values = json?.value ?? [];
        if (values.length === 0) continue;

        // Encontra o último valor não nulo
        let chosen: IpeaValue | null = null;
        for (let i = values.length - 1; i >= 0; i--) {
          const v = values[i];
          if (v?.VALVALOR !== null && v?.VALVALOR !== undefined && v.VALVALOR !== "") {
            chosen = v;
            break;
          }
        }
        if (!chosen) continue;

        const num =
          typeof chosen.VALVALOR === "number"
            ? chosen.VALVALOR
            : parseFloat(String(chosen.VALVALOR).replace(",", "."));
        if (Number.isNaN(num)) continue;

        signals.push({
          title: `IPEA ${s.code}: ${s.label} = ${num.toLocaleString("pt-BR")} ${s.unit}`,
          summary: `Última observação disponível na série IPEAData ${s.code} (${chosen.VALDATA}).`,
          sourceAgentId: this.id,
          publishedAt: chosen.VALDATA ? new Date(chosen.VALDATA) : new Date(),
          rawValue: num,
          unit: s.unit,
          metadata: { sercodigo: s.code, valdata: chosen.VALDATA },
        });
      } catch (err) {
        this.log.warn({ err, code: s.code }, "Falha IPEAData (tolerado)");
        continue;
      }
    }

    return signals;
  }
}
