/**
 * src-aneel-siga — ANEEL Sistema de Informações de Geração (SIGA)
 *
 * Lista empreendimentos de geração de energia (eólica, solar, hídrica, térmica)
 * por município. Permite detectar parques renováveis instalados de forma
 * estruturada — sem depender de manchete de mídia.
 *
 * Dimensão: D3 (Infraestrutura e Serviços) — Indicador 3.2.4 Logística/Energia
 *
 * API: dadosabertos.aneel.gov.br — datastore_search público (CKAN), sem auth.
 *
 * Bug que resolve (feedback equipe 2026-06): Rio do Fogo abriga os parques
 * Arizona I (Iberdrola) e Arizona II (Força Eólica) — fato territorial
 * relevante que nunca aparecia nos sinais coletados via mídia.
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { enrichGeoQuery, matchesTerritory } from "../../geo-filter";

// Resource ID público do CSV "siga-empreendimentos-geracao" no SIGA.
// VALIDADO 02/06/2026 — query "Rio do Fogo" retorna parques eólicos reais
// (RN 15 - Rio do Fogo, Arizona 1, etc).
// Atualização do dataset: mensal.
//   curl 'https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=11ec447d-698d-4ab8-977f-b424d5deee6a&q=Rio+do+Fogo'
const SIGA_RESOURCE_ID = "11ec447d-698d-4ab8-977f-b424d5deee6a";
const SIGA_BASE = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";

// Domínios oficiais reconhecidos — quando o resultado vem de um destes, NÃO
// exigimos que o texto mencione UF/nome do município (assumimos que o
// conteúdo na URL é factual sobre o município consultado).
const OFFICIAL_HOSTS = [
  "aneel.gov.br",
  "gov.br",
  "epe.gov.br",
  "mme.gov.br",
];

function isOfficial(url?: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OFFICIAL_HOSTS.some((d) => host === d || host.endsWith("." + d) || host.endsWith(d));
  } catch {
    return false;
  }
}

interface SigaRecord {
  NomEmpreendimento?: string;
  IdeNucleoCEG?: string;
  CodCEG?: string;
  SigUFPrincipal?: string;
  MdaPotenciaOutorgadaKw?: string | number;
  MdaPotenciaFiscalizadaKw?: string | number;
  DatEntradaOperacao?: string;
  DscPropriRegime?: string;
  DscFonteCombustivel?: string;
  DscOrigemCombustivel?: string;
  DscTipoOutorga?: string;
  DscMunicipios?: string;
  SigTipoGeracao?: string;
  IdcGeracaoQualificada?: string;
  DscSubBacia?: string;
  DscRioOperaUsina?: string;
}

export class SrcAneelSiga extends BaseSourceAgent {
  readonly id: SourceId = "src-aneel-siga";
  readonly dimension: DimensionId = "D3";
  readonly name = "ANEEL SIGA — Empreendimentos de Geração";
  // SIGA é atualizado mensalmente: cache 7d é suficiente
  readonly cacheTtlMs = 1000 * 60 * 60 * 24 * 7;

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    if (!territory.name || !territory.state) return [];

    const ckan = await this.fetchFromCkan(territory, options);
    if (ckan.length > 0) return ckan;

    // Fallback agressivo via SerpAPI: querido para municípios pequenos
    // (Rio do Fogo/RN etc) que não foram capturados pelo CKAN.
    return this.fetchFromSerpapi(territory, options);
  }

  private async fetchFromCkan(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // Consulta com filtro por nome do município + UF.
    // CKAN datastore_search aceita `q` (texto livre) e `filters` (JSON).
    const filters = encodeURIComponent(
      JSON.stringify({ SigUFPrincipal: territory.state })
    );
    const q = encodeURIComponent(territory.name);
    const url = `${SIGA_BASE}?resource_id=${SIGA_RESOURCE_ID}&q=${q}&filters=${filters}&limit=200`;

    try {
      const res = await fetch(url, {
        signal: options.signal,
        headers: { "User-Agent": "DIT-PRINT/1.0" },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        success?: boolean;
        result?: { records?: SigaRecord[] };
      };
      if (!data.success || !data.result?.records) return [];

      const munNeedle = territory.name.toLowerCase();

      for (const rec of data.result.records) {
        // Aceita o empreendimento se:
        //  (a) DscMunicipios contém o município, OU
        //  (b) NomEmpreendimento contém o município (ex: "RN 15 - Rio do Fogo"), OU
        //  (c) DscMunicipios está vazio + UF bate (CKAN às vezes não retorna o
        //      campo no result do datastore_search) — confiamos no filtro UF.
        const munList = (rec.DscMunicipios ?? "").toLowerCase();
        const empName = (rec.NomEmpreendimento ?? "").toLowerCase();
        const inMunList = munNeedle && munList.includes(munNeedle);
        const inNome = munNeedle && empName.includes(munNeedle);
        const emptyMunListButUfMatches =
          !munList && rec.SigUFPrincipal === territory.state;
        if (!inMunList && !inNome && !emptyMunListButUfMatches) continue;

        const potKw =
          typeof rec.MdaPotenciaFiscalizadaKw === "string"
            ? parseFloat(rec.MdaPotenciaFiscalizadaKw.replace(",", "."))
            : Number(rec.MdaPotenciaFiscalizadaKw ?? 0);
        const potMw = Number.isFinite(potKw) ? potKw / 1000 : 0;
        const fonte = (rec.DscFonteCombustivel ?? rec.SigTipoGeracao ?? "energia").toLowerCase();
        const dataOp = rec.DatEntradaOperacao || "";
        const tipoOp = rec.DscTipoOutorga || "";

        const title =
          `ANEEL: empreendimento ${fonte} "${rec.NomEmpreendimento ?? "sem nome"}" ` +
          `em ${territory.name}${potMw > 0 ? ` — ${potMw.toFixed(1)} MW` : ""}`;
        const summary =
          `Fonte: ${rec.DscFonteCombustivel ?? "—"}. ` +
          `Potência fiscalizada: ${potMw > 0 ? potMw.toFixed(2) + " MW" : "—"}. ` +
          `Outorga: ${tipoOp}. Início operação: ${dataOp || "—"}. ` +
          `Municípios: ${rec.DscMunicipios ?? "—"}.`;

        signals.push({
          title,
          summary,
          url: `https://app4.aneel.gov.br/SIGA/`,
          publishedAt: dataOp ? new Date(dataOp) : new Date(),
          sourceAgentId: this.id,
          rawValue: potMw,
          unit: "MW",
          metadata: {
            ceg: rec.CodCEG,
            uf: rec.SigUFPrincipal,
            fonte: rec.DscFonteCombustivel,
            tipoOutorga: tipoOp,
            municipios: rec.DscMunicipios,
            potenciaMw: potMw,
          },
        });
      }
    } catch {
      // Falha de rede / API instável — retorna [] silenciosamente
      return [];
    }

    return signals;
  }

  /**
   * Fallback SerpAPI agressivo: consulta aberta, restringe a domínios oficiais
   * de energia. Para resultados de host oficial NÃO aplicamos matchesTerritory
   * (assumimos que o conteúdo da página oficial é confiável sobre o município).
   */
  private async fetchFromSerpapi(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    const signals: RawSignal[] = [];
    // Query aberta — sem aspas excessivas (pode demais p/ municípios pequenos).
    // Restringe a sites do setor elétrico.
    const baseQ = `(site:aneel.gov.br OR site:epe.gov.br OR site:gov.br) parque eólico OR usina OR empreendimento geração`;
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
        // Se NÃO é domínio oficial, exige menção ao território.
        // Se É domínio oficial, aceita direto.
        if (!isOfficial(item.link) && !matchesTerritory(combined, territory)) continue;
        signals.push({
          title: `ANEEL/Setor Elétrico: ${item.title}`,
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
