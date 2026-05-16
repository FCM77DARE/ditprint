/**
 * Alert Engine — Disparo Multi-Canal de Alertas em Tempo Real
 *
 * Responsabilidades:
 *   1. Recebe sinais classificados com impactScore ≥ 0.7 do Orchestrator
 *   2. Busca assinantes com preferências ativas para o território
 *   3. Respeita quiet hours, digest frequency e threshold por assinante
 *   4. Despacha por canal: SSE (dashboard), email (Resend), push (FCM stub)
 *   5. Grava log de despacho em alert_log
 *
 * Canais implementados:
 *   SSE   — Server-Sent Events para o dashboard interno (sem dependência externa)
 *   Email — Resend API (RESEND_API_KEY env var)
 *   Push  — FCM stub (FIREBASE_SERVER_KEY env var; implementação completa futura)
 *
 * O engine é chamado pelo Orchestrator para cada sinal com triggersAlert = true.
 * Pode ser chamado também para alertas de STT (isAnomaly/isEscalation).
 */

import { getDb } from "./db";
import { alertPreferences, alertLog, subscribers, territories } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "./_core/logger";

const log = logger.child({ module: "alert-engine" });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? "alertas@print.com.br";
const FIREBASE_SERVER_KEY = process.env.FIREBASE_SERVER_KEY;
const APP_URL = process.env.APP_URL ?? "https://print.com.br";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlertPayload {
  territoryId: number;
  territoryName: string;
  territorySlug: string;
  signalTitle: string;
  signalSummary?: string;
  signalUrl?: string;
  impactScore: number;
  dimension: "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "GERAL";
  indicatorCode?: string;
  publishedAt?: Date;
  /** "signal" for individual alerts, "anomaly" for STT-level anomaly, "escalation" for fast escalation */
  alertType: "signal" | "anomaly" | "escalation";
  /** Extra context for anomaly/escalation alerts */
  anomalyContext?: {
    currentStt: number;
    previousStt?: number;
    sigmaDeviation?: number;
    dayDelta?: number;
  };
}

export interface DispatchResult {
  subscriberCount: number;
  channelResults: Array<{
    subscriberId: number;
    channel: "email" | "push" | "sse";
    success: boolean;
    error?: string;
  }>;
}

// ─── SSE Broker ───────────────────────────────────────────────────────────────

type SseClient = {
  id: string;
  territoryId?: number; // undefined = subscribe to all
  write: (data: string) => void;
};

const sseClients = new Map<string, SseClient>();

// Buffer circular dos últimos 30 sinais (replay para novos clientes SSE).
// Sem isso, quem abre a tela entre ciclos de coleta (4h) vê só "Aguardando…".
const SSE_REPLAY_LIMIT = 30;
const signalBuffer: AlertPayload[] = [];

function pushToBuffer(payload: AlertPayload): void {
  signalBuffer.unshift(payload);
  if (signalBuffer.length > SSE_REPLAY_LIMIT) signalBuffer.length = SSE_REPLAY_LIMIT;
}

/**
 * Register a new SSE client. Call from Express route handler.
 * Returns an unsubscribe function — call it on connection close.
 * Envia o buffer recente (últimos N sinais) imediatamente.
 */
export function registerSseClient(
  id: string,
  write: (data: string) => void,
  territoryId?: number
): () => void {
  sseClients.set(id, { id, territoryId, write });
  log.debug({ id, territoryId, total: sseClients.size }, "SSE client registered");

  // Replay: envia sinais recentes (em ordem cronológica reversa do mais recente para o mais antigo)
  // Filtra por território se especificado.
  for (const payload of signalBuffer) {
    if (territoryId !== undefined && payload.territoryId !== territoryId) continue;
    try {
      write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      break;
    }
  }

  return () => {
    sseClients.delete(id);
    log.debug({ id, total: sseClients.size }, "SSE client unregistered");
  };
}

