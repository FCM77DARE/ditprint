import { relations } from "drizzle-orm";
import {
  territories,
  sttScores,
  signals,
  alerts,
  collectionSnapshots,
  indexHistory,
  indicators,
  indicatorScores,
  alertPreferences,
  alertLog,
  subscribers,
} from "./schema";

export const territoriesRelations = relations(territories, ({ many }) => ({
  sttScores: many(sttScores),
  signals: many(signals),
  alerts: many(alerts),
  collectionSnapshots: many(collectionSnapshots),
  indexHistory: many(indexHistory),
  indicatorScores: many(indicatorScores),
  alertPreferences: many(alertPreferences),
  alertLogs: many(alertLog),
}));

export const sttScoresRelations = relations(sttScores, ({ one, many }) => ({
  territory: one(territories, {
    fields: [sttScores.territoryId],
    references: [territories.id],
  }),
  alerts: many(alerts),
}));

export const signalsRelations = relations(signals, ({ one }) => ({
  territory: one(territories, {
    fields: [signals.territoryId],
    references: [territories.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  territory: one(territories, {
    fields: [alerts.territoryId],
    references: [territories.id],
  }),
  sttScore: one(sttScores, {
    fields: [alerts.sttScoreId],
    references: [sttScores.id],
  }),
}));

export const collectionSnapshotsRelations = relations(collectionSnapshots, ({ one, many }) => ({
  territory: one(territories, {
    fields: [collectionSnapshots.territoryId],
    references: [territories.id],
  }),
  indexHistoryEntries: many(indexHistory),
}));

export const indexHistoryRelations = relations(indexHistory, ({ one }) => ({
  territory: one(territories, {
    fields: [indexHistory.territoryId],
    references: [territories.id],
  }),
  snapshot: one(collectionSnapshots, {
    fields: [indexHistory.snapshotId],
    references: [collectionSnapshots.id],
  }),
}));

export const indicatorsRelations = relations(indicators, ({ many }) => ({
  scores: many(indicatorScores),
}));

export const subscribersRelations = relations(subscribers, ({ many }) => ({
  alertPreferences: many(alertPreferences),
  alertLogs: many(alertLog),
}));

export const alertPreferencesRelations = relations(alertPreferences, ({ one }) => ({
  subscriber: one(subscribers, {
    fields: [alertPreferences.subscriberId],
    references: [subscribers.id],
  }),
  territory: one(territories, {
    fields: [alertPreferences.territoryId],
    references: [territories.id],
  }),
}));

export const alertLogRelations = relations(alertLog, ({ one }) => ({
  subscriber: one(subscribers, {
    fields: [alertLog.subscriberId],
    references: [subscribers.id],
  }),
  territory: one(territories, {
    fields: [alertLog.territoryId],
    references: [territories.id],
  }),
}));

export const indicatorScoresRelations = relations(indicatorScores, ({ one }) => ({
  territory: one(territories, {
    fields: [indicatorScores.territoryId],
    references: [territories.id],
  }),
  indicator: one(indicators, {
    fields: [indicatorScores.indicatorId],
    references: [indicators.id],
  }),
}));
