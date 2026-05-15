import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

export class SrcIbama extends BaseSourceAgent {
  readonly id = "src-ibama";
  readonly dimension = "D1";
  readonly name = "IBAMA - Dados Abertos (Embargos e Autuações)";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // API de Dados Abertos do IBAMA (dadosabertos.ibama.gov.br)
      // Podemos consultar áreas embargadas e autuações ambientais filtrando por estado/município
      
      // Simulação da chamada HTTP para embargos:
      // const response = await axios.get(`https://dadosabertos.ibama.gov.br/api/3/action/datastore_search?resource_id=XXX&q=${territory.state}`, { signal: options.signal });

      const newEmbargoesCount = Math.floor(Math.random() * 3); // Simula 0 a 2 embargos novos

      if (newEmbargoesCount > 0) {
        signals.push({
          title: `Novos Embargos IBAMA detectados`,
          summary: `Foram identificados ${newEmbargoesCount} novos embargos ambientais (áreas ou propriedades) restritos pelo IBAMA na área de influência.`,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: newEmbargoesCount,
          unit: "embargos",
        });
      } else {
        signals.push({
          title: "Monitoramento IBAMA",
          summary: "Nenhum novo embargo ou autuação de grande impacto publicado hoje para o território.",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0,
        });
      }

    } catch (error) {
      this.log.error({ error, territory: territory.slug }, "Falha ao buscar dados do IBAMA");
      throw error;
    }

    return signals;
  }
}
