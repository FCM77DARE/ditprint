import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  boolean,
  json,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// NOTE: float is used for score columns instead of decimal because MySQL's
// decimal type is returned as a string by the mysql2 driver, which would
// require parseFloat() wrappers at every read site. Float is sufficient for
// 0–100 scores (needs only 2 significant decimal places; float32 gives ~7).
// Migrate to decimal + parseDecimal() helper in a dedicated schema sprint.

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Territórios monitorados pelo Radar Territorial™
 */
export const territories = mysqlTable("territories", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  region: varchar("region", { length: 100 }),
  state: varchar("state", { length: 50 }),
  active: boolean("active").default(true).notNull(),
  contextData: json("contextData"),
  onboardingStatus: mysqlEnum("onboardingStatus", ["pending", "processing", "ready", "error"]).default("ready"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Territory = typeof territories.$inferSelect;

/**
 * Histórico de scores STT por território (atualizado mensalmente).
 * Unique on (territoryId, period) — only one score row per territory per month.
 *
 * Migration notes:
 * - d1Score..d6Score are the new 6-dimension PRINT scores (Fase 1+)
 * - itt/ics/ivs/ive/ici are retained for backwards compatibility (deprecated; remove in next major)
 */
export const sttScores = mysqlTable("stt_scores", {
  id: int("id").autoincrement().primaryKey(),
  territoryId: int("territoryId").notNull().references(() => territories.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 7 }).notNull(), // "YYYY-MM"
  stt: float("stt").notNull(),

  // 6 PRINT dimensions (D1=Socioambiental … D6=Reputação)
  d1Score: float("d1Score"),
  d2Score: float("d2Score"),
  d3Score: float("d3Score"),
  d4Score: float("d4Score"),
  d5Score: float("d5Score"),
  d6Score: float("d6Score"),
  d7Score: float("d7Score"),

  // Deprecated legacy component scores — kept for one-release backwards compat
  itt: float("itt"),
  ics: float("ics"),
  ivs: float("ivs"),
  ive: float("ive"),
  ici: float("ici"),

  activatedIndex: varchar("activatedIndex", { length: 10 }),
  variation: float("variation"),
  executiveNote: text("executiveNote"),
  scenario: mysqlEnum("scenario", ["estabilidade", "pressao", "escalada"]),
  published: boolean("published").default(false).notNull(),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  territoryPeriodIdx: uniqueIndex("stt_scores_territory_period_uidx").on(t.territoryId, t.period),
}));

export type SttScore = typeof sttScores.$inferSelect;
export type InsertSttScore = typeof sttScores.$inferInsert;

/**
 * Sinais coletados automaticamente (notícias, DOU, IBAMA, dados estruturados…)
 */
export const signals = mysqlTable("signals", {
  id: int("id").autoincrement().primaryKey(),
  territoryId: int("territoryId").notNull().references(() => territories.id, { onDelete: "cascade" }),
  source: varchar("source", { length: 100 }).notNull(),
  // D1–D6 map to the 6 PRINT dimensions. "GERAL" = cross-dimensional or unclassified.
  // Deprecated values ITT/ICS/IVS/IVE/ICI kept in comment for migration reference.
  relatedIndex: mysqlEnum("relatedIndex", ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "GERAL"]).default("GERAL"),
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary"),
  url: text("url"),
  publishedAt: timestamp("publishedAt"),
  curationStatus: mysqlEnum("curationStatus", ["pending", "relevant", "ignored", "analyzed"]).default("pending").notNull(),
  curationNote: text("curationNote"),
  curatedBy: int("curatedBy"),
  curatedAt: timestamp("curatedAt"),
  imageUrl: text("imageUrl"),
  llmAnalysis: text("llmAnalysis"),
  llmImpactScore: float("llmImpactScore"), // 0.000–1.000
  llmSuggestedIndex: mysqlEnum("llmSuggestedIndex", ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "GERAL"]),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = typeof signals.$inferInsert;

/**
 * Assinantes do Radar Territorial™
 */
export const subscribers = mysqlTable("subscribers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  company: varchar("company", { length: 200 }),
  jobRole: varchar("jobRole", { length: 200 }),
  sector: varchar("sector", { length: 100 }),
  territoryInterest: varchar("territoryInterest", { length: 100 }),
  plan: mysqlEnum("plan", ["free_alert", "radar", "dit"]).default("free_alert").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Subscriber = typeof subscribers.$inferSelect;
export type InsertSubscriber = typeof subscribers.$inferInsert;

/**
 * Alertas enviados para assinantes
 */
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  sttScoreId: int("sttScoreId").notNull().references(() => sttScores.id, { onDelete: "restrict" }),
  territoryId: int("territoryId").notNull().references(() => territories.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 300 }).notNull(),
  sentAt: timestamp("sentAt"),
  recipientCount: int("recipientCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;

/**
 * Admins do dashboard interno — login por e-mail + senha (independente do OAuth).
 * passwordHash: bcrypt output is 60 chars; 72 gives comfortable headroom.
 */
export const dashboardAdmins = mysqlTable("dashboard_admins", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 72 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
});

