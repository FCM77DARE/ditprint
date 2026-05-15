/**
 * SignalFeed — Feed SSE de Sinais em Tempo Real
 *
 * Conecta-se ao endpoint /api/alerts/stream e exibe sinais de alto impacto
 * assim que chegam, com visual cyber-luxury.
 *
 * Props:
 *   territoryId — se fornecido, filtra sinais por território
 *   maxItems    — número máximo de itens exibidos (FIFO, default 50)
 */

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, Zap, AlertTriangle, TrendingUp } from "lucide-react";

type AlertPayload = {
  territoryId: number;
  territoryName: string;
  territorySlug: string;
  signalTitle: string;
  signalSummary?: string;
  signalUrl?: string;
  impactScore: number;
  dimension: string;
  indicatorCode?: string;
  alertType: "signal" | "anomaly" | "escalation";
  anomalyContext?: {
    currentStt: number;
    previousStt?: number;
    sigmaDeviation?: number;
    dayDelta?: number;
  };
};

const DIM_COLOR: Record<string, string> = {
  D1: "border-green-400/40 text-green-400",
  D2: "border-blue-400/40 text-blue-400",
  D3: "border-purple-400/40 text-purple-400",
  D4: "border-orange-400/40 text-orange-400",
  D5: "border-cyan-400/40 text-cyan-400",
  D6: "border-pink-400/40 text-pink-400",
  GERAL: "border-muted/40 text-muted-foreground",
};

function ImpactBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.9 ? "bg-red-500" : score >= 0.7 ? "bg-orange-400" : "bg-amber-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted/30">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

function AlertIcon({ type }: { type: string }) {
  if (type === "escalation") return <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />;
  if (type === "anomaly") return <TrendingUp className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />;
  return <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0" />;
}

export default function SignalFeed({
  territoryId,
  maxItems = 50,
}: {
  territoryId?: number;
  maxItems?: number;
}) {
  const [signals, setSignals] = useState<(AlertPayload & { receivedAt: Date })[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = territoryId
      ? `/api/alerts/stream?territoryId=${territoryId}`
      : "/api/alerts/stream";

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as AlertPayload;
        setSignals((prev) => [{ ...payload, receivedAt: new Date() }, ...prev].slice(0, maxItems));
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [territoryId, maxItems]);

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
            <Radio className="h-4 w-4 text-primary" />
            Feed de Sinais
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-muted"}`} />
            <span className="font-mono text-xs text-muted-foreground">
              {connected ? "ao vivo" : "desconectado"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[520px] overflow-y-auto">
          {signals.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Radio className="h-8 w-8 opacity-30" />
              <p className="font-mono text-xs">Aguardando sinais de alto impacto...</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/20">
              {signals.map((signal, i) => (
                <li
                  key={i}
                  className={`group flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/10 ${
                    signal.alertType === "escalation" ? "border-l-2 border-red-400" :
                    signal.alertType === "anomaly" ? "border-l-2 border-orange-400" :
                    "border-l-2 border-primary/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertIcon type={signal.alertType} />
                    <div className="flex-1 min-w-0">
                      {signal.signalUrl ? (
                        <a
                          href={signal.signalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-body text-sm text-foreground/90 leading-snug hover:text-primary line-clamp-2"
                        >
                          {signal.signalTitle}
                        </a>
                      ) : (
                        <p className="font-body text-sm text-foreground/90 leading-snug line-clamp-2">
                          {signal.signalTitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${DIM_COLOR[signal.dimension] ?? DIM_COLOR.GERAL}`}>
                      {signal.dimension}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{signal.territoryName}</span>
                    <ImpactBar score={signal.impactScore} />
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
                      {signal.receivedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>

                  {signal.anomalyContext && (
                    <div className="rounded bg-muted/20 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                      STT: {signal.anomalyContext.currentStt.toFixed(1)}
                      {signal.anomalyContext.dayDelta !== undefined && (
                        <span className={signal.anomalyContext.dayDelta > 0 ? " text-red-400" : " text-emerald-400"}>
                          {" "}{signal.anomalyContext.dayDelta > 0 ? "+" : ""}{signal.anomalyContext.dayDelta.toFixed(1)} em 24h
                        </span>
                      )}
                      {signal.anomalyContext.sigmaDeviation !== undefined && (
                        <span className="text-orange-400"> · {signal.anomalyContext.sigmaDeviation.toFixed(1)}σ</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
