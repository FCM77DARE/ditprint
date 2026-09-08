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
import { territories, subscribers } from "../../drizzle/schema";
import type { Territory } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { orchestrator } from "../agents/orchestrator";
import type { DimensionResult } from "../agents/types";
import type { DimensionId } from "../indicators";
import { runStrategicLayer } from "../strategic/runner";
import { buscarLocalidadeCurada } from "./localidades-curadas";
import {
  buscarCompostoPorNome,
  type TerritorioComposto,
} from "./territorios-compostos";
import { canSpend, consume, getBudgetStatus } from "../_core/budget";
import { getStructuralStatus } from "../structural/store";
import type { TerritoryStrategicContext } from "../strategic/types";

const log = logger.child({ module: "dit-landing" });

/**
 * Piso de cobertura para o DIT sair como diagnóstico.
 *
 * `coverageScore` = fontes que responderam / fontes consultadas. Abaixo deste
 * piso o motor não sabe o suficiente para afirmar nada sobre o território, e o
 * relatório que sairia seria conhecimento geral do modelo com estética de
 * inteligência coletada. Nesse caso devolvemos cobertura insuficiente, não um
 * diagnóstico bonito e vazio.
 *
 * Ajustável por env enquanto a carga estrutural nacional não sobe a linha de
 * base — quando ela subir, este piso pode subir junto.
 */
const MIN_COVERAGE = Number(process.env.DIT_MIN_COVERAGE ?? "0.35");

/**
 * Gerador aberto ligado ou desligado.
 *
 * DESLIGADO (padrão de lançamento): só território já monitorado devolve DIT.
 * Qualquer outro vira captura de lead — "solicitar diagnóstico" — em vez de
 * disparar coleta e LLM na hora.
 *
 * Isso resolve três coisas de uma vez, e é a única decisão que não dá para
 * tomar depois porque define o que o mercado vê primeiro:
 *   custo     não existe consulta anônima disparando ~24 buscas pagas;
 *   cota      a coleta fica concentrada nos territórios que a PRINT escolheu;
 *   verdade   o que vai ao ar passou por publicação humana, como a
 *             metodologia sempre disse (fila de publicação + SttPublishPanel).
 *
 * Religar é `DIT_PUBLIC_ANALYZE=true`, sem deploy.
 */
const PUBLIC_ANALYZE = String(process.env.DIT_PUBLIC_ANALYZE ?? "false").toLowerCase() === "true";

/**
 * Slug canônico do território = código IBGE do município (+ distrito/localidade).
 *
 * Antes o slug saía do texto digitado, e por isso produção acumulou
 * `galinhos-rn` e `galinhos-rio-grande-do-norte` como territórios diferentes,
 * cada um com sua própria série histórica pela metade — além de `gatinhos`,
 * que é erro de digitação e mesmo assim ganhou STT e snapshot.
 */
function canonicalSlug(loc: ResolvedLocation): string {
  // Composto tem slug próprio e estável: não há um código IBGE que o
  // represente, e derivar do primeiro membro esconderia o recorte.
  if (loc.fixedSlug) return loc.fixedSlug;
  const base = `${makeSlug(loc.municipality)}-${loc.ibgeId}`;
  return loc.kind === "municipality" ? base : `${base}-${makeSlug(loc.name)}`;
}

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

/**
 * Estado operacional — orçamento consumido e idade da camada estrutural.
 * É o painel que responde "quanto já gastamos hoje" e "o dado de base está
 * velho?" sem precisar abrir a conta do fornecedor.
 */
ditLandingRouter.get("/ops", async (_req: Request, res: Response) => {
  const [budget, structural] = await Promise.all([
    getBudgetStatus(),
    getStructuralStatus(),
  ]);
  res.json({
    publicAnalyze: PUBLIC_ANALYZE,
    minCoverage: MIN_COVERAGE,
    budget,
    structural,
    ts: new Date().toISOString(),
  });
});

// ── LEAD CAPTURE (email + território de interesse) ────────────────────────────
// POST /api/dit/lead { email, territory }
// Salva como subscriber (plan=free_alert). Idempotente por email.
// Se o banco estiver indisponível, registra em log e devolve { saved:false }.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const leadFallbackLog: Array<{ email: string; territory: string; ts: string }> = [];

ditLandingRouter.post("/lead", async (req: Request, res: Response) => {
  const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").slice(0, 50);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Muitas requisições. Aguarde 1 minuto." });
    return;
  }

  const { email, territory } = req.body as { email?: string; territory?: string };
  const emailClean = (email ?? "").trim().toLowerCase().slice(0, 320);
  const territoryClean = (territory ?? "").trim().slice(0, 120);

  if (!emailClean || !EMAIL_RE.test(emailClean)) {
    res.status(400).json({ error: "Email inválido" });
    return;
  }
  if (!territoryClean) {
    res.status(400).json({ error: "Território obrigatório" });
    return;
  }

  const db = await getDb();
  if (!db) {
    // Sem banco: registra em memória + log estruturado pra captura via Railway logs.
    leadFallbackLog.push({ email: emailClean, territory: territoryClean, ts: new Date().toISOString() });
    log.info({ email: emailClean, territory: territoryClean, ip }, "[LEAD] capturado (sem DB)");
    res.json({ saved: false, captured: true, message: "Registrado em fallback (sem DB)" });
    return;
  }

  try {
    // Upsert: se email já existe, só atualiza o território de interesse.
    const existing = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, emailClean))
      .limit(1);

    if (existing.length > 0) {
      log.info({ email: emailClean, territory: territoryClean }, "[LEAD] já cadastrado");
      res.json({ saved: true, isNew: false });
      return;
    }

    await db.insert(subscribers).values({
      name: emailClean.split("@")[0] || "Lead",
      email: emailClean,
      territoryInterest: territoryClean,
      plan: "free_alert",
      active: true,
    });
    log.info({ email: emailClean, territory: territoryClean }, "[LEAD] novo subscriber salvo");
    res.json({ saved: true, isNew: true });
  } catch (err) {
    log.warn({ err: (err as Error).message, email: emailClean }, "[LEAD] falha ao salvar");
    leadFallbackLog.push({ email: emailClean, territory: territoryClean, ts: new Date().toISOString() });
    res.json({ saved: false, captured: true, error: (err as Error).message });
  }
});

// ── CACHE (lock diário por território) ────────────────────────────────────────
// Chave inclui YYYY-MM-DD para garantir que o mesmo território, no mesmo dia UTC,
// devolva sempre o MESMO STT — mata a "volatilidade visual" entre re-rodadas no
// mesmo dia (Google News mudando, etc). Persistido em disco em data/dit-cache.json
// pra sobreviver a redeploys do Railway dentro do mesmo dia.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname as pathDirname, join } from "node:path";

