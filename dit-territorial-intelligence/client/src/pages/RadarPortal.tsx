/**
 * RadarPortal — Portal do Assinante (/portal)
 *
 * Visão geral dos territórios monitorados com STT ao vivo,
 * feed de alertas recentes e acesso rápido às configurações.
 */

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import EscalationBanner from "@/components/EscalationBanner";
import SignalFeed from "@/components/SignalFeed";
import STTGauge from "@/components/STTGauge";
import { Link } from "wouter";
import { ArrowRight, Bell, Radio, Settings } from "lucide-react";

function ScenarioPill({ scenario }: { scenario: string | null }) {
  if (!scenario) return null;
  const styles: Record<string, string> = {
    escalada: "bg-red-500/20 text-red-300 border-red-500/40",
    pressao: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    estabilidade: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  };
  return (
    <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${styles[scenario] ?? ""}`}>
      {scenario}
    </span>
  );
}

export default function RadarPortal() {
  const { data: territories, isLoading } = trpc.publicData.territories.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });

  const escalated = territories?.filter((t) => (t.stt ?? 0) >= 75) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="scanline" />

      {/* Escalation banners for territories in escalada */}
      {escalated.map((t) => (
        <EscalationBanner
          key={t.slug}
          stt={t.stt ?? 0}
          territoryName={t.name}
          territorySlug={t.slug}
        />
      ))}

      <Header />

      <main className="container py-10">
        {/* Title */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">Portal do Assinante</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Territórios Monitorados
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href="/portal/alertas">
              <Button variant="outline" size="sm" className="border-border/50 font-mono text-xs">
                <Bell className="mr-1.5 h-3.5 w-3.5" />
                Alertas
              </Button>
            </Link>
            <Link href="/portal/configuracoes">
              <Button variant="outline" size="sm" className="border-border/50 font-mono text-xs">
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Configurações
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Territories grid */}
          <div className="space-y-6">
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-48 animate-pulse rounded-xl bg-muted/20" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {territories?.map((t) => (
                  <Card key={t.slug} className="glass border-border/50 transition-all hover:border-primary/40">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-display text-lg font-bold text-foreground">
                          {t.name}
                        </CardTitle>
                        <ScenarioPill scenario={t.scenario} />
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{t.state} · {t.period}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-5xl font-bold text-foreground text-glow">
                          {t.stt !== null ? Math.round(t.stt) : "—"}
                        </span>
                        <div>
                          <span className="font-mono text-xs font-bold text-accent">STT</span>
                          {t.sttDelta !== null && (
                            <div className={`font-mono text-xs font-bold ${(t.sttDelta ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                              {(t.sttDelta ?? 0) > 0 ? "+" : ""}{t.sttDelta?.toFixed(1)}
                            </div>
                          )}
                        </div>
                      </div>
                      <Link href={`/portal/territorio/${t.slug}`}>
                        <Button variant="outline" size="sm" className="w-full border-primary/30 font-mono text-xs text-primary hover:bg-primary/10">
                          Ver detalhe
                          <ArrowRight className="ml-1.5 h-3 w-3" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Live signal feed */}
          <div>
            <SignalFeed maxItems={30} />
          </div>
        </div>
      </main>
    </div>
  );
}
