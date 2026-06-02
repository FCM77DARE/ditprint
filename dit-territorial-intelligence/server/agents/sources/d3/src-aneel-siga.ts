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

// Resource ID público do SIGA na plataforma de Dados Abertos da ANEEL.
// Atualizado mensalmente pela própria ANEEL.
const SIGA_RESOURCE_ID = "b1bd71e7-d0ad-4214-9053-cbd58e9564a7";
const SIGA_BASE = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";

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
        // Confirma que o município realmente está na lista de municípios do
        // empreendimento (DscMunicipios é texto separado por vírgula no SIGA).
        const munList = (rec.DscMunicipios ?? "").toLowerCase();
        if (!munList.includes(munNeedle)) continue;

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
}
