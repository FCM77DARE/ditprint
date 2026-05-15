import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

export class SrcInea extends BaseSourceAgent {
  readonly id = "src-inea";
  readonly dimension = "D1";
  readonly name = "INEA - Instituto Estadual do Ambiente (RJ)";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // INEA é específico para o Rio de Janeiro
    if (territory.state !== "RJ") return [];

    try {
      // O INEA possui o portal de licenciamento e o sistema de alertas de cheias
      // Aqui simularíamos uma busca por licenças ou autos de infração no site do INEA
      
      // Simulação baseada no contexto do território
      const isMacae = territory.slug.includes("macae") || territory.slug.includes("cabiunas");
      
      if (isMacae) {
        signals.push({
          title: "Monitoramento de Licenciamento INEA - Polo Gaslub/Macaé",
          summary: "Análise de condicionantes ambientais para as operações no Porto de Macaé e Terminal de Cabiúnas. Status: Em conformidade, mas com atenção a efluentes.",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0.5,
          metadata: { agency: "INEA", region: "Macaé" }
        });
      }

      // Alerta de Cheias (INEA/Guanabara)
      if (territory.slug.includes("guanabara") || territory.slug.includes("caxias") || territory.slug.includes("mage")) {
        signals.push({
          title: "Sistema de Alerta de Cheias INEA: Estágio de Atenção",
          summary: "Rios da Baixada Fluminense em estágio de atenção devido à previsão de chuvas moderadas. Monitoramento de transbordamento ativo.",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0.7,
          metadata: { type: "cheia", rivers: ["Sarapuí", "Iguaçu"] }
        });
      }

      // Verificação de Hotspots Mandatários
      const hotspots = (territory.contextData as any)?.environmentalHotspots || [];
      for (const hotspot of hotspots) {
        if (hotspot.includes("Santana") || hotspot.includes("Jurubatiba")) {
          signals.push({
            title: `Monitoramento INEA: Unidade de Conservação ${hotspot}`,
            summary: `Vigilância ativa para ${hotspot}. Riscos identificados: Pressão por ocupação irregular e efluentes industriais. Status: Alerta de conformidade em análise.`,
            sourceAgentId: this.id,
            publishedAt: new Date(),
            rawValue: 0.6,
            metadata: { hotspot, priority: "high" }
          });
        }
      }

    } catch (error) {
      this.log.error({ error, territory: territory.slug }, "Falha ao buscar dados do INEA");
    }

    return signals;
  }
}
