import { eq, desc, and, asc, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  territories, sttScores, signals, subscribers,
  collectionSnapshots, indexHistory,
  type Territory, type SttScore, type InsertSttScore,
  type Signal, type InsertSignal,
  type Subscriber, type InsertSubscriber,
  type CollectionSnapshot, type InsertCollectionSnapshot,
  type IndexHistory, type InsertIndexHistory,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { logger } from './_core/logger';

const log = logger.child({ module: "db" });

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      log.warn({ err: error }, "Database connection failed");
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    log.warn(" Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    log.error({ err: error }, "Failed to upsert user");
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    log.warn(" Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Territories ──────────────────────────────────────────────────────────────

export async function getAllTerritories(): Promise<Territory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(territories).where(eq(territories.active, true));
}

export async function getTerritoryBySlug(slug: string): Promise<Territory | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1);
  return result[0];
}

export async function seedTerritories(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(territories).limit(1);
  if (existing.length > 0) return;
  await db.insert(territories).values([
    {
      slug: "baia-guanabara",
      name: "Baía de Guanabara",
      region: "Sudeste",
      state: "RJ",
      contextData: {
        estado: "RJ",
        municipios: ["Rio de Janeiro", "Niterói", "São Gonçalo", "Magé", "Guapimirim", "Duque de Caxias"],
        ibgeMunicipios: ["3304557", "3303302", "3304904", "3302700", "3301900", "3301702"],
        bbox: "-43.8,-23.2,-42.8,-22.5",
        bioma: "Mata Atlântica",
        inpeLayer: "deter-amz:deter_amz",
        rssQueries: [
          "Baía de Guanabara poluição",
          "Baía de Guanabara licença ambiental",
          "Baía de Guanabara porto dragagem",
          "Baía de Guanabara IBAMA INEA",
          "Baía de Guanabara comunidade pescadores",
          "Baía de Guanabara petróleo refinaria",
          "Baía de Guanabara saneamento esgoto",
          "Baía de Guanabara conflito territorial",
        ],
        newsApiQueries: [
          "Baía de Guanabara",
          "Porto do Rio poluição ambiental",
          "INEA Rio de Janeiro licença",
        ],
        newsKeywords: {
          ibama: ["IBAMA Baía de Guanabara", "IBAMA Rio de Janeiro embargo", "IBAMA INEA licença ambiental RJ"],
          ana: ["ANA recursos hídricos Baía Guanabara", "qualidade água Guanabara", "outorga hídrica Rio de Janeiro"],
          queiroDiario: ["diário oficial Rio de Janeiro licença ambiental", "diário oficial Niterói INEA", "ato oficial porto Rio de Janeiro"],
        },
        fogoCruzadoCidadeId: "1", // Rio de Janeiro
        ispCisp: 1,
        llmContext: "Área portuária e industrial com 16 municípios no entorno da Baía de Guanabara (RJ). Presença de comunidades de pescadores, refinaria Reduc (Petrobras), sobreposição de jurisdições federal/estadual/municipal, histórico de poluição por petróleo e conflitos socioambientais. Bioma Mata Atlântica degradado (~8% cobertura original).",
        baselineStt: 78,
      },
    },
    {
      slug: "teles-pires",
      name: "Bacia do Rio Teles Pires",
      region: "Centro-Oeste/Norte",
      state: "MT/PA",
      contextData: {
        estado: "MT/PA",
        municipios: ["Alta Floresta", "Paranaíta", "Apiacás", "Jacareacanga", "Itaituba"],
        ibgeMunicipios: ["5100250", "5105903", "5100808", "1503754", "1503903"],
        bbox: "-57.5,-10.5,-54.5,-7.0",
        bioma: "Amazônia",
        inpeLayer: "deter-amz:deter_amz",
        rssQueries: [
          "Rio Teles Pires hidrelétrica",
          "Teles Pires indígena Munduruku",
          "Bacia Teles Pires licença ambiental",
          "Teles Pires conflito territorial",
          "Munduruku Kayabi Apiaká",
          "UHE Teles Pires IBAMA",
          "Teles Pires pesca ictiofauna",
        ],
        newsApiQueries: [
          "Bacia Teles Pires",
          "Rio Teles Pires hidrelétrica indígena",
        ],
        newsKeywords: {
          ibama: ["IBAMA Teles Pires embargo", "IBAMA Alta Floresta infração", "IBAMA Munduruku licença"],
          ana: ["ANA Rio Teles Pires", "recursos hídricos Teles Pires", "outorga hídrica Mato Grosso Pará"],
          queiroDiario: ["diário oficial Alta Floresta", "diário oficial Itaituba terra indígena", "ato oficial Jacareacanga garimpo"],
        },
        llmContext: "Bacia hidrográfica do Rio Teles Pires (MT/PA) com 3 etnias indígenas (Munduruku, Kayabi, Apiaká), 14 aldeias reconhecidas. Hidrelétricas instaladas (UHE Teles Pires, UHE São Manoel). Alta sensibilidade ecossistêmica (ictiofauna 95%). Fragmentação institucional entre FUNAI, IBAMA, ANEEL e governos estaduais de MT e PA.",
        baselineStt: 84,
      },
    },
    { slug: "nordeste-eolico", name: "Nordeste Eólico", region: "Nordeste", state: "CE/RN/BA", active: false },
    { slug: "corredor-mineral", name: "Minas Gerais – Corredor Mineral", region: "Sudeste", state: "MG", active: false },
  ]);
}