function broadcastSse(payload: AlertPayload): void {
  pushToBuffer(payload);
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  let sent = 0;
  for (const client of Array.from(sseClients.values())) {
    if (client.territoryId === undefined || client.territoryId === payload.territoryId) {
      try {
        client.write(data);
        sent++;
      } catch {
        sseClients.delete(client.id);
      }
    }
  }
  if (sent > 0) log.debug({ sent, territoryId: payload.territoryId }, "SSE broadcast sent");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main entry point. Called by the Orchestrator for each high-impact signal,
 * and by the scheduler for anomaly/escalation events.
 */
export async function dispatchAlert(payload: AlertPayload): Promise<DispatchResult> {
  const result: DispatchResult = { subscriberCount: 0, channelResults: [] };

  // 1. Always broadcast to SSE (no threshold — dashboard shows all alerts)
  broadcastSse(payload);

  // 2. Fetch subscriber preferences for this territory
  const prefs = await fetchActivePreferences(payload.territoryId);
  if (prefs.length === 0) {
    log.debug({ territoryId: payload.territoryId }, "No alert preferences configured for territory");
    return result;
  }

  result.subscriberCount = prefs.length;

  // 3. Dispatch per-subscriber
  const db = await getDb();

  for (const pref of prefs) {
    if (!pref.subscriber) continue;
    if (payload.impactScore < (pref.minImpactThreshold ?? 0.7)) continue;
    if (isInQuietHours(pref.quietHoursStart, pref.quietHoursEnd)) continue;

    const channels = (pref.channels ?? ["email"]) as ("email" | "push" | "sse")[];

    for (const channel of channels) {
      if (channel === "sse") continue; // SSE handled above (broadcast, not per-subscriber)

      let success = false;
      let errorMessage: string | undefined;

      try {
        if (channel === "email") {
          await sendEmail(pref.subscriber.email, pref.subscriber.name, payload);
          success = true;
        } else if (channel === "push") {
          await sendPushStub(pref.subscriber.id, payload);
          success = true;
        }
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        log.warn({ err, channel, subscriberId: pref.subscriber.id }, "Alert dispatch failed");
      }

      result.channelResults.push({ subscriberId: pref.subscriber.id, channel, success, error: errorMessage });

      // Log to alert_log
      if (db) {
        try {
          await db.insert(alertLog).values({
            subscriberId: pref.subscriber.id,
            territoryId: payload.territoryId,
            signalTitle: payload.signalTitle.slice(0, 499),
            impactScore: payload.impactScore,
            dimension: payload.dimension,
            channel,
            delivered: success,
            errorMessage: errorMessage ?? null,
            metadata: { alertType: payload.alertType, indicatorCode: payload.indicatorCode ?? null },
          });
        } catch (err) {
          log.warn({ err }, "Failed to write alert_log entry");
        }
      }
    }
  }

  log.info(
    {
      territory: payload.territorySlug,
      alertType: payload.alertType,
      impactScore: payload.impactScore,
      subscriberCount: result.subscriberCount,
      dispatched: result.channelResults.filter((r) => r.success).length,
    },
    "Alert dispatched"
  );

  return result;
}

/**
 * Dispatch a STT-level anomaly or escalation alert to all subscribers of a territory.
 * Called by the Orchestrator after detectAnomalies().
 */
export async function dispatchAnomalyAlert(
  territoryId: number,
  territoryName: string,
  territorySlug: string,
  alertType: "anomaly" | "escalation",
  context: { currentStt: number; previousStt?: number; sigmaDeviation?: number; dayDelta?: number }
): Promise<DispatchResult> {
  const title =
    alertType === "escalation"
      ? `ESCALAÇÃO: STT de ${territoryName} subiu ${Math.abs(context.dayDelta ?? 0).toFixed(1)} pontos em 24h`
      : `ANOMALIA: STT de ${territoryName} está ${(context.sigmaDeviation ?? 0).toFixed(1)}σ acima da média histórica`;

  return dispatchAlert({
    territoryId,
    territoryName,
    territorySlug,
    signalTitle: title,
    impactScore: 1.0, // Anomaly/escalation always max priority
    dimension: "GERAL",
    alertType,
    anomalyContext: context,
  });
}

// ─── Email via Resend ─────────────────────────────────────────────────────────

async function sendEmail(
  toEmail: string,
  toName: string,
  payload: AlertPayload
): Promise<void> {
  if (!RESEND_API_KEY) {
    log.warn("RESEND_API_KEY not set — email alert skipped");
    return;
  }

  const subject = buildEmailSubject(payload);
  const html = buildEmailHtml(toName, payload);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: toEmail,
      subject,
      html,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

function buildEmailSubject(payload: AlertPayload): string {
  const icon = payload.alertType === "escalation" ? "🚨" : payload.alertType === "anomaly" ? "📊" : "⚠️";
  const impactLabel = payload.impactScore >= 0.9 ? "CRÍTICO" : payload.impactScore >= 0.7 ? "ALTO" : "MODERADO";
  return `${icon} [DIT] ${impactLabel} — ${payload.territoryName}: ${payload.signalTitle.slice(0, 80)}`;
}

function buildEmailHtml(recipientName: string, payload: AlertPayload): string {
  const dimensionLabel: Record<string, string> = {
    D1: "Socioambiental", D2: "Socioeconômica", D3: "Infraestrutura",
    D4: "Dinâmica Territorial", D5: "Governança", D6: "Reputação", GERAL: "Geral",
  };

  const anomalySection = payload.anomalyContext
    ? `
      <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px;margin:16px 0;border-radius:4px;">
        <strong>Contexto Analítico</strong><br>
        STT atual: <strong>${payload.anomalyContext.currentStt.toFixed(1)}</strong>
        ${payload.anomalyContext.previousStt !== undefined ? ` | STT anterior: ${payload.anomalyContext.previousStt.toFixed(1)}` : ""}
        ${payload.anomalyContext.dayDelta !== undefined ? ` | Variação 24h: ${payload.anomalyContext.dayDelta > 0 ? "+" : ""}${payload.anomalyContext.dayDelta.toFixed(1)}` : ""}
        ${payload.anomalyContext.sigmaDeviation !== undefined ? ` | Desvio: ${payload.anomalyContext.sigmaDeviation.toFixed(1)}σ` : ""}
      </div>`
    : "";

  const signalSection = payload.signalSummary
    ? `<p style="color:#444;margin:8px 0;">${payload.signalSummary}</p>`
    : "";

  const ctaButton = payload.signalUrl
    ? `<a href="${payload.signalUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Ver Fonte Original</a>`
    : "";

  const dashboardLink = `<a href="${APP_URL}/dashboard" style="display:inline-block;background:#e94560;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;margin-left:8px;">Abrir Dashboard</a>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>DIT Alert</title></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <div style="background:#1a1a2e;padding:20px;">
      <h1 style="color:#e94560;margin:0;font-size:20px;">Print Territorial Intelligence™</h1>
      <p style="color:#ccc;margin:4px 0 0;font-size:13px;">Alerta de Monitoramento Territorial</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#666;margin:0 0 16px;">Olá, <strong>${recipientName}</strong>.</p>
      <div style="background:#f8f9fa;border-left:4px solid #e94560;padding:16px;border-radius:4px;margin-bottom:16px;">
        <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">${payload.territoryName} · ${dimensionLabel[payload.dimension] ?? payload.dimension}</div>
        <h2 style="margin:8px 0;font-size:16px;color:#1a1a2e;">${payload.signalTitle}</h2>
        ${signalSection}
      </div>
      ${anomalySection}
      <div style="margin:16px 0;">
        <strong>Impacto:</strong> ${(payload.impactScore * 100).toFixed(0)}%
        ${payload.indicatorCode ? ` · Indicador: <code>${payload.indicatorCode}</code>` : ""}
      </div>
      <div style="margin:24px 0;">
        ${ctaButton}${dashboardLink}
      </div>
    </div>
    <div style="background:#f5f5f5;padding:12px 24px;font-size:11px;color:#999;border-top:1px solid #eee;">
      Print Territorial Intelligence™ — Para gerenciar seus alertas, acesse ${APP_URL}/configuracoes.
    </div>
  </div>
</body>
</html>`;
}

// ─── Push (FCM stub) ──────────────────────────────────────────────────────────

async function sendPushStub(subscriberId: number, payload: AlertPayload): Promise<void> {
  if (!FIREBASE_SERVER_KEY) {
    log.debug({ subscriberId }, "FIREBASE_SERVER_KEY not set — push alert skipped");
    return;
  }
  // TODO: Implement FCM push using subscriber's FCM token (stored in subscribers table or separate table).
  // For now, log intent and return.
  log.info({ subscriberId, territory: payload.territorySlug, alertType: payload.alertType }, "Push notification queued (stub)");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type PrefWithSubscriber = {
  id: number;
  subscriberId: number;
  territoryId: number;
  channels: unknown;
  minImpactThreshold: number | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  digestFrequency: "realtime" | "daily" | "weekly";
  active: boolean;
  subscriber: { id: number; email: string; name: string } | null;
};

async function fetchActivePreferences(territoryId: number): Promise<PrefWithSubscriber[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const rows = await db
      .select({
        id: alertPreferences.id,
        subscriberId: alertPreferences.subscriberId,
        territoryId: alertPreferences.territoryId,
        channels: alertPreferences.channels,
        minImpactThreshold: alertPreferences.minImpactThreshold,
        quietHoursStart: alertPreferences.quietHoursStart,
        quietHoursEnd: alertPreferences.quietHoursEnd,
        digestFrequency: alertPreferences.digestFrequency,
        active: alertPreferences.active,
        subscriberEmail: subscribers.email,
        subscriberName: subscribers.name,
        subscriberActive: subscribers.active,
      })
      .from(alertPreferences)
      .innerJoin(subscribers, eq(alertPreferences.subscriberId, subscribers.id))
      .where(
        and(
          eq(alertPreferences.territoryId, territoryId),
          eq(alertPreferences.active, true),
          eq(subscribers.active, true)
        )
      );

    return rows.map((r) => ({
      ...r,
      subscriber: { id: r.subscriberId, email: r.subscriberEmail, name: r.subscriberName },
    }));
  } catch (err) {
    log.warn({ err, territoryId }, "Failed to fetch alert preferences");
    return [];
  }
}

function isInQuietHours(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end) return false;
  const now = new Date();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = (sh ?? 0) * 60 + (sm ?? 0);
  const endMinutes = (eh ?? 0) * 60 + (em ?? 0);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Spans midnight
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

// ─── Daily Digest ─────────────────────────────────────────────────────────────

/**
 * Send the daily briefing digest to all subscribers with digestFrequency="daily".
 * Called by the scheduler at 08:00 after the STT is published.
 */
export async function sendDailyDigest(
  territoryId: number,
  territoryName: string,
  territorySlug: string,
  stt: number,
  executiveNote: string,
  period: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const prefs = await fetchActivePreferences(territoryId);
  const dailyPrefs = prefs.filter(
    (p) => p.digestFrequency === "daily" && (p.channels as string[]).includes("email")
  );

  if (dailyPrefs.length === 0) return;

  for (const pref of dailyPrefs) {
    if (!pref.subscriber || !RESEND_API_KEY) continue;

    try {
      const html = buildDigestHtml(pref.subscriber.name, territoryName, territorySlug, stt, executiveNote, period);
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: pref.subscriber.email,
          subject: `[DIT] Briefing Diário — ${territoryName} · STT ${stt.toFixed(1)} · ${period}`,
          html,
        }),
        signal: AbortSignal.timeout(10000),
      });

      log.info({ subscriberId: pref.subscriber.id, territory: territorySlug, period }, "Daily digest sent");
    } catch (err) {
      log.warn({ err, subscriberId: pref.subscriber.id }, "Daily digest send failed");
    }
  }
}

