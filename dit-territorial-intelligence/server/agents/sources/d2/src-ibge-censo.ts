import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

export class SrcIbgeCenso extends BaseSourceAgent {
  readonly id = "src-ibge-censo";
  readonly dimension = "D2";
  readonly name = "IBGE - Sistema IBGE de Recuperação Automática (SIDRA) Censo";
  // O censo não muda todo dia, então podemos ter um cache TTL bem longo
  readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 30; // 30 dias

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const ctx = territory.contextData as Record<string, unknown> | null;
    const ibgeMuns = (ctx?.ibgeMunicipios as string[]) ?? [];

    if (ibgeMuns.length === 0) return [];

    const signals: RawSignal[] = [];

    for (const ibgeId of ibgeMuns) {
      // População residente - Agregado 793, variável 93 (Censo 2022)
      try {
        const url = `https://servicodados.ibge.gov.br/api/v3/agregados/793/periodos/2022/variaveis/93?localidades=N6%5B${ibgeId}%5D`;
        const res = await fetch(url, { signal: options.signal });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const result = data[0]?.resultados?.[0]?.series?.[0]?.serie?.["2022"];
            if (result && result !== "-") {
              const populacao = parseInt(result, 10);
              if (populacao > 0) {
                signals.push({
                  title: `IBGE Censo 2022: população residente ${populacao.toLocaleString("pt-BR")} hab. (município ${ibgeId})`,
                  summary: `Total de habitantes registrados pelo Censo Demográfico 2022 do IBGE para o município ${ibgeId}.`,
                  sourceAgentId: this.id,
                  publishedAt: new Date(),
                  rawValue: populacao,
                  unit: "habitantes",
                  metadata: { ibgeId, agregado: 793, variavel: 93, ano: 2022 },
                });
              }
            }
          }
        }
      } catch (err) {
        this.log.warn({ err, ibgeId }, "Falha ao buscar população IBGE 793/93");
      }

      // Densidade demográfica - Agregado 1301, variável 615
      try {
        const url = `https://servicodados.ibge.gov.br/api/v3/agregados/1301/periodos/-1/variaveis/615?localidades=N6%5B${ibgeId}%5D`;
        const res = await fetch(url, { signal: options.signal });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const serie = data[0]?.resultados?.[0]?.series?.[0]?.serie ?? {};
            const periodos = Object.keys(serie).sort();
            const ultimo = periodos[periodos.length - 1];
            const value = ultimo ? serie[ultimo] : null;
            if (value && value !== "-") {
              const densidade = parseFloat(String(value).replace(",", "."));
              if (!Number.isNaN(densidade) && densidade > 0) {
                signals.push({
                  title: `IBGE: densidade demográfica ${densidade.toLocaleString("pt-BR")} hab/km² (município ${ibgeId})`,
                  summary: `Densidade demográfica oficial do IBGE para o município ${ibgeId} (período ${ultimo}).`,
                  sourceAgentId: this.id,
                  publishedAt: new Date(),
                  rawValue: densidade,
                  unit: "hab/km²",
                  metadata: { ibgeId, agregado: 1301, variavel: 615, periodo: ultimo },
                });
              }
            }
          }
        }
      } catch (err) {
        this.log.warn({ err, ibgeId }, "Falha ao buscar densidade IBGE 1301/615");
      }
    }

    return signals;
  }
}