// ─── STT Scores ───────────────────────────────────────────────────────────────

export async function getLatestSttScore(territoryId: number): Promise<SttScore | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(sttScores)
    .where(and(eq(sttScores.territoryId, territoryId), eq(sttScores.published, true)))
    .orderBy(desc(sttScores.period)).limit(1);
  return result[0] ?? null;
}

export async function getSttHistory(territoryId: number, limit = 6): Promise<SttScore[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sttScores)
    .where(and(eq(sttScores.territoryId, territoryId), eq(sttScores.published, true)))
    .orderBy(desc(sttScores.period)).limit(limit);
}

export async function getAllSttScores(): Promise<SttScore[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sttScores).orderBy(desc(sttScores.createdAt));
}

export async function upsertSttScore(data: InsertSttScore): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(sttScores).values(data).onDuplicateKeyUpdate({
    set: {
      stt: data.stt, itt: data.itt, ics: data.ics, ivs: data.ivs, ive: data.ive, ici: data.ici,
      activatedIndex: data.activatedIndex, variation: data.variation,
      executiveNote: data.executiveNote, scenario: data.scenario,
      published: data.published, publishedAt: data.publishedAt,
    },
  });
}

// ─── Signals ──────────────────────────────────────────────────────────────────

export async function insertSignal(data: InsertSignal): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (data.url) {
    const existing = await db.select({ id: signals.id }).from(signals).where(eq(signals.url, data.url)).limit(1);
    if (existing.length > 0) return;
  }
  await db.insert(signals).values(data);
}

export async function getSignalsByTerritory(
  territoryId: number,
  status?: "pending" | "relevant" | "ignored" | "analyzed",
  limit = 50
): Promise<Signal[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = status
    ? and(eq(signals.territoryId, territoryId), eq(signals.curationStatus, status))
    : eq(signals.territoryId, territoryId);
  return db.select().from(signals).where(conditions).orderBy(desc(signals.createdAt)).limit(limit);
}

export async function updateSignalCuration(
  signalId: number,
  status: "pending" | "relevant" | "ignored" | "analyzed",
  note: string | null,
  curatedBy: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(signals)
    .set({ curationStatus: status, curationNote: note, curatedBy, curatedAt: new Date() })
    .where(eq(signals.id, signalId));
}

/**
 * Busca sinais de um território para um período específico ("YYYY-MM").
 * Filtra por publishedAt dentro do mês.
 */
export async function getSignalsByPeriod(
  territoryId: number,
  period: string, // "YYYY-MM"
  limit = 50
): Promise<Signal[]> {
  const db = await getDb();
  if (!db) return [];
  // Calcular início e fim do mês
  const [year, month] = period.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  return db.select().from(signals)
    .where(
      and(
        eq(signals.territoryId, territoryId),
        gte(signals.publishedAt, startDate),
        lte(signals.publishedAt, endDate)
      )
    )
    .orderBy(desc(signals.publishedAt))
    .limit(limit);
}

export async function getPendingSignalsCount(territoryId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ id: signals.id }).from(signals)
    .where(and(eq(signals.territoryId, territoryId), eq(signals.curationStatus, "pending")));
  return result.length;
}

// ─── Subscribers ──────────────────────────────────────────────────────────────

