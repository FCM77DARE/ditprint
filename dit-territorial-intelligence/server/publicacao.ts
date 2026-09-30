/**
 * Publicação: o portão humano entre o que o motor calcula e o que sai para fora.
 *
 * Funciona nos dois modos de produção (skill dit-institucional, seção 7):
 *   - Com MySQL: stt_scores segue existindo (published, publishedAt), e o livro
 *     de publicações (coleção `publicacoes`, tabela dit_docs) guarda o que o
 *     MySQL não guarda: quem publicou, tensão e confiança congeladas, nota
 *     publicada, e cada publicação como ponto da série (delta 7/30 dias).
 *   - Sem MySQL: rascunhos e livro vivem em DATA_DIR/rascunhos.json e
 *     DATA_DIR/publicacoes.json. É o que a Railway roda hoje.
 *
 * Regra de ouro: toda leitura pública passa por aqui (`publicadosPorTerritorio`,
 * `lerPublicacoes`) e nunca lê rascunho nem index_history. O orquestrador
 * continua gravando tudo; a leitura pública é que filtra.
 */

import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { indexHistory, sttScores, territories } from "../drizzle/schema";
import { colecao } from "./_core/colecao";
import { logger } from "./_core/logger";
import { cenarioDoStt } from "../shared/metodologia";
import type { Leitura } from "../shared/leitura";
import {
  devolucaoVigente,
  entraNaFila,
  mesclarPublicacoes,
  montarItemFila,
  ordenarFila,
  type Devolucao,
  type Dims,
  type ItemFila,
  type Publicacao,
  type Rascunho,
} from "./stt/publicacao-logica";

const log = logger.child({ module: "publicacao" });

const livro = colecao<Publicacao>("publicacoes");
const fichas = colecao<Rascunho>("rascunhos");
const devolvidos = colecao<Devolucao>("devolucoes");

const chaveRascunho = (slug: string, period: string) => `${slug}|${period}`;

// ─── Rascunhos (o que o motor calculou) ──────────────────────────────────────

export interface EntradaRascunho {
  slug: string;
  territoryId: number;
  nome: string;
  estado: string | null;
  regiao: string | null;
  period: string;
  stt: number;
  dims: Dims;
  activatedIndex: string | null;
  notaExecutiva: string | null;
  leitura: Leitura | null;
  nSinais: number | null;
}

/** Chamado pelo orquestrador a cada rodada. Nunca lança: a coleta não cai por causa disto. */
export async function registrarRascunho(e: EntradaRascunho, agora: Date = new Date()): Promise<void> {
  try {
    const r: Rascunho = {
      slug: e.slug,
      territoryId: e.territoryId,
      nome: e.nome,
      estado: e.estado,
      regiao: e.regiao,
      period: e.period,
      stt: e.stt,
      scenario: cenarioDoStt(e.stt),
      dims: e.dims,
      activatedIndex: e.activatedIndex,
      notaExecutiva: e.notaExecutiva,
      leitura: e.leitura,
      nSinais: e.nSinais,
      geradoEm: agora.toISOString(),
    };
    await fichas.gravar(chaveRascunho(e.slug, e.period), r);
  } catch (err) {
    log.warn({ err: (err as Error).message, slug: e.slug }, "Rascunho não gravado (não-fatal)");
  }
}

// ─── Leitura do publicado ────────────────────────────────────────────────────

function dimsDeLinha(row: Record<string, unknown>): Dims {
  const out: Dims = {};
  for (const k of ["d1", "d2", "d3", "d4", "d5", "d6", "d7"] as const) {
    const v = row[`${k}Score`];
    out[k] = typeof v === "number" ? v : null;
  }
  return out;
}

type LinhaStt = typeof sttScores.$inferSelect;
type Territorio = typeof territories.$inferSelect;

function paraPublicacaoLegada(row: LinhaStt, t: Territorio): Publicacao {
  const quando = row.publishedAt ?? row.updatedAt ?? row.createdAt;
  return {
    slug: t.slug,
    territoryId: t.id,
    nome: t.name,
    estado: t.state ?? null,
    regiao: t.region ?? null,
    period: row.period,
    stt: row.stt,
    tensao: null,
    confianca: null,
    scenario: row.scenario ?? cenarioDoStt(row.stt),
    dims: dimsDeLinha(row as unknown as Record<string, unknown>),
    activatedIndex: row.activatedIndex ?? null,
    notaExecutiva: row.executiveNote ?? null,
    leitura: null,
    nSinais: null,
    publishedAt: new Date(quando).toISOString(),
    publishedBy: "legado",
    origem: "legado",
    scoreId: row.id,
  };
}

