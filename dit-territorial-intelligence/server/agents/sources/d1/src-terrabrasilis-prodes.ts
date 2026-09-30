/**
 * src-terrabrasilis-prodes — INPE TerraBrasilis · PRODES e DETER por município
 *
 * Fonte: GeoServer público do INPE (WFS, gratuito, sem chave):
 *   https://terrabrasilis.dpi.inpe.br/geoserver/ows
 *
 * Camadas usadas (verificadas em 30/09/2026):
 *  - Cobertura: `<prodes-...>:municipalities_<bioma>_biome` (municípios dentro do
 *    bioma, campo `geocodigo`). Amazônia, Caatinga, Cerrado, Mata Atlântica,
 *    Pampa e Pantanal.
 *  - PRODES: `<prodes-...>:yearly_deforestation` (Amazônia: `..._biome`), polígonos
 *    de desmatamento anual com `year` e `area_km`. Não trazem município: o agente
 *    busca os polígonos pela caixa do município e conta os cujo centro cai
 *    DENTRO do limite municipal (ponto em polígono). É aproximação declarada no
 *    sinal: polígono que cruza a divisa entra inteiro ou fica fora.
 *  - DETER (só Amazônia e Cerrado, únicos com DETER publicado): alertas com
 *    município e `areamunkm`, últimos 12 meses.
 *
 * COBERTURA HONESTA
 *  Município que não está em nenhum dos seis biomas com PRODES (ou sem camada)
 *  NÃO recebe sinal. Não se inventa "zero" onde o INPE não mede. O status da
 *  última coleta fica em `statusUltimaColeta` e no log ("sem cobertura").
 *
 * REGRA DE IMPACTO (determinística, sem LLM), por km² de desmatamento no ano mais
 * recente do PRODES (ou nos últimos 12 meses do DETER):
 *   0 km²        -> 0,10 (medição de baixa tensão; evidência resolutiva)
 *   < 1 km²      -> 0,25
 *   1 a < 5      -> 0,40
 *   5 a < 25     -> 0,55
 *   25 a < 100   -> 0,70 (alerta)
 *   100 ou mais  -> 0,85
 *
 * ROBUSTEZ
 *  A consulta completa (vários pedidos ao GeoServer, que pode levar dezenas de
 *  segundos) roda em segundo plano, independente do timeout de 30 s da coleta, e
 *  o resultado é cacheado 7 dias em DATA_DIR/d1-oficial. Se a coleta estourar o
 *  tempo, devolve [] e a próxima encontra o resultado pronto.
 */

import { join } from "node:path";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import axios from "axios";
import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { OFICIAL_DIR, USER_AGENT, fmtData, resolverIbge } from "./oficial-util";

const GEOSERVER = "https://terrabrasilis.dpi.inpe.br/geoserver/ows";
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_PEDIDO_MS = 40_000;

interface Bioma {
  nome: string;
  camadaMunicipios: string;
  camadaProdes: string;
  camadaDeter?: { camada: string; porGeocodigo: boolean };
}

const BIOMAS: Bioma[] = [
  {
    nome: "Amazônia",
    camadaMunicipios: "prodes-amazon-nb:municipalities_amazon_biome",
    camadaProdes: "prodes-amazon-nb:yearly_deforestation_biome",
    camadaDeter: { camada: "deter-amz:deter_amz", porGeocodigo: true },
  },
  {
    nome: "Cerrado",
    camadaMunicipios: "prodes-cerrado-nb:municipalities_cerrado_biome",
    camadaProdes: "prodes-cerrado-nb:yearly_deforestation",
    camadaDeter: { camada: "deter-cerrado-nb:deter_cerrado", porGeocodigo: false },
  },
  {
    nome: "Mata Atlântica",
    camadaMunicipios: "prodes-mata-atlantica-nb:municipalities_mata_atlantica_biome",
    camadaProdes: "prodes-mata-atlantica-nb:yearly_deforestation",
  },
  {
    nome: "Caatinga",
    camadaMunicipios: "prodes-caatinga-nb:municipalities_caatinga_biome",
    camadaProdes: "prodes-caatinga-nb:yearly_deforestation",
  },
  {
    nome: "Pampa",
    camadaMunicipios: "prodes-pampa-nb:municipalities_pampa_biome",
    camadaProdes: "prodes-pampa-nb:yearly_deforestation",
  },
  {
    nome: "Pantanal",
    camadaMunicipios: "prodes-pantanal-nb:municipalities_pantanal_biome",
    camadaProdes: "prodes-pantanal-nb:yearly_deforestation",
  },
];

