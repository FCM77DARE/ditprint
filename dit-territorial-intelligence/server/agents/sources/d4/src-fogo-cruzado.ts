/**
 * src-fogo-cruzado — Instituto Fogo Cruzado
 *
 * Armed violence incidents: shootings, deaths, injuries in metropolitan areas.
 * Dimension: D4 (Dinâmica Territorial) — Indicador 4.2.1.3 (Poder Paralelo)
 *
 * API: https://api-service.fogocruzado.org.br/api/v2/
 * Coverage: Rio de Janeiro, Recife metropolitan areas
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";

/** UF → UUID, preenchido na primeira consulta a /states. */
const stateIdCache = new Map<string, string>();

/** Nome do estado como o Fogo Cruzado devolve → sigla. */
const UF_POR_NOME: Record<string, string> = {
  "Bahia": "BA",
  "Pará": "PA",
  "Pernambuco": "PE",
  "Rio de Janeiro": "RJ",
};

function normalizarNome(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const FOGO_CRUZADO_EMAIL = process.env.FOGO_CRUZADO_EMAIL ?? "";
const FOGO_CRUZADO_PASSWORD = process.env.FOGO_CRUZADO_PASSWORD ?? "";

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export class SrcFogoCruzado extends BaseSourceAgent {
  readonly id: SourceId = "src-fogo-cruzado";
  readonly dimension: DimensionId = "D4";
  readonly name = "Instituto Fogo Cruzado — Violência Armada";

  protected async fetchSignals(
    territory: Territory,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    if (!FOGO_CRUZADO_EMAIL || !FOGO_CRUZADO_PASSWORD) {
      this.log.warn("Credenciais do Fogo Cruzado ausentes (.env)");
      return [];
    }

    const token = await this.getAuthToken(options.signal);
    if (!token) return [];

    // O Fogo Cruzado cobre QUATRO estados: BA, PA, PE e RJ. Fora deles não há
    // o que buscar, e insistir só gasta requisição e polui o log.
    const ctx = territory.contextData as Record<string, unknown> | null;
    const uf = typeof ctx?.uf === "string" ? ctx.uf.toUpperCase() : null;
    if (!uf) {
      this.log.debug({ territory: territory.slug }, "Território sem UF — Fogo Cruzado não aplicável");
      return [];
    }

    const idState = await this.getStateId(uf, options.signal);
    if (!idState) {
      this.log.debug(
        { territory: territory.slug, uf },
        "UF fora da cobertura do Fogo Cruzado (BA, PA, PE, RJ)"
      );
      return [];
    }

    // Build period range
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateFrom = thirtyDaysAgo.toISOString().slice(0, 10);
    const dateTo = now.toISOString().slice(0, 10);

    // O parâmetro é `idState` e exige UUID. O código mandava `stateId=33`
    // (código IBGE do RJ) e a API respondia 400 com
    // "Id do Estado, deve ser um UUID" — o agente devolvia vazio desde então,
    // e vazio é indistinguível de "não há ocorrência" na contagem de cobertura.
    const url =
      `https://api-service.fogocruzado.org.br/api/v2/occurrences` +
      `?idState=${idState}&initialdate=${dateFrom}&finaldate=${dateTo}&take=500`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: options.signal,
    });
    if (!res.ok) {
      this.log.warn({ status: res.status }, "Erro ao buscar ocorrências do Fogo Cruzado");
      return [];
    }

    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        documentNumber: string | null;
        address: string;
        state: { id?: string; name?: string } | string;
        city: { id?: string; name?: string } | string;
        neighborhood: string;
        subNeighborhood: string | null;
        locality: string | null;
        latitude: number;
        longitude: number;
        date: string;
        policeAction: boolean | null;
        agentPresence: boolean | null;
        relatedRecord: string | null;
        contextInfo: {
          mainReason: { id: string; name: string } | null;
          complementaryReasons: Array<{ id: string; name: string }>;
          clippings: Array<{ id: string; name: string }>;
          massacre: boolean | null;
          policeUnitWasPresent: boolean | null;
        };
        victims: Array<{ type: string; situation: string; genre: string; age: string | null }>;
      }>;
      pageMeta?: { total: number };
    };

    const todasDoEstado = data.data ?? [];

    // FILTRO POR MUNICÍPIO — a consulta é estadual e o relatório é municipal.
    //
    // Antes daqui saía "Fogo Cruzado: N tiroteios em Macaé nos últimos 30
    // dias" com o N do estado inteiro. Numa janela de 14 dias no RJ, 89
    // ocorrências, 59 delas na capital: atribuir esse número a Macaé é
    // afirmação falsa num relatório que um decisor vai conferir.
    const nomesAlvo = new Set(
      (Array.isArray(ctx?.municipiosNomes) ? (ctx.municipiosNomes as unknown[]) : [territory.name])
        .map((v) => normalizarNome(String(v)))
    );

    const incidents = todasDoEstado.filter((inc) => {
      const cidade = typeof inc.city === "string" ? inc.city : inc.city?.name ?? "";
      return nomesAlvo.has(normalizarNome(cidade));
    });

    const total = incidents.length;
    const contaVitimas = (situacao: string) =>
      incidents.reduce(
        (sum, inc) => sum + (inc.victims ?? []).filter((v) => v.situation === situacao).length,
        0
      );
    const deaths = contaVitimas("Morto");
    const injured = contaVitimas("Ferido");

    const escopo = nomesAlvo.size > 1 ? `${nomesAlvo.size} municípios do recorte` : territory.name;

    // Zero também é medição: o Fogo Cruzado cobre este estado, então "nenhum
    // registro no período" é informação, não ausência de dado. É por isso que
    // o sinal sai mesmo com total 0 — e `rawValue` o sustenta como evidência.
    return [
      {
        title:
          total > 0
            ? `Fogo Cruzado: ${total} tiroteio(s) em ${escopo} nos últimos 30 dias`
            : `Fogo Cruzado: nenhum tiroteio registrado em ${escopo} nos últimos 30 dias`,
        summary:
          `${total} ocorrência(s) de violência armada registradas pelo Instituto Fogo Cruzado. ` +
          (total > 0 ? `Vítimas: ${deaths} morto(s), ${injured} ferido(s). ` : "") +
          `Período: ${dateFrom} a ${dateTo}. ` +
          `Recorte municipal sobre ${todasDoEstado.length} ocorrências do estado no período.`,
        url: "https://fogocruzado.org.br/",
        publishedAt: new Date(),
        sourceAgentId: this.id,
        rawValue: total,
        unit: "tiroteios/30d",
        provenance:
          `Fogo Cruzado API v2 · /occurrences · idState=${idState} · ` +
          `${dateFrom} a ${dateTo} · filtrado por município`,
        metadata: {
          total,
          deaths,
          injured,
          dateFrom,
          dateTo,
          ocorrenciasNoEstado: todasDoEstado.length,
          municipios: Array.from(nomesAlvo),
        },
      },
    ];
  }

  /**
   * UF → UUID do estado, lido de /states e guardado em memória.
   *
   * Buscado da API em vez de declarado: UUID digitado à mão é o tipo de
   * constante que ninguém confere e que quebra em silêncio.
   */
  private async getStateId(uf: string, signal?: AbortSignal): Promise<string | null> {
    if (stateIdCache.size === 0) {
      const token = await this.getAuthToken(signal);
      if (!token) return null;
      try {
        const res = await fetch("https://api-service.fogocruzado.org.br/api/v2/states", {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { data?: Array<{ id: string; name: string }> };
        for (const st of body.data ?? []) {
          const sigla = UF_POR_NOME[st.name];
          if (sigla) stateIdCache.set(sigla, st.id);
        }
        this.log.info(
          { estados: Array.from(stateIdCache.keys()) },
          "Cobertura do Fogo Cruzado carregada"
        );
      } catch (err) {
        this.log.warn({ err: (err as Error).message }, "Falha ao listar estados do Fogo Cruzado");
        return null;
      }
    }
    return stateIdCache.get(uf) ?? null;
  }

  private async getAuthToken(signal?: AbortSignal): Promise<string | null> {
    if (cachedToken && Date.now() < tokenExpiresAt) {
      return cachedToken;
    }

    try {
      const res = await fetch("https://api-service.fogocruzado.org.br/api/v2/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: FOGO_CRUZADO_EMAIL,
          password: FOGO_CRUZADO_PASSWORD,
        }),
        signal,
      });

      if (!res.ok) {
        this.log.error({ status: res.status }, "Falha na autenticação do Fogo Cruzado");
        return null;
      }

      const data = await res.json() as { data?: { accessToken?: string; expiresIn?: number } };
      
      if (data?.data?.accessToken) {
        cachedToken = data.data.accessToken;
        // Default to 1 hour expiration if not provided
        const expiresIn = data.data.expiresIn ? (data.data.expiresIn * 1000) : (60 * 60 * 1000);
        tokenExpiresAt = Date.now() + expiresIn - 60000; // 1 min buffer
        return cachedToken;
      }
      
      return null;
    } catch (err) {
      this.log.error({ err }, "Erro ao obter token do Fogo Cruzado");
      return null;
    }
  }
}