async function legadoMysql(t: Territorio): Promise<Publicacao[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(sttScores)
      .where(and(eq(sttScores.territoryId, t.id), eq(sttScores.published, true)))
      .orderBy(desc(sttScores.period));
    return rows.map((r) => paraPublicacaoLegada(r, t));
  } catch (err) {
    log.warn({ err: (err as Error).message, slug: t.slug }, "Publicações legadas ilegíveis (não-fatal)");
    return [];
  }
}

export interface TerritorioComPublicacoes {
  slug: string;
  territoryId: number;
  nome: string;
  estado: string | null;
  regiao: string | null;
  /** Só em modo MySQL. */
  contextData: unknown;
  pubs: Publicacao[];
}

async function territoriosAtivosMysql(): Promise<Territorio[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(territories).where(eq(territories.active, true));
  } catch {
    return [];
  }
}

/**
 * Todos os territórios com suas publicações (já mescladas com o legado).
 * `incluirSemPublicacao`: territórios ativos do MySQL sem nada publicado entram
 * com `pubs: []` (a lista pública precisa mostrá-los como "sem leitura").
 */
export async function publicadosPorTerritorio(
  opcoes: { incluirSemPublicacao?: boolean } = {}
): Promise<TerritorioComPublicacoes[]> {
  const doLivro = await livro.listar();
  const porSlug = new Map<string, Publicacao[]>();
  for (const p of doLivro) porSlug.set(p.slug, [...(porSlug.get(p.slug) ?? []), p]);

  const saida = new Map<string, TerritorioComPublicacoes>();
  for (const t of await territoriosAtivosMysql()) {
    const pubs = mesclarPublicacoes(porSlug.get(t.slug) ?? [], await legadoMysql(t));
    if (pubs.length === 0 && !opcoes.incluirSemPublicacao) continue;
    saida.set(t.slug, {
      slug: t.slug,
      territoryId: t.id,
      nome: t.name,
      estado: t.state ?? null,
      regiao: t.region ?? null,
      contextData: t.contextData,
      pubs,
    });
  }
  for (const [slug, pubs] of Array.from(porSlug.entries())) {
    if (saida.has(slug)) continue;
    const ult = [...pubs].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[pubs.length - 1];
    saida.set(slug, {
      slug,
      territoryId: ult.territoryId,
      nome: ult.nome,
      estado: ult.estado,
      regiao: ult.regiao,
      contextData: null,
      pubs: mesclarPublicacoes(pubs, []),
    });
  }
  return Array.from(saida.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Um território (por slug) com as publicações; null se não existe em lugar nenhum. */
export async function publicadosDoSlug(slug: string): Promise<TerritorioComPublicacoes | null> {
  const doLivro = (await livro.listar()).filter((p) => p.slug === slug);
  const db = await getDb();
  let t: Territorio | undefined;
  if (db) {
    try {
      [t] = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1);
    } catch {
      t = undefined;
    }
  }
  if (t) {
    return {
      slug,
      territoryId: t.id,
      nome: t.name,
      estado: t.state ?? null,
      regiao: t.region ?? null,
      contextData: t.contextData,
      pubs: mesclarPublicacoes(doLivro, await legadoMysql(t)),
    };
  }
  if (doLivro.length === 0) return null;
  const ult = [...doLivro].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[doLivro.length - 1];
  return {
    slug,
    territoryId: ult.territoryId,
    nome: ult.nome,
    estado: ult.estado,
    regiao: ult.regiao,
    contextData: null,
    pubs: mesclarPublicacoes(doLivro, []),
  };
}

export async function lerPublicacoes(slug: string): Promise<Publicacao[]> {
  return (await publicadosDoSlug(slug))?.pubs ?? [];
}

// ─── Publicar e devolver (um único caminho) ──────────────────────────────────

export interface RefScore {
  scoreId?: number;
  slug?: string;
  period?: string;
}

/** Rascunho a partir de uma linha pendente de stt_scores (modo MySQL, dados anteriores ao livro). */
async function rascunhoDeLinha(row: LinhaStt, t: Territorio): Promise<Rascunho> {
  const { leituraDoTerritorio, scoresDeLinha } = await import("./stt/leitura");
  const leitura = await leituraDoTerritorio(
    { id: t.id, slug: t.slug, contextData: t.contextData },
    scoresDeLinha(row as unknown as Record<string, unknown>)
  );
  let nSinais: number | null = null;
  const db = await getDb();
  if (db) {
    try {
      const [h] = await db
        .select({ n: indexHistory.signalCount })
        .from(indexHistory)
        .where(and(eq(indexHistory.territoryId, t.id), eq(indexHistory.period, row.period)))
        .limit(1);
      nSinais = h?.n ?? null;
    } catch {
      nSinais = null;
    }
  }
  return {
    slug: t.slug,
    territoryId: t.id,
    nome: t.name,
    estado: t.state ?? null,
    regiao: t.region ?? null,
    period: row.period,
    stt: row.stt,
    scenario: row.scenario ?? cenarioDoStt(row.stt),
    dims: dimsDeLinha(row as unknown as Record<string, unknown>),
    activatedIndex: row.activatedIndex ?? null,
    notaExecutiva: row.executiveNote ?? null,
    leitura,
    nSinais,
    geradoEm: new Date(row.updatedAt ?? row.createdAt).toISOString(),
    scoreId: row.id,
  };
}

/** Resolve a referência (scoreId do MySQL, ou slug + período) para um rascunho. */
async function resolverRascunho(ref: RefScore): Promise<Rascunho> {
  const db = await getDb();
  if (ref.scoreId !== undefined) {
    if (!db) throw new TRPCError({ code: "NOT_FOUND", message: "Score não encontrado." });
    const [row] = await db.select().from(sttScores).where(eq(sttScores.id, ref.scoreId)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Score não encontrado." });
    const [t] = await db.select().from(territories).where(eq(territories.id, row.territoryId)).limit(1);
    if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Território não encontrado." });
    // O rascunho do livro de rascunhos, se existir, é mais novo que a linha do MySQL.
    const daFicha = await fichas.obter(chaveRascunho(t.slug, row.period));
    return daFicha ?? (await rascunhoDeLinha(row, t));
  }
  if (!ref.slug || !ref.period) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Informe scoreId, ou slug e period." });
  }
  const daFicha = await fichas.obter(chaveRascunho(ref.slug, ref.period));
  if (daFicha) return daFicha;
  if (db) {
    const [t] = await db.select().from(territories).where(eq(territories.slug, ref.slug)).limit(1);
    if (t) {
      const [row] = await db
        .select()
        .from(sttScores)
        .where(and(eq(sttScores.territoryId, t.id), eq(sttScores.period, ref.period)))
        .limit(1);
      if (row) return rascunhoDeLinha(row, t);
    }
  }
  throw new TRPCError({ code: "NOT_FOUND", message: "Rascunho não encontrado para este território e período." });
}

/**
 * O ÚNICO caminho de publicação. Congela tensão e confiança, grava quem e
 * quando, atualiza o MySQL quando ele existe e acrescenta ao livro.
 */
export async function publicar(
  ref: RefScore,
  opcoes: { notaExecutiva?: string; por: string },
  agora: Date = new Date()
): Promise<Publicacao> {
  const r = await resolverRascunho(ref);
  const nota = opcoes.notaExecutiva !== undefined ? opcoes.notaExecutiva : r.notaExecutiva;
  const publishedAt = agora.toISOString();
  const db = await getDb();
  let scoreId = r.scoreId;

  if (db && r.territoryId > 0) {
    try {
      const d = r.dims;
      const valores = {
        stt: r.stt,
        d1Score: d.d1 ?? null, d2Score: d.d2 ?? null, d3Score: d.d3 ?? null,
        d4Score: d.d4 ?? null, d5Score: d.d5 ?? null, d6Score: d.d6 ?? null, d7Score: d.d7 ?? null,
        activatedIndex: r.activatedIndex,
        executiveNote: nota,
        scenario: r.scenario,
        published: true,
        publishedAt: agora,
      };
      await db
        .insert(sttScores)
        .values({ territoryId: r.territoryId, period: r.period, ...valores })
        .onDuplicateKeyUpdate({ set: { ...valores, updatedAt: agora } });
      const [linha] = await db
        .select({ id: sttScores.id })
        .from(sttScores)
        .where(and(eq(sttScores.territoryId, r.territoryId), eq(sttScores.period, r.period)))
        .limit(1);
      scoreId = linha?.id ?? scoreId;
    } catch (err) {
      log.error({ err: (err as Error).message, slug: r.slug }, "Publicação no MySQL falhou");
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível publicar no banco." });
    }
  }

  const pub: Publicacao = {
    slug: r.slug,
    territoryId: r.territoryId,
    nome: r.nome,
    estado: r.estado,
    regiao: r.regiao,
    period: r.period,
    stt: r.stt,
    tensao: r.leitura?.tensao ?? null,
    confianca: r.leitura?.confianca ?? null,
    scenario: r.scenario,
    dims: r.dims,
    activatedIndex: r.activatedIndex,
    notaExecutiva: nota,
    leitura: r.leitura,
    nSinais: r.nSinais,
    publishedAt,
    publishedBy: opcoes.por,
    origem: db && r.territoryId > 0 ? "mysql" : "disco",
    ...(scoreId !== undefined ? { scoreId } : {}),
  };
  await livro.gravar(`${pub.slug}|${publishedAt}`, pub);
  await devolvidos.remover(chaveRascunho(r.slug, r.period));
  log.info({ slug: pub.slug, period: pub.period, por: opcoes.por, origem: pub.origem }, "STT publicado");
  return pub;
}

/** Devolve o rascunho ao motor: sai da fila até o motor calcular de novo. */
export async function devolver(
  ref: RefScore,
  opcoes: { motivo: string; por: string },
  agora: Date = new Date()
): Promise<Devolucao> {
  const r = await resolverRascunho(ref);
  const d: Devolucao = {
    slug: r.slug,
    period: r.period,
    motivo: opcoes.motivo,
    por: opcoes.por,
    em: agora.toISOString(),
    rascunhoGeradoEm: r.geradoEm,
  };
  await devolvidos.gravar(chaveRascunho(r.slug, r.period), d);
  log.info({ slug: r.slug, period: r.period, por: opcoes.por }, "Rascunho devolvido ao motor");
  return d;
}

// ─── Fila da mesa ─────────────────────────────────────────────────────────────

/** Último rascunho por slug (período mais recente; empate pelo cálculo mais novo). */
function maisRecentePorSlug(rs: Rascunho[]): Rascunho[] {
  const m = new Map<string, Rascunho>();
  for (const r of rs) {
    const atual = m.get(r.slug);
    if (!atual || r.period > atual.period || (r.period === atual.period && r.geradoEm > atual.geradoEm)) {
      m.set(r.slug, r);
    }
  }
  return Array.from(m.values());
}

/** Linhas pendentes de stt_scores que ainda não têm rascunho no livro (anteriores a esta versão). */
async function pendentesLegados(jaTem: Set<string>): Promise<Rascunho[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select()
      .from(sttScores)
      .where(eq(sttScores.published, false))
      .orderBy(desc(sttScores.period));
    const ts = await db.select().from(territories);
    const porId = new Map(ts.map((t) => [t.id, t]));
    const vistos = new Set<number>();
    const out: Rascunho[] = [];
    for (const row of rows) {
      if (vistos.has(row.territoryId)) continue; // só o período mais recente por território
      vistos.add(row.territoryId);
      const t = porId.get(row.territoryId);
      if (!t || jaTem.has(chaveRascunho(t.slug, row.period))) continue;
      out.push(await rascunhoDeLinha(row, t));
    }
    return out;
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Pendentes legados ilegíveis (não-fatal)");
    return [];
  }
}