export async function upsertSubscriber(data: InsertSubscriber): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(subscribers).values(data).onDuplicateKeyUpdate({
    set: { name: data.name, company: data.company, jobRole: data.jobRole, sector: data.sector, territoryInterest: data.territoryInterest },
  });
}

export async function getAllSubscribers(): Promise<Subscriber[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscribers).where(eq(subscribers.active, true)).orderBy(desc(subscribers.createdAt));
}

export async function getSubscribersByTerritory(territorySlug: string): Promise<Subscriber[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscribers)
    .where(and(eq(subscribers.active, true), eq(subscribers.territoryInterest, territorySlug)));
}

// ─── Collection Snapshots ─────────────────────────────────────────────────────

export async function insertCollectionSnapshot(data: InsertCollectionSnapshot): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(collectionSnapshots).values(data);
  return (result as any)[0]?.insertId ?? null;
}

export async function getCollectionSnapshots(
  territoryId: number,
  limit = 24
): Promise<CollectionSnapshot[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(collectionSnapshots)
    .where(eq(collectionSnapshots.territoryId, territoryId))
    .orderBy(desc(collectionSnapshots.collectedAt))
    .limit(limit);
}

// ─── Index History ────────────────────────────────────────────────────────────

export async function insertIndexHistory(data: InsertIndexHistory): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Upsert por territoryId + period
  await db.insert(indexHistory).values(data).onDuplicateKeyUpdate({
    set: {
      itt: data.itt, ics: data.ics, ivs: data.ivs, ive: data.ive, ici: data.ici,
      stt: data.stt,
      ittDelta: data.ittDelta, icsDelta: data.icsDelta, ivsDelta: data.ivsDelta,
      iveDelta: data.iveDelta, iciDelta: data.iciDelta, sttDelta: data.sttDelta,
      activatedIndex: data.activatedIndex, scenario: data.scenario,
      signalCount: data.signalCount, relevantSignalCount: data.relevantSignalCount,
      keyEvents: data.keyEvents, llmRationale: data.llmRationale,
      snapshotId: data.snapshotId,
    },
  });
}

export async function getIndexHistory(
  territoryId: number,
  limit = 24
): Promise<IndexHistory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(indexHistory)
    .where(eq(indexHistory.territoryId, territoryId))
    .orderBy(asc(indexHistory.period))
    .limit(limit);
}

export async function getLatestIndexHistory(territoryId: number): Promise<IndexHistory | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(indexHistory)
    .where(eq(indexHistory.territoryId, territoryId))
    .orderBy(desc(indexHistory.period))
    .limit(1);
  return result[0] ?? null;
}

