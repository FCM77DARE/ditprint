/**
 * Store da camada estrutural — carga nacional em lote, leitura sem rede.
 *
 * Fluxo:
 *   1. `loadNationalStructuralData()` roda UMA vez por mês (script/cron).
 *      Para cada indicador do catálogo, uma requisição `N6[all]` ao IBGE traz
 *      os 5.570 municípios de uma vez. Cinco indicadores = cinco requisições
 *      para o Brasil inteiro.
 *   2. O resultado é gravado em DATA_DIR/structural/municipios.json.
 *   3. `getStructuralForMunicipality(ibgeId)` lê do arquivo (carregado em
 *      memória no primeiro acesso). Zero rede, zero cota, zero custo por
 *      território consultado.
 *
 * É isso que tira a cobertura de D2/D3 de ~20% para 100% em qualquer município
 * do país sem gastar um centavo a mais de busca paga.
 */

import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../_core/logger";
import {
  STRUCTURAL_CATALOG,
  DERIVED_CATALOG,
  type StructuralIndicator,
} from "./catalog";

const log = logger.child({ module: "structural-store" });

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const STRUCT_DIR = join(DATA_DIR, "structural");
const STORE_FILE = join(STRUCT_DIR, "municipios.json");

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v3/agregados";
const FETCH_TIMEOUT_MS = 120_000;

export interface StructuralValue {
  value: number;
  unit: string;
  label: string;
  period: string;
  source: string;
  dimension: string;
  indicatorCode?: string;
  polarity: string;
  /**
   * Posição do município na distribuição nacional deste indicador, 0–1.
   *
   * É o que permite comparar territórios sem inventar faixa arbitrária:
   * "PIB per capita no percentil 12 do país" é uma afirmação verificável e
   * calibrada contra os 5.570 municípios, não contra um número que alguém
   * escolheu. É daqui que sai o score estrutural das dimensões.
   */
  pct?: number;
  /** Procedência exata, para o sinal poder ser conferido pelo cliente */
  provenance: string;
}

export interface StructuralStore {
  generatedAt: string;
  indicatorCount: number;
  municipalityCount: number;
  /** ibgeId → { chave do indicador → valor } */
  data: Record<string, Record<string, StructuralValue>>;
}

// ─── Carga nacional ──────────────────────────────────────────────────────────

interface IbgeSerie {
  localidade: { id: string; nome: string };
  serie: Record<string, string>;
}

