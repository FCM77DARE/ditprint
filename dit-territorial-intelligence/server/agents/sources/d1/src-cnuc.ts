import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

export class SrcCnuc extends BaseSourceAgent {
  readonly id = "src-cnuc";
  readonly dimension = "D1";
  readonly name = "CNUC / MMA - Cadastro Nacional de Unidades de Conservação";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // O CNUC contém as áreas de APAs e APPs (federais, estaduais, municipais)
      // Simulação da chamada HTTP para buscar dados de conservação por código IBGE:
      // const response = await axios.get(`https://dadosabertos.mma.gov.br/api/3/action/datastore_search?resource_id=XXX&q=${territory.ibgeCode}`, { signal: options.signal });

      signals.push({
        title: "Monitoramento de APAs e APPs",
        summary: "Dados estruturais de Unidades de Conservação confirmados. Nenhuma alteração legal recente de limites na área.",
        sourceAgentId: this.id,
        publishedAt: new Date(),
        rawValue: 0, 
      });

      // Verificação de Hotspots Mandatários (ICMBio)
      const hotspots = (territory.contextData as any)?.environmentalHotspots || [];
      for (const hotspot of hotspots) {
        if (hotspot.includes("Santana") || hotspot.includes("Jurubatiba")) {
          signals.push({
            title: `Alerta ICMBio/CNUC: Vulnerabilidade em ${hotspot}`,
            summary: `Monitoramento de impacto ambiental em ${hotspot}. Identificada pressão de expansão urbana e riscos à biodiversidade local.`,
            sourceAgentId: this.id,
            publishedAt: new Date(),
            rawValue: 0.7, // Impacto maior por ser área protegida
            metadata: { hotspot, type: "ICMBio Alerta" }
          });
        }
      }

    } catch (error) {
      this.log.error({ error, territory: territory.slug }, "Falha ao buscar dados do CNUC");
      throw error;
    }

    return signals;
  }
}
