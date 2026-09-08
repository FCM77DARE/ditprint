/**
 * src-datasus — DATASUS/CNES · Infraestrutura de Saúde
 *
 * Fontes oficiais (todas gratuitas, sem chave):
 *  1) API CNES — apidadosabertos.saude.gov.br/cnes/estabelecimentos
 *     Retorna estabelecimentos por município (codigo_municipio IBGE).
 *  2) DATASUS Tabnet — tabnet.datasus.gov.br (Tabnet HTTP, GET simples)
 *     Indicadores TABNET (nascimentos, óbitos, cobertura AB).
 *  3) API IBGE localidades — para converter território em código IBGE.
 *
 * SerpAPI é fallback quando as APIs oficiais estão fora do ar.
 */

import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import { enrichGeoQuery, matchesTerritory } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";
import axios from "axios";

interface CnesEstabelecimento {
  codigo_cnes?: number;
  nome_fantasia?: string;
  nome_razao_social?: string;
  tipo_unidade?: string;
  natureza_juridica?: string;
  esfera_administrativa?: string;
  gestao?: string;
  codigo_municipio?: number;
}

export class SrcDatasus extends BaseSourceAgent {
  readonly id = "src-datasus";
  readonly dimension = "D3";
  readonly name = "DATASUS/CNES - Infraestrutura de Saúde";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // ── 1) API oficial CNES (dados abertos SUS) — primária ──
    const ibgeId = this.getIbgeId(territory);
    if (ibgeId) {
      const cnesSignals = await this.fetchCnes(ibgeId, territory, options);
      signals.push(...cnesSignals);
    }

    // ── 2) Fallback SerpAPI se API oficial não trouxe nada ──
    if (signals.length === 0) {
      const fallback = await this.fetchSerpapiFallback(territory, options);
      signals.push(...fallback);
    }

    return signals;
  }

  /**
   * Extrai o código IBGE do território (contextData ou ibgeId direto).
   */
  private getIbgeId(territory: Territory): number | null {
    const ctx = (territory.contextData ?? null) as Record<string, unknown> | null;
    // O schema de `territories` não tem coluna ibgeId — o código do
    // município vem em contextData, gravado na resolução do território.
    const raw =
      ctx?.ibgeId ??
      ctx?.ibgeCode ??
      (Array.isArray(ctx?.ibgeMunicipios) ? (ctx.ibgeMunicipios as unknown[])[0] : undefined);
    const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  /**
   * API oficial CNES — apidadosabertos.saude.gov.br
   */
  private async fetchCnes(
    ibgeId: number,
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    // Código IBGE 7-dígitos → 6-dígitos (padrão CNES corta o dígito verificador)
    const codMun6 = String(ibgeId).slice(0, 6);
    const url = `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?codigo_municipio=${codMun6}&limit=200`;

    try {
      const res = await axios.get(url, {
        signal: options.signal,
        timeout: 15000,
        headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200 || !res.data) return signals;

      const raw = res.data as { estabelecimentos?: CnesEstabelecimento[]; data?: CnesEstabelecimento[]; results?: CnesEstabelecimento[] };
      const items = raw.estabelecimentos ?? raw.data ?? raw.results ?? (Array.isArray(res.data) ? res.data : []);

      if (!Array.isArray(items) || items.length === 0) return signals;

      // Consolidação por tipo de unidade
      const byTipo = new Map<string, number>();
      for (const est of items) {
        const t = (est.tipo_unidade || "OUTROS").trim();
        byTipo.set(t, (byTipo.get(t) || 0) + 1);
      }
      const totalEstab = items.length;

      // Sinal principal: infraestrutura de saúde total
      signals.push({
        title: `CNES · ${territory.name}: ${totalEstab} estabelecimentos de saúde cadastrados`,
        summary: `Consulta oficial ao CNES/DATASUS retornou ${totalEstab} estabelecimentos ativos no município. Distribuição: ${Array.from(
          byTipo.entries()
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([t, n]) => `${n} ${t}`)
          .join("; ")}.`,
        url: `https://cnes2.datasus.gov.br/Mod_Ind_Unidade_Listar.asp?VCod_Municipio=${codMun6}`,
        sourceAgentId: this.id,
        publishedAt: new Date(),
        rawValue: totalEstab,
        unit: "estabelecimentos",
        metadata: {
          ibgeId: codMun6,
          totalEstabelecimentos: totalEstab,
          byTipo: Object.fromEntries(byTipo.entries()),
          source: "cnes-api-oficial",
        },
      });

      // Sinal específico se hospitais < 1 ou UPAs = 0 (déficit estrutural)
      const nHospitais = Array.from(byTipo.entries())
        .filter(([t]) => /HOSPITAL/i.test(t))
        .reduce((sum, [, n]) => sum + n, 0);
      const nUpa = Array.from(byTipo.entries())
        .filter(([t]) => /PRONTO|URG[ÊE]NCIA|UPA/i.test(t))
        .reduce((sum, [, n]) => sum + n, 0);

      if (nHospitais === 0) {
        signals.push({
          title: `CNES · ${territory.name} sem hospital cadastrado`,
          summary: `Nenhum estabelecimento tipo HOSPITAL identificado no CNES para o município. Cobertura hospitalar depende de referência intermunicipal.`,
          url: `https://cnes2.datasus.gov.br/Mod_Ind_Unidade_Listar.asp?VCod_Municipio=${codMun6}`,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0.75, // sinal estrutural relevante
          metadata: { ibgeId: codMun6, indicador: "sem_hospital" },
        });
      }
      if (nUpa === 0 && totalEstab > 5) {
        signals.push({
          title: `CNES · ${territory.name} sem UPA/Pronto Socorro`,
          summary: `Município tem ${totalEstab} unidades de saúde mas nenhuma classificada como pronto atendimento/UPA.`,
          url: `https://cnes2.datasus.gov.br/Mod_Ind_Unidade_Listar.asp?VCod_Municipio=${codMun6}`,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0.6,
          metadata: { ibgeId: codMun6, indicador: "sem_upa" },
        });
      }
    } catch {
      // silencioso — cai pra fallback SerpAPI
    }

    return signals;
  }

  /**
   * Fallback: SerpAPI restrita a domínios oficiais.
   */
  private async fetchSerpapiFallback(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];

    const signals: RawSignal[] = [];
    const searchString = enrichGeoQuery(
      `(site:datasus.gov.br OR site:saude.gov.br OR site:cnes.datasus.gov.br) hospital OR CNES OR SUS`,
      territory
    );
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchString)}&num=5&api_key=${SERPAPI_KEY}`;

    try {
      const data = (await serpapiCachedFetch(url, options.signal)) as
        | { organic_results?: Array<{ title: string; snippet?: string; link: string }> }
        | null;
      if (!data) return signals;
      for (const item of data.organic_results ?? []) {
        const combined = `${item.title ?? ""} ${item.snippet ?? ""}`;
        if (!matchesTerritory(combined, territory)) continue;
        signals.push({
          title: `DATASUS: ${item.title}`,
          summary: item.snippet,
          url: item.link,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          metadata: { source: "serpapi-fallback" },
        });
      }
    } catch {
      // ignore
    }
    return signals;
  }
}