// Seed histórico de dados para demonstração (períodos anteriores)
export async function seedIndexHistory(territoryId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: indexHistory.id })
    .from(indexHistory)
    .where(eq(indexHistory.territoryId, territoryId))
    .limit(1);
  if (existing.length > 0) return;

  // Dados históricos simulados para Baía de Guanabara (territoryId=1)
  // Baseados no contexto real do território e metodologia DIT
  const historicalData = [
    { period: "2024-01", stt: 71, itt: 68, ics: 72, ivs: 75, ive: 65, ici: 74, scenario: "pressao" as const },
    { period: "2024-02", stt: 72, itt: 69, ics: 73, ivs: 74, ive: 66, ici: 75, scenario: "pressao" as const },
    { period: "2024-03", stt: 70, itt: 67, ics: 71, ivs: 73, ive: 64, ici: 73, scenario: "pressao" as const },
    { period: "2024-04", stt: 73, itt: 71, ics: 74, ivs: 76, ive: 67, ici: 76, scenario: "pressao" as const },
    { period: "2024-05", stt: 74, itt: 72, ics: 75, ivs: 77, ive: 68, ici: 77, scenario: "pressao" as const },
    { period: "2024-06", stt: 76, itt: 74, ics: 77, ivs: 78, ive: 70, ici: 79, scenario: "escalada" as const },
    { period: "2024-07", stt: 75, itt: 73, ics: 76, ivs: 77, ive: 69, ici: 78, scenario: "pressao" as const },
    { period: "2024-08", stt: 77, itt: 75, ics: 78, ivs: 79, ive: 71, ici: 80, scenario: "escalada" as const },
    { period: "2024-09", stt: 76, itt: 74, ics: 77, ivs: 78, ive: 70, ici: 79, scenario: "pressao" as const },
    { period: "2024-10", stt: 78, itt: 76, ics: 79, ivs: 80, ive: 72, ici: 81, scenario: "escalada" as const },
    { period: "2024-11", stt: 77, itt: 75, ics: 78, ivs: 79, ive: 71, ici: 80, scenario: "pressao" as const },
    { period: "2024-12", stt: 79, itt: 77, ics: 80, ivs: 81, ive: 73, ici: 82, scenario: "escalada" as const },
    { period: "2025-01", stt: 78, itt: 76, ics: 79, ivs: 80, ive: 72, ici: 81, scenario: "pressao" as const },
    { period: "2025-02", stt: 76, itt: 74, ics: 77, ivs: 78, ive: 70, ici: 79, scenario: "pressao" as const },
    { period: "2025-03", stt: 77, itt: 75, ics: 78, ivs: 79, ive: 71, ici: 80, scenario: "pressao" as const },
    { period: "2025-04", stt: 79, itt: 77, ics: 80, ivs: 81, ive: 73, ici: 82, scenario: "escalada" as const },
    { period: "2025-05", stt: 80, itt: 78, ics: 81, ivs: 82, ive: 74, ici: 83, scenario: "escalada" as const },
    { period: "2025-06", stt: 78, itt: 76, ics: 79, ivs: 80, ive: 72, ici: 81, scenario: "pressao" as const },
    { period: "2025-07", stt: 77, itt: 75, ics: 78, ivs: 79, ive: 71, ici: 80, scenario: "pressao" as const },
    { period: "2025-08", stt: 79, itt: 77, ics: 80, ivs: 81, ive: 73, ici: 82, scenario: "escalada" as const },
    { period: "2025-09", stt: 81, itt: 79, ics: 82, ivs: 83, ive: 75, ici: 84, scenario: "escalada" as const },
    { period: "2025-10", stt: 80, itt: 78, ics: 81, ivs: 82, ive: 74, ici: 83, scenario: "escalada" as const },
    { period: "2025-11", stt: 79, itt: 77, ics: 80, ivs: 81, ive: 73, ici: 82, scenario: "pressao" as const },
    { period: "2025-12", stt: 78, itt: 76, ics: 79, ivs: 80, ive: 72, ici: 81, scenario: "pressao" as const },
  ];

  for (let i = 0; i < historicalData.length; i++) {
    const d = historicalData[i];
    const prev = i > 0 ? historicalData[i - 1] : null;
    await db.insert(indexHistory).values({
      territoryId,
      period: d.period,
      stt: d.stt,
      itt: d.itt,
      ics: d.ics,
      ivs: d.ivs,
      ive: d.ive,
      ici: d.ici,
      sttDelta: prev ? parseFloat((d.stt - prev.stt).toFixed(1)) : 0,
      ittDelta: prev ? parseFloat((d.itt - prev.itt).toFixed(1)) : 0,
      icsDelta: prev ? parseFloat((d.ics - prev.ics).toFixed(1)) : 0,
      ivsDelta: prev ? parseFloat((d.ivs - prev.ivs).toFixed(1)) : 0,
      iveDelta: prev ? parseFloat((d.ive - prev.ive).toFixed(1)) : 0,
      iciDelta: prev ? parseFloat((d.ici - prev.ici).toFixed(1)) : 0,
      scenario: d.scenario,
      source: "import",
      signalCount: 0,
      relevantSignalCount: 0,
    });
  }
}

// ─── Dados Públicos (site público, sem autenticação) ─────────────────────────

/**
 * Retorna todos os territórios ativos com o STT mais recente do index_history.
 * Usado pelo site público para exibir cards dinâmicos.
 */
export async function getPublicTerritoryOverview(): Promise<Array<{
  id: number;
  slug: string;
  name: string;
  region: string | null;
  state: string | null;
  stt: number | null;
  scenario: string | null;
  period: string | null;
  sttDelta: number | null;
  activatedIndex: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];

  const allTerritories = await db.select().from(territories).where(eq(territories.active, true));

  const result = await Promise.all(allTerritories.map(async (t) => {
    const [latest] = await db.select({
      stt: indexHistory.stt,
      scenario: indexHistory.scenario,
      period: indexHistory.period,
      sttDelta: indexHistory.sttDelta,
      activatedIndex: indexHistory.activatedIndex,
    })
      .from(indexHistory)
      .where(eq(indexHistory.territoryId, t.id))
      .orderBy(desc(indexHistory.period))
      .limit(1);

    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      region: t.region ?? null,
      state: t.state ?? null,
      stt: latest?.stt ?? null,
      scenario: latest?.scenario ?? null,
      period: latest?.period ?? null,
      sttDelta: latest?.sttDelta ?? null,
      activatedIndex: latest?.activatedIndex ?? null,
    };
  }));

  return result;
}

