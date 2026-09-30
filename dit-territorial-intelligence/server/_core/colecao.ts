/**
 * Coleção de documentos que funciona nos dois modos de produção do DIT.
 *
 *   - Com MySQL (DATABASE_URL): uma única tabela `dit_docs` (colecao, chave,
 *     payload). Criada na primeira escrita com CREATE TABLE IF NOT EXISTS; não
 *     entra no drizzle/schema.ts de propósito, para não brigar com o journal
 *     de migrações.
 *   - Sem MySQL (Railway hoje): um JSON por coleção em DATA_DIR/<nome>.json,
 *     gravado de forma atômica (arquivo temporário + rename) e serializado por
 *     fila, para que duas escritas seguidas não percam dado.
 *
 * Quem usa (leads, assinantes, saúde das fontes, publicações, rascunhos,
 * devoluções) enxerga só `listar/obter/gravar/remover`, igual nos dois modos.
 * DATA_DIR é lido a cada chamada para os testes poderem apontar para uma pasta
 * temporária.
 */

import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger";

const log = logger.child({ module: "colecao" });

export interface Colecao<T> {
  listar(): Promise<T[]>;
  /** Lista com a chave junto (necessário quando o documento não repete a chave). */
  entradas(): Promise<Array<[string, T]>>;
  obter(chave: string): Promise<T | null>;
  gravar(chave: string, doc: T): Promise<void>;
  remover(chave: string): Promise<void>;
}

export function diretorioDeDados(): string {
  return process.env.DATA_DIR || join(process.cwd(), "data");
}

function nomeSeguro(nome: string): string {
  return nome.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
}

// ─── Backend JSON ─────────────────────────────────────────────────────────────

const filas = new Map<string, Promise<unknown>>();

/** Serializa operações por arquivo: cada uma só começa quando a anterior acaba. */
function naFila<R>(arquivo: string, op: () => Promise<R>): Promise<R> {
  const anterior = filas.get(arquivo) ?? Promise.resolve();
  const proxima = anterior.then(op, op);
  filas.set(arquivo, proxima.catch(() => undefined));
  return proxima;
}

async function lerJson<T>(arquivo: string): Promise<Record<string, T>> {
  try {
    const txt = await fs.readFile(arquivo, "utf8");
    const obj = JSON.parse(txt);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, T>) : {};
  } catch {
    return {};
  }
}

async function gravarJson<T>(arquivo: string, dados: Record<string, T>): Promise<void> {
  const dir = diretorioDeDados();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${arquivo}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(dados, null, 2), "utf8");
  await fs.rename(tmp, arquivo);
}

function backendJson<T>(nome: string): Colecao<T> {
  const arquivo = () => join(diretorioDeDados(), `${nomeSeguro(nome)}.json`);
  return {
    async entradas() {
      const f = arquivo();
      return naFila(f, async () => Object.entries(await lerJson<T>(f)));
    },
    async listar() {
      const f = arquivo();
      return naFila(f, async () => Object.values(await lerJson<T>(f)));
    },
    async obter(chave) {
      const f = arquivo();
      return naFila(f, async () => (await lerJson<T>(f))[chave] ?? null);
    },
    async gravar(chave, doc) {
      const f = arquivo();
      return naFila(f, async () => {
        const dados = await lerJson<T>(f);
        dados[chave] = doc;
        await gravarJson(f, dados);
      });
    },
    async remover(chave) {
      const f = arquivo();
      return naFila(f, async () => {
        const dados = await lerJson<T>(f);
        delete dados[chave];
        await gravarJson(f, dados);
      });
    },
  };
}

// ─── Backend MySQL ────────────────────────────────────────────────────────────

let tabelaGarantida = false;

type ExecutorSql = { execute: (q: unknown) => Promise<unknown> };

async function dbSeHouver(): Promise<ExecutorSql | null> {
  if (!process.env.DATABASE_URL) return null;
  const { getDb } = await import("../db");
  return (await getDb()) as unknown as ExecutorSql | null;
}

function linhas(resultado: unknown): Array<Record<string, unknown>> {
  // mysql2 via drizzle devolve [rows, fields]
  const r = Array.isArray(resultado) ? resultado[0] : resultado;
  return Array.isArray(r) ? (r as Array<Record<string, unknown>>) : [];
}

async function garantirTabela(db: ExecutorSql): Promise<void> {
  if (tabelaGarantida) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`CREATE TABLE IF NOT EXISTS dit_docs (
    colecao VARCHAR(48) NOT NULL,
    chave VARCHAR(190) NOT NULL,
    payload LONGTEXT NOT NULL,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (colecao, chave)
  )`);
  tabelaGarantida = true;
}

function parse<T>(payload: unknown): T | null {
  try {
    return JSON.parse(String(payload)) as T;
  } catch {
    return null;
  }
}

function backendMysql<T>(nome: string, db: ExecutorSql): Colecao<T> {
  const col = nomeSeguro(nome);
  return {
    async entradas() {
      await garantirTabela(db);
      const { sql } = await import("drizzle-orm");
      const rs = linhas(await db.execute(sql`SELECT chave, payload FROM dit_docs WHERE colecao = ${col}`));
      const out: Array<[string, T]> = [];
      for (const r of rs) {
        const v = parse<T>(r.payload);
        if (v !== null) out.push([String(r.chave), v]);
      }
      return out;
    },
    async listar() {
      return (await this.entradas()).map(([, v]) => v);
    },
    async obter(chave) {
      await garantirTabela(db);
      const { sql } = await import("drizzle-orm");
      const rs = linhas(
        await db.execute(sql`SELECT payload FROM dit_docs WHERE colecao = ${col} AND chave = ${chave} LIMIT 1`)
      );
      return rs[0] ? parse<T>(rs[0].payload) : null;
    },
    async gravar(chave, doc) {
      await garantirTabela(db);
      const { sql } = await import("drizzle-orm");
      const payload = JSON.stringify(doc);
      await db.execute(
        sql`INSERT INTO dit_docs (colecao, chave, payload) VALUES (${col}, ${chave}, ${payload})
            ON DUPLICATE KEY UPDATE payload = VALUES(payload)`
      );
    },
    async remover(chave) {
      await garantirTabela(db);
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`DELETE FROM dit_docs WHERE colecao = ${col} AND chave = ${chave}`);
    },
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Coleção nomeada. O backend é escolhido a cada operação: com DATABASE_URL e
 * banco acessível usa MySQL; senão JSON em DATA_DIR.
 */
export function colecao<T>(nome: string): Colecao<T> {
  async function escolher(): Promise<Colecao<T>> {
    try {
      const db = await dbSeHouver();
      if (db) return backendMysql<T>(nome, db);
    } catch (err) {
      log.warn({ err: (err as Error).message, nome }, "MySQL indisponível, usando JSON em DATA_DIR");
    }
    return backendJson<T>(nome);
  }
  return {
    async entradas() { return (await escolher()).entradas(); },
    async listar() { return (await escolher()).listar(); },
    async obter(chave) { return (await escolher()).obter(chave); },
    async gravar(chave, doc) { return (await escolher()).gravar(chave, doc); },
    async remover(chave) { return (await escolher()).remover(chave); },
  };
}

/** Só para testes: zera o cache de "tabela já criada". */
export function _resetarColecaoParaTeste(): void {
  tabelaGarantida = false;
  filas.clear();
}