async function fetchIndicatorNationwide(
  ind: StructuralIndicator
): Promise<Map<string, { value: number; period: string }>> {
  const classif = ind.classificacao
    ? `&classificacao=${encodeURIComponent(ind.classificacao)}`
    : "";
  const url =
    `${IBGE_BASE}/${ind.agregado}/periodos/${ind.periodo}` +
    `/variaveis/${ind.variavel}?localidades=N6%5Ball%5D${classif}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "DIT-PRINT/1.0 (territorial-intelligence)" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`IBGE ${ind.key} devolveu HTTP ${res.status}`);

  const payload = (await res.json()) as Array<{
    resultados?: Array<{ series?: IbgeSerie[] }>;
  }>;

  const out = new Map<string, { value: number; period: string }>();
  const series = payload?.[0]?.resultados?.[0]?.series ?? [];

  for (const s of series) {
    const ibgeId = s.localidade?.id;
    if (!ibgeId) continue;
    // A série vem como { "2022": "483540" }. Pega o período mais recente.
    const periods = Object.keys(s.serie ?? {}).sort();
    const period = periods[periods.length - 1];
    if (!period) continue;
    const raw = s.serie[period];
    // IBGE usa "-" e "..." para dado indisponível — não vira zero, vira ausência.
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out.set(ibgeId, { value, period });
  }

  return out;
}

/**
 * Baixa o catálogo inteiro para todos os municípios do Brasil e grava em disco.
 * Idempotente: rodar de novo simplesmente reescreve com dado mais fresco.
 */
export async function loadNationalStructuralData(): Promise<StructuralStore> {
  if (!existsSync(STRUCT_DIR)) mkdirSync(STRUCT_DIR, { recursive: true });

  const data: Record<string, Record<string, StructuralValue>> = {};
  let ok = 0;
  let failed = 0;

  for (const ind of STRUCTURAL_CATALOG) {
    const started = Date.now();
    try {
      const values = await fetchIndicatorNationwide(ind);
      for (const [ibgeId, { value, period }] of Array.from(values.entries())) {
        (data[ibgeId] ??= {})[ind.key] = {
          value,
          unit: ind.unit,
          label: ind.label,
          period,
          source: ind.source,
          dimension: ind.dimension,
          indicatorCode: ind.indicatorCode,
          polarity: ind.polarity,
          provenance:
            `IBGE/agregados/${ind.agregado} · variável ${ind.variavel} · ` +
            `N6[${ibgeId}] · ${period}`,
        };
      }
      ok++;
      log.info(
        { indicator: ind.key, municipios: values.size, ms: Date.now() - started },
        "Indicador estrutural carregado para o Brasil inteiro"
      );
    } catch (err) {
      failed++;
      log.error(
        { indicator: ind.key, err: (err as Error).message },
        "Falha ao carregar indicador estrutural"
      );
    }
  }

  // Derivados — calculados sobre o que efetivamente veio.
  for (const der of DERIVED_CATALOG) {
    let computed = 0;
    for (const [ibgeId, byKey] of Object.entries(data)) {
      const flat: Record<string, number> = {};
      for (const [k, v] of Object.entries(byKey)) flat[k] = v.value;
      const value = der.compute(flat);
      if (value === null || !Number.isFinite(value)) continue;
      byKey[der.key] = {
        value,
        unit: der.unit,
        label: der.label,
        period: byKey.pib_corrente?.period ?? "",
        source: der.source,
        dimension: der.dimension,
        polarity: der.polarity,
        provenance: `derivado · ${der.source} · N6[${ibgeId}]`,
      };
      computed++;
    }
    log.info({ indicator: der.key, municipios: computed }, "Indicador derivado calculado");
  }

  // Percentis nacionais — calculados depois que tudo carregou, sobre a
  // distribuição real do país. Um município só é "pobre", "denso" ou
  // "isolado" em relação aos outros 5.569.
  computeNationalPercentiles(data);

  const store: StructuralStore = {
    generatedAt: new Date().toISOString(),
    indicatorCount: ok + DERIVED_CATALOG.length,
    municipalityCount: Object.keys(data).length,
    data,
  };

  await fs.writeFile(STORE_FILE, JSON.stringify(store), "utf8");
  log.info(
    {
      municipios: store.municipalityCount,
      indicadoresOk: ok,
      indicadoresFalhos: failed,
      arquivo: STORE_FILE,
    },
    "Camada estrutural nacional gravada"
  );

  return store;
}

/**
 * Preenche `pct` de cada indicador com a posição do município na distribuição
 * nacional (0 = menor do país, 1 = maior).
 *
 * Empates recebem o mesmo percentil (rank médio), então 300 municípios com
 * densidade idêntica não viram 300 posições diferentes.
 */
function computeNationalPercentiles(
  data: Record<string, Record<string, StructuralValue>>
): void {
  const byIndicator = new Map<string, Array<{ ibgeId: string; value: number }>>();

  for (const [ibgeId, byKey] of Object.entries(data)) {
    for (const [key, v] of Object.entries(byKey)) {
      let arr = byIndicator.get(key);
      if (!arr) {
        arr = [];
        byIndicator.set(key, arr);
      }
      arr.push({ ibgeId, value: v.value });
    }
  }

  for (const [key, arr] of Array.from(byIndicator.entries())) {
    arr.sort((a, b) => a.value - b.value);
    const n = arr.length;
    if (n < 2) continue;

    let i = 0;
    while (i < n) {
      // Bloco de empate
      let j = i;
      while (j + 1 < n && arr[j + 1].value === arr[i].value) j++;
      const meanRank = (i + j) / 2;
      const pct = Math.round((meanRank / (n - 1)) * 1000) / 1000;
      for (let k = i; k <= j; k++) {
        data[arr[k].ibgeId][key].pct = pct;
      }
      i = j + 1;
    }

    log.debug({ indicator: key, municipios: n }, "Percentis nacionais calculados");
  }
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

let memo: StructuralStore | null = null;
let memoPromise: Promise<StructuralStore | null> | null = null;

async function loadStore(): Promise<StructuralStore | null> {
  if (memo) return memo;
  if (memoPromise) return memoPromise;
  memoPromise = (async () => {
    try {
      const raw = await fs.readFile(STORE_FILE, "utf8");
      memo = JSON.parse(raw) as StructuralStore;
      log.info(
        { municipios: memo.municipalityCount, geradoEm: memo.generatedAt },
        "Camada estrutural carregada em memória"
      );
      return memo;
    } catch {
      log.warn(
        { arquivo: STORE_FILE },
        "Camada estrutural ausente — rode `pnpm structural:load`"
      );
      return null;
    } finally {
      memoPromise = null;
    }
  })();
  return memoPromise;
}

/** Invalida o cache em memória (usar depois de uma recarga). */
export function resetStructuralCache(): void {
  memo = null;
}

/** Indicadores estruturais de um município. Vazio se a carga não rodou. */
export async function getStructuralForMunicipality(
  ibgeId: number | string
): Promise<Record<string, StructuralValue>> {
  const store = await loadStore();
  if (!store) return {};
  return store.data[String(ibgeId)] ?? {};
}

/** Metadados da carga — usado no painel de saúde e na procedência do relatório. */
export async function getStructuralStatus(): Promise<{
  available: boolean;
  generatedAt: string | null;
  municipalityCount: number;
  indicatorCount: number;
  ageDays: number | null;
}> {
  const store = await loadStore();
  if (!store) {
    return {
      available: false,
      generatedAt: null,
      municipalityCount: 0,
      indicatorCount: 0,
      ageDays: null,
    };
  }
  const ageDays =
    (Date.now() - new Date(store.generatedAt).getTime()) / (24 * 60 * 60 * 1000);
  return {
    available: true,
    generatedAt: store.generatedAt,
    municipalityCount: store.municipalityCount,
    indicatorCount: store.indicatorCount,
    ageDays: Math.round(ageDays * 10) / 10,
  };
}