// Cache persistente: prod Railway usa /data (volume montado), dev local ./data.
const CACHE_FILE = join(process.env.DATA_DIR || join(process.cwd(), "data"), "dit-cache.json");
const analysisCache = new Map<string, { result: unknown; ts: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function todayKey(slug: string): string {
  return `${slug}|${new Date().toISOString().slice(0, 10)}`;
}

function loadCacheFromDisk(): void {
  try {
    if (!existsSync(CACHE_FILE)) return;
    const raw = readFileSync(CACHE_FILE, "utf-8");
    const obj = JSON.parse(raw) as Record<string, { result: unknown; ts: number }>;
    for (const [k, v] of Object.entries(obj)) {
      if (Date.now() - v.ts < CACHE_TTL_MS) analysisCache.set(k, v);
    }
    log.info({ entries: analysisCache.size }, "Cache DIT recarregado do disco");
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Falha ao recarregar cache do disco — ignorado");
  }
}

function persistCacheToDisk(): void {
  try {
    mkdirSync(pathDirname(CACHE_FILE), { recursive: true });
    const obj: Record<string, { result: unknown; ts: number }> = {};
    analysisCache.forEach((v, k) => { obj[k] = v; });
    writeFileSync(CACHE_FILE, JSON.stringify(obj), "utf-8");
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Falha ao persistir cache em disco — ignorado");
  }
}

loadCacheFromDisk();

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
    nome?: string;
    mesorregiao?: {
      nome?: string;
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

export type ResolvedLocationKind =
  | "municipality"
  | "district"
  | "locality"
  /** Recorte que atravessa municípios — ver territorios-compostos.ts */
  | "composite";

export interface ResolvedLocation {
  kind: ResolvedLocationKind;
  name: string;          // nome local (ex: "Cabiúnas")
  ibgeId: number;        // sempre o id do município pai (para stats downstream)
  /**
   * Todos os municípios do recorte. Um item para município, distrito e
   * localidade; a lista inteira para composto. Os agentes de fonte já liam
   * `contextData.ibgeMunicipios` como lista — o composto só a preenche toda.
   */
  ibgeIds?: number[];
  /** Slug fixo, quando o recorte tem um (composto não tem código IBGE) */
  fixedSlug?: string;
  municipality: string;  // município pai (== name quando kind === 'municipality')
  state: string;         // sigla UF
  stateName?: string;    // nome completo UF ("Bahia") — usado em queries
  region: string;        // nome da região (Sudeste, Nordeste…)
  mesoregion?: string;   // mesorregião IBGE ("Sul Baiano")
  microregion?: string;  // microrregião IBGE ("Valença")
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
    // Apóstrofos: reto U+0027, esquerdo/direito U+2018/U+2019, modifier U+02BC,
    // backtick U+0060, acute U+00B4. Todos viram nada.
    .replace(/['‘’ʼ`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Variante de `normalize` que ADICIONALMENTE colapsa contrações portuguesas
 * separadas por espaço: "Dias d Avila" → "dias davila"; "Sant Ana" → "santana".
 *
 * Bug fix (feedback equipe): quando o usuário digita "Dias d Ávila" (alguns
 * teclados/autocomplete substituem o apóstrofo por espaço), normalize base
 * produz "dias d avila", mas IBGE armazena "Dias d'Ávila" → "dias davila".
 * Esta variante força "d avila" → "davila" pra bater.
 */
function normalizeCollapsed(s: string): string {
  return normalize(s).replace(/\b([dnlmstv])\s+(?=[aeiou])/gi, "$1");
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
  // Tentativa 1: match exato normalizado
  let hits = list.filter((x) => normalize(x.nome) === target);
  if (hits.length > 0) return hits;

  // Tentativa 2: contrações portuguesas colapsadas — bate "Dias d Ávila"
  // (usuário) com "Dias d'Ávila" (IBGE).
  const targetCollapsed = normalizeCollapsed(target);
  hits = list.filter((x) => normalizeCollapsed(x.nome) === targetCollapsed);
  if (hits.length > 0) return hits;

  // Tentativa 3: prefix
  hits = list.filter((x) => normalize(x.nome).startsWith(target));
  if (hits.length > 0) return hits;

  // Tentativa 4: includes (cuidado com homônimos)
  hits = list.filter((x) => normalize(x.nome).includes(target));
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
  /** Categoria OSM: place, boundary, highway, railway, aeroway, shop… */
  class?: string;
  /** Subtipo: village, town, administrative, residential, station… */
  type?: string;
  addresstype?: string;
  boundingbox?: [string, string, string, string];
  address?: NominatimAddress;
}

/**
 * Classes do OSM que representam LUGAR onde gente mora ou que tem recorte
 * territorial. Só estas podem virar território do DIT.
 *
 * Sem esta trava, o Nominatim devolve o que tiver: "Rua das Flores" resolvia
 * para "Rua XV de Novembro, Curitiba/PR" e "Porto de Maricá" para "Rua Edson
 * de Almeida Porto Antiga" — cada um virando território monitorado, com
 * município pai plausível e tudo. Uma rua não é território, e antes de a
 * resolução virar porta de entrada isso passava despercebido.
 */
const OSM_PLACE_CLASSES = new Set(["place", "boundary", "landuse"]);

/** Tipos que reprovam mesmo dentro de uma classe aceita. */
const OSM_REJECTED_TYPES = new Set([
  "road", "residential_road", "station", "stop", "halt", "helipad",
  "aerodrome", "bus_stop", "platform",
]);

/**
 * Ordem de preferência: recorte administrativo primeiro (é o que mais se
 * aproxima de um distrito), depois lugar habitado, depois o resto.
 */
function osmRank(d: NominatimResult): number {
  if (d.class === "boundary" && d.type === "administrative") return 0;
  if (d.class === "place") return 1;
  if (d.class === "landuse") return 2;
  return 99;
}

function isAcceptableOsmPlace(d: NominatimResult): boolean {
  if (!d.class || !OSM_PLACE_CLASSES.has(d.class)) return false;
  if (d.type && OSM_REJECTED_TYPES.has(d.type)) return false;
  if (d.addresstype && OSM_REJECTED_TYPES.has(d.addresstype)) return false;
  return true;
}

/**
 * O nome devolvido tem que ser o nome pedido.
 *
 * Segunda trava, independente da classe: o Nominatim é generoso com
 * correspondência parcial, e "Porto de Maricá" casava com qualquer logradouro
 * que tivesse "Porto" no nome. Território errado num relatório de cliente é
 * pior que território não encontrado.
 */
const OSM_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "d"]);

function palavrasSignificativas(v: string): string[] {
  return normalizeCollapsed(v)
    .split(/\s+/)
    .filter((w) => w.length > 0 && !OSM_STOPWORDS.has(w));
}

function osmNameMatches(query: string, d: NominatimResult): boolean {
  const alvo = palavrasSignificativas(query);
  const achado = palavrasSignificativas(d.name ?? "");
  if (alvo.length === 0 || achado.length === 0) return false;

  // Um dos nomes tem que conter TODAS as palavras do outro.
  //
  //   "Cabiúnas"        x "Fazenda Cabiúnas"                → passa
  //   "Itaipuaçu"       x "Itaipuaçu"                       → passa
  //   "Porto de Maricá" x "Rua Edson de Almeida Porto Anti" → reprova
  //                       ("maricá" não aparece)
  //
  // A primeira versão comparava tamanho de string, e reprovava Cabiúnas —
  // que é território real do polo de Macaé, com relatório já gerado.
  const contem = (a: string[], b: string[]) => a.every((w) => b.includes(w));
  return contem(alvo, achado) || contem(achado, alvo);
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

    const candidatos = data
      .filter((d) => isAcceptableOsmPlace(d) && osmNameMatches(rawName, d))
      .sort((a, b) => osmRank(a) - osmRank(b));

    if (candidatos.length === 0) {
      log.info(
        {
          consulta: rawName,
          descartados: data.map((d) => `${d.class}/${d.type}:${d.name ?? ""}`),
        },
        "Nominatim devolveu resultados, mas nenhum é lugar — território não resolvido"
      );
      return null;
    }

    // Entre os aceitos, prefere o que traz município no endereço.
    return (
      candidatos.find((d) => d.address?.city || d.address?.municipality || d.address?.town) ??
      candidatos[0]
    );
  } catch {
    return null;
  }
}

/**
 * Resolve os membros de um composto contra a malha, por nome e UF.
 *
 * Nunca por código digitado: foi assim que 2910776 (Feira da Mata) entrou uma
 * vez no lugar de Dias d'Ávila (2910057) num script de análise, e a linha saiu
 * plausível. Membro que não resolve é registrado como erro, não ignorado em
 * silêncio — recorte incompleto muda o score sem avisar.
 */
function resolverMembros(
  composto: TerritorioComposto,
  munList: IbgeMunicipio[]
): { membros: IbgeMunicipio[]; faltando: string[] } {
  const membros: IbgeMunicipio[] = [];
  const faltando: string[] = [];

  for (const m of composto.membros) {
    const hits = munList.filter(
      (x) =>
        normalizeCollapsed(x.nome) === normalizeCollapsed(m.nome) &&
        x.microrregiao?.mesorregiao?.UF?.sigla === m.uf
    );
    if (hits.length === 1) membros.push(hits[0]);
    else faltando.push(`${m.nome}/${m.uf} (${hits.length} correspondências)`);
  }

  // Maior primeiro — o principal representa o composto nos campos escalares.
  membros.sort((a, b) => a.id - b.id);
  return { membros, faltando };
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
    stateName: parentMun.microrregiao?.mesorregiao?.UF?.nome ?? "",
    region: parentMun.microrregiao?.mesorregiao?.UF?.regiao?.nome ?? "",
    mesoregion: parentMun.microrregiao?.mesorregiao?.nome ?? "",
    microregion: parentMun.microrregiao?.nome ?? "",
    centroid: geo?.centroid,
    bbox: geo?.bbox,
  };
}

/**
 * Resolve qualquer entrada (município, distrito ou localidade OSM) para uma
 * estrutura completa com município pai, UF, região e geometria (centroid+bbox).
 */
export interface AmbiguousOption {
  name: string;
  state: string;
  ibgeId: number;
}

/**
 * Homônimos encontrados na última resolução que terminou ambígua.
 *
 * Carona feia, mas resolveLocation é chamada em dois lugares e mudar a
 * assinatura para um resultado discriminado espalharia por todo o arquivo.
 * É lida imediatamente depois da chamada, no mesmo tick.
 */
let lastAmbiguity: AmbiguousOption[] | null = null;

function takeAmbiguity(): AmbiguousOption[] | null {
  const a = lastAmbiguity;
  lastAmbiguity = null;
  return a;
}

async function resolveLocation(rawName: string): Promise<ResolvedLocation | null> {
  lastAmbiguity = null;
  const { name, state: hintState } = parseTerritoryInput(rawName);
  const target = normalize(name);
  if (!target) return null;

  // ── 0) Território composto ─────────────────────────────────────────────────
  // Antes de tudo: "Baía de Guanabara" não é município nem distrito, e sem
  // esta porta caía no Nominatim, que devolvia qualquer coisa parecida.
  const composto = buscarCompostoPorNome(name);
  const munListParaComposto = composto ? await loadAllMunicipios() : null;
  if (composto && munListParaComposto) {
    const resolvido = resolverMembros(composto, munListParaComposto);
    if (resolvido.faltando.length > 0) {
      log.error(
        { composto: composto.slug, faltando: resolvido.faltando },
        "Território composto tem membro que não existe na malha do IBGE — conferir a declaração"
      );
    }
    if (resolvido.membros.length > 0) {
      const principal = resolvido.membros[0];
      log.info(
        { composto: composto.slug, membros: resolvido.membros.length, criterio: composto.criterio },
        "Território composto resolvido"
      );
      const geo = await lookupGeoBox(composto.nome, composto.uf);
      return {
        kind: "composite",
        name: composto.nome,
        ibgeId: principal.id,
        ibgeIds: resolvido.membros.map((m) => m.id),
        fixedSlug: composto.slug,
        municipality: composto.nome,
        state: composto.uf,
        stateName: principal.microrregiao?.mesorregiao?.UF?.nome ?? "",
        region: composto.regiao,
        mesoregion: principal.microrregiao?.mesorregiao?.nome ?? "",
        microregion: principal.microrregiao?.nome ?? "",
        centroid: geo?.centroid,
        bbox: geo?.bbox,
      };
    }
  }

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
      // Capital ganha do homônimo: quem digita "Salvador" quer a capital da
      // Bahia, não Salvador das Missões/RS.
      const capital = hits.find((x) => CAPITAL_IBGE_IDS.has(x.id));

      // Sem capital e sem UF, nome repetido no país é ambiguidade de verdade.
      // Antes o código pegava hits[0] e seguia: "Lajeado" virava Lajeado/TO
      // em silêncio, enquanto a série em produção era de Lajeado/RS. Escolher
      // sozinho aqui é atribuir o território errado ao cliente.
      if (!capital && hits.length > 1) {
        lastAmbiguity = hits.slice(0, 8).map((m) => ({
          name: m.nome,
          state: m.microrregiao?.mesorregiao?.UF?.sigla ?? "",
          ibgeId: m.id,
        }));
        return null;
      }

      const m = capital ?? hits[0];
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

  // ── 3) Localidade curada ───────────────────────────────────────────────────
  // Antes do Nominatim, porque para lugar pequeno ele acerta o nome e erra o
  // município: "Cabiúnas" caía em Cambuci/RJ (existe uma Fazenda Cabiúnas lá)
  // quando a que interessa é o terminal da Petrobras, em Macaé. Nenhuma
  // heurística de texto resolve — só saber de qual Cabiúnas se fala.
  const curada = buscarLocalidadeCurada(normalizeCollapsed(name));
  if (curada && (!hintState || hintState === curada.uf)) {
    const munList2 = munList ?? (await loadAllMunicipios());
    const pai = munList2?.find((m) => m.id === curada.ibgeId);
    if (pai) {
      log.info(
        { consulta: name, localidade: curada.nome, municipio: curada.municipio, nota: curada.nota },
        "Localidade resolvida pela tabela curada"
      );
      const geo = await lookupGeoBox(`${curada.nome}, ${curada.municipio}`, curada.uf);
      return buildLocation("locality", curada.nome, pai, geo ?? undefined);
    }
    log.warn(
      { localidade: curada.nome, ibgeId: curada.ibgeId },
      "Localidade curada aponta para código IBGE que não existe na malha — conferir a tabela"
    );
  }

  // ── 4) Localidade (Nominatim/OSM) ──────────────────────────────────────────
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

/**
 * Mapeamento UF → state_id na API Fogo Cruzado v2.
 * Fonte: https://api.fogocruzado.org.br/api/v2/states
 * (Hoje API cobre apenas RJ/PE/BA — demais estados retornam vazio.)
 */
const FOGO_CRUZADO_STATE_IDS: Record<string, string> = {
  RJ: "813ca36b-91e3-4a18-b408-60b27a1942ef",
  PE: "9d4b58a6-46d7-4d62-a4d6-08f1e3a9f01a",
  BA: "1c39e4b1-49a8-4f4a-90a4-94d7e2b96c5f",
};

/**
 * Gera o `contextData` JSON do território a partir do ResolvedLocation.
 *
 * Bug fix: 6 agentes (IBGE Censo/Renda/Habitação, PNUD-Atlas, Querido Diário,
 * Fogo Cruzado) ficavam mudos pra qualquer município novo porque contextData
 * vinha null. Agora populamos ibgeMunicipios, mesoregion, microregion etc.
 * automaticamente a partir do lookup IBGE feito em resolveLocation.
 */
function buildContextData(loc: ResolvedLocation | null): Record<string, unknown> | null {
  if (!loc || !loc.ibgeId) return null;
  // Composto preenche a lista inteira; os demais, um item. Os agentes de
  // fonte sempre leram `ibgeMunicipios` como lista, então nada mais muda.
  const municipios = (loc.ibgeIds?.length ? loc.ibgeIds : [loc.ibgeId]).map(String);
  const ctx: Record<string, unknown> = {
    ibgeMunicipios: municipios,
    ibgeId: String(loc.ibgeId),
  };
  if (loc.kind === "composite") {
    ctx.composite = true;
    ctx.compositeSlug = loc.fixedSlug;
  }
  if (loc.state) {
    ctx.uf = loc.state;
    const fc = FOGO_CRUZADO_STATE_IDS[loc.state];
    if (fc) ctx.fogoCruzadoStateId = fc;
  }
  if (loc.stateName) ctx.stateName = loc.stateName;
  if (loc.mesoregion) ctx.mesoregion = loc.mesoregion;
  if (loc.microregion) ctx.microregion = loc.microregion;
  if (loc.centroid) ctx.centroid = loc.centroid;
  if (loc.bbox) ctx.bbox = loc.bbox;
  return ctx;
}

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

  const contextData = buildContextData(loc);

  const db = await getDb();

  const fakeTerritory = (): Territory =>
    ({
      id: 0,
      slug,
      name: resolvedName,
      region: loc?.region ?? null,
      state: loc?.state ?? null,
      active: true,
      contextData,
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
    if (existing.length > 0) {
      // Backfill: se território já existe mas contextData está vazio/incompleto,
      // atualizamos com o lookup atual — destrava agentes IBGE/Querido Diário
      // pra municípios criados antes deste fix.
      const existingTerritory = existing[0];
      const existingCtx = existingTerritory.contextData as Record<string, unknown> | null;
      const needsBackfill =
        !existingCtx ||
        !existingCtx.ibgeMunicipios ||
        (Array.isArray(existingCtx.ibgeMunicipios) && existingCtx.ibgeMunicipios.length === 0);
      if (needsBackfill && contextData) {
        try {
          await db
            .update(territories)
            .set({ contextData })
            .where(eq(territories.id, existingTerritory.id));
          return { ...existingTerritory, contextData } as Territory;
        } catch (uErr) {
          log.warn({ err: (uErr as Error).message, slug }, "Backfill de contextData falhou");
        }
      }
      return existingTerritory;
    }

    await db.insert(territories).values({
      slug,
      name: resolvedName,
      region: loc?.region ?? undefined,
      state: loc?.state ?? undefined,
      active: true,
      contextData,
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

interface ReportPromptGeo {
  state?: string;
  stateName?: string;
  mesoregion?: string;
  microregion?: string;
}

function buildReportPrompt(
  territoryName: string,
  region: string,
  stt: number,
  dimensions: Partial<Record<DimensionId, DimensionResult>>,
  alertCount: number,
  totalSignals: number,
  geo: ReportPromptGeo = {}
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
          : "(SEM COBERTURA — declarar explicitamente, é proibido inferir)";
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

  const geoLine = [
    geo.stateName ? `Estado: ${geo.stateName} (${geo.state})` : geo.state ? `UF: ${geo.state}` : null,
    geo.mesoregion ? `Mesorregião IBGE: ${geo.mesoregion}` : null,
    geo.microregion ? `Microrregião IBGE: ${geo.microregion}` : null,
  ].filter(Boolean).join(" · ");

  return `Você é o sistema de relatórios do DIT PRINT Territorial Intelligence™.

Os dados abaixo foram coletados pelo orquestrador com até 32 agentes reais rodando sobre o território "${territoryName}" (${region}).
${geoLine ? `\nLocalização precisa: ${geoLine}` : ""}

═══ DADOS REAIS DO ORQUESTRADOR DIT ═══
STT Global calculado: ${stt}/100 → Cenário: ${scenarioLabel}
Total sinais coletados: ${totalSignals} | Alertas críticos (impacto ≥ 0.7): ${alertCount}

${dimBlocks}

═══ REGRAS DO RELATÓRIO ═══
1. Os scores numéricos de dimensão (ex: D1=75) são CONFIDENCIAIS — NÃO os mencione como números. Use apenas rótulos qualitativos: "Alta Complexidade", "Vácuo Institucional", etc.
2. O STT global (${stt}) PODE e DEVE ser mencionado — é o produto que o usuário pagou para ver.
3. PROCEDÊNCIA — regra inegociável. Toda afirmação factual sobre o território
   (número, evento, autuação, obra, conflito, indicador) tem que sair dos sinais
   REAIS listados acima. É PROIBIDO completar com conhecimento geral, com
   estimativa ou com o que "costuma acontecer" em municípios parecidos.
   Para dimensão marcada SEM COBERTURA, escreva exatamente isso — que o motor
   não teve retorno de fonte nesta dimensão neste território — e siga. Vazio
   declarado vale mais que texto inventado: quem lê é decisor que confere.

═══ ESPECIFICIDADE OBRIGATÓRIA (contexto, nunca dado) ═══
O que vem abaixo serve para ancorar o texto no lugar concreto — marco cultural,
vocação produtiva, geografia. Isso é CONTEXTO e pode vir do seu conhecimento.
O que NÃO pode vir do seu conhecimento é qualquer dado, número, data, valor ou
ocorrência apresentado como levantado pelo DIT. Contexto se escreve como
contexto; dado só existe se estiver nos sinais coletados.

Você está analisando "${territoryName}" — um lugar concreto, com história, cultura,
economia e geografia próprios. Recomendações genéricas tipo "promover eventos
culturais" ou "investir em saneamento" são PROIBIDAS porque se aplicam a qualquer
município do Brasil. Em cada parágrafo, cite explicitamente:
  • Pelo menos UM marco cultural, histórico ou produtivo específico do território
    (nome próprio: ex. "Capital Baiana do Forró" em Senhor do Bonfim; "Festa de
    Iemanjá" no Rio Vermelho; "MATOPIBA" no Oeste Baiano; "Cabruca de cacau" no
    Sul Baiano; "Polo Petroquímico de Camaçari"; "Bacia de Campos" no Norte
    Fluminense; "Reserva Sapiranga / Projeto Tamar" no litoral norte da BA; etc).
  • Pelo menos UMA referência geográfica concreta (rio, bacia, APA, BR, bioma de
    transição, baía, manguezal, distrito industrial — com nome próprio).
  • Pelo menos UMA dinâmica social ou produtiva real do território (pesca
    artesanal, turismo religioso, polo educacional, garimpo histórico, etc).

Se você não conhece o suficiente sobre "${territoryName}" para citar marcos
próprios, REDUZA a confiança das afirmações (use "indícios sugerem", "merece
investigação local") em vez de inventar ou recorrer ao genérico.

═══ CALENDÁRIO CULTURAL ═══
Quando o território tiver evento sazonal de relevância nacional ou regional
(São João, Carnaval, festas de padroeiro, festivais), cite-o como ATIVO
estratégico — não só folclore. Ex: São João em Senhor do Bonfim/Cruz das Almas
gera receita turística de R$ dezenas de milhões; Carnaval em Salvador/Olinda
mobiliza logística e segurança em escala metropolitana; Festa do Bonfim
movimenta o calendário religioso baiano.

═══ HOTSPOTS ESPECÍFICOS ═══
Quando referir-se a "tensões" ou "áreas a monitorar", NUNCA seja abstrato. Cite
bairro, distrito, BR, rio, APA, comunidade, terra indígena com nome próprio.

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

// buildFallbackPrompt REMOVIDO em 08/09/2026.
// Ele instruía o modelo: "a coleta de dados em tempo real falhou, use seu
// conhecimento para gerar um diagnóstico plausível" — e mandava citar "dados
// reais do IBGE, IBAMA". O relatório saía sem nenhuma marca de que era
// fabricado. Coleta que falha agora devolve 503; cobertura abaixo do piso
// devolve status "cobertura_insuficiente". O DIT não preenche vazio.


// ── LLM CALL ─────────────────────────────────────────────────────────────────
// Prioridade: OpenRouter → Anthropic → OpenAI
// OpenRouter unifica acesso a todos os modelos pelo mesmo endpoint OpenAI-compat.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

async function callLLMOpenRouter(prompt: string): Promise<unknown> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://dit-api-production.up.railway.app",
      "X-Title": "DIT PRINT Territorial Intelligence",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",          // Melhor custo-benefício no OpenRouter
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Você é o sistema de relatórios do DIT PRINT Territorial Intelligence™. Responda SEMPRE com JSON válido e completo, sem nenhum texto fora do JSON. Seja específico, concreto e útil para decisores de negócios no Brasil.",
        },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(150000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter retornou resposta vazia");
  return JSON.parse(content);
}

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
      temperature: 0,
      system:
        "Você é o sistema de IA do DIT PRINT Territorial Intelligence™. " +
        "Responda SEMPRE com JSON válido e completo, sem nenhum texto fora do JSON. " +
        "Seja específico, concreto e útil para decisores de negócios no Brasil.",
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(150000),
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
      temperature: 0,
    }),
    signal: AbortSignal.timeout(150000),
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
  if (OPENROUTER_API_KEY.length > 20) {
    log.info("Usando OpenRouter (gpt-4o) para relatório DIT");
    return callLLMOpenRouter(prompt);
  }
  if (ANTHROPIC_API_KEY.length > 20) {
    log.info("Usando Anthropic Claude para relatório DIT");
    return callLLMAnthropicClaude(prompt);
  }
  log.info("Usando OpenAI direto para relatório DIT");
  return callLLMOpenAI(prompt);
}

// ── ROTA ISCA (free preview) ──────────────────────────────────────────────────
// POST /api/dit/isca — retorna só o teaser do DIT completo.
// Se o DIT completo não estiver em cache, roda o analyze completo primeiro
// e deriva a isca a partir dele. Assim STT da isca === STT do DIT completo.

// ── APRENDIZADO AUTÔNOMO ──────────────────────────────────────────────────
// GET /api/dit/learning/stats — visualiza estado do aprendizado
// POST /api/dit/learning/feedback — registra feedback manual de sinal

ditLandingRouter.get("/learning/stats", async (_req: Request, res: Response) => {
  try {
    const { getLearningStats } = await import("../stt/learning-engine");
    res.json(await getLearningStats());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

ditLandingRouter.post("/learning/feedback", async (req: Request, res: Response) => {
  try {
    const { signalHash, source, territorySlug, rating } = req.body as {
      signalHash?: string; source?: string; territorySlug?: string;
      rating?: "relevant" | "irrelevant";
    };
    if (!signalHash || !source || !territorySlug || (rating !== "relevant" && rating !== "irrelevant")) {
      res.status(400).json({ error: "signalHash, source, territorySlug, rating obrigatórios" });
      return;
    }
    const { recordFeedback } = await import("../stt/learning-engine");
    await recordFeedback(signalHash, source, territorySlug, rating);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── HISTÓRICO STT (para dashboard / gráfico de tendência) ──────────────────
// GET /api/dit/history/:slug — retorna histórico de scores por data.

ditLandingRouter.get("/history/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug) { res.status(400).json({ error: "slug obrigatório" }); return; }
    const { getSttHistory } = await import("../stt/dit-snapshot-store");
    const history = await getSttHistory(slug);
    res.json({ slug, history });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── LISTA DE TERRITÓRIOS MONITORADOS ────────────────────────────────────────
// GET /api/dit/monitored — lista todos os territórios com DIT salvo.

ditLandingRouter.get("/monitored", async (_req: Request, res: Response) => {
  try {
    const { listTrackedSlugs, getSttHistory } = await import("../stt/dit-snapshot-store");
    const slugs = await listTrackedSlugs();
    const list = await Promise.all(
      slugs.map(async (slug) => {
        const history = await getSttHistory(slug);
        const latest = history[history.length - 1];
        return { slug, latestStt: latest?.stt, latestScenario: latest?.scenario, latestDate: latest?.date, totalDays: history.length };
      })
    );
    res.json({ count: list.length, territories: list });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── ROTA ISCA (free preview) ──────────────────────────────────────────────────

ditLandingRouter.post("/isca", async (req: Request, res: Response) => {
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

  // A isca precisa da MESMA chave que o /analyze grava, senão nunca acha o
  // cache e re-roda a coleta inteira a cada visita. Chave = slug canônico IBGE.
  const loc = await resolveLocation(territoryClean);
  const iscaAmbiguidade = takeAmbiguity();
  if (!loc && iscaAmbiguidade) {
    res.status(409).json({
      error: "Território ambíguo",
      detail:
        `Existe mais de um município chamado "${territoryClean}" no Brasil. ` +
        "Informe o estado para o DIT saber de qual você fala.",
      status: "ambiguo",
      territory: territoryClean,
      options: iscaAmbiguidade,
    });
    return;
  }
  if (!loc) {
    res.status(404).json({
      error: "Território não encontrado",
      detail:
        `Não encontramos "${territoryClean}" na malha municipal do IBGE. ` +
        "Confira a grafia ou informe o estado — ex: \"Galinhos, RN\".",
      territory: territoryClean,
    });
    return;
  }

  const fullCacheKey = todayKey(canonicalSlug(loc));
  const iscaCacheKey = `isca:${fullCacheKey}`;

  // Serve isca do cache se disponível
  const cached = analysisCache.get(iscaCacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    log.info({ territory: territoryClean }, "Isca — cache hit");
    res.json(cached.result);
    return;
  }

  // DIT completo não está em cache — precisa gerar o completo primeiro,
  // pois a isca é derivada dele (garante consistência do STT).
  log.info({ territory: territoryClean }, "Isca — rodando DIT completo para derivar isca");
  try {
    // Chama a própria lógica do /analyze via forward interno
    const analyzeUrl = `http://localhost:${process.env.PORT ?? 3000}/api/dit/analyze`;
    const r = await fetch(analyzeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ territory: territoryClean }),
      signal: AbortSignal.timeout(150000),
    });
    // 404 (não existe), 503 (coleta falhou) e 200 com status
    // "cobertura_insuficiente" são respostas legítimas — repassa como vieram,
    // em vez de virar erro genérico de isca.
    if (!r.ok) {
      const body = await r.json().catch(() => ({ error: `Analyze failed: ${r.status}` }));
      res.status(r.status).json(body);
      return;
    }
    // Após o analyze, a isca estará no cache — serve do cache
    const iscaCached = analysisCache.get(iscaCacheKey);
    if (iscaCached) {
      res.json(iscaCached.result);
    } else {
      // Fallback improvável: retorna o full result
      const full = await r.json();
      res.json(full);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * Território já tem DIT publicado? Consulta o snapshot store, que é a mesma
 * base que alimenta /monitored — o que está no ar é o que já foi coletado e
 * publicado, não o que alguém digitou.
 */
async function isMonitored(slug: string): Promise<boolean> {
  try {
    const { listTrackedSlugs } = await import("../stt/dit-snapshot-store");
    const slugs = await listTrackedSlugs();
    return slugs.includes(slug);
  } catch {
    return false;
  }
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

  // `?force=true` pula o cache diário — útil pra QA depois de deploys que
  // adicionam fontes ou corrigem bugs de coleta. Sem isso, o cache em disco
  // continua servindo o resultado antigo do dia inteiro.
  const forceRefresh =
    String(req.query.force ?? "").toLowerCase() === "true" ||
    String((req.body as { force?: string }).force ?? "").toLowerCase() === "true";

  try {
    // 1. Resolve hierárquico: município → distrito → localidade (OSM).
    // Roda ANTES do cache porque é a resolução que define o slug canônico —
    // sem ela, "Galinhos", "Galinhos RN" e "galinhos-rio-grande-do-norte"
    // viravam três territórios com três históricos.
    const loc = await resolveLocation(territoryClean);

    // 1a. PORTA DE ENTRADA — território tem que existir na malha do IBGE.
    // Sem isso, um erro de digitação ("gatinhos") era resolvido, analisado,
    // pontuado com STT 97 e salvo em produção como território monitorado.
    const ambiguidade = takeAmbiguity();
    if (!loc && ambiguidade) {
      log.info(
        { territory: territoryClean, opcoes: ambiguidade.length },
        "Nome de município repetido no país — pedindo a UF"
      );
      res.status(409).json({
        error: "Território ambíguo",
        detail:
          `Existe mais de um município chamado "${territoryClean}" no Brasil. ` +
          "Informe o estado para o DIT saber de qual você fala.",
        status: "ambiguo",
        territory: territoryClean,
        options: ambiguidade,
      });
      return;
    }

    if (!loc) {
      log.info({ territory: territoryClean, ip }, "Território não encontrado na malha IBGE");
      res.status(404).json({
        error: "Território não encontrado",
        detail:
          `Não encontramos "${territoryClean}" na malha municipal do IBGE. ` +
          "Confira a grafia ou informe o estado — ex: \"Galinhos, RN\".",
        territory: territoryClean,
      });
      return;
    }

    log.info(
      {
        territory: territoryClean,
        kind: loc.kind,
        resolved: loc.name,
        municipality: loc.municipality,
        ibgeId: loc.ibgeId,
      },
      "Lookup hierárquico concluído"
    );

    const slug = canonicalSlug(loc);
    const cacheKey = todayKey(slug);

    // 1b. PORTA DO LANÇAMENTO — território fora da lista monitorada não
    // dispara coleta. Vira pedido, e o pedido é o funil (Radar por assinatura,
    // Diagnóstico por ticket). Cache do dia continua sendo servido: quem já
    // tem DIT publicado hoje recebe normalmente.
    if (!PUBLIC_ANALYZE) {
      const jaTemDit = analysisCache.has(cacheKey) || (await isMonitored(slug));
      if (!jaTemDit) {
        log.info({ territory: slug, ip }, "Território fora do escopo monitorado — vira lead");
        res.status(200).json({
          status: "sob_demanda",
          territory: loc.name,
          region:
            loc.kind === "municipality"
              ? `${loc.name}, ${loc.state} — ${loc.region}`
              : `${loc.name} (${loc.municipality}), ${loc.state} — ${loc.region}`,
          slug,
          resolution: {
            kind: loc.kind,
            name: loc.name,
            municipality: loc.municipality,
            state: loc.state,
            region: loc.region,
            ibgeId: loc.ibgeId,
          },
          message:
            `${loc.name} ainda não está no Radar. O DIT deste território é ` +
            "produzido sob demanda, com coleta dedicada e publicação analisada.",
          cta: "solicitar_diagnostico",
        });
        return;
      }
    }

    // 1c. TETO DE GASTO — protege a conta inteira, não só um recurso.
    const analyzeBudget = await canSpend("analyze");
    if (!analyzeBudget.ok) {
      log.warn({ territory: slug, budget: analyzeBudget }, "Orçamento de análise esgotado");
      res.status(429).json({
        error: "Limite de análises atingido",
        detail:
          "O DIT atingiu o teto de análises do período. " +
          "Territórios já publicados continuam disponíveis.",
        status: "orcamento_esgotado",
        retryAfter: "24h",
      });
      return;
    }

    // Cache hit (lock diário — mesmo território no mesmo dia UTC = mesmo STT)
    if (!forceRefresh) {
      const cached = analysisCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        log.info({ territory: slug }, "Cache hit — retornando DIT em cache (lock diário)");
        res.json(cached.result);
        return;
      }
    } else {
      log.info({ territory: slug }, "Cache bypass (force=true) — recoleta DIT");
      analysisCache.delete(cacheKey);
    }

    log.info({ territory: slug, ip }, "Iniciando análise DIT com orquestrador real");

    const resolvedName = loc.name;
    // Rótulo de região exibido no relatório
    // município: "Recife, PE — Nordeste"
    // distrito/localidade: "Cabiúnas (Macaé), RJ — Sudeste"
    const region =
      loc.kind === "municipality"
        ? `${loc.name}, ${loc.state} — ${loc.region}`
        : `${loc.name} (${loc.municipality}), ${loc.state} — ${loc.region}`;

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
          setTimeout(() => reject(new Error("Orchestrator timeout (140s)")), 140000)
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
      // Antes daqui saía um relatório inteiro escrito de memória do modelo
      // ("a coleta falhou, gere um diagnóstico plausível"), entregue sem
      // nenhuma marca de que não tinha dado por trás. Falha de coleta é falha
      // de coleta — o cliente precisa saber que não rodou.
      log.error(
        { territory: resolvedName, err: (orchErr as Error).message },
        "Orquestrador falhou — sem diagnóstico (não fabricamos relatório)"
      );
    }

    if (!orchestratorResult) {
      res.status(503).json({
        error: "Coleta indisponível",
        detail:
          "A malha de fontes não respondeu a tempo para este território. " +
          "O DIT não emite diagnóstico sem dado coletado. Tente novamente em alguns minutos.",
        territory: resolvedName,
        status: "coleta_falhou",
      });
      return;
    }

    // 3a. PISO DE COBERTURA — o motor precisa saber o suficiente para afirmar.
    // Com cobertura baixa, todas as dimensões chegam vazias no prompt e o
    // relatório vira conhecimento geral do modelo com cara de inteligência
    // coletada. Território assim entra na fila de coleta, não vira diagnóstico.
    const coverage = orchestratorResult.coverageScore ?? 0;
    if (coverage < MIN_COVERAGE) {
      const detail = orchestratorResult.coverageDetail;
      log.warn(
        { territory: slug, coverage, minCoverage: MIN_COVERAGE, detail },
        "Cobertura abaixo do piso — DIT não emitido"
      );

      // Entra na fila de coleta: o scheduler volta nele nos próximos ciclos e,
      // quando a cobertura subir, o DIT sai de verdade.
      try {
        const { trackTerritory } = await import("../stt/tracked-territories");
        await trackTerritory({
          slug,
          name: resolvedName,
          state: loc.state,
          region: loc.region,
          ibgeId: loc.ibgeId,
        });
      } catch (trackErr) {
        log.warn({ err: (trackErr as Error).message }, "Falha ao enfileirar território");
      }

      res.status(200).json({
        status: "cobertura_insuficiente",
        territory: resolvedName,
        region,
        slug,
        resolution: {
          kind: loc.kind,
          name: loc.name,
          municipality: loc.municipality,
          state: loc.state,
          region: loc.region,
          ibgeId: loc.ibgeId,
        },
        coverageScore: Math.round(coverage * 1000) / 1000,
        minCoverage: MIN_COVERAGE,
        coverageDetail: detail ?? null,
        message:
          `A malha do DIT ainda não tem cobertura suficiente sobre ${resolvedName} ` +
          `para emitir diagnóstico (${Math.round(coverage * 100)}% das fontes responderam, ` +
          `mínimo de ${Math.round(MIN_COVERAGE * 100)}%). ` +
          "O território entrou na fila de coleta.",
      });
      return;
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
      stateName: loc?.stateName ?? "",
      region: loc?.region ?? "",
      mesoregion: loc?.mesoregion ?? "",
      microregion: loc?.microregion ?? "",
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
    const llmBudget = await canSpend("llm_report");
    if (!llmBudget.ok) {
      log.warn({ territory: slug, budget: llmBudget }, "Orçamento de LLM esgotado");
      res.status(429).json({
        error: "Limite de relatórios atingido",
        detail:
          "A coleta deste território rodou, mas o teto de geração de relatório " +
          "do período foi atingido. O diagnóstico sai no próximo ciclo.",
        status: "orcamento_esgotado",
        coverageScore: orchestratorResult.coverageScore ?? null,
      });
      return;
    }
    await consume("analyze");
    await consume("llm_report");

    const llmPromise: Promise<unknown> = callLLM(
          buildReportPrompt(
            resolvedName,
            region,
            Math.round(orchestratorResult.stt),
            orchestratorResult.dimensions,
            orchestratorResult.alerts.length,
            orchestratorResult.totalSignals,
            {
              state: loc?.state,
              stateName: loc?.stateName,
              mesoregion: loc?.mesoregion,
              microregion: loc?.microregion,
            }
          )
        );

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

    // Merge: LLM produz o relatório executivo; strategic layer adiciona dados
    // estruturados. STT/scenario/dimensões SEMPRE vêm do orchestrator (fonte
    // canônica). LLM pode "inventar" um STT diferente no free-form output —
    // sobrescrevemos aqui para garantir consistência com o consolidator 24mo.
    const baseExtra = {
      resolution,
      territoryGeo: geo ? { centroid: geo.centroid, bbox: geo.bbox } : null,
      coverageScore: orchestratorResult?.coverageScore ?? null,
      coverageDetail: orchestratorResult?.coverageDetail ?? null,
      /**
       * Procedência do relatório, exposta junto com ele.
       *
       * O DIT é lido por decisor que confere. Ele precisa poder ver, sem
       * pedir, quanto da malha respondeu, quantos sinais sustentam o texto e
       * qual o piso que o diagnóstico teve que passar para ser emitido.
       */
      dataIntegrity: {
        basis: "coletado" as const,
        slug,
        ibgeId: loc.ibgeId,
        coverageScore: orchestratorResult.coverageScore ?? null,
        minCoverage: MIN_COVERAGE,
        sourcesConsulted: orchestratorResult.coverageDetail?.totalSources ?? null,
        sourcesWithSignals: orchestratorResult.coverageDetail?.sourcesWithSignals ?? null,
        signalsInWindow: orchestratorResult.historicalConsolidation?.signalsInWindow ?? null,
        windowMonths: orchestratorResult.historicalConsolidation?.windowMonths ?? null,
        collectedAt: orchestratorResult.completedAt,
      },
    };

    // Override canônico do orchestrator sobre o output do LLM
    const canonicalOverride = orchestratorResult
      ? (() => {
          const sc = scenarioFromStt(orchestratorResult.stt);
          return {
            stt: Math.round(orchestratorResult.stt),
            scenario: sc.scenario,
            scenarioLabel: sc.scenarioLabel,
            gaugeColor: sc.gaugeColor,
            totalSignalsCount: orchestratorResult.totalSignals,
            alertsCount: orchestratorResult.alerts.length,
          };
        })()
      : {};

    const result =
      strategic && typeof llmReport === "object" && llmReport !== null
        ? {
            ...(llmReport as Record<string, unknown>),
            ...baseExtra,
            ...canonicalOverride,
            sectors: strategic.sectors,
            resources: strategic.resources,
            hotspots: strategic.hotspots,
            strategicCases: strategic.strategicCases,
          }
        : typeof llmReport === "object" && llmReport !== null
          ? { ...(llmReport as Record<string, unknown>), ...baseExtra, ...canonicalOverride }
          : llmReport;

    // 6. Salva o DIT COMPLETO em cache — sempre antes de qualquer retorno.
    // Esta é a base canônica. A "isca" (free preview) é derivada DAQUI,
    // garantindo consistência absoluta: STT da isca === STT do DIT completo.
    analysisCache.set(cacheKey, { result, ts: Date.now() });
    persistCacheToDisk();

    // 6a. SNAPSHOT PERMANENTE — salva DIT completo em disco por data.
    // Diferente do cache (24h em memória), o snapshot sobrevive para sempre:
    // - Auditabilidade: "qual era o STT ontem?"
    // - Scheduler usa para não reprocessar o que já foi computado hoje
    // - Base para gráfico de tendência STT no dashboard
    // - Garante que 24 meses de HISTÓRICO DE SCORES esteja disponível
    try {
      const { saveDitSnapshot } = await import("../stt/dit-snapshot-store");
      const resultObj = result as Record<string, unknown>;
      const sttVal = typeof resultObj.stt === "number" ? resultObj.stt : 0;
      const scenarioVal = typeof resultObj.scenario === "string" ? resultObj.scenario : "estabilidade";
      const signalCount = orchestratorResult?.totalSignals ?? 0;
      const coverage = orchestratorResult?.coverageScore;
      await saveDitSnapshot(
        slug,
        resolvedName,
        result,
        sttVal,
        scenarioVal,
        signalCount,
        coverage
      );
    } catch (snapErr) {
      log.warn({ err: (snapErr as Error).message }, "Falha ao salvar DIT snapshot (não-fatal)");
    }

    // 6b. Gera isca (free preview) derivada do DIT completo.
    // Contém: STT, cenário, 1 parágrafo do executiveSummary, 3 sinais,
    // nomes das dimensões com complexidade (sem insights), previsão resumida.
    // Sem: insights detalhados, recomendações completas, recursos, hotspots,
    // casos estratégicos. Isca é salva junto mas enviada só quando solicitada.
    const fullResult = result as Record<string, unknown>;
    const iscaResult = {
      territory: fullResult.territory,
      region: fullResult.region,
      stt: fullResult.stt,
      scenario: fullResult.scenario,
      scenarioLabel: fullResult.scenarioLabel,
      gaugeColor: fullResult.gaugeColor,
      resolution: fullResult.resolution,
      coverageScore: fullResult.coverageScore,
      // 1 parágrafo de síntese
      executiveSummaryTeaser: Array.isArray(fullResult.executiveSummary)
        ? (fullResult.executiveSummary as string[])[0] ?? ""
        : "",
      // Dimensões: só código, nome e complexidade (sem insights, sem signals)
      dimensionsTeaser: Array.isArray(fullResult.dimensions)
        ? (fullResult.dimensions as Array<{ code: string; name: string; complexity: string }>)
            .map((d) => ({ code: d.code, name: d.name, complexity: d.complexity }))
        : [],
      // 3 sinais mais críticos
      keySignalsTeaser: Array.isArray(fullResult.keySignals)
        ? (fullResult.keySignals as unknown[]).slice(0, 3)
        : [],
      // 1 risco e 1 oportunidade da previsão
      forecastTeaser: fullResult.forecast
        ? {
            horizon: (fullResult.forecast as { horizon?: string }).horizon,
            risks: ((fullResult.forecast as { risks?: string[] }).risks ?? []).slice(0, 2),
          }
        : null,
      isIsca: true,
      fullDitAvailable: true,
    };
    analysisCache.set(`isca:${cacheKey}`, { result: iscaResult, ts: Date.now() });
    persistCacheToDisk();

    // 7. REGISTRO DE RASTREAMENTO — todo território pesquisado entra na lista
    // de coleta autônoma do scheduler (rodando a cada 4h). Isso é o que faz
    // o STT EVOLUIR DIARIAMENTE em vez de ser snapshot do dia da pesquisa.
    try {
      const { trackTerritory } = await import("../stt/tracked-territories");
      const sttForCache =
        typeof (result as { stt?: unknown }).stt === "number"
          ? ((result as { stt: number }).stt)
          : undefined;
      await trackTerritory({
        slug,
        name: resolvedName,
        state: loc?.state,
        region: loc?.region,
        ibgeId: loc?.ibgeId,
        lastSttSeen: sttForCache,
      });
    } catch (trackErr) {
      log.warn({ err: (trackErr as Error).message }, "Falha ao registrar tracked territory");
    }

    log.info({ territory: resolvedName }, "DIT análise concluída e entregue");
    res.json(result);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ territory: territoryClean, err: msg }, "Falha na análise DIT");
    res.status(500).json({ error: msg });
  }
});
