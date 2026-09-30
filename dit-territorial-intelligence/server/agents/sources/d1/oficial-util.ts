/**
 * oficial-util — utilitários das fontes OFICIAIS e GRATUITAS de D1.
 *
 * Três coisas em comum entre IBAMA (embargos), S2iD (reconhecimentos) e
 * TerraBrasilis (PRODES/DETER):
 *
 *  1) Base nacional grande (CSV de 80 a 170 MB) baixada UMA vez, reduzida a um
 *     índice pequeno por município e cacheada em DATA_DIR/d1-oficial por 30 dias.
 *     O download roda em segundo plano e NÃO depende do timeout de 30 s da coleta:
 *     a coleta que encontra o índice pronto responde na hora; a que não encontra
 *     devolve [] (sem inventar nada) e dispara a construção para as próximas.
 *  2) Leitura em fluxo de CSV com ponto e vírgula e aspas (campos com quebra de
 *     linha), sem carregar o arquivo inteiro na memória.
 *  3) Resolução do código IBGE do território.
 */

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import axios from "axios";
import type { Territory } from "../../../../drizzle/schema";
import { dobrar } from "../../verificador";
import { logger } from "../../../_core/logger";

const log = logger.child({ module: "d1-oficial" });

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
export const OFICIAL_DIR = join(DATA_DIR, "d1-oficial");

/** Validade do índice nacional: as bases oficiais mudam em ritmo mensal. */
export const VALIDADE_INDICE_MS = 30 * 24 * 60 * 60 * 1000;
/** Depois de uma construção que falhou, espera antes de tentar de novo. */
const ESPERA_APOS_FALHA_MS = 60 * 60 * 1000;

// Alguns portais do governo (WAF) recusam o User-Agent padrão de bibliotecas.
export const USER_AGENT =
  "Mozilla/5.0 (compatible; DIT-PRINT/1.0; +https://printrio.net) AppleWebKit/537.36";

// ─── Código IBGE ─────────────────────────────────────────────────────────────

/** Código IBGE de 7 dígitos do território (gravado em contextData na resolução). */
export function ibgeDoTerritorio(territory: Territory): string | null {
  const ctx = (territory.contextData ?? null) as Record<string, unknown> | null;
  const raw =
    ctx?.ibgeId ??
    ctx?.ibgeCode ??
    (Array.isArray(ctx?.ibgeMunicipios) ? (ctx.ibgeMunicipios as unknown[])[0] : undefined);
  const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const s = String(n);
  return s.length === 7 ? s : null;
}

const municipiosPorUf = new Map<string, Map<string, string>>();

/**
 * Sem código em contextData, resolve por nome + UF na API de localidades do IBGE
 * (gratuita). Devolve null se o nome não existir na UF (território que não é
 * município, por exemplo): nesse caso a fonte não responde, não adivinha.
 */
export async function resolverIbge(territory: Territory, signal?: AbortSignal): Promise<string | null> {
  const direto = ibgeDoTerritorio(territory);
  if (direto) return direto;
  const ctx = (territory.contextData ?? {}) as Record<string, unknown>;
  const uf = String(ctx.uf ?? territory.state ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) return null;
  try {
    let mapa = municipiosPorUf.get(uf);
    if (!mapa) {
      const r = await axios.get(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
        { signal, timeout: 15000, headers: { "User-Agent": USER_AGENT } }
      );
      mapa = new Map<string, string>();
      for (const m of r.data as Array<{ id: number; nome: string }>) mapa.set(dobrar(m.nome), String(m.id));
      municipiosPorUf.set(uf, mapa);
    }
    return mapa.get(dobrar(territory.name)) ?? null;
  } catch {
    return null;
  }
}

// ─── CSV em fluxo ────────────────────────────────────────────────────────────

/**
 * Lê um CSV com separador ";" e aspas duplas, linha a linha, em fluxo. Devolve
 * cada registro como array de campos (a primeira linha é o cabeçalho, quem chama
 * decide o que fazer com ela). Aceita quebra de linha dentro de campo entre aspas.
 */
export async function* lerCsv(
  caminho: string,
  codificacao: "utf-8" | "windows-1252"
): AsyncGenerator<string[]> {
  const decoder = new TextDecoder(codificacao);
  const stream = createReadStream(caminho, { highWaterMark: 1 << 20 });
  let campos: string[] = [];
  let atual = "";
  let aspas = false;
  let pendenteAspas = false; // viu " dentro de campo entre aspas: fecha ou escapa?

  for await (const chunk of stream) {
    const texto = decoder.decode(chunk as Buffer, { stream: true });
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (pendenteAspas) {
        pendenteAspas = false;
        if (c === '"') {
          atual += '"';
          continue;
        }
        aspas = false; // a aspa anterior fechou o campo; segue o tratamento normal de c
      }
      if (aspas) {
        if (c === '"') pendenteAspas = true;
        else atual += c;
        continue;
      }
      if (c === '"') aspas = true;
      else if (c === ";") {
        campos.push(atual);
        atual = "";
      } else if (c === "\n") {
        campos.push(atual);
        atual = "";
        yield campos;
        campos = [];
      } else if (c !== "\r") atual += c;
    }
  }
  if (atual !== "" || campos.length > 0) {
    campos.push(atual);
    yield campos;
  }
}