function buildDigestHtml(
  name: string,
  territoryName: string,
  territorySlug: string,
  stt: number,
  executiveNote: string,
  period: string
): string {
  const scenarioColor = stt >= 75 ? "#dc3545" : stt >= 50 ? "#fd7e14" : "#28a745";
  const scenarioLabel = stt >= 75 ? "ESCALADA" : stt >= 50 ? "PRESSÃO" : "ESTABILIDADE";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <div style="background:#1a1a2e;padding:20px;">
      <h1 style="color:#e94560;margin:0;font-size:20px;">Print Territorial Intelligence™</h1>
      <p style="color:#ccc;margin:4px 0 0;font-size:13px;">Briefing Diário — ${period}</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#666;">Olá, <strong>${name}</strong>. Aqui está o briefing diário de ${territoryName}.</p>

      <div style="text-align:center;padding:24px;background:#f8f9fa;border-radius:8px;margin:16px 0;">
        <div style="font-size:48px;font-weight:bold;color:${scenarioColor};">${stt.toFixed(1)}</div>
        <div style="font-size:12px;color:${scenarioColor};font-weight:bold;letter-spacing:2px;">${scenarioLabel}</div>
        <div style="font-size:13px;color:#666;margin-top:4px;">Score de Tensão Territorial</div>
      </div>

      <div style="background:#f8f9fa;border-left:4px solid #1a1a2e;padding:16px;border-radius:4px;margin:16px 0;">
        <strong style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Nota Executiva</strong>
        <p style="margin:8px 0 0;color:#333;line-height:1.6;">${executiveNote || "Análise em processamento."}</p>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="${APP_URL}/radar/territorio/${territorySlug}" style="background:#e94560;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Ver Relatório Completo
        </a>
      </div>
    </div>
    <div style="background:#f5f5f5;padding:12px 24px;font-size:11px;color:#999;border-top:1px solid #eee;">
      Print Territorial Intelligence™ — Gerenciar alertas: ${APP_URL}/configuracoes
    </div>
  </div>
</body>
</html>`;
}
