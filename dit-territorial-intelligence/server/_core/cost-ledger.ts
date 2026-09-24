/**
 * Livro de custo — quanto custou, de verdade, ler um território.
 *
 * A pergunta "quanto custa um território" não se responde com estimativa de
 * token. Ela se responde medindo: cada chamada paga (LLM ou busca) registra o
 * uso REAL devolvido pelo provedor, com o território a que pertence.
 *
 * O território chega por contexto assíncrono (AsyncLocalStorage). A análise
 * abre o contexto uma vez — `comCustoDoTerritorio(slug, "leitura", fn)` — e
 * tudo que for pago lá dentro, em qualquer agente, em qualquer profundidade,
 * cai na conta certa. Nenhum dos 46 agentes precisou mudar.
 *
 * Grava em DATA_DIR/custos/ledger.jsonl, uma linha por evento pago.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";

const log = logger.child({ module: "cost-ledger" });

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const DIR = join(DATA_DIR, "custos");
const LEDGER = join(DIR, "ledger.jsonl");

/**
 * Tipo de execução:
 *   leitura       primeira leitura completa de um território (Diagnóstico)
 *   acompanhamento coleta diária de um território já no Radar
 *   outro         qualquer outra coisa (painel, script)
 */
export type TipoExecucao = "leitura" | "acompanhamento" | "outro";

interface Contexto {
  territorio: string;
  tipo: TipoExecucao;
  execucao: string;
  iniciadaEm: number;
}

const storage = new AsyncLocalStorage<Contexto>();

export interface EventoCusto {
  ts: string;
  territorio: string;
  tipo: TipoExecucao;
  execucao: string;
  recurso: "llm" | "serpapi" | "apify";
  papel?: string;
  modelo?: string;
  inTokens?: number;
  outTokens?: number;
  /** Busca servida do cache não custa — é registrada para mostrar a economia */
  cache?: boolean;
  /**
   * Busca que a cota ou o teto barrou. Não custou nada HOJE, mas é demanda
   * real: sem registrá-la, com a conta zerada o custo de busca de um
   * território sairia zero, e o preço do Radar seria calculado em cima disso.
   */
  bloqueada?: boolean;
  usd: number;
}

/** Roda `fn` com todo custo interno atribuído a este território. */
export async function comCustoDoTerritorio<T>(
  territorio: string,
  tipo: TipoExecucao,
  fn: () => Promise<T>
): Promise<T> {
  const ctx: Contexto = {
    territorio,
    tipo,
    execucao: randomUUID().slice(0, 8),
    iniciadaEm: Date.now(),
  };
  return storage.run(ctx, fn);
}

export function contextoAtual(): Contexto | undefined {
  return storage.getStore();
}

/** Registra um evento pago (ou evitado pelo cache). Nunca lança. */
export async function registrarCusto(
  e: Omit<EventoCusto, "ts" | "territorio" | "tipo" | "execucao">
): Promise<void> {
  const ctx = storage.getStore();
  const evento: EventoCusto = {
    ts: new Date().toISOString(),
    territorio: ctx?.territorio ?? "(sem território)",
    tipo: ctx?.tipo ?? "outro",
    execucao: ctx?.execucao ?? "-",
    ...e,
    usd: Math.round(e.usd * 1e6) / 1e6,
  };
  try {
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
    await fs.appendFile(LEDGER, JSON.stringify(evento) + "\n", "utf8");
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Falha ao gravar evento de custo");
  }
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

async function lerEventos(): Promise<EventoCusto[]> {
  try {
    const raw = await fs.readFile(LEDGER, "utf8");
    return raw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as EventoCusto);
  } catch {
    return [];
  }
}

export interface ResumoExecucao {
  execucao: string;
  territorio: string;
  tipo: TipoExecucao;
  em: string;
  usd: number;
  llmUsd: number;
  buscaUsd: number;
  chamadasLlm: number;
  buscasPagas: number;
  buscasDoCache: number;
  buscasBloqueadas: number;
  tokensEntrada: number;
  tokensSaida: number;
  porPapel: Record<string, { usd: number; chamadas: number; modelo: string }>;
}

/** Custo por execução — cada leitura ou acompanhamento de cada território. */
export async function resumoPorExecucao(limite = 50): Promise<ResumoExecucao[]> {
  const eventos = await lerEventos();
  const mapa = new Map<string, ResumoExecucao>();

  for (const e of eventos) {
    let r = mapa.get(e.execucao);
    if (!r) {
      r = {
        execucao: e.execucao,
        territorio: e.territorio,
        tipo: e.tipo,
        em: e.ts,
        usd: 0,
        llmUsd: 0,
        buscaUsd: 0,
        chamadasLlm: 0,
        buscasPagas: 0,
        buscasDoCache: 0,
        buscasBloqueadas: 0,
        tokensEntrada: 0,
        tokensSaida: 0,
        porPapel: {},
      };
      mapa.set(e.execucao, r);
    }
    r.usd += e.usd;
    if (e.recurso === "llm") {
      r.llmUsd += e.usd;
      r.chamadasLlm += 1;
      r.tokensEntrada += e.inTokens ?? 0;
      r.tokensSaida += e.outTokens ?? 0;
      const p = e.papel ?? "?";
      const atual = r.porPapel[p] ?? { usd: 0, chamadas: 0, modelo: e.modelo ?? "?" };
      atual.usd += e.usd;
      atual.chamadas += 1;
      r.porPapel[p] = atual;
    } else {
      if (e.cache) r.buscasDoCache += 1;
      else if (e.bloqueada) r.buscasBloqueadas += 1;
      else {
        r.buscasPagas += 1;
        r.buscaUsd += e.usd;
      }
    }
  }

  return Array.from(mapa.values())
    .sort((a, b) => b.em.localeCompare(a.em))
    .slice(0, limite)
    .map((r) => ({
      ...r,
      usd: Math.round(r.usd * 10000) / 10000,
      llmUsd: Math.round(r.llmUsd * 10000) / 10000,
      buscaUsd: Math.round(r.buscaUsd * 10000) / 10000,
    }));
}