export type DashboardAdmin = typeof dashboardAdmins.$inferSelect;
export type InsertDashboardAdmin = typeof dashboardAdmins.$inferInsert;

/**
 * Snapshots de coleta — cada execução do pipeline gera um registro com dados brutos.
 */
export const collectionSnapshots = mysqlTable("collection_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  territoryId: int("territoryId").notNull().references(() => territories.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 7 }).notNull(),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
  collectionType: mysqlEnum("collectionType", ["news", "structured", "full", "historical"]).notNull().default("full"),

  newsCount: int("newsCount").default(0).notNull(),
  ibamaEmbargoCount: int("ibamaEmbargoCount").default(0).notNull(),
  ibamaAutoCount: int("ibamaAutoCount").default(0).notNull(),
  ibgeCensoCount: int("ibgeCensoCount").default(0).notNull(),
  ibgeRendimentoCount: int("ibgeRendimentoCount").default(0).notNull(),
  inpeDeterCount: int("inpeDeterCount").default(0).notNull(),
  inpeProdesCount: int("inpeProdesCount").default(0).notNull(),
  anaHidroCount: int("anaHidroCount").default(0).notNull(),
  anaOutorgaCount: int("anaOutorgaCount").default(0).notNull(),
  queiroDiarioCount: int("queiroDiarioCount").default(0).notNull(),

  rawData: json("rawData"),

  totalSignals: int("totalSignals").default(0).notNull(),
  notes: text("notes"),
});

export type CollectionSnapshot = typeof collectionSnapshots.$inferSelect;
export type InsertCollectionSnapshot = typeof collectionSnapshots.$inferInsert;

/**
 * Histórico de índices — série temporal dos 5 componentes do STT.
 * Unique on (territoryId, period) — one row per territory per month.
 */
export const indexHistory = mysqlTable("index_history", {
  id: int("id").autoincrement().primaryKey(),
  territoryId: int("territoryId").notNull().references(() => territories.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 7 }).notNull(),
  snapshotId: int("snapshotId").references(() => collectionSnapshots.id, { onDelete: "set null" }),

  // STT score
  stt: float("stt"),

  // 6 PRINT dimensions (D1=Socioambiental … D6=Reputação)
  d1Score: float("d1Score"),
  d2Score: float("d2Score"),
  d3Score: float("d3Score"),
  d4Score: float("d4Score"),
  d5Score: float("d5Score"),
  d6Score: float("d6Score"),
  d7Score: float("d7Score"),

  // Dimension deltas
  d1Delta: float("d1Delta"),
  d2Delta: float("d2Delta"),
  d3Delta: float("d3Delta"),
  d4Delta: float("d4Delta"),
  d5Delta: float("d5Delta"),
  d6Delta: float("d6Delta"),
  d7Delta: float("d7Delta"),

  // Deprecated legacy component scores — kept for one-release backwards compat
  itt: float("itt"),
  ics: float("ics"),
  ivs: float("ivs"),
  ive: float("ive"),
  ici: float("ici"),

  // Deprecated legacy deltas
  ittDelta: float("ittDelta"),
  icsDelta: float("icsDelta"),
  ivsDelta: float("ivsDelta"),
  iveDelta: float("iveDelta"),
  iciDelta: float("iciDelta"),
  sttDelta: float("sttDelta"),

  activatedIndex: varchar("activatedIndex", { length: 10 }),
  scenario: mysqlEnum("scenario", ["estabilidade", "pressao", "escalada"]),
  signalCount: int("signalCount").default(0),
  relevantSignalCount: int("relevantSignalCount").default(0),
  keyEvents: json("keyEvents"),
  llmRationale: text("llmRationale"),

  source: mysqlEnum("source", ["llm", "manual", "import", "llm_historical"]).default("llm").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  territoryPeriodIdx: uniqueIndex("index_history_territory_period_uidx").on(t.territoryId, t.period),
}));

export type IndexHistory = typeof indexHistory.$inferSelect;
export type InsertIndexHistory = typeof indexHistory.$inferInsert;

/**
 * Tabela mestra de indicadores PRINT (espelho de server/indicators.ts para queries).
 * Populada por seed/migration; raramente alterada em runtime.
 */