export async function montarFilaPublicacao(
  opcoes: { incluirDevolvidos?: boolean } = {}
): Promise<ItemFila[]> {
  const doLivro = await fichas.listar();
  const chaves = new Set(doLivro.map((r) => chaveRascunho(r.slug, r.period)));
  const todos = maisRecentePorSlug([...doLivro, ...(await pendentesLegados(chaves))]);
  const pubsPorSlug = new Map<string, Publicacao[]>();
  for (const t of await publicadosPorTerritorio()) pubsPorSlug.set(t.slug, t.pubs);
  const devs = new Map((await devolvidos.entradas()).map(([k, v]) => [k, v]));

  const itens: ItemFila[] = [];
  for (const r of todos) {
    const pubs = pubsPorSlug.get(r.slug) ?? [];
    const ultima = pubs.length
      ? [...pubs].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))[pubs.length - 1]
      : null;
    if (!entraNaFila(r, ultima)) continue;
    const dev = devolucaoVigente(r, devs.get(chaveRascunho(r.slug, r.period)));
    if (dev && !opcoes.incluirDevolvidos) continue;
    itens.push(montarItemFila(r, ultima, dev));
  }
  return ordenarFila(itens);
}

/** Para o getPendingScores antigo em modo disco: rascunhos pendentes de um slug. */
export async function rascunhosDoSlug(slug: string): Promise<Rascunho[]> {
  return (await fichas.listar())
    .filter((r) => r.slug === slug)
    .sort((a, b) => b.period.localeCompare(a.period));
}
