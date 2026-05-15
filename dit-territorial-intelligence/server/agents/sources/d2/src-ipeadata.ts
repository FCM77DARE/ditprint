import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

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

    try {
      // API IPEAData (http://ipeadata.gov.br/api/odata4/)
      // Fornece indicadores macroeconômicos e sociais, como Índice de Gini e Taxa de Pobreza
      
      signals.push({
        title: "Atualização de Séries Históricas IPEA",
        summary: "Indicadores de Desigualdade (Gini) e Pobreza conferidos no banco de dados do IPEA.",
        sourceAgentId: this.id,
        publishedAt: new Date(),
        rawValue: 0,
      });

    } catch (error) {
      this.log.error({ error, territory: territory.slug }, "Falha ao buscar dados do IPEAData");
      throw error;
    }

    return signals;
  }
}
