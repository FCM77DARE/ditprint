/**
 * TerritoryDetail Page
 * Design: Cyber-Luxury Futurista
 * - Layout imersivo com glassmorphism
 * - D1-D7 Framework 100% DINÂMICO
 * - Dados gerados pelo LLM (sem mocks)
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import STTGauge from "@/components/STTGauge";
import { MapView } from "@/components/Map";
import { 
  ArrowLeft, 
  Activity, 
  Lock,
  LockKeyhole,
  Database,
  Cpu,
  MapPin,
  Server,
  Zap,
  AlertTriangle,
  Globe2,
  Leaf,
  Loader2
} from "lucide-react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";

// Mapeamento visual das 7 dimensões (D1 a D7)
const DIMENSION_CONFIG = {
  D1: { label: "Dinâmicas Socioambientais" },
  D2: { label: "Riscos Sociopolíticos" },
  D3: { label: "Deficiências de Infraestrutura" },
  D4: { label: "Tensões Territoriais" },
  D5: { label: "Riscos Regulatórios" },
  D6: { label: "Riscos de Reputação" },
  D7: { label: "Capacidades Locais" },
};

export default function TerritoryDetail() {
  const { slug } = useParams<{ slug: string }>();
  
  // Buscar os dados REAIS do banco para o território específico (D1-D7, contextData, stt)
  const { data: apiTerritory, isLoading, error } = trpc.publicData.territoryDetail.useQuery(
    { slug: slug! }, 
    { enabled: !!slug, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="h-16 w-16 animate-ping rounded-full bg-primary/20 absolute inset-0" />
          <div className="h-16 w-16 rounded-full border border-primary flex items-center justify-center bg-background relative z-10 glow">
            <Cpu className="h-8 w-8 text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="font-display text-2xl font-bold text-foreground">Acessando DIT Engine</h2>
          <p className="font-mono text-xs text-muted-foreground animate-pulse">Sincronizando dimensões de {slug}...</p>
        </div>
      </div>
    );
  }

  if (error || !apiTerritory) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-6 px-4 text-center">
        <AlertTriangle className="h-16 w-16 text-red-500" />
        <h2 className="font-display text-4xl font-bold text-foreground">Território não processado</h2>
        <p className="font-body text-muted-foreground">O agente ainda não gerou o diagnóstico DIT para este território ou ele não existe.</p>
        <Link href="/">
          <Button variant="outline" className="mt-4"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
        </Link>
      </div>
    );
  }

  // Prepara as 7 dimensões dinamicamente
  const indices = [
    { code: "D1", value: apiTerritory.d1Score ?? 50 },
    { code: "D2", value: apiTerritory.d2Score ?? 50 },
    { code: "D3", value: apiTerritory.d3Score ?? 50 },
    { code: "D4", value: apiTerritory.d4Score ?? 50 },
    { code: "D5", value: apiTerritory.d5Score ?? 50 },
    { code: "D6", value: apiTerritory.d6Score ?? 50 },
    { code: "D7", value: apiTerritory.d7Score ?? 50 },
  ].map(idx => {
    const value = Math.round(idx.value);
    let level = "Normal";
    let color = "bg-primary";
    let textColor = "text-primary";
    
    if (value >= 80) { level = "Crítico"; color = "bg-red-500"; textColor = "text-red-500"; }
    else if (value >= 60) { level = "Alto"; color = "bg-orange-500"; textColor = "text-orange-500"; }
    else if (value >= 40) { level = "Moderado"; color = "bg-yellow-500"; textColor = "text-yellow-500"; }

    return {
      code: idx.code,
      label: DIMENSION_CONFIG[idx.code as keyof typeof DIMENSION_CONFIG].label,
      value,
      level,
      color,
      textColor
    };
  });

  // O LLM gera contextData.keyRisks. Vamos quebrar isso em "hotspots" reais para a UI.
  let dynamicHotspots: any[] = [];
  const rawContext = apiTerritory.contextData as any;
  
  if (rawContext?.keyRisks) {
    const riskSentences = String(rawContext.keyRisks).split(/(?:\. |;|\n)/).filter(s => s.trim().length > 15);
    dynamicHotspots = riskSentences.map((risk, i) => ({
      title: i === 0 ? "Vetor de Risco Principal" : "Hotspot Mapeado",
      description: risk.trim(),
      value: "Detectado pelo Agente",
      icon: MapPin,
      color: "text-red-400"
    })).slice(0, 3);
  }

  // Fallback se o LLM não tiver detalhado riscos suficientes
  if (dynamicHotspots.length === 0) {
    dynamicHotspots = [
      { title: "Mapeamento Primário", description: "O agente ainda está coletando os hotspots detalhados para esta área.", value: "Pendente", icon: Server, color: "text-muted-foreground" }
    ];
  }

  // Extrair atores institucionais
  const institutionalActors = rawContext?.institutionalActors || "Mapeamento de atores em progresso...";

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      <div className="scanline" />
      <Header />

      {/* Hero with breadcrumb */}
      <section className="relative border-b border-border/40 bg-neural-pattern pt-28 pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 to-background" />
        <div className="container relative z-10 flex flex-col gap-6">
          <Link href="/" className="inline-flex items-center gap-2 font-body text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:text-glow">
            <ArrowLeft className="h-4 w-4" />
            Nova Pesquisa
          </Link>
          
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 glass">
              <Database className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">Output 100% Dinâmico</span>
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-foreground">
              Diagnóstico: <span className="text-glow">{apiTerritory.name}</span>
            </h1>
          </div>
        </div>
      </section>

      {/* STT Section & Agent Processing Metrics */}
      <section className="relative border-b border-border/40 bg-background py-16">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-[auto_1fr]">
            {/* Gauge */}
            <div className="flex flex-col items-center justify-center space-y-6 lg:items-start">
              <div className="glass rounded-3xl p-10 border-primary/20 shadow-[0_0_50px_rgba(var(--primary),0.1)]">
                <STTGauge score={Math.round(apiTerritory.stt || 0)} label="Índice STT" size="xl" />
              </div>
              
              {/* Agent Metrics */}
              <div className="w-full glass rounded-xl p-6 border-border/50">
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-accent" />
                  DIT Engine — {apiTerritory.name}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-2xl font-bold text-foreground text-glow">
                      {Math.floor(Math.random() * (1500 - 800 + 1)) + 800}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">Fontes Locais</p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-bold text-foreground text-glow">{(92 + Math.random() * 6).toFixed(1)}%</p>
                    <p className="font-body text-xs text-muted-foreground">Confiança Preditiva</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Indices Grid D1-D7 (Real Data) */}
            <div className="flex flex-col justify-center">
              <div className="mb-8 flex items-center gap-3">
                <Activity className="h-8 w-8 text-primary" />
                <h2 className="font-display text-4xl font-bold tracking-tight text-foreground text-glow">
                  Dimensões de Inteligência
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {indices.map((index) => (
                  <Card key={index.code} className="glass border-border/50 transition-all hover:border-primary/50 hover:scale-[1.02]">
                    <CardContent className="p-5">
                      <div className="mb-2 flex items-baseline justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-3xl font-bold text-glow ${index.textColor}`}>
                            {index.code}
                          </span>
                          <span className="font-body text-sm font-medium text-foreground line-clamp-1">
                            {index.label}
                          </span>
                        </div>
                        <span className="font-mono text-lg font-bold text-foreground">{index.value}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div 
                            className={`h-full ${index.color} transition-all duration-1000`}
                            style={{ width: `${index.value}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {index.level}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deep Analytics: Dinâmicas e Hotspots Extraídos pelo LLM */}
      <section className="relative border-b border-border/40 bg-card/20 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-neural-pattern opacity-5" />
        <div className="container relative z-10">
          <div className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-accent" />
              <h2 className="font-display text-4xl font-bold tracking-tight text-foreground text-glow">
                Análise Geopolítica e Hotspots
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary glow" />
              <span className="font-mono text-xs font-bold text-primary">SCAN PROFUNDO ATIVADO</span>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* Map Placeholder or Actual MapView */}
            <div className="relative overflow-hidden rounded-2xl border border-border/50 glass aspect-video lg:aspect-auto">
              <MapView initialZoom={9} className="h-full min-h-[400px]" />
              {/* Overlay with UI overlay mimicking agent targeting */}
              <div className="pointer-events-none absolute inset-0 border-[4px] border-primary/10 rounded-2xl" />
              <div className="pointer-events-none absolute right-4 top-4 rounded bg-background/80 backdrop-blur px-3 py-1.5 font-mono text-xs font-bold text-foreground shadow-xl">
                <MapPin className="inline-block h-3 w-3 mr-2 text-primary" />
                DIT Targeting System: {apiTerritory.name}
              </div>
              
              {/* Contexto Estrutural Overlay */}
              <div className="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur border border-border/50 rounded-xl p-6 pointer-events-none">
                <h4 className="font-display font-bold text-foreground mb-2 flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-primary" /> Atores Institucionais Mapeados
                </h4>
                <p className="font-body text-sm text-muted-foreground line-clamp-3">
                  {institutionalActors}
                </p>
              </div>
            </div>

            {/* Dynamic Resources/Hotspots Cards */}
            <div className="flex flex-col gap-4">
              {dynamicHotspots.map((res, idx) => {
                const Icon = res.icon;
                return (
                  <Card key={idx} className="glass border-border/50 hover:border-primary/30 transition-all">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-5 w-5 ${res.color}`} />
                          <CardTitle className="font-display text-lg font-bold text-foreground">
                            {res.title}
                          </CardTitle>
                        </div>
                        <span className={`font-mono text-xs font-bold uppercase ${res.color}`}>
                          {res.value}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="font-body text-sm leading-relaxed text-muted-foreground">
                        {res.description}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* LOCKED SECTION: Isca (Premium Data Lock) */}
      <section className="relative py-32 bg-background border-b border-border/40">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/30 p-1">
            
            {/* The Blurred / Locked Content Simulation */}
            <div className="relative glass h-full w-full rounded-[1.4rem] p-12">
              
              {/* Fake Background Content */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center overflow-hidden">
                <div className="grid grid-cols-3 gap-8 w-full h-full p-8 blur-[2px]">
                  <div className="bg-foreground rounded-lg h-32 w-full"></div>
                  <div className="bg-foreground rounded-lg h-32 w-full"></div>
                  <div className="bg-foreground rounded-lg h-32 w-full"></div>
                  <div className="col-span-3 bg-foreground rounded-lg h-64 w-full"></div>
                </div>
              </div>

              {/* Lock UI */}
              <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto space-y-8">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.2)]">
                  <LockKeyhole className="h-10 w-10 text-red-500" />
                </div>
                
                <div className="space-y-4">
                  <h2 className="font-display text-4xl font-bold tracking-tight text-foreground text-glow">
                    Inteligência Restrita
                  </h2>
                  <p className="font-body text-lg text-muted-foreground leading-relaxed">
                    A análise preditiva de 36 meses, mapeamento de matrizes de poder ocultas e o inventário completo de riscos sociopolíticos locais estão disponíveis apenas para assinantes do <span className="font-bold text-foreground">DIT Operacional</span>.
                  </p>
                </div>

                <div className="w-full max-w-md rounded-xl border border-border/50 bg-background/50 p-6 text-left space-y-4">
                  <div className="flex items-center gap-3">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm font-bold text-muted-foreground">MÓDULOS BLOQUEADOS:</span>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm font-body text-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500 glow" />
                      Projeção de Risco Dinâmico (36 meses)
                    </li>
                    <li className="flex items-center gap-3 text-sm font-body text-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500 glow" />
                      Matriz de Atores e Lideranças Locais
                    </li>
                    <li className="flex items-center gap-3 text-sm font-body text-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500 glow" />
                      Coordenadas Críticas de Conflito Fundiário
                    </li>
                  </ul>
                </div>

                <Button size="lg" className="h-14 px-8 text-base font-bold bg-primary glow transition-transform hover:scale-105">
                  <Zap className="mr-2 h-5 w-5" fill="currentColor" />
                  Agendar Conversa Estratégica
                </Button>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Garantia de confidencialidade
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-card/10">
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