// ─── Download ────────────────────────────────────────────────────────────────

/** Baixa uma URL para arquivo em fluxo. Escreve em .tmp e renomeia no fim. */
export async function baixarParaArquivo(url: string, destino: string, limiteMs = 15 * 60 * 1000): Promise<void> {
  await mkdir(OFICIAL_DIR, { recursive: true });
  const tmp = `${destino}.tmp`;
  const controller = new AbortController();
  const relogio = setTimeout(() => controller.abort(), limiteMs);
  try {
    const r = await axios.get(url, {
      responseType: "stream",
      signal: controller.signal,
      timeout: 60_000,
      maxContentLength: Infinity,
      headers: { "User-Agent": USER_AGENT, Accept: "text/csv,*/*" },
    });
    const tipo = String(r.headers["content-type"] ?? "");
    if (/text\/html/i.test(tipo)) throw new Error(`resposta HTML em vez de CSV (${url})`);
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(tmp);
      r.data.pipe(out);
      r.data.on("error", reject);
      out.on("error", reject);
      out.on("finish", () => resolve());
    });
    await rename(tmp, destino);
  } catch (err) {
    await unlink(tmp).catch(() => undefined);
    throw err;
  } finally {
    clearTimeout(relogio);
  }
}

// ─── Índice em disco com construção em segundo plano ─────────────────────────

export interface IndiceEmDisco<T> {
  geradoEm: string;
  /** Endpoint de onde a base foi baixada */
  fonteUrl: string;
  dados: T;
}

const construindo = new Map<string, Promise<void>>();
const falhouEm = new Map<string, number>();

/**
 * Devolve o índice cacheado (mesmo vencido: dado de ontem vale mais que nenhum)
 * e, se estiver ausente ou vencido, dispara a reconstrução em segundo plano.
 * Nunca lança e nunca espera o download: null significa "ainda não há índice".
 */
export async function obterIndice<T>(
  nome: string,
  construir: () => Promise<IndiceEmDisco<T>>
): Promise<{ indice: IndiceEmDisco<T>; defasado: boolean } | null> {
  const arquivo = join(OFICIAL_DIR, `${nome}.json`);
  let indice: IndiceEmDisco<T> | null = null;
  let idade = Infinity;
  try {
    indice = JSON.parse(await readFile(arquivo, "utf-8")) as IndiceEmDisco<T>;
    idade = Date.now() - (await stat(arquivo)).mtimeMs;
  } catch {
    // sem índice ainda
  }

  const vencido = !indice || idade > VALIDADE_INDICE_MS;
  if (vencido) void reconstruirIndice(nome, construir);
  return indice ? { indice, defasado: idade > VALIDADE_INDICE_MS } : null;
}

/**
 * Constrói o índice agora e grava em disco. Uma construção por vez por fonte;
 * falha registrada e não repetida por uma hora. Exposta para o script de
 * pré-aquecimento (rodar uma vez por mês) e para os testes.
 */
export function reconstruirIndice<T>(
  nome: string,
  construir: () => Promise<IndiceEmDisco<T>>
): Promise<void> {
  const emAndamento = construindo.get(nome);
  if (emAndamento) return emAndamento;
  const ultimaFalha = falhouEm.get(nome);
  if (ultimaFalha && Date.now() - ultimaFalha < ESPERA_APOS_FALHA_MS) return Promise.resolve();

  const job = (async () => {
    const t0 = Date.now();
    try {
      log.info({ indice: nome }, "Construindo índice oficial em segundo plano");
      const indice = await construir();
      await mkdir(OFICIAL_DIR, { recursive: true });
      const arquivo = join(OFICIAL_DIR, `${nome}.json`);
      await writeFile(`${arquivo}.tmp`, JSON.stringify(indice), "utf-8");
      await rename(`${arquivo}.tmp`, arquivo);
      falhouEm.delete(nome);
      log.info({ indice: nome, segundos: Math.round((Date.now() - t0) / 1000) }, "Índice oficial pronto");
    } catch (err) {
      falhouEm.set(nome, Date.now());
      log.warn({ indice: nome, err: (err as Error).message }, "Falha ao construir índice oficial (nova tentativa em 1 h)");
    } finally {
      construindo.delete(nome);
    }
  })();
  construindo.set(nome, job);
  return job;
}

// ─── Datas ───────────────────────────────────────────────────────────────────

/** "2025-05-08 09:49:15" ou "08/05/2025" para Date; null se ilegível ou absurda. */
export function lerData(texto: string): Date | null {
  const t = (texto ?? "").trim();
  let d: Date | null = null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  else if ((m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/))) d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  if (!d || Number.isNaN(d.getTime())) return null;
  // A base do IBAMA traz datas com erro de digitação (ano 2925, 2090). Fora de
  // 1990 até amanhã, a data não é confiável e o registro fica sem data.
  const ano = d.getUTCFullYear();
  if (ano < 1990 || d.getTime() > Date.now() + 86_400_000) return null;
  return d;
}

export function mesesAtras(n: number): number {
  return Date.now() - n * 30.4375 * 24 * 60 * 60 * 1000;
}

export function fmtData(d: Date | string | number): string {
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
}
