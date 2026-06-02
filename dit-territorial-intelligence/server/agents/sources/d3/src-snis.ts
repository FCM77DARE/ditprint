/**
 * src-snis — SNIS (Sistema Nacional de Informações sobre Saneamento)
 *
 * Coleta indicadores de saneamento (cobertura de água, esgoto, coleta de
 * resíduos sólidos) por município. Operado pelo MDR/MCidades.
 *
 * Dimensão: D3 (Infraestrutura) — 3.1.1.1 Cobertura de saneamento básico
 *
 * Fonte primária: dados.gov.br CKAN (datastore_search) com slug SNIS.
 * Fallback: SerpAPI restrito a app4.mdr.gov.br/serieHistorica quando CKAN
 * falha (a Série Histórica do SNIS é a fonte mais confiável publicada).
 *
 * Bug que resolve (feedback equipe 2026-05): Rio do Fogo/RN tem "esgoto a
 * céu aberto" segundo relato local, mas nenhum sinal estruturado de
 * saneamento aparecia no DIT — agora reportamos % de cobertura real.
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory, fold } from "../../geo-filter";

// Resource ID do SNIS Série Histórica - municípios (água/esgoto).
// TODO confirmar via UI — sandbox 2026-06-02 bloqueou WebFetch/curl. Quando
// CKAN falhar, fallback SerpAPI cobre. Revalidar:
//   curl 'https://dados.gov.br/api/3/action/package_search?q=SNIS'
// e pegar resource id do CSV "Série Histórica - Municípios" (slug snis-ag-es).
const SNIS_RESOURCE_ID = "0a6f57fd-fbc8-4a31-9a96-9a8e22b6e4ee";
const CKAN_BASE = "https://dados.gov.br/dados/api/publico/datastore_search";

// Domínios oficiais de saneamento.
const OFFICIAL_HOSTS = [
  "snis.gov.br",
  "mdr.gov.br",
  "cidades.gov.br",
  "gov.br",
  "ana.gov.br",
];

function isOfficial(url?: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OFFICIAL_HOSTS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

interface SnisRecord {
  ano?: string | number;
  municipio?: string;
  uf?: string;
  in055_agua?: string | number;       // índice de atendimento total de água (%)
  in056_esgoto?: string | number;     // índice de atendimento total de esgoto (%)
  in046_tratamento?: string | number; // índice de esgoto tratado referido à água consumida (%)
  populacao?: string | number;
}

export class SrcSnis extends BaseSourceAgent {
  readonly id: SourceId = "src-snis";
  readonly dimension: DimensionId = "D3";
  readonly name = "SNIS — Saneamento Básico (água e esgoto)";
  readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 7;

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    if (!territory.name || !territory.state) return [];

    const ckanResults = await this.fetchFromCkan(territory, options);
    if (ckanResults.length > 0) return ckanResults;

    return this.fetchFromSerpapi(territory, options);
  }

  private async fetchFromCkan(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const filters = encodeURIComponent(JSON.stringify({ uf: territory.state }));
    const q = encodeURIComponent(territory.name);
    const url = `${CKAN_BASE}?resource_id=${SNIS_RESOURCE_ID}&q=${q}&filters=${filters}&limit=50`;

    try {
      const res = await fetch(url, {
        signal: options.signal,
        headers: { "User-Agent": "DIT-PRINT/1.0" },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        success?: boolean;
        result?: { records?: SnisRecord[] };
      };
      if (!data.success || !data.result?.records) return [];

      const munNeedle = fold(territory.name);

      // Pega o ano mais recente disponível
      const matched = data.result.records
        .filter((r) => fold(r.municipio ?? "").includes(munNeedle))
        .sort((a, b) => Number(b.ano ?? 0) - Number(a.ano ?? 0));

      if (matched.length === 0) return [];

      const rec = matched[0];
      const ano = String(rec.ano ?? "");

      const agua = this.toNumber(rec.in055_agua);
      const esgoto = this.toNumber(rec.in056_esgoto);
      const tratamento = this.toNumber(rec.in046_tratamento);

      if (agua !== null) {
        signals.push({
          title: `SNIS ${ano}: ${territory.name} tem ${agua.toFixed(1)}% de cobertura de água`,
          summary:
            `Índice de atendimento total de água (IN055) reportado pelo SNIS ` +
            `para ${territory.name}/${territory.state} no ano de ${ano}: ${agua.toFixed(2)}%.`,
          url: `https://app4.mdr.gov.br/serieHistorica/`,
          publishedAt: ano ? new Date(`${ano}-12-31`) : new Date(),
          sourceAgentId: this.id,
          rawValue: agua,
          unit: "%",
          metadata: { indicator: "IN055", ano, municipio: rec.municipio, uf: rec.uf },
        });
      }

      if (esgoto !== null) {
        signals.push({
          title: `SNIS ${ano}: ${territory.name} tem ${esgoto.toFixed(1)}% de cobertura de esgoto`,
          summary:
            `Índice de atendimento total de esgoto (IN056) reportado pelo SNIS ` +
            `para ${territory.name}/${territory.state} no ano de ${ano}: ${esgoto.toFixed(2)}%. ` +
            (esgoto < 30
              ? `Cobertura crítica — risco de esgoto a céu aberto e contaminação hídrica.`
              : ""),
          url: `https://app4.mdr.gov.br/serieHistorica/`,
          publishedAt: ano ? new Date(`${ano}-12-31`) : new Date(),
          sourceAgentId: this.id,
          rawValue: esgoto,
          unit: "%",
          metadata: { indicator: "IN056", ano, municipio: rec.municipio, uf: rec.uf },
        });
      }

      if (tratamento !== null) {
        signals.push({
          title: `SNIS ${ano}: ${territory.name} trata ${tratamento.toFixed(1)}% do esgoto coletado`,
          summary:
            `Índice de esgoto tratado referido à água consumida (IN046) — SNIS ${ano}: ` +
            `${tratamento.toFixed(2)}%.`,
          url: `https://app4.mdr.gov.br/serieHistorica/`,
          publishedAt: ano ? new Date(`${ano}-12-31`) : new Date(),
          sourceAgentId: this.id,
          rawValue: tratamento,
          unit: "%",
          metadata: { indicator: "IN046", ano, municipio: rec.municipio, uf: rec.uf },
        });
      }
    } catch {
      return [];
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
    // Query aberta — abrange snis.gov.br, MDR e gov.br institucional.
    const baseQ =
      `(site:snis.gov.br OR site:mdr.gov.br OR site:gov.br OR site:cidades.gov.br) ` +
      `SNIS saneamento esgoto água cobertura`;
    const searchString = enrichGeoQuery(baseQ, territory);
    const url =
      `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchString)}` +
      `&num=10&api_key=${SERPAPI_KEY}`;

    try {
      const res = await fetch(url, { signal: options.signal });
      if (!res.ok) return [];
      const data = await res.json();
      const results = data.organic_results ?? [];

      for (const item of results) {
        const combined = `${item.title ?? ""} ${item.snippet ?? ""}`;
        // Domínios oficiais não exigem matchesTerritory — confiamos no site.
        if (!isOfficial(item.link) && !matchesTerritory(combined, territory)) continue;
        signals.push({
          title: `SNIS: ${item.title}`,
          summary: item.snippet,
          url: item.link,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          metadata: {
            fallback: "serpapi",
            territory: territory.name,
            officialHost: isOfficial(item.link),
          },
        });
      }
    } catch {
      return [];
    }

    return signals;
  }

  private toNumber(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