/**
 * Retorna os detalhes de um território público, incluindo D1-D7 reais e contextData (riscos, atores).
 */
export async function getPublicTerritoryDetail(slug: string) {
  const db = await getDb();
  if (!db) return null;

  const [t] = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1);
  if (!t) return null;

  const [latest] = await db.select()
    .from(indexHistory)
    .where(eq(indexHistory.territoryId, t.id))
    .orderBy(desc(indexHistory.period))
    .limit(1);

  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    region: t.region ?? null,
    state: t.state ?? null,
    stt: latest?.stt ?? null,
    scenario: latest?.scenario ?? null,
    period: latest?.period ?? null,
    d1Score: latest?.d1Score ?? null,
    d2Score: latest?.d2Score ?? null,
    d3Score: latest?.d3Score ?? null,
    d4Score: latest?.d4Score ?? null,
    d5Score: latest?.d5Score ?? null,
    d6Score: latest?.d6Score ?? null,
    d7Score: latest?.d7Score ?? null,
    contextData: t.contextData,
  };
}


/**
 * Retorna uma amostra de sinais relevantes/analisados com análise LLM para exibir no site público.
 * Limita a 4 sinais de alto impacto para não entregar tudo.
 */
export async function getPublicSampleSignals(limit = 4): Promise<Array<{
  id: number;
  territory: string;
  title: string;
  source: string;
  relatedIndex: string | null;
  llmAnalysis: string | null;
  llmImpactScore: number | null;
  publishedAt: Date | null;
}>> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select({
    id: signals.id,
    territory: territories.name,
    title: signals.title,
    source: signals.source,
    relatedIndex: signals.relatedIndex,
    llmAnalysis: signals.llmAnalysis,
    llmImpactScore: signals.llmImpactScore,
    publishedAt: signals.publishedAt,
  })
    .from(signals)
    .innerJoin(territories, eq(signals.territoryId, territories.id))
    .where(
      and(
        eq(signals.curationStatus, "relevant"),
        eq(territories.active, true)
      )
    )
    .orderBy(desc(signals.llmImpactScore))
    .limit(limit);

  return rows;
}

/**
 * Retorna comparativo de STT entre todos os territórios ativos para o dashboard.
 * Inclui histórico dos últimos 6 meses para sparkline.
 */
export async function getAllTerritoriesComparison(): Promise<Array<{
  id: number;
  slug: string;
  name: string;
  currentStt: number | null;
  currentPeriod: string | null;
  scenario: string | null;
  sttDelta: number | null;
  activatedIndex: string | null;
  history: Array<{ period: string; stt: number }>;
  signalCount: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  const allTerritories = await db.select().from(territories).where(eq(territories.active, true));

  const result = await Promise.all(allTerritories.map(async (t) => {
    const history = await db.select({
      period: indexHistory.period,
      stt: indexHistory.stt,
      sttDelta: indexHistory.sttDelta,
      scenario: indexHistory.scenario,
      activatedIndex: indexHistory.activatedIndex,
      signalCount: indexHistory.signalCount,
    })
      .from(indexHistory)
      .where(eq(indexHistory.territoryId, t.id))
      .orderBy(desc(indexHistory.period))
      .limit(6);

    const latest = history[0] ?? null;
    const totalSignals = history.reduce((acc, h) => acc + (h.signalCount ?? 0), 0);

    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      currentStt: latest?.stt ?? null,
      currentPeriod: latest?.period ?? null,
      scenario: latest?.scenario ?? null,
      sttDelta: latest?.sttDelta ?? null,
      activatedIndex: latest?.activatedIndex ?? null,
      history: history.reverse().map(h => ({ period: h.period, stt: h.stt ?? 0 })),
      signalCount: totalSignals,
    };
  }));

  return result.sort((a, b) => (b.currentStt ?? 0) - (a.currentStt ?? 0));
}
