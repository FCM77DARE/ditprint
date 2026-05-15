/**
 * RadarTerritoryPage — Detalhe do Território no Portal (/portal/territorio/:slug)
 *
 * Exibe STT ao vivo, histórico, feed de sinais do território e configuração de alertas.
 */

import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import Header from "@/components/Header";
import EscalationBanner from "@/components/EscalationBanner";
import SignalFeed from "@/components/SignalFeed";
import AlertConfigPanel from "@/components/AlertConfigPanel";
import STTGauge from "@/components/STTGauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const DIM_LABELS = ["D1 Socioambiental", "D2 Socioeconômica", "D3 Infraestrutura", "D4 Dinâmica Territ.", "D5 Governança", "D6 Reputação"];

// Subscriber email would come from auth context in production
const DEMO_EMAIL = "analista@print.com.br";

export default function RadarTerritoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: overview } = trpc.publicData.territories.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });
  const territory = overview?.find((t) => t.slug === slug);

  const { data: history } = trpc.territories.history.useQuery(
    { slug, limit: 6 },
    { enabled: !!slug, staleTime: 5 * 60 * 1000 }
  );

  if (!territory) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-20 text-center text-muted-foreground font-mono">
          Território não encontrado.
        </div>
      </div>
    );
  }

  const stt = territory.stt ? Math.round(territory.stt) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="scanline" />
      {stt >= 75 && (
        <EscalationBanner
          stt={stt}
          territoryName={territory.name}
          territorySlug={slug}
        />
      )}
      <Header />

      <main className="container py-10 space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link href="/portal">
            <Button variant="ghost" size="sm" className="font-mono text-xs text-muted-foreground hover:text-foreground px-2">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Portal
            </Button>
          </Link>
          <span className="font-mono text-xs text-muted-foreground">/</span>
          <span className="font-mono text-xs text-foreground">{territory.name}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">{territory.name}</h1>
            <p className="font-mono text-xs text-muted-foreground">{territory.state} · {territory.period}</p>
          </div>
          <div className="glass rounded-xl p-6">
            <STTGauge score={stt} label="STT" size="lg" />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* STT history */}
            {history && history.length > 0 && (
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="font-mono text-sm uppercase tracking-wider">Histórico STT</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-24">
                    {history.slice().reverse().map((h, i) => {
                      const val = h.stt ?? 0;
                      const height = `${Math.max(8, val)}%`;
                      const color = val >= 75 ? "bg-red-400" : val >= 50 ? "bg-orange-400" : "bg-emerald-400";
                      return (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t ${color} opacity-80`}
                            style={{ height }}
                            title={`${h.period}: ${val.toFixed(1)}`}
                          />
                          <span className="font-mono text-[9px] text-muted-foreground">{h.period?.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Signal feed for this territory */}
            <SignalFeed territoryId={territory.id} maxItems={20} />
          </div>

          {/* Alert config */}
          <div>
            <AlertConfigPanel
              subscriberEmail={DEMO_EMAIL}
              territoryId={territory.id}
              territoryName={territory.name}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
