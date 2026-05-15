/**
 * src-fogo-cruzado — Instituto Fogo Cruzado
 *
 * Armed violence incidents: shootings, deaths, injuries in metropolitan areas.
 * Dimension: D4 (Dinâmica Territorial) — Indicador 4.2.1.3 (Poder Paralelo)
 *
 * API: https://api.fogocruzado.org.br/api/v2/
 * Coverage: Rio de Janeiro, Recife metropolitan areas
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";

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

    // We use stateId to search if cityId is not available, default to RJ state (id: 33)
    const ctx = territory.contextData as Record<string, unknown> | null;
    let stateId = ctx?.fogoCruzadoStateId as string | undefined;
    if (!stateId) {
      // RJ state id in IBGE is 33, Fogo Cruzado uses IBGE codes for stateId and cityId
      stateId = "33"; 
    }

    // Build period range
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateFrom = thirtyDaysAgo.toISOString().slice(0, 10);
    const dateTo = now.toISOString().slice(0, 10);

    const url =
      `https://api.fogocruzado.org.br/api/v2/occurrences` +
      `?stateId=${stateId}&initialdate=${dateFrom}&finaldate=${dateTo}&take=50`;

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
        state: string;
        city: string;
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

    if (!data.data?.length) return [];

    const incidents = data.data;
    const total = data.pageMeta?.total ?? incidents.length;
    const deaths = incidents.reduce(
      (sum, inc) => sum + inc.victims.filter((v) => v.situation === "Morto").length,
      0
    );
    const injured = incidents.reduce(
      (sum, inc) => sum + inc.victims.filter((v) => v.situation === "Ferido").length,
      0
    );

    return [
      {
        title: `Fogo Cruzado: ${total} tiroteio(s) em ${territory.name} nos últimos 30 dias`,
        summary: `${total} ocorrências de violência armada registradas. Vítimas: ${deaths} morto(s), ${injured} ferido(s). Período: ${dateFrom} a ${dateTo}.`,
        url: "https://fogocruzado.org.br/",
        publishedAt: new Date(),
        sourceAgentId: this.id,
        rawValue: total,
        unit: "tiroteios/30d",
        metadata: { total, deaths, injured, dateFrom, dateTo },
      },
    ];
  }

  private async getAuthToken(signal?: AbortSignal): Promise<string | null> {
    if (cachedToken && Date.now() < tokenExpiresAt) {
      return cachedToken;
    }

    try {
      const res = await fetch("https://api.fogocruzado.org.br/api/v2/auth/login", {
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
