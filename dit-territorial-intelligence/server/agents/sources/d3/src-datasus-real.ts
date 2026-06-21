/**
 * src-datasus-real — DataSUS Indicadores Reais
 *
 * Versão melhorada do src-datasus. Em vez de SerpAPI puro, tenta primeiro
 * APIs estruturadas (PCDaS Fiocruz / dados.gov.br Saúde) para obter
 * indicadores de saúde por município: cobertura ESF, mortalidade infantil,
 * leitos hospitalares.
 *
 * Dimensão: D3 (Infraestrutura) — 3.1.2.1 Acesso a serviços de saúde
 *
 * Fonte primária: PCDaS Fiocruz (bigdata-api.fiocruz.br).
 * Fallback: SerpAPI restrito a tabnet.datasus.gov.br / dados.gov.br/dados.
 *
 * NOTA: o agente src-datasus.ts (SerpAPI puro) continua existindo. Este
 * é seu sucessor — o switch é feito manualmente em dim-infraestrutura.ts.
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory, fold } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";

// Endpoint público PCDaS Fiocruz (Indicadores de Saúde por município).
// Estrutura observada: GET /indicadores/municipal?codigo_municipio=...
const PCDAS_BASE = "https://bigdata-api.fiocruz.br/api/indicadores";

interface PcdasIndicator {
  indicador?: string;
  valor?: number | string;
  ano?: number | string;
  unidade?: string;
  fonte?: string;
}

export class SrcDatasusReal extends BaseSourceAgent {
  readonly id: SourceId = "src-datasus-real";
  readonly dimension: DimensionId = "D3";
  readonly name = "DataSUS (real) — ESF, Mortalidade, Leitos";
  readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 7;

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    if (!territory.name || !territory.state) return [];

    const ibgeCode = (territory as unknown as { ibgeCode?: string | number }).ibgeCode;
    if (ibgeCode) {
      const structured = await this.fetchFromPcdas(territory, String(ibgeCode), options);
      if (structured.length > 0) return structured;
    }

    return this.fetchFromSerpapi(territory, options);
  }

  private async fetchFromPcdas(
    territory: Territory,
    ibgeCode: string,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    // Tenta os 3 indicadores prioritários
    const targets = [
      { key: "cobertura_esf", label: "Cobertura ESF", unit: "%" },
      { key: "mortalidade_infantil", label: "Mortalidade infantil", unit: "óbitos/1000" },
      { key: "leitos_sus", label: "Leitos SUS", unit: "leitos" },
    ];

    for (const target of targets) {
      const url = `${PCDAS_BASE}/municipal?codigo_municipio=${ibgeCode}&indicador=${target.key}`;
      try {
        const res = await fetch(url, {
          signal: options.signal,
          headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
        });
        if (!res.ok) continue;
        const data = (await res.json()) as PcdasIndicator | PcdasIndicator[];
        const records = Array.isArray(data) ? data : [data];

        for (const rec of records) {
          const valor =
            typeof rec.valor === "string"
              ? parseFloat(rec.valor.replace(",", "."))
              : Number(rec.valor ?? NaN);
          if (!Number.isFinite(valor)) continue;
          const ano = String(rec.ano ?? "");

          signals.push({
            title:
              `DataSUS/PCDaS: ${target.label} em ${territory.name} = ` +
              `${valor.toFixed(2)} ${rec.unidade ?? target.unit} (${ano})`,
            summary:
              `Indicador "${target.label}" reportado pela PCDaS Fiocruz/DataSUS ` +
              `para ${territory.name}/${territory.state}. ` +
              `Ano: ${ano}. Valor: ${valor} ${rec.unidade ?? target.unit}. ` +
              `Fonte primária: ${rec.fonte ?? "DataSUS/TabNet"}.`,
            url: `https://bigdata.icict.fiocruz.br/`,
            publishedAt: ano ? new Date(`${ano}-12-31`) : new Date(),
            sourceAgentId: this.id,
            rawValue: valor,
            unit: rec.unidade ?? target.unit,
            metadata: {
              indicador: target.key,
              ano,
              ibgeCode,
              fonte: rec.fonte,
            },
          });
        }
      } catch {
        // segue para o próximo indicador
      }
    }

    return signals;
  }

  private async fetchFromSerpapi(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    const signals: RawSignal[] = [];
    const searchString = enrichGeoQuery(
      `site:tabnet.datasus.gov.br OR site:dados.gov.br/dados ESF cobertura mortalidade leitos`,
      territory
    );
    const url =
      `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchString)}` +
      `&num=5&api_key=${SERPAPI_KEY}`;

    try {
      const data = (await serpapiCachedFetch(url, options.signal)) as
        | { organic_results?: Array<{ title: string; snippet?: string; link: string }> }
        | null;
      if (!data) return [];
      const results = data.organic_results ?? [];

      for (const item of results) {
        const combined = `${item.title ?? ""} ${item.snippet ?? ""}`;
        if (!matchesTerritory(combined, territory)) continue;
        // Filtro temático rápido: só passa se mencionar termo de saúde
        const folded = fold(combined);
        const healthHit = ["esf", "saude", "sus", "mortalidade", "leitos", "hospital"].some(
          (t) => folded.includes(t)
        );
        if (!healthHit) continue;
        signals.push({
          title: `DataSUS: ${item.title}`,
          summary: item.snippet,
          url: item.link,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          metadata: { fallback: "serpapi", territory: territory.name },
        });
      }
    } catch {
      return [];
    }

    return signals;
  }
}
