/**
 * Progresso da leitura ao vivo.
 *
 * O motor (dimensões e fontes) avisa aqui o que acontece enquanto coleta; a
 * rota GET /api/dit/leitura/stream repassa à tela em SSE. Serve para a pessoa
 * ver as fontes respondendo e os sinais verificados chegando de verdade, em
 * vez de uma barra que finge andar.
 *
 * O território chega por contexto assíncrono (AsyncLocalStorage), igual ao
 * livro de custos: o motor não precisa saber quem está ouvindo. Sem ouvinte,
 * `emitir` não faz nada e não custa nada (scheduler e rota antiga seguem iguais).
 *
 * Só sai daqui o que já é público (manchete, fonte, data) ou contagem. Nenhum
 * texto de análise passa por este canal.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type EventoProgresso =
  | { tipo: "etapa"; id: "coleta" | "verificacao" | "consolidacao" | "redacao"; rotulo: string; detalhe?: string }
  | { tipo: "fonte"; dimensao: string; fonte: string; nome: string; ok: boolean; brutos: number }
  | {
      tipo: "sinal";
      dimensao: string;
      fonte: string;
      titulo: string;
      data: string | null;
      url: string | null;
      impacto: "alto" | "medio" | "baixo";
    }
  | { tipo: "dimensao"; id: string; nome: string; sinais: number; fontesOk: number; fontesTotal: number };

type Ouvinte = (e: EventoProgresso) => void;

const ouvintes = new Map<string, Set<Ouvinte>>();
const contexto = new AsyncLocalStorage<{ slug: string }>();

/** Roda `fn` com o território em contexto: tudo que o motor emitir dentro vai para os ouvintes dele. */
export function comProgresso<T>(slug: string, fn: () => T): T {
  return contexto.run({ slug }, fn);
}

/** Emite para quem ouve o território do contexto atual. Sem contexto ou sem ouvinte, não faz nada. */
export function emitir(evento: EventoProgresso): void {
  const slug = contexto.getStore()?.slug;
  if (slug) emitirPara(slug, evento);
}

export function emitirPara(slug: string, evento: EventoProgresso): void {
  const set = ouvintes.get(slug);
  if (!set || set.size === 0) return;
  for (const fn of Array.from(set)) {
    try {
      fn(evento);
    } catch {
      // Ouvinte quebrado (conexão caída) não pode derrubar a coleta.
    }
  }
}

/** Escuta um território. Devolve a função que para de escutar. */
export function ouvir(slug: string, fn: Ouvinte): () => void {
  let set = ouvintes.get(slug);
  if (!set) {
    set = new Set();
    ouvintes.set(slug, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) ouvintes.delete(slug);
  };
}

export function _ouvintesParaTeste(): number {
  let n = 0;
  ouvintes.forEach((s) => (n += s.size));
  return n;
}
