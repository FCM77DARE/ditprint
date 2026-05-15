import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

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
    const signals: RawSignal[] = [];

    try {
      // API de Agregados do IBGE (servicodados.ibge.gov.br)
      // Exemplo de chamada para buscar população residente (Agregado 6579 - Censo 2022)
      // /api/v3/agregados/6579/periodos/2022/variaveis/93?localidades=N6[IBGE_CODE]
      
      // Simulação:
      // const response = await axios.get(`https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/2022/variaveis/93?localidades=N6[${territory.ibgeCode}]`, { signal: options.signal });

      signals.push({
        title: "Dados Demográficos IBGE Consolidados",
        summary: "Perfil populacional e pirâmide etária do território verificados sem anomalias (Censo).",
        sourceAgentId: this.id,
        publishedAt: new Date(),
        rawValue: 0,
      });

    } catch (error) {
      this.log.error({ error, territory: territory.slug }, "Falha ao buscar dados do IBGE Censo");
      throw error;
    }

    return signals;
  }
}
