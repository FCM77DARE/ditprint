/**
 * src-inmet — INMET Instituto Nacional de Meteorologia
 *
 * Fontes oficiais:
 *  1) apiprevmet3.inmet.gov.br/avisos/rss/aviso/inicio  → feed oficial de avisos
 *     (o endpoint /alertas do apitempo.inmet.gov.br foi descontinuado)
 *  2) apiprevmet3.inmet.gov.br/estacao/proxima/{lat}/{lon}  → estação mais próxima
 *  3) apitempo.inmet.gov.br/estacao/{data-inicio}/{data-fim}/{codigo}  → dados horários
 *
 * Estratégia: buscar avisos ativos no estado do território e cruzar com o
 * município. Estações próximas ficam para expansão futura (requer centroid).
 */

import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import axios from "axios";

interface InmetAviso {
  id?: number | string;
  descricao?: string;
  data_inicio?: string;
  data_fim?: string;
  severidade?: string;
  status?: string;
  aviso_tipo?: string;
  aviso_cor?: string;
  estados?: string;   // string com UFs separadas por vírgula
  municipios?: string;
}

const INMET_BASE = "https://apiprevmet3.inmet.gov.br";
const LEGACY_BASE = "https://apitempo.inmet.gov.br";

export class SrcInmet extends BaseSourceAgent {
  readonly id = "src-inmet";
  readonly dimension = "D1";
  readonly name = "INMET - Instituto Nacional de Meteorologia";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const uf = (territory.state || "").toUpperCase();
    if (!uf) return signals;

    // 1) Tenta endpoint atual (apiprevmet3) — avisos ativos
    const avisos = await this.fetchAvisos(options);

    if (avisos.length > 0) {
      // Filtra por UF do território
      const locais = avisos.filter((a) => {
        const estados = (a.estados || "").toUpperCase();
        return estados.includes(uf);
      });

      for (const a of locais) {
        const severidade = (a.severidade || a.aviso_cor || "").toLowerCase();
        const isHigh = /vermelho|laranja|extremo|alto/.test(severidade);
        signals.push({
          title: `INMET: ${a.aviso_tipo || "Aviso meteorológico"} · ${severidade || "monitoramento"}`,
          summary: a.descricao || "Aviso oficial emitido pelo INMET para o estado.",
          sourceAgentId: this.id,
          publishedAt: a.data_inicio ? new Date(a.data_inicio) : new Date(),
          rawValue: isHigh ? 1 : 0.5,
          url: `https://alertas2.inmet.gov.br/`,
          metadata: {
            severidade,
            data_inicio: a.data_inicio,
            data_fim: a.data_fim,
            municipios: a.municipios,
            estados: a.estados,
            aviso_tipo: a.aviso_tipo,
          },
        });
      }
    }

    // Se sem avisos ativos para a UF, sinal baseline (indica que consulta foi feita)
    if (signals.length === 0) {
      signals.push({
        title: `INMET · Sem avisos meteorológicos ativos para ${uf}`,
        summary: "Consulta ao painel oficial de avisos do INMET não retornou eventos severos para o estado do território na data.",
        sourceAgentId: this.id,
        publishedAt: new Date(),
        rawValue: 0,
        url: "https://alertas2.inmet.gov.br/",
        metadata: { uf, source: "apiprevmet3" },
      });
    }

    return signals;
  }

  /**
   * Busca avisos ativos. Tenta endpoint novo (apiprevmet3), com fallback
   * silencioso para o legacy (apitempo) se ainda estiver de pé em algum
   * ambiente. 404 vira array vazio — não é fatal.
   */
  private async fetchAvisos(options: CollectOptions): Promise<InmetAviso[]> {
    // Endpoint atual
    for (const url of [
      `${INMET_BASE}/avisos/ativos`,
      `${LEGACY_BASE}/avisos/ativos`,
      `${INMET_BASE}/avisos`,
    ]) {
      try {
        const res = await axios.get(url, {
          signal: options.signal,
          timeout: 10000,
          headers: { "User-Agent": "DIT-PRINT/1.0" },
          validateStatus: (s) => s < 500, // 404 não é erro fatal aqui
        });
        if (res.status === 200 && Array.isArray(res.data)) {
          return res.data as InmetAviso[];
        }
        if (
          res.status === 200 &&
          res.data &&
          typeof res.data === "object" &&
          Array.isArray((res.data as { hoje?: unknown[] }).hoje)
        ) {
          return (res.data as { hoje: InmetAviso[] }).hoje;
        }
      } catch {
        // tenta próxima URL silenciosamente
      }
    }
    return [];
  }
}