// ─── Resultado em cache ──────────────────────────────────────────────────────

interface ResultadoBioma {
  bioma: string;
  prodes?: {
    anoCamada: number;
    km2: number;
    poligonos: number;
    anoAnterior: number;
    km2Anterior: number;
  };
  deter?: {
    desde: string;
    km2Desmatamento: number;
    km2Outros: number;
    alertas: number;
  };
}
interface Resultado {
  geradoEm: string;
  ibge: string;
  nome: string;
  status: "ok" | "sem_cobertura";
  biomas: ResultadoBioma[];
}

// ─── WFS ─────────────────────────────────────────────────────────────────────

type Geometria = { type: string; coordinates: any } | null;
interface Feicao {
  geometry: Geometria;
  properties: Record<string, any>;
}

/**
 * GetFeature em GeoJSON. Usa WFS 1.0.0 de propósito: a partir da 1.1 o GeoServer
 * inverte a ordem dos eixos do EPSG:4326 (lat, lon) e quebra o ponto em polígono.
 */
async function getFeature(typeName: string, extra: Record<string, string | number>): Promise<Feicao[]> {
  const r = await axios.get(GEOSERVER, {
    params: { service: "WFS", version: "1.0.0", request: "GetFeature", typeName, outputFormat: "application/json", ...extra },
    timeout: TIMEOUT_PEDIDO_MS,
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    validateStatus: (s) => s === 200,
  });
  const d = r.data as { features?: Feicao[] } | string;
  if (typeof d === "string" || !Array.isArray(d?.features)) {
    throw new Error(`GeoServer respondeu sem features para ${typeName}`);
  }
  return d.features;
}

// ─── Geometria ───────────────────────────────────────────────────────────────

type Anel = number[][];

function aneisDe(geom: Geometria): Anel[][] {
  if (!geom) return [];
  if (geom.type === "Polygon") return [geom.coordinates as Anel[]];
  if (geom.type === "MultiPolygon") return geom.coordinates as Anel[][];
  return [];
}

