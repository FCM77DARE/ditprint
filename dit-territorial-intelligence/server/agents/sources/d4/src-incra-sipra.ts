/**
 * src-incra-sipra — INCRA SIPRA (Sistema de Informações de Projetos de Reforma Agrária)
 *
 * Lista assentamentos de reforma agrária por município (nome, área, famílias,
 * ano de criação). Dado estrutural — sem depender de cobertura de mídia.
 *
 * Dimensão: D4 (Dinâmica Territorial) — 4.4.1.2 Assentamentos rurais
 *
 * Fonte primária: CKAN dados abertos INCRA (datastore_search público).
 * Fallback: SerpAPI restrito a site:incra.gov.br quando a API CKAN falha.
 *
 * Bug que resolve (feedback equipe 2026-05): municípios pequenos do interior
 * (Rio do Fogo/RN e similares) caem em "Vácuo Institucional" porque a mídia
 * não cobre — mas o INCRA tem o registro estrutural do assentamento.
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory, fold } from "../../geo-filter";

// Resource ID público do SIPRA na plataforma de Dados Abertos do INCRA.
// TODO confirmar via UI — sandbox 2026-06-02 bloqueou WebFetch/curl, não foi
// possível validar UUID ao vivo. Quando falhar, fallback SerpAPI cobre o caso.
// Revalidar via:
//   curl 'https://dadosabertos.incra.gov.br/api/3/action/package_search?q=assentamento'
const SIPRA_RESOURCE_ID = "2a01250d-cf02-49a8-b6a3-7b7f3a55c5c4";
const CKAN_BASE = "https://dadosabertos.incra.gov.br/api/3/action/datastore_search";

// Domínios oficiais reconhecidos para fallback agressivo.
const OFFICIAL_HOSTS = ["incra.gov.br", "gov.br", "mda.gov.br"];

function isOfficial(url?: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OFFICIAL_HOSTS.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

interface SipraRecord {
  nome_projeto?: string;
  municipio?: string;
  uf?: string;
  area_ha?: string | number;
  num_familias?: string | number;
  capacidade_familias?: string | number;
  data_criacao?: string;
  fase?: string;
  codigo_sipra?: string;
}

export class SrcIncraSipra extends BaseSourceAgent {
  readonly id: SourceId = "src-incra-sipra";
  readonly dimension: DimensionId = "D4";
  readonly name = "INCRA SIPRA — Assentamentos de Reforma Agrária";
  // Dado estrutural: cache 7 dias
  readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 7;

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    if (!territory.name || !territory.state) return [];

    // Tenta API CKAN primeiro
    const ckanResults = await this.fetchFromCkan(territory, options);
    if (ckanResults.length > 0) return ckanResults;

    // Fallback: SerpAPI restrito ao domínio incra.gov.br
    return this.fetchFromSerpapi(territory, options);
  }

  private async fetchFromCkan(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const filters = encodeURIComponent(JSON.stringify({ uf: territory.state }));
    const q = encodeURIComponent(territory.name);
    const url = `${CKAN_BASE}?resource_id=${SIPRA_RESOURCE_ID}&q=${q}&filters=${filters}&limit=200`;

    try {
      const res = await fetch(url, {
        signal: options.signal,
        headers: { "User-Agent": "DIT-PRINT/1.0" },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        success?: boolean;
        result?: { records?: SipraRecord[] };
      };
      if (!data.success || !data.result?.records) return [];

      const munNeedle = fold(territory.name);

      for (const rec of data.result.records) {
        const munRec = fold(rec.municipio ?? "");
        if (!munRec.includes(munNeedle)) continue;

        const areaHa =
          typeof rec.area_ha === "string"
            ? parseFloat(rec.area_ha.replace(",", "."))
            : Number(rec.area_ha ?? 0);
        const familias =
          typeof rec.num_familias === "string"
            ? parseInt(rec.num_familias, 10)
            : Number(rec.num_familias ?? rec.capacidade_familias ?? 0);
        const dataCriacao = rec.data_criacao || "";
        const nome = rec.nome_projeto ?? "Assentamento sem nome";

        const title = `INCRA: assentamento "${nome}" em ${territory.name}` +
          (familias > 0 ? ` — ${familias} famílias` : "");
        const summary =
          `Projeto de assentamento (PA) do INCRA. ` +
          `Município: ${rec.municipio ?? territory.name}/${rec.uf ?? territory.state}. ` +
          `Área: ${areaHa > 0 ? areaHa.toFixed(2) + " ha" : "—"}. ` +
          `Famílias assentadas: ${familias > 0 ? familias : "—"}. ` +
          `Data de criação: ${dataCriacao || "—"}. ` +
          `Fase: ${rec.fase ?? "—"}.`;

        signals.push({
          title,
          summary,
          url: `https://www.gov.br/incra/pt-br/assuntos/reforma-agraria/assentamentos`,
          publishedAt: dataCriacao ? new Date(dataCriacao) : new Date(),
          sourceAgentId: this.id,
          rawValue: familias > 0 ? familias : areaHa,
          unit: familias > 0 ? "familias" : "ha",
          metadata: {
            codigoSipra: rec.codigo_sipra,
            uf: rec.uf,
            municipio: rec.municipio,
            areaHa,
            familias,
            fase: rec.fase,
          },
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
    // Query mais aberta — sem aspas excessivas, cobre painel.incra e gov.br.
    const baseQ = `(site:incra.gov.br OR site:gov.br OR site:painel.incra.gov.br) assentamento OR "projeto de assentamento" OR PA`;
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
        // Domínio oficial: aceita direto. Outro: exige menção ao território.
        if (!isOfficial(item.link) && !matchesTerritory(combined, territory)) continue;
        signals.push({
          title: `INCRA (SIPRA): ${item.title}`,
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
}
