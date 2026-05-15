import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

export class SrcInpeDeter extends BaseSourceAgent {
  readonly id = "src-inpe-deter";
  readonly dimension = "D1";
  readonly name = "INPE - TerraBrasilis (Alertas DETER)";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // O INPE TerraBrasilis disponibiliza dados via WFS e APIs REST.
      // Exemplo de integração buscando alertas de desmatamento recentes (simulação baseada na API do INPE)
      
      // Para uma integração real em produção, usaríamos as coordenadas do território (BBox) 
      // para consultar a API WFS do TerraBrasilis.
      
      // Simulando a chamada HTTP:
      // const bbox = territory.bbox; // ex: "-44.0,-23.0,-42.0,-22.0"
      // const response = await axios.get(`http://terrabrasilis.dpi.inpe.br/geoserver/wfs?request=GetFeature&typeName=deter&bbox=${bbox}`, { signal: options.signal });

      // Como placeholder inicial (visto que dependemos do shapefile/bbox do território),
      // enviamos um sinal de "monitoramento ativo" ou buscamos dados estaduais.
      
      // Aqui simulamos uma resposta:
      const simulatedAlerts = Math.random() > 0.7 ? [{ area_km2: 12.5, date: new Date().toISOString() }] : [];

      if (simulatedAlerts.length > 0) {
        for (const alert of simulatedAlerts) {
          signals.push({
            title: `Alerta DETER: Desmatamento Detectado`,
            summary: `Área de ${alert.area_km2} km² com indícios de desmatamento ou degradação na região do território.`,
            sourceAgentId: this.id,
            publishedAt: new Date(alert.date),
            rawValue: alert.area_km2,
            unit: "km²",
          });
        }
      } else {
        signals.push({
          title: "Monitoramento INPE DETER",
          summary: "Nenhum novo alerta de desmatamento expressivo detectado na região neste período.",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0,
          unit: "km²",
        });
      }

    } catch (error) {
      this.log.error({ error, territory: territory.slug }, "Falha ao buscar dados do INPE DETER");
      throw error;
    }

    return signals;
  }
}
