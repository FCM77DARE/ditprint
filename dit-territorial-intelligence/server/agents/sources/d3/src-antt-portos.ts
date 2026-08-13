/**
 * src-antt-portos — ANTT/ANTAQ · Logística e Portos
 *
 * Fontes oficiais:
 *  1) API ANTAQ dados abertos — dadosabertos.antaq.gov.br (CKAN datastore_search)
 *     Consulta de portos e terminais por UF.
 *  2) API ANTT — dados.antt.gov.br (CKAN)
 *
 * SerpAPI só como fallback.
 */

import { BaseSourceAgent } from "../../base-source";
import type { RawSignal, CollectOptions } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import { enrichGeoQuery, matchesTerritory, fold } from "../../geo-filter";
import { serpapiCachedFetch } from "../../serpapi-quota";
import axios from "axios";

// Recursos ANTAQ dados abertos — porto público / TUP / Estação de Transbordo
const ANTAQ_CKAN_BASE = "https://web3.antaq.gov.br/ea/CKAN/api/3/action";

interface CkanRecord {
  nome_porto?: string;
  nome_terminal?: string;
  nome?: string;
  uf?: string;
  municipio?: string;
  tipo?: string;
  situacao?: string;
  latitude?: number | string;
  longitude?: number | string;
  cargas_movimentadas?: string;
  operador?: string;
}

export class SrcAnttPortos extends BaseSourceAgent {
  readonly id = "src-antt-portos";
  readonly dimension = "D3";
  readonly name = "ANTT/ANTAQ - Logística e Portos";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const uf = (territory.state || "").toUpperCase();
    if (!uf) return signals;

    // ── API oficial ANTAQ ── (primária)
    const antaqSignals = await this.fetchAntaq(uf, territory, options);
    signals.push(...antaqSignals);

    // ── Fallback SerpAPI se ANTAQ não trouxe nada ──
    if (signals.length === 0) {
      const fallback = await this.fetchSerpapiFallback(territory, options);
      signals.push(...fallback);
    }

    return signals;
  }

  /**
   * Consulta portos e terminais da ANTAQ na UF do território.
   * Faz filtragem por município no lado do cliente (o CKAN aceita filters mas
   * o schema varia por recurso).
   */
  private async fetchAntaq(
    uf: string,
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    const query = `estados=${uf}`;
    // datastore_search com q por UF
    const url = `${ANTAQ_CKAN_BASE}/datastore_search?resource_id=terminais&q=${encodeURIComponent(uf)}&limit=200`;

    try {
      const res = await axios.get(url, {
        signal: options.signal,
        timeout: 15000,
        headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200 || !res.data) return signals;
      const payload = res.data as { result?: { records?: CkanRecord[] } };
      const records = payload.result?.records ?? [];
      if (records.length === 0) return signals;

      const munFold = fold(territory.name || "");
      const locais = records.filter((r) => {
        const rUf = String(r.uf || "").toUpperCase();
        if (rUf && rUf !== uf) return false;
        // Se tem município no registro, prioriza match; se não, aceita UF
        if (r.municipio && munFold) {
          return fold(r.municipio).includes(munFold);
        }
        return true;
      });

      if (locais.length === 0 && records.length > 0) {
        // Não há terminal no município, mas há na UF — sinal de contexto logístico
        signals.push({
          title: `ANTAQ · ${records.length} terminais/portos na UF ${uf} (nenhum no município de ${territory.name})`,
          summary: `Consulta oficial ao cadastro ANTAQ retornou ${records.length} instalações portuárias no estado ${uf}, mas nenhuma diretamente em ${territory.name}. Município depende de logística intermunicipal.`,
          url: "https://web3.antaq.gov.br/ea/CKAN/",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0.3,
          metadata: { uf, source: "antaq-ckan", ufTotal: records.length, muniHits: 0 },
        });
      }

      for (const r of locais.slice(0, 10)) {
        const nome = r.nome_terminal || r.nome_porto || r.nome || "Instalação portuária";
        signals.push({
          title: `ANTAQ · ${nome} (${r.tipo || "terminal"}) em ${r.municipio || territory.name}/${uf}`,
          summary: `Instalação registrada oficialmente pela ANTAQ. Situação: ${r.situacao || "operacional"}. Operador: ${r.operador || "n/d"}. ${r.cargas_movimentadas ? `Cargas: ${r.cargas_movimentadas}.` : ""}`,
          url: "https://web3.antaq.gov.br/ea/CKAN/",
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: 0.7,
          metadata: {
            uf,
            municipio: r.municipio,
            tipo: r.tipo,
            situacao: r.situacao,
            operador: r.operador,
            source: "antaq-ckan-oficial",
          },
        });
      }
    } catch {
      // silencioso — cai pra fallback
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
      `(site:antt.gov.br OR site:antaq.gov.br) porto OR terminal OR rodoviário`,
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
          title: `ANTT/ANTAQ: ${item.title}`,
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
