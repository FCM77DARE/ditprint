/**
 * Identidade do município pelo código IBGE (nome, UF e população do Censo 2022).
 *
 * Fonte OFICIAL e GRATUITA, sem chave: IBGE/SIDRA, agregado 4714 (população
 * residente), que devolve o nome já com a sigla da UF ("Caiçara do Norte (RN)").
 *   https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93?localidades=N6[<ibge>]
 *
 * Usado pelos agentes que precisam do NOME do município (busca textual no
 * Congresso) ou do TAMANHO dele (comparar volume de contratações por
 * habitante). Falha de rede devolve null: o agente segue sem o dado e nunca
 * inventa nome nem população.
 */

import axios from "axios";

const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface IdentidadeMunicipio {
  ibge: string;
  nome: string;
  uf: string;
  populacao: number;
}

const cache = new Map<string, { ate: number; dado: IdentidadeMunicipio | null }>();

export function urlIdentidade(ibge: string): string {
  return `https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93?localidades=N6%5B${ibge}%5D`;
}

/** Lê a resposta do agregado 4714. Exportada para teste sem rede. */
export function lerIdentidade(ibge: string, corpo: unknown): IdentidadeMunicipio | null {
  const serie = (corpo as any)?.[0]?.resultados?.[0]?.series?.[0];
  const rotulo: unknown = serie?.localidade?.nome;
  const pop = Number(serie?.serie?.["2022"]);
  if (typeof rotulo !== "string") return null;
  const m = rotulo.match(/^(.*) \(([A-Z]{2})\)$/);
  if (!m) return null;
  return { ibge, nome: m[1], uf: m[2], populacao: Number.isFinite(pop) ? pop : 0 };
}

export async function identidadeMunicipio(ibge: string, signal?: AbortSignal): Promise<IdentidadeMunicipio | null> {
  const hit = cache.get(ibge);
  if (hit && hit.ate > Date.now()) return hit.dado;
  try {
    const res = await axios.get(urlIdentidade(ibge), {
      signal,
      timeout: TIMEOUT_MS,
      headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
      validateStatus: (s) => s < 500,
    });
    if (res.status !== 200) return null;
    const dado = lerIdentidade(ibge, res.data);
    if (dado) cache.set(ibge, { ate: Date.now() + CACHE_TTL_MS, dado });
    return dado;
  } catch {
    return null;
  }
}

/** Códigos IBGE (7 dígitos) do território, do mesmo jeito que o src-siconfi lê. */
export function ibgeIdsDoTerritorio(contextData: unknown): string[] {
  const ctx = (contextData ?? null) as Record<string, unknown> | null;
  if (!ctx) return [];
  const lista = ctx.ibgeMunicipios;
  if (Array.isArray(lista) && lista.length > 0) {
    return lista.map((v) => String(v)).filter((v) => /^\d{7}$/.test(v));
  }
  const direto = ctx.ibgeId ?? ctx.ibgeCode;
  const s = direto == null ? "" : String(direto);
  return /^\d{7}$/.test(s) ? [s] : [];
}
