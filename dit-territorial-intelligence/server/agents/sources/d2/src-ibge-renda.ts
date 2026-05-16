import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

interface IbgeQuery {
  agregado: number;
  variavel: number;
  label: string;
  unit: string;
}

export class SrcIbgeRenda extends BaseSourceAgent {
  readonly id = "src-ibge-renda";
  readonly dimension = "D2";
  readonly name = "IBGE - PNAD Contínua (Renda e Emprego)";
  readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 7; // 7 dias

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const ctx = territory.contextData as Record<string, unknown> | null;
    const ibgeMuns = (ctx?.ibgeMunicipios as string[]) ?? [];
    if (ibgeMuns.length === 0) return [];

    const signals: RawSignal[] = [];

    // PNAD Contínua: rendimento médio domiciliar per capita (agregado 7064 / var 1641)
    // Taxa de desocupação (agregado 5429 / var 4099 — pode variar por região)
    const queries: IbgeQuery[] = [
      { agregado: 7064, variavel: 1641, label: "rendimento médio domiciliar per capita", unit: "R$" },
      { agregado: 5429, variavel: 4099, label: "taxa de desocupação", unit: "%" },
    ];

    for (const ibgeId of ibgeMuns) {
      for (const q of queries) {
        try {
          const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${q.agregado}/periodos/-6/variaveis/${q.variavel}?localidades=N6%5B${ibgeId}%5D`;
          const res = await fetch(url, { signal: options.signal });
          if (!res.ok) continue;
          const data = await res.json();
          if (!Array.isArray(data) || data.length === 0) continue;

          const serie = data[0]?.resultados?.[0]?.series?.[0]?.serie ?? {};
          const periodos = Object.keys(serie).sort();
          // pega o último valor válido
          let chosen: { periodo: string; value: number } | null = null;
          for (let i = periodos.length - 1; i >= 0; i--) {
            const raw = serie[periodos[i]];
            if (raw && raw !== "-" && raw !== "...") {
              const num = parseFloat(String(raw).replace(",", "."));
              if (!Number.isNaN(num)) {
                chosen = { periodo: periodos[i], value: num };
                break;
              }
            }
          }
          if (!chosen) continue;

          signals.push({
            title: `PNAD Contínua: ${q.label} ${chosen.value.toLocaleString("pt-BR")} ${q.unit} (município ${ibgeId})`,
            summary: `IBGE/PNADC indica ${q.label} de ${chosen.value} ${q.unit} para o município ${ibgeId} no período ${chosen.periodo}.`,
            sourceAgentId: this.id,
            publishedAt: new Date(),
            rawValue: chosen.value,
            unit: q.unit,
            metadata: { ibgeId, agregado: q.agregado, variavel: q.variavel, periodo: chosen.periodo },
          });
        } catch (err) {
          this.log.warn({ err, ibgeId, agregado: q.agregado }, "Falha PNADC");
          continue;
        }
      }
    }

    return signals;
  }
}
