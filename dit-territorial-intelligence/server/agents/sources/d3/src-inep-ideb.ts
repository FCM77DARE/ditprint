/**
 * src-inep-ideb — INEP IDEB (Índice de Desenvolvimento da Educação Básica)
 *
 * Coleta a nota IDEB de um município (anos iniciais e finais do ensino
 * fundamental). Indicador estrutural de qualidade educacional.
 *
 * Dimensão: D3 (Infraestrutura) — 3.1.3.1 Taxa de escolaridade / qualidade
 *
 * Fonte primária: CKAN dados.gov.br slug "ideb-indice-de-desenvolvimento-
 *                  da-educacao-basica".
 * Fallback: SerpAPI restrito a site:inep.gov.br OR site:qedu.org.br.
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory, fold } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";

// Resource ID do IDEB municipal no dados.gov.br.
// TODO confirmar via UI — sandbox 2026-06-02 bloqueou WebFetch/curl. Quando
// CKAN falhar, fallback SerpAPI cobre (qedu.org.br tem cobertura municipal
// excelente). Revalidar:
//   curl 'https://dados.gov.br/api/3/action/package_search?q=IDEB'
const IDEB_RESOURCE_ID = "f1a3e7c2-9d1c-4a0f-9d8c-3a7c6f1e2b3d";
const CKAN_BASE = "https://dados.gov.br/dados/api/publico/datastore_search";

// Domínios oficiais educacionais (qedu inclui — dado público confiável).
const OFFICIAL_HOSTS = [
  "inep.gov.br",
  "mec.gov.br",
  "gov.br",
  "qedu.org.br",
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

interface IdebRecord {
  ano?: string | number;
  municipio?: string;
  uf?: string;
  rede?: string;          // pública, estadual, municipal
  fase?: string;          // "anos iniciais" | "anos finais"
  ideb?: string | number;
  nota_matematica?: string | number;
  nota_portugues?: string | number;
}

export class SrcInepIdeb extends BaseSourceAgent {
  readonly id: SourceId = "src-inep-ideb";
  readonly dimension: DimensionId = "D3";
  readonly name = "INEP IDEB — Qualidade da Educação Básica";
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
    const url = `${CKAN_BASE}?resource_id=${IDEB_RESOURCE_ID}&q=${q}&filters=${filters}&limit=100`;

    try {
      const res = await fetch(url, {
        signal: options.signal,
        headers: { "User-Agent": "DIT-PRINT/1.0" },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        success?: boolean;
        result?: { records?: IdebRecord[] };
      };
      if (!data.success || !data.result?.records) return [];

      const munNeedle = fold(territory.name);
      const matched = data.result.records.filter((r) =>
        fold(r.municipio ?? "").includes(munNeedle)
      );
      if (matched.length === 0) return [];

      // Agrupa por fase, pega o ano mais recente de cada
      const byFase = new Map<string, IdebRecord>();
      for (const rec of matched) {
        const fase = (rec.fase ?? "geral").toLowerCase();
        const cur = byFase.get(fase);
        if (!cur || Number(rec.ano ?? 0) > Number(cur.ano ?? 0)) {
          byFase.set(fase, rec);
        }
      }

      for (const [fase, rec] of Array.from(byFase.entries())) {
        const ideb = this.toNumber(rec.ideb);
        if (ideb === null) continue;
        const ano = String(rec.ano ?? "");

        signals.push({
          title:
            `INEP IDEB ${ano}: ${territory.name} = ${ideb.toFixed(1)} ` +
            `(${fase}${rec.rede ? `, rede ${rec.rede}` : ""})`,
          summary:
            `Índice IDEB para ${territory.name}/${territory.state}, ${fase}` +
            `${rec.rede ? `, rede ${rec.rede}` : ""}, ano ${ano}: ${ideb.toFixed(2)}. ` +
            (ideb < 4.5 ? `Abaixo da meta nacional — alerta de qualidade.` : ""),
          url: `https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/ideb`,
          publishedAt: ano ? new Date(`${ano}-12-31`) : new Date(),
          sourceAgentId: this.id,
          rawValue: ideb,
          unit: "IDEB",
          metadata: {
            ano,
            fase,
            rede: rec.rede,
            municipio: rec.municipio,
            uf: rec.uf,
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
    // Query aberta — qedu cobre TODO município, inclusive pequenos.
    const baseQ =
      `(site:inep.gov.br OR site:qedu.org.br OR site:gov.br OR site:mec.gov.br) ` +
      `IDEB nota educação básica`;
    const searchString = enrichGeoQuery(baseQ, territory);
    const url =
      `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchString)}` +
      `&num=10&api_key=${SERPAPI_KEY}`;

    try {
      const data = (await serpapiCachedFetch(url, options.signal)) as
        | { organic_results?: Array<{ title: string; snippet?: string; link: string }> }
        | null;
      if (!data) return [];
      const results = data.organic_results ?? [];

      for (const item of results) {
        const combined = `${item.title ?? ""} ${item.snippet ?? ""}`;
        if (!isOfficial(item.link) && !matchesTerritory(combined, territory)) continue;
        signals.push({
          title: `INEP IDEB: ${item.title}`,
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
