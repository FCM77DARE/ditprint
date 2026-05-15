/**
 * SSE Page - Sector Sensitivity Exposure
 * Design: Cyber-Luxury Futurista
 * - Exposição setorial no território
 * - Gráficos de barras e radar
 * - Lógica de funil (não canibaliza DIT)
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import STTGauge from "@/components/STTGauge";
import { 
  ArrowRight, 
  Zap,
  TrendingUp,
  Target,
  Layers,
  CheckCircle2,
  ArrowUpRight
} from "lucide-react";
import { Link } from "wouter";

export default function SSE() {
  const sectorComparison = [
    { sector: "Energia / Óleo & Gás", sse: 85, color: "#00E5FF", level: "Alta" },
    { sector: "Logística Portuária", sse: 82, color: "#4D9FFF", level: "Alta" },
    { sector: "Saneamento", sse: 54, color: "#6B7280", level: "Moderada" },
  ];

  const radarDimensions = [
    { dimension: "Sensibilidade Ambiental", level: "Alta" },
    { dimension: "Conflito de Uso do Espaço", level: "Alto" },
    { dimension: "Visibilidade Pública", level: "Alta" },
    { dimension: "Complexidade Institucional", level: "Alta" },
    { dimension: "Mobilização Social", level: "Alta" },
  ];

  const deliverables = [
    "Índice de Exposição Setorial (0–100)",
    "Análise das camadas territoriais ativadas",
    "Comparativo entre setores",
    "Radar de ativação estrutural",
    "Cenários setoriais prováveis",
  ];

  const journey = [
    { step: "1", name: "DIT", description: "Complexidade Estrutural" },
    { step: "2", name: "SSE", description: "Exposição Setorial", active: true },
    { step: "3", name: "PTE", description: "Exposição de Projeto" },
    { step: "4", name: "Monitor", description: "Monitoramento Territorial" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Scan line effect */}
      <div className="scanline" />
      
      <Header />

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center overflow-hidden bg-neural-pattern pt-20">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />

        <div className="container relative z-10">
          <div className="mx-auto max-w-5xl text-center">
            {/* Brand */}
            <div className="mb-8 flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 glass">
                <Target className="h-4 w-4 text-accent" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                  Print Territorial Intelligence™
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-6xl font-bold leading-none tracking-tight text-foreground text-glow lg:text-7xl">
                  SSE™
                </h1>
                <p className="font-mono text-xl font-medium tracking-wide text-accent text-glow-cyan">
                  Sector Sensitivity Exposure
                </p>
                <p className="font-body text-lg text-muted-foreground">
                  Exposição Setorial no Território
                </p>
              </div>
              <span className="font-mono text-xs font-medium tracking-widest text-muted-foreground">
                A unit by Print
              </span>
            </div>

            {/* Headline */}
            <h2 className="mb-8 font-display text-5xl font-bold leading-tight tracking-tight text-foreground lg:text-6xl">
              Nem todo setor ativa o território da mesma forma.
            </h2>

            {/* Description */}
            <div className="mb-12 space-y-6">
              <p className="mx-auto max-w-3xl font-body text-xl leading-relaxed text-muted-foreground">
                O SSE™ cruza o <span className="font-bold text-accent text-glow-cyan">Score Territorial Total (STT)</span> com dinâmicas setoriais específicas, revelando como diferentes segmentos interagem com a complexidade estrutural do território.
              </p>
              <p className="mx-auto max-w-3xl font-body text-lg leading-relaxed text-muted-foreground">
                Baseado no DIT, o SSE transforma leitura territorial em{" "}
                <span className="font-bold text-primary text-glow">exposição setorial mensurável</span>.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap justify-center gap-4">
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
                Solicitar análise setorial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Por Que o SSE Existe */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                Fundamento
              </span>
            </div>
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground text-glow">
              Por que o SSE existe
            </h2>
          </div>

          <div className="glass rounded-2xl p-10 space-y-8">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="font-display text-2xl font-bold text-foreground">
                  O DIT mede a complexidade estrutural do território.
                </h3>
              </div>
              <div className="space-y-4">
                <h3 className="font-display text-2xl font-bold text-accent text-glow-cyan">
                  O SSE mede como o seu setor ativa essa complexidade.
                </h3>
              </div>
            </div>

            <div className="border-t border-border/40 pt-8">
              <p className="mb-6 font-body text-lg leading-relaxed text-muted-foreground">
                Territórios de alta complexidade não reagem de forma homogênea.
                Cada setor ativa camadas distintas:
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {["Uso do espaço", "Sensibilidade ambiental", "Mobilização social", 
                  "Exposição pública", "Complexidade institucional"].map((layer, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-4">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-accent glow-cyan" />
                    <span className="font-body text-sm font-medium text-foreground">{layer}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border/40 pt-8 text-center">
              <p className="font-display text-2xl font-bold text-foreground">
                Complexidade territorial é fixa.
              </p>
              <p className="mt-2 font-display text-2xl font-bold text-accent text-glow-cyan">
                Exposição setorial varia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Base Territorial */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                Base Territorial
              </span>
            </div>
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground text-glow">
              Baía de Guanabara
            </h2>
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="glass rounded-2xl p-10">
              <div className="mb-8 flex justify-center">
                <STTGauge score={78} label="Baía de Guanabara" size="lg" />
              </div>
              <p className="text-center font-body text-lg leading-relaxed text-muted-foreground">
                O SSE parte do STT para cruzar dinâmicas específicas de cada setor econômico.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Exposição Setorial Comparativa */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground text-glow">
              Exposição Setorial Comparativa
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">
              Exemplo aplicado — Baía de Guanabara
            </p>
          </div>

          <div className="mx-auto max-w-5xl">
            {/* Chart */}
            <div className="glass rounded-2xl p-10 mb-12">
              <img 
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663191299985/43iZsmPphrqUoXjRK5zrxR/sse-bar-chart_a8240929.png" 
                alt="Gráfico de barras - Exposição Setorial Comparativa"
                className="w-full"
              />
            </div>

            {/* Legend */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="glass border-border/50">
                <CardContent className="p-6">
                  <div className="mb-2 h-3 w-full rounded-full bg-accent/30" />
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                    80–100
                  </p>
                  <p className="mt-1 font-body text-sm text-muted-foreground">
                    Exposição Alta
                  </p>
                </CardContent>
              </Card>
              <Card className="glass border-border/50">
                <CardContent className="p-6">
                  <div className="mb-2 h-3 w-full rounded-full bg-primary/30" />
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                    60–79
                  </p>
                  <p className="mt-1 font-body text-sm text-muted-foreground">
                    Exposição Elevada
                  </p>
                </CardContent>
              </Card>
              <Card className="glass border-border/50">
                <CardContent className="p-6">
                  <div className="mb-2 h-3 w-full rounded-full bg-muted" />
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    40–59
                  </p>
                  <p className="mt-1 font-body text-sm text-muted-foreground">
                    Exposição Moderada
                  </p>
                </CardContent>
              </Card>
              <Card className="glass border-border/50">
                <CardContent className="p-6">
                  <div className="mb-2 h-3 w-full rounded-full bg-muted/50" />
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    0–39
                  </p>
                  <p className="mt-1 font-body text-sm text-muted-foreground">
                    Exposição Baixa
                  </p>
                </CardContent>
              </Card>
            </div>

            <p className="mt-12 text-center font-body text-lg italic text-muted-foreground">
              O mesmo território pode gerar níveis distintos de exposição conforme o setor envolvido.
            </p>
          </div>
        </div>
      </section>

      {/* Radar de Ativação Setorial */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground text-glow">
              Radar de Ativação Setorial
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">
              Energia / Óleo & Gás
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="glass rounded-2xl p-10 mb-12">
              <img 
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663191299985/43iZsmPphrqUoXjRK5zrxR/sse-radar-chart_c6a4e1ed.png" 
                alt="Gráfico radar - Ativação Setorial Energia"
                className="w-full"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {radarDimensions.map((dim, idx) => (
                <Card key={idx} className="glass border-border/50">
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                      <ArrowUpRight className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-body text-base font-medium text-foreground">
                        {dim.dimension}
                      </p>
                      <p className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                        {dim.level}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-12 glass rounded-2xl p-8 text-center">
              <p className="mb-4 font-body text-lg leading-relaxed text-muted-foreground">
                O radar evidencia quais camadas estruturais do território são mais ativadas por determinado setor.
              </p>
              <div className="space-y-2">
                <p className="font-body text-base text-muted-foreground">
                  Sem recomendação.
                </p>
                <p className="font-body text-base text-muted-foreground">
                  Sem plano operacional.
                </p>
                <p className="mt-4 font-display text-xl font-bold text-accent text-glow-cyan">
                  Apenas leitura estratégica.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O Que o SSE Entrega */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container max-w-4xl">
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                Entregáveis
              </span>
            </div>
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground text-glow">
              O que o SSE entrega
            </h2>
          </div>

          <div className="glass rounded-2xl p-10">
            <div className="space-y-4 mb-8">
              {deliverables.map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 rounded-lg border border-border/50 bg-card/50 p-5">
                  <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-accent" />
                  <p className="font-body text-lg text-foreground">{item}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-border/40 pt-8 text-center space-y-3">
              <p className="font-body text-lg text-muted-foreground">
                O SSE não substitui estratégia operacional.
              </p>
              <p className="font-display text-2xl font-bold text-accent text-glow-cyan">
                Ele antecipa o grau de exposição estrutural.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Jornada Territorial */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground text-glow">
              Parte da Jornada Territorial
            </h2>
            <p className="font-mono text-sm font-medium tracking-wider text-accent">
              Print Territorial Intelligence™
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4 mb-12">
            {journey.map((item, idx) => (
              <Card 
                key={idx} 
                className={`glass border-border/50 transition-all ${
                  item.active ? 'glow-cyan border-accent/50 scale-105' : ''
                }`}
              >
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20">
                    <span className="font-mono text-2xl font-bold text-accent">
                      {item.step}
                    </span>
                  </div>
                  <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
                    {item.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-body text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="glass rounded-2xl p-10 text-center space-y-6">
            <p className="font-body text-lg leading-relaxed text-muted-foreground">
              O SSE é oferecido prioritariamente a organizações que já adquiriram o DIT.
            </p>
            <p className="font-display text-xl font-bold text-accent text-glow-cyan">
              Clientes DIT possuem condição diferenciada para aprofundamento setorial.
            </p>
            <p className="font-mono text-sm font-medium tracking-wider text-muted-foreground">
              Investimento sob consulta.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative bg-gradient-to-br from-primary/10 via-accent/10 to-background py-24">
        <div className="container max-w-4xl text-center">
          <div className="glass rounded-2xl p-12">
            <div className="mb-6 flex items-center justify-center gap-3">
              <Zap className="h-8 w-8 text-accent" fill="currentColor" />
            </div>
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground text-glow">
              Aprofunde a leitura territorial do seu setor.
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
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
                Solicitar proposta formal
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
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
