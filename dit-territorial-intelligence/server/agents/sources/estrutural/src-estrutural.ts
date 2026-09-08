/**
 * Agentes da camada estrutural — leem do store nacional, não da rede.
 *
 * Diferente de todo o resto da malha, estes agentes não fazem requisição
 * externa nenhuma durante a análise de um território. A carga nacional já
 * rodou em lote (`pnpm structural:load`), e aqui é só leitura de disco por
 * código IBGE.
 *
 * Consequências, que são o ponto inteiro da mudança:
 *   • cobertura de D2/D3 igual em Macaé e em município de 2 mil habitantes —
 *     o IBGE mede os dois, então os dois têm dado;
 *   • custo marginal por território consultado: zero (não consome SerpAPI,
 *     não consome cota, não depende de o Google ter indexado alguma coisa);
 *   • o sinal carrega `rawValue` e `provenance` (agregado, variável, período),
 *     então o cliente consegue abrir e conferir número por número.
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { getStructuralForMunicipality } from "../../../structural/store";

abstract class StructuralSourceAgent extends BaseSourceAgent {
  readonly cacheTtlMs = 0; // leitura de disco, cache não faz sentido

  protected async fetchSignals(
    territory: Territory,
    _options: CollectOptions
  ): Promise<RawSignal[]> {
    // Recorte composto (Baía de Guanabara) traz vários municípios. Emitimos
    // um sinal por município e por indicador, com o código no título — somar
    // ou mostrar só o primeiro descreveria um território que não existe.
    const ibgeIds = resolveIbgeIds(territory);
    if (ibgeIds.length === 0) {
      this.log.debug(
        { territory: territory.slug },
        "Sem código IBGE no território — camada estrutural não aplicável"
      );
      return [];
    }

    const composto = ibgeIds.length > 1;
    const signals: RawSignal[] = [];

    for (const ibgeId of ibgeIds) {
      const indicators = await getStructuralForMunicipality(ibgeId);
      for (const [key, v] of Object.entries(indicators)) {
        if (v.dimension !== this.dimension) continue;
        signals.push({
          title: composto
            ? `${v.label} (IBGE ${ibgeId}): ${formatValue(v.value, v.unit)}`
            : `${v.label}: ${formatValue(v.value, v.unit)}`,
          summary:
            `${v.label} do município (código IBGE ${ibgeId}) segundo ${v.source}, ` +
            `período ${v.period}. Indicador estrutural — vale até a próxima ` +
            `divulgação da fonte, não decai com o tempo.` +
            (composto
              ? ` Integra um recorte de ${ibgeIds.length} municípios; no score, ` +
                "os membros entram ponderados por população."
              : ""),
          sourceAgentId: this.id,
          publishedAt: periodToDate(v.period),
          rawValue: v.value,
          unit: v.unit,
          provenance: v.provenance,
          metadata: {
            structural: true,
            indicatorKey: key,
            indicatorCode: v.indicatorCode,
            polarity: v.polarity,
            period: v.period,
            ibgeId,
            composite: composto,
          },
        });
      }
    }

    if (signals.length === 0) {
      this.log.debug(
        { territory: territory.slug, ibgeIds, dimension: this.dimension },
        "Camada estrutural sem indicadores para esta dimensão"
      );
    }

    return signals;
  }
}

export class SrcEstruturalD2 extends StructuralSourceAgent {
  readonly id: SourceId = "src-estrutural-d2";
  readonly dimension: DimensionId = "D2";
  readonly name = "Camada estrutural — IBGE (população, PIB, renda)";
}

export class SrcEstruturalD3 extends StructuralSourceAgent {
  readonly id: SourceId = "src-estrutural-d3";
  readonly dimension: DimensionId = "D3";
  readonly name = "Camada estrutural — IBGE (área, densidade, infraestrutura)";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * O código IBGE chega por caminhos diferentes conforme a origem do território
 * (registro do banco, lista em disco do scheduler, resolução da landing).
 */
function resolveIbgeIds(territory: Territory): string[] {
  const ctx = territory.contextData as Record<string, unknown> | null;
  if (!ctx) return [];

  // A lista manda: é ela que carrega o recorte inteiro. `ibgeId` é o
  // escalar de compatibilidade, usado só quando a lista não veio.
  const list = ctx.ibgeMunicipios;
  if (Array.isArray(list) && list.length > 0) {
    return list.map((v) => String(v)).filter((v) => v.length > 0);
  }

  const direct = ctx.ibgeId;
  if (typeof direct === "string" && direct.length > 0) return [direct];
  if (typeof direct === "number") return [String(direct)];

  return [];
}

function formatValue(value: number, unit: string): string {
  const formatted = Number.isInteger(value)
    ? value.toLocaleString("pt-BR")
    : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${formatted} ${unit}`;
}

/**
 * Período do IBGE ("2022") vira data de referência do sinal. O consolidador
 * trata sinal estrutural com peso temporal 1.0, então esta data serve para
 * exibição e auditoria, não para decaimento.
 */
function periodToDate(period: string): Date {
  const year = Number(period);
  if (Number.isFinite(year) && year > 1900 && year < 2200) {
    return new Date(Date.UTC(year, 11, 31));
  }
  return new Date();
}
