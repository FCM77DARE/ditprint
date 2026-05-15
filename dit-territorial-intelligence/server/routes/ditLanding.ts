/**
 * DIT Landing — Endpoint público para análise de qualquer território
 *
 * POST /api/dit/analyze
 * Body: { territory: string }
 *
 * Fluxo real (sem mock):
 * 1. Lookup IBGE → identifica município, estado, região
 * 2. Find/create territory record no DB
 * 3. Run orchestrator.run(territory) — todos os 32 agentes reais + orquestrador
 * 4. Build LLM prompt com dados reais coletados pelo orquestrador
 * 5. Call LLM → relatório executivo (STT global exposto; D-scores ocultos)
 * 6. Retorna DIT formatado como JSON
 *
 * Produto: STT Global visível ($9,90). Scores por dimensão → DIT Completo (premium).
 * Cache: 6h por território. Rate limit: 10 req/min por IP.
 */

import { Router, Request, Response } from "express";
import { ENV } from "../_core/env";
import { logger } from "../_core/logger";
import { getDb } from "../db";
import { territories } from "../../drizzle/schema";
import type { Territory } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { orchestrator } from "../agents/orchestrator";
import type { DimensionResult } from "../agents/types";
import type { DimensionId } from "../indicators";
import { runStrategicLayer } from "../strategic/runner";
import type { TerritoryStrategicContext } from "../strategic/types";

const log = logger.child({ module: "dit-landing" });

export const ditLandingRouter = Router();

// ── CORS (landing page pode ser file:// ou domínio externo) ──────────────────
ditLandingRouter.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
ditLandingRouter.options("*", (_req, res) => res.sendStatus(204));

// ── HEALTH CHECK (Railway / monitoring) ───────────────────────────────────────
ditLandingRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "dit-landing", ts: new Date().toISOString() });
});

// ── CACHE (6h por território) ─────────────────────────────────────────────────
const analysisCache = new Map<string, { result: unknown; ts: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// ── RATE LIMIT (por IP) ───────────────────────────────────────────────────────
const requestLog = new Map<string, number[]>();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (requestLog.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  times.push(now);
  requestLog.set(ip, times);
  return times.length > RATE_MAX;
}

// ── IBGE LOOKUP ───────────────────────────────────────────────────────────────

interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string;
        nome?: string;
        regiao?: { nome?: string };
      };
    };
  };
}

// ── RESOLUÇÃO HIERÁRQUICA: município → distrito → localidade (OSM) ────────────
// IBGE `/municipios?nome=` ignora o filtro e devolve a lista inteira. Por isso
// baixamos a lista completa (uma vez por processo) e filtramos localmente
// usando normalização accent-insensitive. Aceita "Cidade" ou "Cidade, UF".
// Distritos (10k+) seguem o mesmo padrão. Para localidades que não constam
// no IBGE (bairros, terminais, vilas), caímos no Nominatim (OSM) e usamos a
// `address.municipality` retornada para re-ancorar no IBGE.

export type ResolvedLocationKind = "municipality" | "district" | "locality";

export interface ResolvedLocation {
  kind: ResolvedLocationKind;
  name: string;          // nome local (ex: "Cabiúnas")
  ibgeId: number;        // sempre o id do município pai (para stats downstream)
  municipality: string;  // município pai (== name quando kind === 'municipality')
  state: string;         // sigla UF
  region: string;        // nome da região (Sudeste, Nordeste…)
  centroid?: { lat: number; lng: number };
  bbox?: [number, number, number, number];
}

interface IbgeDistrito {
  id: number;
  nome: string;
  municipio: IbgeMunicipio;
}

const CAPITAL_IBGE_IDS = new Set<number>([
  1200401, 1302603, 1400100, 1501402, 1600303, 1721000, 2111300, 2211001,
  2304400, 2408102, 2507507, 2611606, 2704302, 2800308, 2927408, 3106200,
  3205309, 3304557, 3550308, 4106902, 4205407, 4314902, 5002704, 5103403,
  5208707, 5300108,
]);

let ibgeCache: IbgeMunicipio[] | null = null;
let ibgeCachePromise: Promise<IbgeMunicipio[] | null> | null = null;