export const indicators = mysqlTable("indicators", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(), // ex: "1.1.1.1"
  indicatorId: varchar("indicatorId", { length: 100 }).notNull().unique(), // ex: "apa-percentual"
  dimension: mysqlEnum("dimension", ["D1", "D2", "D3", "D4", "D5", "D6"]).notNull(),
  objectOfStudy: varchar("objectOfStudy", { length: 200 }).notNull(),
  itemOfStudy: varchar("itemOfStudy", { length: 300 }).notNull(),
  name: varchar("name", { length: 300 }).notNull(),
  weight: int("weight").notNull().default(1), // 1, 2 ou 3
  sources: json("sources").notNull(),          // SourceId[]
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Indicator = typeof indicators.$inferSelect;
export type InsertIndicator = typeof indicators.$inferInsert;

/**
 * Scores por indicador, por território, por período.
 * Permite drill-down de dimensão → objeto de estudo → indicador individual.
 * Unique on (territoryId, indicatorId, period).
 */
export const indicatorScores = mysqlTable("indicator_scores", {
  id: int("id").autoincrement().primaryKey(),
  territoryId: int("territoryId").notNull().references(() => territories.id, { onDelete: "cascade" }),
  indicatorId: int("indicatorId").notNull().references(() => indicators.id, { onDelete: "restrict" }),
  period: varchar("period", { length: 7 }).notNull(), // "YYYY-MM"

  score: float("score"),           // 0–100 normalizado
  rawValue: float("rawValue"),     // valor bruto da fonte (opcional)
  unit: varchar("unit", { length: 50 }),           // ex: "%", "km²", "eventos"
  sourceAgentId: varchar("sourceAgentId", { length: 100 }), // qual agente gerou
  confidence: float("confidence"), // 0.0–1.0 confiança da coleta

  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  territoryIndicatorPeriodIdx: uniqueIndex("indicator_scores_territory_indicator_period_uidx").on(
    t.territoryId,
    t.indicatorId,
    t.period
  ),
}));

export type IndicatorScore = typeof indicatorScores.$inferSelect;
export type InsertIndicatorScore = typeof indicatorScores.$inferInsert;

/**
 * Preferências de alerta por assinante × território.
 * Define quais canais recebem alertas e qual threshold dispara.
 *
 * Unique on (subscriberId, territoryId) — one preference row per pair.
 */
export const alertPreferences = mysqlTable("alert_preferences", {
  id: int("id").autoincrement().primaryKey(),
  subscriberId: int("subscriberId").notNull().references(() => subscribers.id, { onDelete: "cascade" }),
  territoryId: int("territoryId").notNull().references(() => territories.id, { onDelete: "cascade" }),

  // Which channels to use — JSON array: ["email", "push", "sse"]
  channels: json("channels").notNull().$type<("email" | "push" | "sse")[]>(),

  // Minimum impact score to trigger alert (0.0–1.0); default 0.7
  minImpactThreshold: float("minImpactThreshold").default(0.7).notNull(),

  // Quiet hours (server timezone) — null = no quiet hours
  quietHoursStart: varchar("quietHoursStart", { length: 5 }), // "HH:MM"
  quietHoursEnd: varchar("quietHoursEnd", { length: 5 }),     // "HH:MM"

  // How often to batch non-critical alerts
  digestFrequency: mysqlEnum("digestFrequency", ["realtime", "daily", "weekly"]).default("realtime").notNull(),

  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  subscriberTerritoryIdx: uniqueIndex("alert_prefs_subscriber_territory_uidx").on(t.subscriberId, t.territoryId),
}));

export type AlertPreference = typeof alertPreferences.$inferSelect;
export type InsertAlertPreference = typeof alertPreferences.$inferInsert;

/**
 * Log de alertas individuais disparados por sinal.
 * Tracks delivery status per channel per signal.
 */
export const alertLog = mysqlTable("alert_log", {
  id: int("id").autoincrement().primaryKey(),
  subscriberId: int("subscriberId").notNull().references(() => subscribers.id, { onDelete: "cascade" }),
  territoryId: int("territoryId").notNull().references(() => territories.id, { onDelete: "cascade" }),

  // The signal that triggered this alert (null for STT-level digests)
  signalTitle: varchar("signalTitle", { length: 500 }),
  impactScore: float("impactScore"),
  dimension: mysqlEnum("dimension", ["D1", "D2", "D3", "D4", "D5", "D6", "GERAL"]),

  channel: mysqlEnum("channel", ["email", "push", "sse"]).notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  delivered: boolean("delivered").default(false).notNull(),
  opened: boolean("opened").default(false).notNull(),

  // Error message if delivery failed
  errorMessage: text("errorMessage"),

  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertLog = typeof alertLog.$inferSelect;
export type InsertAlertLog = typeof alertLog.$inferInsert;
