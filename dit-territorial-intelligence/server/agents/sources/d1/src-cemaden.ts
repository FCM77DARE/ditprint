import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

export class SrcCemaden extends BaseSourceAgent {
  readonly id = "src-cemaden";
  readonly dimension = "D1";
  readonly name = "CEMADEN - Centro Nacional de Monitoramento e Alertas de Desastres Naturais";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // O CEMADEN disponibiliza dados sobre alertas de desastres naturais.
      // Em uma integração real, buscaríamos pela API usando as coordenadas ou códigos IBGE dos municípios do território.
      
      // Simulação da chamada HTTP:
      // const response = await axios.get(`http://api.cemaden.gov.br/alertas?municipio=${territory.ibgeCode}`, { signal: options.signal });

      const hasAlert = Math.random() > 0.85; // Simula 15% de chance de ter um alerta ativo

      if (hasAlert) {
        signals.push({
          title: "Alerta CEMADEN: Risco de Deslizamento/Alagamento",
          summary: "Identificado risco hidrológico ou geológico para a região monitorada nas últimas 24 horas.",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 1, // 1 = alerta ativo
        });
      } else {
        signals.push({
          title: "Monitoramento CEMADEN",
          summary: "Nenhum alerta crítico de desastre natural para os municípios do território no momento.",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0,
        });
      }

    } catch (error) {
      this.log.error({ error, territory: territory.slug }, "Falha ao buscar dados do CEMADEN");
      throw error;
    }

    return signals;
  }
}