/** Ponto em polígono (par-ímpar sobre todos os anéis: furos entram certo). */
function dentro(x: number, y: number, poligono: Anel[]): boolean {
  let c = false;
  for (const anel of poligono) {
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [xi, yi] = anel[i];
      const [xj, yj] = anel[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

/** Centro do polígono: média dos vértices do anel externo do primeiro polígono. */
function centro(geom: Geometria): [number, number] | null {
  const p = aneisDe(geom)[0]?.[0];
  if (!p || p.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of p) {
    sx += x;
    sy += y;
  }
  return [sx / p.length, sy / p.length];
}

function caixa(poligonos: Anel[][]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pol of poligonos) {
    for (const [x, y] of pol[0] ?? []) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

// ─── Consulta por bioma ──────────────────────────────────────────────────────

const anoMaisRecentePorCamada = new Map<string, number>();

async function anoMaisRecente(camada: string): Promise<number> {
  const cache = anoMaisRecentePorCamada.get(camada);
  if (cache) return cache;
  const f = await getFeature(camada, {
    // Filtro necessário: em algumas camadas (Amazônia) há registros com year nulo,
    // que a ordenação decrescente coloca na frente.
    cql_filter: "year>2000",
    sortBy: "year D",
    maxFeatures: 1,
    propertyName: "year",
  });
  const ano = Number(f[0]?.properties?.year);
  if (!Number.isFinite(ano) || ano < 2000) throw new Error(`Sem ano recente em ${camada}`);
  anoMaisRecentePorCamada.set(camada, ano);
  return ano;
}

async function consultarProdes(
  b: Bioma,
  geocodigo: string
): Promise<ResultadoBioma["prodes"]> {
  const [munFeicoes, anoCamada] = await Promise.all([
    getFeature(b.camadaMunicipios, { cql_filter: `geocodigo='${geocodigo}'` }),
    anoMaisRecente(b.camadaProdes),
  ]);
  const poligonosMun = aneisDe(munFeicoes[0]?.geometry ?? null);
  if (poligonosMun.length === 0) throw new Error("Sem geometria do município");
  const [minX, minY, maxX, maxY] = caixa(poligonosMun);
  const anoAnterior = anoCamada - 1;

  const feicoes = await getFeature(b.camadaProdes, {
    cql_filter: `BBOX(geom,${minX},${minY},${maxX},${maxY}) AND year>=${anoAnterior}`,
    propertyName: "year,area_km,geom",
    maxFeatures: 20000,
  });

  const somaPorAno = new Map<number, { km2: number; n: number }>();
  for (const f of feicoes) {
    const c = centro(f.geometry);
    if (!c) continue;
    if (!poligonosMun.some((p) => dentro(c[0], c[1], p))) continue;
    const ano = Number(f.properties.year);
    const km2 = Number(f.properties.area_km);
    if (!Number.isFinite(ano) || !Number.isFinite(km2)) continue;
    const s = somaPorAno.get(ano) ?? { km2: 0, n: 0 };
    s.km2 += km2;
    s.n += 1;
    somaPorAno.set(ano, s);
  }
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    anoCamada,
    km2: r(somaPorAno.get(anoCamada)?.km2 ?? 0),
    poligonos: somaPorAno.get(anoCamada)?.n ?? 0,
    anoAnterior,
    km2Anterior: r(somaPorAno.get(anoAnterior)?.km2 ?? 0),
  };
}

async function consultarDeter(
  b: Bioma,
  geocodigo: string,
  nome: string,
  uf: string
): Promise<ResultadoBioma["deter"] | undefined> {
  if (!b.camadaDeter) return undefined;
  const desde = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const filtroMun = b.camadaDeter.porGeocodigo
    ? `mun_geocod='${geocodigo}'`
    : `municipality='${nome.replace(/'/g, "''")}' AND uf='${uf}'`;
  const feicoes = await getFeature(b.camadaDeter.camada, {
    cql_filter: `${filtroMun} AND view_date>='${desde}'`,
    propertyName: "classname,areamunkm",
    maxFeatures: 20000,
  });
  let desmat = 0;
  let outros = 0;
  for (const f of feicoes) {
    const km2 = Number(f.properties.areamunkm);
    if (!Number.isFinite(km2)) continue;
    // Desmatamento (corte raso, com vegetação, mineração) tensiona; degradação e
    // cicatriz de queimada vão para "outros" e não entram na regra de impacto.
    if (/DESMATAMENTO|MINERACAO/i.test(String(f.properties.classname ?? ""))) desmat += km2;
    else outros += km2;
  }
  const r = (v: number) => Math.round(v * 100) / 100;
  return { desde, km2Desmatamento: r(desmat), km2Outros: r(outros), alertas: feicoes.length };
}

async function consultarTudo(ibge: string, nome: string, uf: string): Promise<Resultado | null> {
  const cobertura = await Promise.all(
    BIOMAS.map(async (b) => {
      try {
        const f = await getFeature(b.camadaMunicipios, { cql_filter: `geocodigo='${ibge}'`, propertyName: "geocodigo" });
        return { b, dentro: f.length > 0, erro: false };
      } catch {
        return { b, dentro: false, erro: true };
      }
    })
  );
  const biomas = cobertura.filter((c) => c.dentro).map((c) => c.b);
  // Se algum pedido falhou e nenhum bioma confirmou, não dá para afirmar "sem
  // cobertura": devolve null (sem cache) e tenta de novo na próxima coleta.
  if (biomas.length === 0 && cobertura.some((c) => c.erro)) return null;

  const resultado: Resultado = { geradoEm: new Date().toISOString(), ibge, nome, status: biomas.length ? "ok" : "sem_cobertura", biomas: [] };
  for (const b of biomas) {
    const item: ResultadoBioma = { bioma: b.nome };
    const [prodes, deter] = await Promise.allSettled([consultarProdes(b, ibge), consultarDeter(b, ibge, nome, uf)]);
    if (prodes.status === "fulfilled") item.prodes = prodes.value;
    if (deter.status === "fulfilled" && deter.value) item.deter = deter.value;
    // Só guarda o bioma se alguma consulta respondeu; falha total não vira "zero".
    if (item.prodes || item.deter) resultado.biomas.push(item);
  }
  if (biomas.length > 0 && resultado.biomas.length === 0) return null;
  return resultado;
}

// ─── Regra de impacto ────────────────────────────────────────────────────────

/** Regra de impacto por km² de desmatamento, documentada no cabeçalho. */
export function impactoDesmatamento(km2: number): number {
  if (km2 <= 0) return 0.1;
  if (km2 < 1) return 0.25;
  if (km2 < 5) return 0.4;
  if (km2 < 25) return 0.55;
  if (km2 < 100) return 0.7;
  return 0.85;
}

// ─── Agente ──────────────────────────────────────────────────────────────────

const pendentes = new Map<string, Promise<Resultado | null>>();

async function lerCache(ibge: string): Promise<Resultado | null> {
  const arquivo = join(OFICIAL_DIR, `terrabrasilis-${ibge}.json`);
  try {
    const idade = Date.now() - (await stat(arquivo)).mtimeMs;
    if (idade > VALIDADE_MS) return null;
    return JSON.parse(await readFile(arquivo, "utf-8")) as Resultado;
  } catch {
    return null;
  }
}

async function gravarCache(r: Resultado): Promise<void> {
  await mkdir(OFICIAL_DIR, { recursive: true });
  const arquivo = join(OFICIAL_DIR, `terrabrasilis-${r.ibge}.json`);
  await writeFile(`${arquivo}.tmp`, JSON.stringify(r), "utf-8");
  await rename(`${arquivo}.tmp`, arquivo);
}

export class SrcTerrabrasilisProdes extends BaseSourceAgent {
  readonly id: SourceId = "src-terrabrasilis-prodes";
  readonly dimension: DimensionId = "D1";
  readonly name = "INPE TerraBrasilis · PRODES/DETER (desmatamento oficial)";

  /** Resultado da última coleta (diagnóstico: ok, sem_cobertura, indisponivel). */
  statusUltimaColeta: { ibge: string | null; status: "ok" | "sem_cobertura" | "indisponivel" | "sem_ibge" } | null = null;

  protected async fetchSignals(territory: Territory, options: CollectOptions): Promise<RawSignal[]> {
    const ibge = await resolverIbge(territory, options.signal);
    if (!ibge) {
      this.statusUltimaColeta = { ibge: null, status: "sem_ibge" };
      return [];
    }
    const ctx = (territory.contextData ?? {}) as Record<string, unknown>;
    const uf = String(ctx.uf ?? territory.state ?? "").toUpperCase();

    let resultado = await lerCache(ibge);
    if (!resultado) {
      let job = pendentes.get(ibge);
      if (!job) {
        job = consultarTudo(ibge, territory.name, uf)
          .then(async (r) => {
            if (r) await gravarCache(r);
            return r;
          })
          .catch((err) => {
            this.log.warn({ ibge, err: (err as Error).message }, "Consulta ao TerraBrasilis falhou");
            return null;
          })
          .finally(() => pendentes.delete(ibge));
        pendentes.set(ibge, job);
      }
      // A consulta segue em segundo plano se a coleta estourar o tempo.
      const abortou = new Promise<null>((resolve) => {
        if (options.signal?.aborted) resolve(null);
        options.signal?.addEventListener("abort", () => resolve(null), { once: true });
      });
      resultado = await Promise.race([job, abortou]);
    }

    if (!resultado) {
      this.statusUltimaColeta = { ibge, status: "indisponivel" };
      return [];
    }
    if (resultado.status === "sem_cobertura") {
      this.statusUltimaColeta = { ibge, status: "sem_cobertura" };
      this.log.info(
        { territory: territory.slug, ibge },
        "TerraBrasilis: município fora dos seis biomas com PRODES. Fonte sem cobertura; nenhum sinal emitido"
      );
      return [];
    }
    this.statusUltimaColeta = { ibge, status: "ok" };
    return this.montarSinais(territory, resultado);
  }

  private montarSinais(territory: Territory, r: Resultado): RawSignal[] {
    const sinais: RawSignal[] = [];
    const km = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km²`;
    const mes = new Date().toISOString().slice(0, 7);

    for (const b of r.biomas) {
      if (b.prodes) {
        const p = b.prodes;
        const variacao = p.km2Anterior > 0 ? `; em ${p.anoAnterior} foram ${km(p.km2Anterior)}` : "";
        sinais.push({
          title:
            p.km2 > 0
              ? `PRODES/INPE · ${km(p.km2)} de desmatamento em ${territory.name} em ${p.anoCamada} (${b.bioma})`
              : `PRODES/INPE · Nenhum desmatamento detectado em ${territory.name} em ${p.anoCamada} (${b.bioma})`,
          summary:
            `Monitoramento oficial do INPE (PRODES, bioma ${b.bioma}, TerraBrasilis): ${km(p.km2)} de desmatamento no município em ${p.anoCamada} ` +
            `(${p.poligonos} polígono${p.poligonos === 1 ? "" : "s"})${variacao}. Polígonos atribuídos ao município pelo centro, aproximação na divisa.`,
          url: `https://terrabrasilis.dpi.inpe.br/app/map/deforestation?hl=pt-br#prodes-${b.bioma.toLowerCase().replace(/\s+/g, "-")}-${r.ibge}-${mes}`,
          provenance: `INPE TerraBrasilis WFS · ${BIOMAS.find((x) => x.nome === b.bioma)?.camadaProdes} · município ${r.ibge} · ano ${p.anoCamada}`,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: p.km2,
          unit: "km²",
          impactHint: impactoDesmatamento(p.km2),
          metadata: {
            evidenciaOficial: true,
            ibgeId: r.ibge,
            bioma: b.bioma,
            produto: "PRODES",
            anoReferencia: p.anoCamada,
            km2: p.km2,
            poligonos: p.poligonos,
            anoAnterior: p.anoAnterior,
            km2Anterior: p.km2Anterior,
            endpoint: GEOSERVER,
            consultadoEm: r.geradoEm,
            source: "inpe-terrabrasilis-prodes",
          },
        });
      }
      if (b.deter) {
        const d = b.deter;
        sinais.push({
          title:
            d.km2Desmatamento > 0
              ? `DETER/INPE · ${km(d.km2Desmatamento)} de alertas de desmatamento em ${territory.name} nos últimos 12 meses (${b.bioma})`
              : `DETER/INPE · Nenhum alerta de desmatamento em ${territory.name} nos últimos 12 meses (${b.bioma})`,
          summary:
            `Alertas DETER do INPE (TerraBrasilis, bioma ${b.bioma}) desde ${fmtData(d.desde)}: ${km(d.km2Desmatamento)} de desmatamento e mineração` +
            (d.km2Outros > 0 ? `; ${km(d.km2Outros)} de degradação e queimada, fora da regra de impacto` : "") +
            `; ${d.alertas} alerta${d.alertas === 1 ? "" : "s"} no total.`,
          url: `https://terrabrasilis.dpi.inpe.br/app/map/alerts?hl=pt-br#deter-${b.bioma.toLowerCase().replace(/\s+/g, "-")}-${r.ibge}-${mes}`,
          provenance: `INPE TerraBrasilis WFS · ${BIOMAS.find((x) => x.nome === b.bioma)?.camadaDeter?.camada} · município ${r.ibge} · desde ${d.desde}`,
          sourceAgentId: this.id,
          publishedAt: new Date(),
          rawValue: d.km2Desmatamento,
          unit: "km²",
          impactHint: impactoDesmatamento(d.km2Desmatamento),
          metadata: {
            evidenciaOficial: true,
            ibgeId: r.ibge,
            bioma: b.bioma,
            produto: "DETER",
            desde: d.desde,
            km2Desmatamento: d.km2Desmatamento,
            km2Outros: d.km2Outros,
            alertas: d.alertas,
            endpoint: GEOSERVER,
            consultadoEm: r.geradoEm,
            source: "inpe-terrabrasilis-deter",
          },
        });
      }
    }
    return sinais;
  }
}