async function loadAllMunicipios(): Promise<IbgeMunicipio[] | null> {
  if (ibgeCache) return ibgeCache;
  if (ibgeCachePromise) return ibgeCachePromise;
  ibgeCachePromise = (async () => {
    try {
      const res = await fetch(
        "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
        {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "DIT-PRINT/1.0" },
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as IbgeMunicipio[];
      ibgeCache = data;
      return data;
    } catch {
      return null;
    } finally {
      ibgeCachePromise = null;
    }
  })();
  return ibgeCachePromise;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTerritoryInput(raw: string): { name: string; state: string | null } {
  // Aceita "Belo Horizonte, MG", "Belo Horizonte - MG", "Belo Horizonte/MG", "Belo Horizonte (MG)"
  const m = raw.match(/^(.*?)[\s,/\-(]+([A-Za-z]{2})\)?\s*$/);
  if (m) {
    const state = m[2].toUpperCase();
    if (state.length === 2) return { name: m[1].trim(), state };
  }
  return { name: raw.trim(), state: null };
}

let distritosCache: IbgeDistrito[] | null = null;
let distritosCachePromise: Promise<IbgeDistrito[] | null> | null = null;

async function loadAllDistritos(): Promise<IbgeDistrito[] | null> {
  if (distritosCache) return distritosCache;
  if (distritosCachePromise) return distritosCachePromise;
  distritosCachePromise = (async () => {
    try {
      const res = await fetch(
        "https://servicodados.ibge.gov.br/api/v1/localidades/distritos",
        {
          signal: AbortSignal.timeout(20000),
          headers: { "User-Agent": "DIT-PRINT/1.0" },
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as IbgeDistrito[];
      distritosCache = data;
      return data;
    } catch {
      return null;
    } finally {
      distritosCachePromise = null;
    }
  })();
  return distritosCachePromise;
}

function pickMatches<T extends { nome: string }>(list: T[], target: string): T[] {
  let hits = list.filter((x) => normalize(x.nome) === target);
  if (hits.length === 0) hits = list.filter((x) => normalize(x.nome).startsWith(target));
  if (hits.length === 0) hits = list.filter((x) => normalize(x.nome).includes(target));
  return hits;
}

// ── NOMINATIM (locality fallback) ─────────────────────────────────────────────

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  suburb?: string;
  municipality?: string;
  state?: string;
  region?: string;
  "ISO3166-2-lvl4"?: string;
  country_code?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  boundingbox?: [string, string, string, string];
  address?: NominatimAddress;
}

async function lookupNominatim(
  rawName: string,
  hintState: string | null
): Promise<NominatimResult | null> {
  try {
    const q = hintState ? `${rawName}, ${hintState}, Brasil` : `${rawName}, Brasil`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      q
    )}&format=json&limit=3&countrycodes=br&addressdetails=1`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "DIT-PRINT/1.0 (contact@print.com.br)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResult[];
    if (!data?.length) return null;
    // Prefere hit que tenha município preenchido no endereço
    const withMun =
      data.find((d) => d.address?.city || d.address?.municipality || d.address?.town) ?? data[0];
    return withMun;
  } catch {
    return null;
  }
}

function buildLocation(
  kind: ResolvedLocationKind,
  localName: string,
  parentMun: IbgeMunicipio,
  geo?: { centroid: { lat: number; lng: number }; bbox: [number, number, number, number] }
): ResolvedLocation {
  return {
    kind,
    name: localName,
    ibgeId: parentMun.id,
    municipality: parentMun.nome,
    state: parentMun.microrregiao?.mesorregiao?.UF?.sigla ?? "",
    region: parentMun.microrregiao?.mesorregiao?.UF?.regiao?.nome ?? "",
    centroid: geo?.centroid,
    bbox: geo?.bbox,
  };
}

/**
 * Resolve qualquer entrada (município, distrito ou localidade OSM) para uma
 * estrutura completa com município pai, UF, região e geometria (centroid+bbox).
 */
async function resolveLocation(rawName: string): Promise<ResolvedLocation | null> {
  const { name, state: hintState } = parseTerritoryInput(rawName);
  const target = normalize(name);
  if (!target) return null;

  // ── 1) Município ───────────────────────────────────────────────────────────
  const munList = await loadAllMunicipios();
  if (munList) {
    let hits = pickMatches(munList, target);
    // Se UF foi informada, exigimos UF — sem fallback "wrong-UF".
    if (hintState) {
      hits = hits.filter(
        (m) => m.microrregiao?.mesorregiao?.UF?.sigla === hintState
      );
    }
    if (hits.length > 0) {
      const m = hits.find((x) => CAPITAL_IBGE_IDS.has(x.id)) ?? hits[0];
      const geo = await lookupGeoBox(m.nome, m.microrregiao?.mesorregiao?.UF?.sigla ?? "");
      return buildLocation("municipality", m.nome, m, geo ?? undefined);
    }
  }

  // ── 2) Distrito (EXACT match apenas — evita "Copacabana"→"Copacabana do Norte") ─
  const distList = await loadAllDistritos();
  let distritoHit: IbgeDistrito | null = null;
  if (distList) {
    const allHits = distList.filter((x) => normalize(x.nome) === target);
    // Quando o usuário informa UF, só consideramos distritos daquela UF.
    const hits = hintState
      ? allHits.filter(
          (d) => d.municipio.microrregiao?.mesorregiao?.UF?.sigla === hintState
        )
      : allHits;
    distritoHit = hits[0] ?? null;
    // Se UF foi explicitada e bateu distrito naquela UF, confiamos no IBGE.
    if (distritoHit && hintState) {
      const d = distritoHit;
      const geo = await lookupGeoBox(
        d.nome,
        d.municipio.microrregiao?.mesorregiao?.UF?.sigla ?? ""
      );
      return buildLocation("district", d.nome, d.municipio, geo ?? undefined);
    }
  }

  // ── 3) Localidade (Nominatim/OSM) ──────────────────────────────────────────
  const osm = await lookupNominatim(name, hintState);
  if (osm) {
    const muniName =
      osm.address?.city ||
      osm.address?.municipality ||
      osm.address?.town ||
      osm.address?.village ||
      "";
    // Re-âncora no IBGE pelo município pai
    if (muniName && munList) {
      const muniTarget = normalize(muniName);
      const muniHits = munList.filter((m) => normalize(m.nome) === muniTarget);
      const ufFromIso = osm.address?.["ISO3166-2-lvl4"]?.split("-")[1];
      const m =
        (ufFromIso &&
          muniHits.find((x) => x.microrregiao?.mesorregiao?.UF?.sigla === ufFromIso)) ||
        muniHits[0];
      if (m) {
        const lat = parseFloat(osm.lat);
        const lng = parseFloat(osm.lon);
        let bbox: [number, number, number, number] | undefined;
        if (osm.boundingbox && osm.boundingbox.length === 4) {
          const [south, north, west, east] = osm.boundingbox.map(parseFloat);
          if ([south, north, west, east].every(Number.isFinite)) {
            bbox = [west, south, east, north];
          }
        }
        return buildLocation(
          "locality",
          osm.name || name,
          m,
          Number.isFinite(lat) && Number.isFinite(lng)
            ? { centroid: { lat, lng }, bbox: bbox ?? [lng - 0.1, lat - 0.1, lng + 0.1, lat + 0.1] }
            : undefined
        );
      }
    }
  }

  // ── 4) Último recurso: distrito IBGE sem UF (homônimos em municípios pequenos) ─
  if (distritoHit) {
    const d = distritoHit;
    const geo = await lookupGeoBox(
      d.nome,
      d.municipio.microrregiao?.mesorregiao?.UF?.sigla ?? ""
    );
    return buildLocation("district", d.nome, d.municipio, geo ?? undefined);
  }

  return null;
}

// ── NOMINATIM (centroid + bbox para hotspots OSM) ────────────────────────────

interface NominatimHit {
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
}

async function lookupGeoBox(
  name: string,
  state: string
): Promise<{ centroid: { lat: number; lng: number }; bbox: [number, number, number, number] } | null> {
  try {
    const q = encodeURIComponent(`${name}, ${state}, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "DIT-PRINT/1.0 (contact@print.com.br)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimHit[];
    if (!data?.length) return null;
    const h = data[0];
    const lat = parseFloat(h.lat);
    const lng = parseFloat(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    let bbox: [number, number, number, number] | null = null;
    if (h.boundingbox && h.boundingbox.length === 4) {
      const [south, north, west, east] = h.boundingbox.map(parseFloat);
      if ([south, north, west, east].every(Number.isFinite)) {
        bbox = [west, south, east, north];
      }
    }
    if (!bbox) {
      const d = 0.25;
      bbox = [lng - d, lat - d, lng + d, lat + d];
    }
    return { centroid: { lat, lng }, bbox };
  } catch {
    return null;
  }
}

// ── SLUG ──────────────────────────────────────────────────────────────────────

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── TERRITORY FIND OR CREATE ──────────────────────────────────────────────────

async function findOrCreateTerritory(
  rawName: string,
  loc: ResolvedLocation | null
): Promise<Territory> {
  // Para distrito/localidade, o slug inclui o município pai para evitar colisão
  // (ex: "cabiunas--macae", "centro--belo-horizonte").
  const resolvedName = loc?.name ?? rawName;
  const slugBase =
    loc && loc.kind !== "municipality"
      ? `${makeSlug(loc.name)}--${makeSlug(loc.municipality)}`
      : makeSlug(resolvedName);
  const slug = slugBase;

  const db = await getDb();

  const fakeTerritory = (): Territory =>
    ({
      id: 0,
      slug,
      name: resolvedName,
      region: loc?.region ?? null,
      state: loc?.state ?? null,
      active: true,
      contextData: null,
      onboardingStatus: "ready",
      createdAt: new Date(),
    }) as unknown as Territory;

  if (!db) return fakeTerritory();

  try {
    const existing = await db
      .select()
      .from(territories)
      .where(eq(territories.slug, slug))
      .limit(1);
    if (existing.length > 0) return existing[0];

    await db.insert(territories).values({
      slug,
      name: resolvedName,
      region: loc?.region ?? undefined,
      state: loc?.state ?? undefined,
      active: true,
      contextData: null,
      onboardingStatus: "ready",
    });

    const created = await db
      .select()
      .from(territories)
      .where(eq(territories.slug, slug))
      .limit(1);
    if (created.length > 0) return created[0];
  } catch (e) {
    log.warn({ err: (e as Error).message }, "Territory DB operation failed, using in-memory record");
  }

  return fakeTerritory();
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function complexityFromScore(score: number): string {
  if (score >= 75) return "Alta Complexidade";
  if (score >= 50) return "Média Complexidade";
  if (score >= 25) return "Baixa Complexidade";
  return "Vácuo Institucional";
}

function scenarioFromStt(stt: number): {
  scenario: string;
  scenarioLabel: string;
  gaugeColor: string;
} {
  if (stt >= 75)
    return { scenario: "escalada", scenarioLabel: "Cenário Escalada", gaugeColor: "#B84A3A" };
  if (stt >= 50)
    return { scenario: "pressao", scenarioLabel: "Pressão Territorial", gaugeColor: "#D4A574" };
  return {
    scenario: "estabilidade",
    scenarioLabel: "Estabilidade Territorial",
    gaugeColor: "#6B9B7C",
  };
}

const DIMENSION_NAMES: Partial<Record<DimensionId, string>> = {
  D1: "Socioambiental",
  D2: "Socioeconômica",
  D3: "Infraestrutura e Serviços",
  D4: "Dinâmica Territorial",
  D5: "Governança",
  D6: "Reputação e Visibilidade",
};

// ── BUILD LLM PROMPT FROM ORCHESTRATOR DATA ───────────────────────────────────

function buildReportPrompt(
  territoryName: string,
  region: string,
  stt: number,
  dimensions: Partial<Record<DimensionId, DimensionResult>>,
  alertCount: number,
  totalSignals: number
): string {
  const { scenario, scenarioLabel, gaugeColor } = scenarioFromStt(stt);

  const dimBlocks = (["D1", "D2", "D3", "D4", "D5", "D6"] as DimensionId[])
    .map(code => {
      const dim = dimensions[code];
      if (!dim) return `${code} — ${DIMENSION_NAMES[code]}: sem dados coletados`;
      const cplx = complexityFromScore(dim.score);
      const topSignals = dim.signals
        .sort((a, b) => b.impactScore - a.impactScore)
        .slice(0, 6)
        .map(s => `[${s.sourceAgentId}] (imp:${s.impactScore.toFixed(2)}) ${s.title}`);
      const signalsText =
        topSignals.length > 0
          ? topSignals.join("\n  ")
          : "(sem sinais — usar conhecimento geral sobre o território)";
      const indicatorKeys = Object.keys(dim.indicatorScores ?? {}).slice(0, 4);
      const indicatorText =
        indicatorKeys.length > 0
          ? indicatorKeys.map(k => `${k}=${dim.indicatorScores[k]}`).join(", ")
          : "sem indicadores";
      return `${code} — ${DIMENSION_NAMES[code]}
  Score interno: ${Math.round(dim.score)}/100 → ${cplx}
  Fontes ok: ${dim.sourcesOk} | Fontes com erro: ${dim.sourcesError} | Sinais: ${dim.signals.length}
  Indicadores: ${indicatorText}
  Top sinais coletados:
  ${signalsText}`;
    })
    .join("\n\n");

  return `Você é o sistema de relatórios do DIT PRINT Territorial Intelligence™.

Os dados abaixo foram coletados pelo orquestrador com até 32 agentes reais rodando sobre o território "${territoryName}" (${region}).

═══ DADOS REAIS DO ORQUESTRADOR DIT ═══
STT Global calculado: ${stt}/100 → Cenário: ${scenarioLabel}
Total sinais coletados: ${totalSignals} | Alertas críticos (impacto ≥ 0.7): ${alertCount}

${dimBlocks}

═══ REGRAS DO RELATÓRIO ═══
1. Os scores numéricos de dimensão (ex: D1=75) são CONFIDENCIAIS — NÃO os mencione como números. Use apenas rótulos qualitativos: "Alta Complexidade", "Vácuo Institucional", etc.
2. O STT global (${stt}) PODE e DEVE ser mencionado — é o produto que o usuário pagou para ver.
3. Use os sinais REAIS coletados acima como base da análise. Para dimensões sem dados coletados, fundamente com conhecimento territorial brasileiro.
4. Seja ESPECÍFICO ao território — mencione contextos, fontes e dinâmicas reais. Nada genérico.
5. keySignals: use os sinais reais dos agentes. Se não houver dados reais suficientes, crie sinais plausíveis baseados no conhecimento do território com fontes reais (IBAMA, CEMADEN, IBGE, etc.).

Responda APENAS com JSON válido, sem texto fora do JSON:

{
  "territory": "${territoryName}",
  "region": "${region}",
  "stt": ${stt},
  "scenario": "${scenario}",
  "scenarioLabel": "${scenarioLabel}",
  "gaugeColor": "${gaugeColor}",
  "executiveSummary": [
    "<parágrafo 1: apresente o território + STT ${stt} + cenário ${scenarioLabel}, 2-3 frases concretas>",
    "<parágrafo 2: dimensões mais críticas (sem mencionar números de score), 2-3 frases específicas com sinais reais>",
    "<parágrafo 3: implicação direta para decisor/investidor que atua nesse território, 2-3 frases acionáveis>"
  ],
  "dimensions": [
    {
      "code": "D1",
      "name": "Socioambiental",
      "complexity": "<rótulo: Alta Complexidade|Média Complexidade|Baixa Complexidade|Vácuo Institucional>",
      "complexityNote": "<nota curta de contexto, ex: 'CEMADEN ativo, embargos IBAMA detectados'>",
      "insight": "<análise executiva 2-3 frases específicas e concretas sobre D1 neste território>",
      "signals": ["<chip sinal-chave 1>", "<chip 2>", "<chip 3>"]
    },
    {
      "code": "D2", "name": "Socioeconômica",
      "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]
    },
    {
      "code": "D3", "name": "Infraestrutura e Serviços",
      "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]
    },
    {
      "code": "D4", "name": "Dinâmica Territorial",
      "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]
    },
    {
      "code": "D5", "name": "Governança",
      "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]
    },
    {
      "code": "D6", "name": "Reputação e Visibilidade",
      "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]
    }
  ],
  "keySignals": [
    {
      "source": "<fonte real: IBAMA|CEMADEN|IBGE|DataSUS|ISP-RJ|Fogo Cruzado|SNIS|Querido Diário|etc>",
      "dimension": "<D1|D2|D3|D4|D5|D6>",
      "dimTag": "<tag-d1|tag-d2|tag-d3|tag-d4|tag-d5|tag-d6>",
      "text": "<descrição específica e concreta do sinal, 1-2 frases>",
      "impact": <0.0-1.0>,
      "impactCls": "<impact-high (>=0.7)|impact-med (0.4-0.69)|impact-low (<0.4)>",
      "status": "<CRÍTICO|ALERTA|MONITORAMENTO|VÁCUO>",
      "statusCls": "<status-critico|status-alerta|status-monitoramento>"
    },
    { "source": "...", "dimension": "...", "dimTag": "...", "text": "...", "impact": 0.0, "impactCls": "...", "status": "...", "statusCls": "..." },
    { "source": "...", "dimension": "...", "dimTag": "...", "text": "...", "impact": 0.0, "impactCls": "...", "status": "...", "statusCls": "..." },
    { "source": "...", "dimension": "...", "dimTag": "...", "text": "...", "impact": 0.0, "impactCls": "...", "status": "...", "statusCls": "..." },
    { "source": "...", "dimension": "...", "dimTag": "...", "text": "...", "impact": 0.0, "impactCls": "...", "status": "...", "statusCls": "..." }
  ],
  "forecast": {
    "horizon": "Próximo Trimestre — Maio a Agosto/2026",
    "text": "<tendência e dinâmica esperada para o território, 2-3 frases>",
    "risks": [
      "<risco específico e concreto 1>",
      "<risco específico 2>",
      "<risco específico 3>",
      "<risco específico 4>"
    ],
    "opportunities": "<oportunidades reais de atuação: captação de recursos, parcerias, nichos de mercado, 3-4 frases>"
  },
  "recommendations": [
    {
      "title": "<RECOMENDAÇÃO EM MAIÚSCULAS — AÇÃO PRINCIPAL>",
      "text": "<detalhamento concreto e específico, 2-3 frases acionáveis>",
      "urgency": "<IMEDIATO|CURTO PRAZO|MÉDIO PRAZO>",
      "urgCls": "<urg-imediato|urg-curto|urg-medio>"
    },
    { "title": "...", "text": "...", "urgency": "...", "urgCls": "..." },
    { "title": "...", "text": "...", "urgency": "...", "urgCls": "..." },
    { "title": "...", "text": "...", "urgency": "...", "urgCls": "..." }
  ]
}`;
}

// ── FALLBACK PROMPT (orquestrador falhou/timeout) ─────────────────────────────

function buildFallbackPrompt(territoryName: string, region: string): string {
  const { scenario, scenarioLabel, gaugeColor } = scenarioFromStt(50);
  return `Você é o sistema de IA do DIT PRINT Territorial Intelligence™.
Gere um Diagnóstico de Inteligência Territorial (DIT) para: "${territoryName}" (${region}).

ATENÇÃO: A coleta de dados em tempo real falhou. Use seu conhecimento sobre o território e a realidade brasileira para gerar um diagnóstico plausível e coerente.

Metodologia PRINT — 6 Dimensões:
D1 Socioambiental (peso 0.22): APA/APP, IBAMA, CEMADEN, DETER, passivos ambientais
D2 Socioeconômica (peso 0.15): IDH, Gini, desemprego, renda per capita, pobreza
D3 Infraestrutura (peso 0.15): saneamento, saúde, educação, habitação, logística
D4 Dinâmica Territorial (peso 0.22): conflitos fundiários, poder paralelo, populações tradicionais
D5 Governança (peso 0.15): institucionalidade, participação social, TACs, orçamento
D6 Reputação (peso 0.11): mídia, Google Trends, engajamento, interesse científico
STT = (D1×0.22) + (D2×0.15) + (D3×0.15) + (D4×0.22) + (D5×0.15) + (D6×0.11)

REGRAS:
1. Scores de dimensão são INTERNOS — não mencione números, apenas rótulos de complexidade.
2. O STT global PODE e DEVE ser mencionado.
3. Seja específico ao território — use dados reais do IBGE, IBAMA, etc.

Responda APENAS com JSON válido:
{
  "territory": "${territoryName}",
  "region": "${region}",
  "stt": <número 0-100 calculado>,
  "scenario": "${scenario}",
  "scenarioLabel": "${scenarioLabel}",
  "gaugeColor": "${gaugeColor}",
  "executiveSummary": ["<p1 com STT>", "<p2 dimensões críticas>", "<p3 implicação decisor>"],
  "dimensions": [
    {"code": "D1", "name": "Socioambiental", "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]},
    {"code": "D2", "name": "Socioeconômica", "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]},
    {"code": "D3", "name": "Infraestrutura e Serviços", "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]},
    {"code": "D4", "name": "Dinâmica Territorial", "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]},
    {"code": "D5", "name": "Governança", "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]},
    {"code": "D6", "name": "Reputação e Visibilidade", "complexity": "...", "complexityNote": "...", "insight": "...", "signals": ["...", "...", "..."]}
  ],
  "keySignals": [
    {"source": "...", "dimension": "...", "dimTag": "...", "text": "...", "impact": 0.0, "impactCls": "...", "status": "...", "statusCls": "..."},
    {"source": "...", "dimension": "...", "dimTag": "...", "text": "...", "impact": 0.0, "impactCls": "...", "status": "...", "statusCls": "..."},
    {"source": "...", "dimension": "...", "dimTag": "...", "text": "...", "impact": 0.0, "impactCls": "...", "status": "...", "statusCls": "..."},
    {"source": "...", "dimension": "...", "dimTag": "...", "text": "...", "impact": 0.0, "impactCls": "...", "status": "...", "statusCls": "..."},
    {"source": "...", "dimension": "...", "dimTag": "...", "text": "...", "impact": 0.0, "impactCls": "...", "status": "...", "statusCls": "..."}
  ],
  "forecast": {
    "horizon": "Próximo Trimestre — Maio a Agosto/2026",
    "text": "...",
    "risks": ["...", "...", "...", "..."],
    "opportunities": "..."
  },
  "recommendations": [
    {"title": "...", "text": "...", "urgency": "...", "urgCls": "..."},
    {"title": "...", "text": "...", "urgency": "...", "urgCls": "..."},
    {"title": "...", "text": "...", "urgency": "...", "urgCls": "..."},
    {"title": "...", "text": "...", "urgency": "...", "urgCls": "..."}
  ]
}`;
}

// ── LLM CALL ─────────────────────────────────────────────────────────────────
// Prioridade: Anthropic → OpenAI/Forge

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

async function callLLMAnthropicClaude(prompt: string): Promise<unknown> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      temperature: 0.3,
      system:
        "Você é o sistema de IA do DIT PRINT Territorial Intelligence™. " +
        "Responda SEMPRE com JSON válido e completo, sem nenhum texto fora do JSON. " +
        "Seja específico, concreto e útil para decisores de negócios no Brasil.",
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(58000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const content = data.content?.find(c => c.type === "text")?.text;
  if (!content) throw new Error("Anthropic retornou resposta vazia");
  const clean = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(clean);
}

async function callLLMOpenAI(prompt: string): Promise<unknown> {
  const apiBase = (ENV.forgeApiUrl || "https://api.openai.com").replace(/\/$/, "");
  const apiKey = ENV.forgeApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurado no .env");

  const res = await fetch(`${apiBase}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você é o sistema de IA do DIT PRINT Territorial Intelligence™. " +
            "Responda SEMPRE com JSON válido e completo, sem nenhum texto fora do JSON. " +
            "Seja específico, concreto e útil para decisores de negócios no Brasil.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(58000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI retornou resposta vazia");
  return JSON.parse(content);
}

async function callLLM(prompt: string): Promise<unknown> {
  if (ANTHROPIC_API_KEY.length > 20) {
    log.info("Usando Anthropic Claude para relatório DIT");
    return callLLMAnthropicClaude(prompt);
  }
  log.info("Usando OpenAI para relatório DIT");
  return callLLMOpenAI(prompt);
}

// ── ROTA PRINCIPAL ────────────────────────────────────────────────────────────

ditLandingRouter.post("/analyze", async (req: Request, res: Response) => {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").slice(0, 50);

  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Muitas requisições. Aguarde 1 minuto." });
    return;
  }

  const { territory } = req.body as { territory?: string };

  if (!territory || territory.trim().length < 2) {
    res.status(400).json({ error: "Nome do território obrigatório (mínimo 2 caracteres)" });
    return;
  }

  const territoryClean = territory.trim().slice(0, 120);
  const cacheKey = makeSlug(territoryClean);

  // Cache hit
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    log.info({ territory: territoryClean }, "Cache hit — retornando DIT em cache");
    res.json(cached.result);
    return;
  }

  log.info({ territory: territoryClean, ip }, "Iniciando análise DIT com orquestrador real");

  try {
    // 1. Resolve hierárquico: município → distrito → localidade (OSM)
    const loc = await resolveLocation(territoryClean);
    log.info(
      {
        territory: territoryClean,
        kind: loc?.kind ?? "não encontrado",
        resolved: loc?.name,
        municipality: loc?.municipality,
      },
      "Lookup hierárquico concluído"
    );

    const resolvedName = loc?.name ?? territoryClean;
    // Rótulo de região exibido no relatório
    // município: "Recife, PE — Nordeste"
    // distrito/localidade: "Cabiúnas (Macaé), RJ — Sudeste"
    const region = loc
      ? (loc.kind === "municipality"
          ? `${loc.name}, ${loc.state} — ${loc.region}`
          : `${loc.name} (${loc.municipality}), ${loc.state} — ${loc.region}`)
      : territoryClean;

    // 2. Find/create territory record no DB
    const territoryRecord = await findOrCreateTerritory(territoryClean, loc);
    log.info({ territory: resolvedName, id: territoryRecord.id }, "Territory record pronto");

    // 3. Run orchestrator — todos os 32 agentes reais
    // Timeout de 85s para não travar o servidor em caso de APIs lentas
    let orchestratorResult: Awaited<ReturnType<typeof orchestrator.run>> | null = null;
    try {
      orchestratorResult = await Promise.race([
        orchestrator.run(territoryRecord),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Orchestrator timeout (85s)")), 85000)
        ),
      ]);
      log.info(
        {
          territory: resolvedName,
          stt: orchestratorResult.stt,
          totalSignals: orchestratorResult.totalSignals,
          alerts: orchestratorResult.alerts.length,
        },
        "Orquestrador concluído com sucesso"
      );
    } catch (orchErr) {
      log.warn(
        { territory: resolvedName, err: (orchErr as Error).message },
        "Orquestrador timeout/erro — usando fallback LLM puro"
      );
    }

    // 4. Strategic Layer (recursos, setores, hotspots, casos) em paralelo com LLM
    // Para distrito/localidade reutilizamos a geometria do município pai quando
    // o lookup local não trouxe bbox (mais signal pros agentes OSM).
    const geo =
      loc && (loc.centroid && loc.bbox
        ? { centroid: loc.centroid, bbox: loc.bbox }
        : await lookupGeoBox(loc.municipality, loc.state));
    const strategicCtx: TerritoryStrategicContext = {
      name: resolvedName,
      state: loc?.state ?? "",
      region: loc?.region ?? "",
      ibgeId: loc?.ibgeId ?? 0,
      centroid: geo?.centroid,
      bbox: geo?.bbox,
    };

    const dimScoresForSectors: Partial<Record<DimensionId, number>> = orchestratorResult
      ? Object.fromEntries(
          (["D1", "D2", "D3", "D4", "D5", "D6"] as DimensionId[])
            .map(d => [d, orchestratorResult!.dimensions[d]?.score])
            .filter(([, v]) => typeof v === "number")
        )
      : {};

    // 5. Build prompt + call LLM para relatório executivo (em paralelo com strategic layer)
    const llmPromise: Promise<unknown> = orchestratorResult
      ? callLLM(
          buildReportPrompt(
            resolvedName,
            region,
            Math.round(orchestratorResult.stt),
            orchestratorResult.dimensions,
            orchestratorResult.alerts.length,
            orchestratorResult.totalSignals
          )
        )
      : callLLM(buildFallbackPrompt(resolvedName, region));

    const strategicPromise = runStrategicLayer(strategicCtx, dimScoresForSectors).catch(err => {
      log.warn({ err: (err as Error).message }, "Strategic layer falhou — seguindo sem ela");
      return null;
    });

    const [llmReport, strategic] = await Promise.all([llmPromise, strategicPromise]);

    // Metadados de resolução territorial (município/distrito/localidade)
    const resolution = loc
      ? {
          kind: loc.kind,
          name: loc.name,
          municipality: loc.municipality,
          state: loc.state,
          region: loc.region,
          ibgeId: loc.ibgeId,
        }
      : null;

    // Merge: LLM produz o relatório executivo; strategic layer adiciona dados estruturados
    const baseExtra = {
      resolution,
      territoryGeo: geo ? { centroid: geo.centroid, bbox: geo.bbox } : null,
    };
    const result =
      strategic && typeof llmReport === "object" && llmReport !== null
        ? {
            ...(llmReport as Record<string, unknown>),
            ...baseExtra,
            sectors: strategic.sectors,
            resources: strategic.resources,
            hotspots: strategic.hotspots,
            strategicCases: strategic.strategicCases,
          }
        : typeof llmReport === "object" && llmReport !== null
          ? { ...(llmReport as Record<string, unknown>), ...baseExtra }
          : llmReport;

    // 6. Cache e retorno
    analysisCache.set(cacheKey, { result, ts: Date.now() });
    log.info({ territory: resolvedName }, "DIT análise concluída e entregue");
    res.json(result);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ territory: territoryClean, err: msg }, "Falha na análise DIT");
    res.status(500).json({ error: msg });
  }
});
