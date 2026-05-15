import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

export class SrcInmet extends BaseSourceAgent {
  readonly id = "src-inmet";
  readonly dimension = "D1";
  readonly name = "INMET - Instituto Nacional de Meteorologia";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // TODO: Obter o código da estação meteorológica mais próxima do território usando territory.state ou coordenadas
      // Como exemplo, simulamos a busca de dados climáticos e alertas do INMET
      
      // Chamada real para a API de alertas do INMET (Pública e gratuita)
      // Exemplo de endpoint de alertas diários: https://apitempo.inmet.gov.br/alertas
      const response = await axios.get("https://apitempo.inmet.gov.br/alertas", {
        signal: options.signal,
        timeout: 10000,
      });

      // Se houver dados de alertas hoje
      if (response.data && Array.isArray(response.data)) {
        // Filtrar alertas para o estado do território (ex: RJ para Baía de Guanabara)
        const alertasLocais = response.data.filter(
          (alerta) => alerta.estados && alerta.estados.includes(territory.state)
        );

        for (const alerta of alertasLocais) {
          signals.push({
            title: `Alerta INMET: ${alerta.risco_descricao || "Evento Climático"}`,
            summary: alerta.descricao || "Condição climática extrema reportada.",
            sourceAgentId: this.id,
            publishedAt: new Date(alerta.data_inicio || Date.now()),
            rawValue: alerta.risco_id, 
            metadata: {
              severidade: alerta.severidade,
              municipios: alerta.municipios,
            },
          });
        }
      }

      // Se não houver alertas, geramos um sinal neutro/baseline de que a coleta foi feita
      if (signals.length === 0) {
        signals.push({
          title: "Monitoramento Climático INMET",
          summary: "Nenhum alerta meteorológico severo ativo para o território neste período.",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0,
        });
      }

    } catch (error) {
      this.log.error({ error, territory: territory.slug }, "Falha ao buscar dados do INMET");
      throw error; // Deixar o BaseSourceAgent lidar com o retry
    }

    return signals;
  }
}
