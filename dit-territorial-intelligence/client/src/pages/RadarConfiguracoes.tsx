/**
 * RadarConfiguracoes — Configurações de Alertas do Portal (/portal/configuracoes)
 *
 * Permite configurar preferências de alerta para cada território monitorado.
 */

import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import AlertConfigPanel from "@/components/AlertConfigPanel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import { Link } from "wouter";

// In production, this would come from session/auth context
const DEMO_EMAIL = "analista@print.com.br";

export default function RadarConfiguracoes() {
  const { data: territories, isLoading } = trpc.publicData.territories.useQuery();

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
          <span className="font-mono text-xs text-foreground">Configurações</span>
        </div>

        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">Configurações de Alertas</h1>
        </div>

        <p className="font-body text-sm text-muted-foreground max-w-lg">
          Defina para cada território monitorado quais canais recebem alertas,
          o threshold de impacto mínimo e o horário de silêncio.
        </p>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-xl bg-muted/20" />)}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {territories?.map((t) => (
              <AlertConfigPanel
                key={t.slug}
                subscriberEmail={DEMO_EMAIL}
                territoryId={t.id}
                territoryName={t.name}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
