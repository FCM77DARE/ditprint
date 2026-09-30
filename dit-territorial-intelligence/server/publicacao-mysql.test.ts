/**
 * Modo MySQL das mesmas regras. Só roda se DIT_TEST_MYSQL_URL apontar para um
 * banco DESCARTÁVEL já migrado (ex.: mysql://root@127.0.0.1:3306/dit_teste_backend).
 * Sem a variável, o arquivo é ignorado (CI e máquinas sem MySQL).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL_TESTE = process.env.DIT_TEST_MYSQL_URL;
const rodar = Boolean(URL_TESTE);

describe.skipIf(!rodar)("modo MySQL (banco descartável)", () => {
  let db: NonNullable<Awaited<ReturnType<typeof import("./db").getDb>>>;
  let S: typeof import("./../drizzle/schema");
  let svc: typeof import("./publicacao");
  let dbmod: typeof import("./db");
  let colecaoMod: typeof import("./_core/colecao");
  let territorioA = 0;
  let territorioB = 0;

  beforeAll(async () => {
    process.env.JWT_SECRET = "m".repeat(48);
    process.env.DATABASE_URL = URL_TESTE;
    S = await import("../drizzle/schema");
    dbmod = await import("./db");
    svc = await import("./publicacao");
    colecaoMod = await import("./_core/colecao");
    db = (await dbmod.getDb())!;
    const { sql } = await import("drizzle-orm");
    for (const t of ["dit_docs", "stt_scores", "index_history", "territories"]) {
      await db.execute(sql.raw(`DELETE FROM ${t}`)).catch(() => undefined);
    }
    await db.insert(S.territories).values([
      { slug: "macae-3302403", name: "Macaé", state: "RJ", region: "Sudeste", active: true },
      { slug: "belford-roxo-3300456", name: "Belford Roxo", state: "RJ", region: "Sudeste", active: true },
    ]);
    const rows = await db.select().from(S.territories);
    territorioA = rows.find((r) => r.slug === "macae-3302403")!.id;
    territorioB = rows.find((r) => r.slug === "belford-roxo-3300456")!.id;

    // A: linha PENDENTE do motor (formato antigo, sem rascunho no livro) + index_history com nº de sinais.
    await db.insert(S.sttScores).values({
      territoryId: territorioA, period: "2026-09", stt: 77, d1Score: 50, d2Score: 60, d3Score: 70,
      d4Score: 80, d5Score: 40, d6Score: 30, scenario: "escalada", published: false, executiveNote: "Nota do motor.",
    });
    await db.insert(S.indexHistory).values({ territoryId: territorioA, period: "2026-09", stt: 77, signalCount: 12 });
    // B: linha já PUBLICADA no modelo antigo (sem registro no livro).
    await db.insert(S.sttScores).values({
      territoryId: territorioB, period: "2026-08", stt: 58, scenario: "pressao", published: true,
      publishedAt: new Date("2026-08-20T12:00:00Z"), executiveNote: "Antiga.\n\nDetalhe.",
    });
  });

  afterAll(async () => {
    delete process.env.DATABASE_URL;
  });

  it("colecao em MySQL: grava, lê, lista, remove", async () => {
    const c = colecaoMod.colecao<{ n: number }>("teste-mysql");
    await c.gravar("a", { n: 1 });
    await c.gravar("a", { n: 2 });
    await c.gravar("b", { n: 3 });
    expect(await c.obter("a")).toEqual({ n: 2 });
    expect((await c.listar()).length).toBe(2);
    await c.remover("a");
    expect(await c.obter("a")).toBeNull();
  });

  it("a leitura pública não vê a linha pendente; vê a publicada do modelo antigo (legado)", async () => {
    const lista = await svc.publicadosPorTerritorio();
    expect(lista.map((t) => t.slug)).toEqual(["belford-roxo-3300456"]);
    expect(lista[0].pubs[0]).toMatchObject({ stt: 58, origem: "legado", publishedBy: "legado" });
  });

  it("a fila enxerga a pendente do MySQL com nº de sinais do index_history", async () => {
    const fila = await svc.montarFilaPublicacao();
    const a = fila.find((i) => i.slug === "macae-3302403");
    expect(a).toBeDefined();
    expect(a!.rascunho.nSinais).toBe(12);
    expect(a!.scoreId).toBeGreaterThan(0);
  });

  it("publicar por scoreId marca published no MySQL, grava quem publicou e tira da fila", async () => {
    const fila = await svc.montarFilaPublicacao();
    const a = fila.find((i) => i.slug === "macae-3302403")!;
    const pub = await svc.publicar({ scoreId: a.scoreId! }, { por: "op@print.com.br", notaExecutiva: "Nota final." });
    expect(pub.origem).toBe("mysql");
    expect(pub.publishedBy).toBe("op@print.com.br");

    const [linha] = await db.select().from(S.sttScores).where((await import("drizzle-orm")).eq(S.sttScores.territoryId, territorioA));
    expect(linha.published).toBe(true);
    expect(linha.executiveNote).toBe("Nota final.");

    expect((await svc.montarFilaPublicacao()).find((i) => i.slug === "macae-3302403")).toBeUndefined();
    const tp = await svc.publicadosDoSlug("macae-3302403");
    expect(tp?.pubs).toHaveLength(1);
    expect(tp?.pubs[0].stt).toBe(77);
  });

  it("upsertSttScore (rascunho) não despublica o que já foi publicado", async () => {
    await dbmod.upsertSttScore({ territoryId: territorioA, period: "2026-09", stt: 99, published: false });
    const { eq } = await import("drizzle-orm");
    const [linha] = await db.select().from(S.sttScores).where(eq(S.sttScores.territoryId, territorioA));
    expect(linha.published).toBe(true);
  });

  it("devolver no MySQL tira a pendente da fila", async () => {
    const { eq } = await import("drizzle-orm");
    await db.insert(S.sttScores).values({ territoryId: territorioB, period: "2026-09", stt: 61, scenario: "pressao", published: false });
    let fila = await svc.montarFilaPublicacao();
    const b = fila.find((i) => i.slug === "belford-roxo-3300456")!;
    expect(b.delta).not.toBeNull(); // contra a publicada legada de 58
    await svc.devolver({ scoreId: b.scoreId! }, { motivo: "Sem fonte oficial", por: "op" });
    fila = await svc.montarFilaPublicacao();
    expect(fila.find((i) => i.slug === "belford-roxo-3300456")).toBeUndefined();
    void eq;
  });
});
