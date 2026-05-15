/**
 * Home Page - Landing Principal do DIT
 * Design: Cyber-Luxury Futurista
 * - Hero full-viewport com background animado
 * - Glassmorphism e glow effects
 * - Carrossel horizontal com cards flutuantes
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/Header";
import STTGauge from "@/components/STTGauge";
import { ArrowRight, Bell, BookOpen, Lock, Radio, Sparkles, TrendingUp, Zap } from "lucide-react";
import { Link } from "wouter";
import { useRef } from "react";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const carouselRef = useRef<HTMLDivElement>(null);

  const { data: territoriesData } = trpc.publicData.territories.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Map API data to the shape needed by the carousel
  const territories = territoriesData?.map((t) => ({
    id: t.slug,
    name: t.name,
    stt: t.stt !== null ? Math.round(t.stt) : null,
    scenario: t.scenario,
    sttDelta: t.sttDelta,
    status: "available" as const,
    slug: `/territorio/${t.slug}`,
  })) ?? [
    // Fallback skeleton entries while loading
    { id: "baia-guanabara", name: "Baía de Guanabara", stt: null, scenario: null, sttDelta: null, status: "available" as const, slug: "/territorio/baia-guanabara" },
    { id: "teles-pires", name: "Bacia do Rio Teles Pires", stt: null, scenario: null, sttDelta: null, status: "available" as const, slug: "/territorio/teles-pires" },
  ];

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = 360;
      carouselRef.current.scrollBy({
        left: direction === "right" ? scrollAmount : -scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Scan line effect */}
      <div className="scanline" />
      
      <Header />

      {/* Hero Section - Full Viewport */}
      <section className="relative flex min-h-screen items-center overflow-hidden bg-neural-pattern pt-20">
        {/* Animated background */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "url('https://d2xsxph8kpxj0f.cloudfront.net/310519663191299985/43iZsmPphrqUoXjRK5zrxR/hero-cyber-bg_9624f79a.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />

        <div className="container relative z-10">
          <div className="grid gap-16 lg:grid-cols-[1.2fr_1fr] lg:gap-24">
            {/* Left: Content */}
            <div className="flex flex-col justify-center space-y-10">
              {/* Eyebrow */}
              <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 glass">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                  Inteligência Territorial de Ponta
                </span>
              </div>

              {/* Headline */}
              <h1 className="font-display text-6xl font-bold leading-[1.05] tracking-tight text-foreground text-glow lg:text-7xl xl:text-8xl">
                Complexidade territorial em dados estratégicos.
              </h1>

              {/* Subheadline */}
              <p className="max-w-2xl font-body text-xl leading-relaxed text-muted-foreground lg:text-2xl">
                O DIT transforma estruturas territoriais complexas em um{" "}
                <span className="font-bold text-accent text-glow-cyan">Score proprietário (STT 0–100)</span>,
                oferecendo clareza estratégica antes da operação.
              </p>

              {/* Stats */}
              <div className="flex flex-wrap gap-8">
                <div className="flex flex-col">
                  <span className="font-mono text-4xl font-bold text-primary text-glow">
                    78
                  </span>
                  <span className="font-body text-sm text-muted-foreground">
                    Score médio STT
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-4xl font-bold text-accent text-glow-cyan">
                    4
                  </span>
                  <span className="font-body text-sm text-muted-foreground">
                    Territórios em análise
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-4xl font-bold text-primary text-glow">
                    5+
                  </span>
                  <span className="font-body text-sm text-muted-foreground">
                    Índices componentes
                  </span>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  className="glow bg-primary font-body text-base font-bold text-primary-foreground transition-all hover:scale-105 hover:bg-primary/90"
                >
                  <Zap className="mr-2 h-5 w-5" fill="currentColor" />
                  Agendar conversa estratégica
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-accent/50 font-body text-base font-bold text-accent transition-all hover:scale-105 hover:border-accent hover:bg-accent/10"
                >
                  Solicitar acesso ao DIT
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Right: Gauge */}
            <div className="flex items-center justify-center lg:justify-end">
              <div className="glass rounded-2xl p-10 shadow-2xl">
                <STTGauge score={78} label="Baía de Guanabara" size="xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Territórios Analisados Section */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container">
          {/* Section Header */}
          <div className="mb-16 space-y-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                Pipeline Nacional
              </span>
            </div>
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground text-glow lg:text-6xl">
              Territórios estratégicos analisados
            </h2>
            <p className="mx-auto max-w-3xl font-body text-lg text-muted-foreground">
              Análise territorial com foco em infraestrutura, energia e recursos naturais.
              Inteligência estratégica para decisões de alto impacto.
            </p>
          </div>

          {/* Carousel */}
          <div className="relative">
            {/* Scroll container */}
            <div
              ref={carouselRef}
              className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
            >
              {territories.map((territory) => (
                <Card
                  key={territory.id}
                  className="glass glow min-w-[320px] flex-shrink-0 snap-start border-border/50 transition-all hover:scale-105 hover:border-primary/50 sm:min-w-[360px]"
                >
                  <CardContent className="flex flex-col gap-6 p-8">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 rounded-lg bg-accent/20 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-accent glow-cyan">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                        Disponível
                      </span>
                      {territory.scenario && (
                        <span className={`font-mono text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${
                          territory.scenario === "escalada" ? "text-red-400 bg-red-400/10" :
                          territory.scenario === "pressao" ? "text-orange-400 bg-orange-400/10" :
                          "text-emerald-400 bg-emerald-400/10"
                        }`}>
                          {territory.scenario}
                        </span>
                      )}
                    </div>

                    {/* Territory Name */}
                    <h3 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground">
                      {territory.name}
                    </h3>

                    {/* STT Score or Skeleton */}
                    {territory.stt !== null ? (
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-6xl font-bold text-foreground text-glow">
                          {territory.stt}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-semibold uppercase tracking-wider text-accent">
                            STT
                          </span>
                          {territory.sttDelta !== null && territory.sttDelta !== undefined && (
                            <span className={`font-mono text-xs font-bold ${territory.sttDelta > 0 ? "text-red-400" : territory.sttDelta < 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                              {territory.sttDelta > 0 ? "+" : ""}{territory.sttDelta.toFixed(1)} vs. anterior
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="h-16 animate-pulse rounded-lg bg-muted/30" />
                    )}

                    {/* Complexity Level */}
                    {territory.stt !== null && (
                      <p className="font-mono text-xs font-bold uppercase tracking-wider text-accent text-glow-cyan">
                        {territory.stt >= 75 ? "Complexidade Crítica" : territory.stt >= 50 ? "Alta Complexidade Territorial" : "Complexidade Moderada"}
                      </p>
                    )}

                    {/* CTA */}
                    <Link href={territory.slug}>
                      <Button
                        variant="outline"
                        className="mt-2 w-full border-2 border-primary/50 font-body font-bold text-primary transition-all hover:scale-105 hover:border-primary hover:bg-primary/10"
                      >
                        Ver análise completa
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Scroll controls */}
            <div className="mt-8 flex justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => scrollCarousel("left")}
                className="h-10 w-10 border-2 border-primary/50 transition-all hover:scale-110 hover:border-primary hover:bg-primary/10"
              >
                ←
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => scrollCarousel("right")}
                className="h-10 w-10 border-2 border-primary/50 transition-all hover:scale-110 hover:border-primary hover:bg-primary/10"
              >
                →
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Radar Territorial™ — Funil de Produto */}
      <section className="relative border-t border-border/40 bg-card/20 py-24 overflow-hidden">
        {/* Background grid pattern */}
        <div className="absolute inset-0 bg-neural-pattern opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/0 to-background" />

        <div className="container relative z-10">
          {/* Header */}
          <div className="mb-20 text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 glass">
              <Radio className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                Ciclo de Produto
              </span>
            </div>
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground lg:text-6xl">
              Radar Territorial™
            </h2>
            <p className="mx-auto max-w-2xl font-body text-xl leading-relaxed text-muted-foreground">
              Monitoramento contínuo de complexidade territorial com atualização mensal.
              Inteligência recorrente como base para decisões estratégicas.
            </p>
          </div>

          {/* Funnel Steps */}
          <div className="mx-auto max-w-4xl">
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-8 top-12 bottom-12 w-px bg-gradient-to-b from-primary via-accent to-primary/20 hidden md:block" />

              <div className="space-y-6">
                {/* Step 1 - Isca */}
                <div className="relative flex gap-6 items-start">
                  <div className="relative z-10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-primary/20 border border-primary/40 glass">
                    <Bell className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1 glass rounded-2xl p-8 border border-primary/20 hover:border-primary/50 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">Entrada gratuita</span>
                        <h3 className="mt-1 font-display text-2xl font-bold text-foreground">Alerta de Ativação</h3>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-green-100 px-3 py-1 font-mono text-xs font-bold text-green-800">Gratuito</span>
                    </div>
                    <p className="font-body text-base text-muted-foreground leading-relaxed">
                      Cadastre-se para receber um alerta quando o STT de um território de interesse se mover.
                      Quando o alerta chega, você entende o valor — e quer saber o porquê.
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-start pl-6 md:pl-8">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                    <ArrowRight className="h-4 w-4 rotate-90 text-primary" />
                  </div>
                </div>

                {/* Step 2 - Radar */}
                <div className="relative flex gap-6 items-start">
                  <div className="relative z-10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-accent/20 border border-accent/40 glass">
                    <Radio className="h-7 w-7 text-accent" />
                  </div>
                  <div className="flex-1 glass rounded-2xl p-8 border border-accent/20 hover:border-accent/50 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">Assinatura mensal</span>
                        <h3 className="mt-1 font-display text-2xl font-bold text-foreground">Radar Territorial™</h3>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-accent/10 px-3 py-1 font-mono text-xs font-bold text-accent border border-accent/30">Recorrente</span>
                    </div>
                    <p className="font-body text-base text-muted-foreground leading-relaxed mb-6">
                      STT atualizado mensalmente com alertas de ativação, nota executiva de contexto,
                      termômetro de cenários e briefing setorial personalizado.
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {["STT Atualizado", "Alerta de Ativação", "Nota Executiva", "Briefing Setorial"].map((item) => (
                        <div key={item} className="rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-center">
                          <p className="font-mono text-xs font-bold text-foreground">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-start pl-6 md:pl-8">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                    <ArrowRight className="h-4 w-4 rotate-90 text-primary" />
                  </div>
                </div>

                {/* Step 3 - DIT */}
                <div className="relative flex gap-6 items-start">
                  <div className="relative z-10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-primary/20 border border-primary/40 glass">
                    <BookOpen className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1 glass rounded-2xl p-8 border border-primary/20 hover:border-primary/50 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">Produto consultivo</span>
                        <h3 className="mt-1 font-display text-2xl font-bold text-foreground">DIT — Diagnóstico Completo</h3>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary border border-primary/30">Sob consulta</span>
                    </div>
                    <p className="font-body text-base text-muted-foreground leading-relaxed">
                      Análise estrutural profunda do território com STT completo, panorama institucional,
                      arquitetura social e cenários estruturais. Entregue como produto executivo.
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-start pl-6 md:pl-8">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                    <ArrowRight className="h-4 w-4 rotate-90 text-primary" />
                  </div>
                </div>

                {/* Step 4 - SSE */}
                <div className="relative flex gap-6 items-start">
                  <div className="relative z-10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-accent/20 border border-accent/40 glass">
                    <TrendingUp className="h-7 w-7 text-accent" />
                  </div>
                  <div className="flex-1 glass rounded-2xl p-8 border border-accent/20 hover:border-accent/50 transition-all">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">Aprofundamento setorial</span>
                        <h3 className="mt-1 font-display text-2xl font-bold text-foreground">SSE™ — Sector Sensitivity Exposure</h3>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-accent/10 px-3 py-1 font-mono text-xs font-bold text-accent border border-accent/30">Sob consulta</span>
                    </div>
                    <p className="font-body text-base text-muted-foreground leading-relaxed">
                      Mapeamento da exposição setorial ao território. Identifica quais setores estão mais
                      vulneráveis e quais têm maior potencial de ativação territorial.
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-start pl-6 md:pl-8">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                    <ArrowRight className="h-4 w-4 rotate-90 text-primary" />
                  </div>
                </div>

                {/* Step 5 - Retainer */}
                <div className="relative flex gap-6 items-start">
                  <div className="relative z-10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-primary/30 border border-primary/60 glass glow">
                    <Zap className="h-7 w-7 text-primary" fill="currentColor" />
                  </div>
                  <div className="flex-1 glass rounded-2xl p-8 border border-primary/40 hover:border-primary/70 transition-all bg-primary/5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">Parceria contínua</span>
                        <h3 className="mt-1 font-display text-2xl font-bold text-foreground">Retainer Estratégico</h3>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-primary/20 px-3 py-1 font-mono text-xs font-bold text-primary border border-primary/40">Exclusivo</span>
                    </div>
                    <p className="font-body text-base text-muted-foreground leading-relaxed">
                      Inteligência territorial contínua com acesso prioritário a novos territórios,
                      análises sob demanda e suporte estratégico direto da equipe Print.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Final */}
            <div className="mt-16 text-center">
              <p className="mb-8 font-body text-lg text-muted-foreground">
                Comece pelo alerta gratuito. Evolua no seu ritmo.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  size="lg"
                  className="glow bg-primary font-body text-base font-bold text-primary-foreground transition-all hover:scale-105 hover:bg-primary/90"
                >
                  <Bell className="mr-2 h-5 w-5" />
                  Receber alerta gratuito
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-accent/50 font-body text-base font-bold text-accent transition-all hover:scale-105 hover:border-accent hover:bg-accent/10"
                >
                  Conhecer o Radar Territorial™
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30 py-16">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex flex-col items-center gap-3 md:items-start">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 glow">
                  <Zap className="h-5 w-5 text-primary" fill="currentColor" />
                </div>
                <span className="font-display text-xl font-bold tracking-tight text-foreground">
                  PRINT
                </span>
              </div>
              <span className="font-mono text-[10px] font-medium tracking-widest text-accent">
                TERRITORIAL INTELLIGENCE
              </span>
            </div>

            <div className="flex flex-wrap justify-center gap-8 font-body text-sm text-muted-foreground">
              <Link href="/" className="transition-all hover:text-foreground hover:text-glow">
                Territórios
              </Link>
              <Link href="/metodologia" className="transition-all hover:text-foreground hover:text-glow">
                Metodologia
              </Link>
              <Link href="/sobre" className="transition-all hover:text-foreground hover:text-glow">
                Sobre
              </Link>
              <Link href="/contato" className="transition-all hover:text-foreground hover:text-glow">
                Contato
              </Link>
            </div>

            <p className="font-body text-xs text-muted-foreground">
              © 2026 Print. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
