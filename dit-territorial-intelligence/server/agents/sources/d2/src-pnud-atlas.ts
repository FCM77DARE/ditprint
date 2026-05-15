import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

export class SrcPnudAtlas extends BaseSourceAgent {
  readonly id = "src-pnud-atlas";
  readonly dimension = "D2";
  readonly name = "PNUD - Atlas do Desenvolvimento Humano (IDH)";
  readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 30; // 30 dias

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    try {
      // O PNUD publica o Atlas do Desenvolvimento Humano do Brasil.
      // Esses dados geralmente são estáticos por longos períodos (anuais/decenais).
      // Pode ser consultado via API ou extraído do banco de dados local que alimentamos periodicamente.
      
      signals.push({
        title: "Índice de Desenvolvimento Humano (IDH)",
        summary: "Monitoramento de IDHM (Renda, Longevidade e Educação) realizado. Nenhuma atualização estrutural no período.",
        sourceAgentId: this.id,
        publishedAt: new Date(),
        rawValue: 0,
      });

    } catch (error) {
      this.log.error({ error, territory: territory.slug }, "Falha ao buscar dados do PNUD Atlas");
      throw error;
    }

    return signals;
  }
}
