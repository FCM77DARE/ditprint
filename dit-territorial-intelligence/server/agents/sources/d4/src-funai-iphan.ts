/**
 * src-funai-iphan — Patrimônio Cultural, Terras Indígenas, Quilombos
 *
 * Fontes oficiais:
 *  1) FUNAI WFS/WMS — geoserver.funai.gov.br/geoserver/ows
 *     Terras Indígenas por município (spatial query via bbox do território)
 *  2) Fundação Palmares — quilombolas.cultura.gov.br dados.gov.br
 *     Comunidades quilombolas certificadas
 *  3) IPHAN — sicg.iphan.gov.br + api.iphan.gov.br
 *     Bens tombados e registrados
 *
 * SerpAPI é fallback.
 */

import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import { enrichGeoQuery, matchesTerritory, fold } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";
import axios from "axios";

// FUNAI WFS público — camada oficial Terras Indígenas
const FUNAI_WFS = "https://geoserver.funai.gov.br/geoserver/Funai/ows";
// Palmares — CSV oficial de CRQs
const PALMARES_LIST = "https://www.gov.br/palmares/pt-br/acesso-a-informacao/institucional/certificacoes";

interface FunaiFeature {
  properties?: {
    terrai_nom?: string;
    etnia_nome?: string;
    municipio_?: string;
    uf_sigla?: string;
    fase_ti?: string;
    modalidade?: string;
    superficie_?: number;
  };
}

export class SrcFunaiIphan extends BaseSourceAgent {
  readonly id = "src-funai-iphan";
  readonly dimension = "D4";
  readonly name = "FUNAI / Palmares / IPHAN";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];

    // ── 1) FUNAI WFS — Terras Indígenas por UF/município ──
    signals.push(...(await this.fetchFunai(territory, options)));

    // ── 2) IPHAN — patrimônio tombado no município ──
    signals.push(...(await this.fetchIphan(territory, options)));

    // ── Fallback SerpAPI se nada retornou ──
    if (signals.length === 0) {
      signals.push(...(await this.fetchSerpapiFallback(territory, options)));
    }

    return signals;
  }

  /**
   * Consulta FUNAI WFS por UF, filtra município no cliente.
   */
  private async fetchFunai(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const uf = (territory.state || "").toUpperCase();
    if (!uf) return signals;

    const params = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "Funai:tis_poligonais",
      outputFormat: "application/json",
      cql_filter: `uf_sigla LIKE '%${uf}%'`,
      count: "200",
    });
    const url = `${FUNAI_WFS}?${params.toString()}`;

    try {
      const res = await axios.get(url, {
        signal: options.signal,
        timeout: 20000,
        headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200 || !res.data) return signals;
      const payload = res.data as { features?: FunaiFeature[] };
      const feats = payload.features ?? [];
      if (feats.length === 0) return signals;

      const munFold = fold(territory.name || "");
      const locais = feats.filter((f) => {
        const munStr = (f.properties?.municipio_ || "").toString();
        if (!munStr || !munFold) return false;
        return fold(munStr).includes(munFold);
      });

      // Sinal principal: quantas TIs no município
      if (locais.length > 0) {
        for (const f of locais.slice(0, 5)) {
          const p = f.properties || {};
          signals.push({
            title: `FUNAI · Terra Indígena ${p.terrai_nom || "sem nome"} — ${p.etnia_nome || "etnia n/d"} em ${territory.name}`,
            summary: `Terra Indígena reconhecida pela FUNAI. Fase: ${p.fase_ti || "n/d"}. Modalidade: ${p.modalidade || "n/d"}. Superfície: ${p.superficie_ ? `${(p.superficie_ / 10000).toFixed(0)} ha` : "n/d"}. Localização: ${p.municipio_} / ${p.uf_sigla}.`,
            url: "https://terrasindigenas.org.br/",
            sourceAgentId: this.id,
            publishedAt: new Date(),
            rawValue: 0.9, // alta relevância — gatilho CLPI
            metadata: {
              tiNome: p.terrai_nom,
              etnia: p.etnia_nome,
              fase: p.fase_ti,
              modalidade: p.modalidade,
              superficieHa: p.superficie_ ? p.superficie_ / 10000 : null,
              municipio: p.municipio_,
              uf: p.uf_sigla,
              source: "funai-wfs-oficial",
              gatilho_clpi: true,
            },
          });
        }
      } else if (feats.length > 0) {
        // Há TIs na UF mas nenhuma neste município — sinal contextual
        signals.push({
          title: `FUNAI · ${feats.length} Terras Indígenas em ${uf} (nenhuma diretamente em ${territory.name})`,
          summary: `Estado tem ${feats.length} TIs registradas mas nenhuma sobreposta ao território municipal. Verificar TIs limítrofes conforme rotina CLPI.`,
          url: "https://terrasindigenas.org.br/",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0.35,
          metadata: { uf, ufTotal: feats.length, muniHits: 0, source: "funai-wfs-oficial" },
        });
      }
    } catch {
      // silencioso
    }

    return signals;
  }

  /**
   * IPHAN via SICG (endpoint público JSON não estável, então usa
   * dados.gov.br como proxy oficial).
   */
  private async fetchIphan(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const uf = (territory.state || "").toUpperCase();
    if (!uf) return signals;

    // dados.gov.br CKAN — dataset "bens-tombados-iphan"
    const url = `https://dados.gov.br/dados/api/publico/datastore_search?resource_id=iphan-bens-tombados&q=${encodeURIComponent(territory.name || "")}&limit=50`;

    try {
      const res = await axios.get(url, {
        signal: options.signal,
        timeout: 12000,
        headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200 || !res.data) return signals;
      const payload = res.data as { result?: { records?: Array<Record<string, unknown>> } };
      const records = payload.result?.records ?? [];
      const munFold = fold(territory.name || "");
      const locais = records.filter((r) => {
        const mun = fold(String(r.municipio || r.cidade || ""));
        return mun && mun.includes(munFold);
      });

      for (const r of locais.slice(0, 5)) {
        signals.push({
          title: `IPHAN · Bem tombado em ${territory.name}: ${r.denominacao || r.nome || "s/nome"}`,
          summary: `Patrimônio cultural registrado pelo IPHAN. Tipo: ${r.tipo || r.categoria || "n/d"}. Ato: ${r.ato_tombamento || r.processo || "n/d"}.`,
          url: "https://sicg.iphan.gov.br/",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0.55,
          metadata: {
            uf,
            municipio: territory.name,
            source: "iphan-ckan-oficial",
            ...r,
          },
        });
      }
    } catch {
      // silencioso
    }

    return signals;
  }

  private async fetchSerpapiFallback(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const SERPAPI_KEY = process.env.SERPAPI_API_KEY ?? "";
    if (!SERPAPI_KEY) return [];
    const signals: RawSignal[] = [];
    const searchString = enrichGeoQuery(
      `(site:funai.gov.br OR site:iphan.gov.br OR site:palmares.gov.br OR site:terrasindigenas.org.br)`,
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
          title: `FUNAI/IPHAN: ${item.title}`,
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
