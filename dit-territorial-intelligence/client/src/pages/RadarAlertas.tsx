/**
 * RadarAlertas — Histórico de Alertas do Portal (/portal/alertas)
 *
 * Exibe o alert_log dos últimos 7 dias por território.
 * O assinante pode ver quais alertas foram enviados, por qual canal e se foram abertos.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, CheckCircle, Mail, Radio, Smartphone, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "email") return <Mail className="h-3.5 w-3.5 text-blue-400" />;
  if (channel === "push") return <Smartphone className="h-3.5 w-3.5 text-purple-400" />;
  return <Radio className="h-3.5 w-3.5 text-primary" />;
}

function DimBadge({ dim }: { dim: string | null }) {
  if (!dim) return null;
  const colors: Record<string, string> = {
    D1: "text-green-400 border-green-400/30",
    D2: "text-blue-400 border-blue-400/30",
    D3: "text-purple-400 border-purple-400/30",
    D4: "text-orange-400 border-orange-400/30",
    D5: "text-cyan-400 border-cyan-400/30",
    D6: "text-pink-400 border-pink-400/30",
    GERAL: "text-muted-foreground border-muted/30",
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${colors[dim] ?? ""}`}>
      {dim}
    </span>
  );
}

export default function RadarAlertas() {
  const { data: territories } = trpc.publicData.territories.useQuery();
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<number | null>(null);

  const { data: logs, isLoading } = trpc.alertLog.recent.useQuery(
    { territoryId: selectedTerritoryId ?? (territories?.[0]?.id ?? 0), limit: 100 },
    { enabled: !!selectedTerritoryId || !!territories?.length }
  );

  const effectiveTerritoryId = selectedTerritoryId ?? territories?.[0]?.id;

  return (
    <div className="min-h-screen bg-background">
      <div className="scanline" />
      <Header />

      <main className="container py-10 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link href="/portal">
            <Button variant="ghost" size="sm" className="font-mono text-xs text-muted-foreground hover:text-foreground px-2">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Portal
            </Button>
          </Link>
          <span className="font-mono text-xs text-muted-foreground">/</span>
          <span className="font-mono text-xs text-foreground">Alertas</span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">Histórico de Alertas</h1>
          </div>
          <Select
            value={String(effectiveTerritoryId ?? "")}
            onValueChange={(v) => setSelectedTerritoryId(parseInt(v))}
          >
            <SelectTrigger className="w-52 border-border/40 bg-background/50 font-mono text-xs">
              <SelectValue placeholder="Selecionar território" />
            </SelectTrigger>
            <SelectContent>
              {territories?.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="glass border-border/50">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-muted/20" />)}
              </div>
            ) : !logs?.length ? (
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="font-mono text-xs">Nenhum alerta registrado para este território.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="border-b border-border/50 bg-background/80">
                  <tr className="text-left font-mono uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">Sinal</th>
                    <th className="px-2 py-2.5 text-center">Dim</th>
                    <th className="px-2 py-2.5 text-center">Canal</th>
                    <th className="px-2 py-2.5 text-right">Impacto</th>
                    <th className="px-2 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">Enviado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-2.5 max-w-xs">
                        <p className="line-clamp-1 text-foreground/80">{log.signalTitle ?? "—"}</p>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <DimBadge dim={log.dimension} />
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex justify-center">
                          <ChannelIcon channel={log.channel} />
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono">
                        {log.impactScore !== null ? `${Math.round((log.impactScore ?? 0) * 100)}%` : "—"}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {log.delivered ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <CheckCircle className="h-3 w-3" />
                            {log.opened ? "aberto" : "entregue"}
                          </span>
                        ) : (
                          <span className="text-red-400">falha</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                        {log.sentAt
                          ? new Date(log.sentAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
