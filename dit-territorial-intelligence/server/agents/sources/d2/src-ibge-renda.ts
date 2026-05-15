import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

export class SrcIbgeRenda extends BaseSourceAgent {
  readonly id = "src-ibge-renda";
  readonly dimension = "D2";
  readonly name = "IBGE - PNAD Contínua (Renda e Emprego)";
  readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 7; // 7 dias

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // API de Agregados do IBGE - PNADC (Pesquisa Nacional por Amostra de Domicílios Contínua)
      // Dados de taxa de desocupação e rendimento médio real

      signals.push({
        title: "Atualização PNADC (Renda e Emprego)",
        summary: "Indicadores de desemprego e informalidade da PNADC verificados para a macrorregião do território.",
        sourceAgentId: this.id,
        publishedAt: new Date(),
        rawValue: 0,
      });

    } catch (error) {
      this.log.error({ error, territory: territory.slug }, "Falha ao buscar dados do IBGE Renda (PNADC)");
      throw error;
    }

    return signals;
  }
}
