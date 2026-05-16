import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import SignalFeed from "@/components/SignalFeed";
import DiagnosisReport, { type DitAnalyzeResult } from "@/components/DiagnosisReport";
import {
  Search,
  ArrowRight,
  Zap,
  ShieldCheck,
  BarChart3,
  AlertTriangle,
  Radio,
  Target,
  Loader2
} from "lucide-react";

// ── Loading steps (replicam o UX de pesquisa.html — 30-60s de análise real)
const LOADING_STEPS = [
  { icon: "🌐", title: "Identificando no IBGE",        detail: "Localizando município, estado e região geográfica..." },
  { icon: "🤖", title: "Ativando 32 agentes PRINT",     detail: "D1 Socioambiental · D2 Socioeconômica · D3 Infraestrutura..." },
  { icon: "📊", title: "Processando fontes oficiais",   detail: "IBAMA · CEMADEN · IBGE · DataSUS · INEP · Querido Diário..." },
  { icon: "🧮", title: "Calculando STT com orquestrador", detail: "6 dimensões consolidadas · Σ(Di × Wi)..." },
  { icon: "✍️", title: "Gerando análise executiva",     detail: "IA PRINT sintetizando diagnóstico e recomendações..." },
];
// Marcos de tempo em ms (cumulativos) — quando cada step entra em "running"
const STEP_MARKS = [0, 4000, 14000, 34000, 49000];

export default function LandingSimple() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DitAnalyzeResult | null>(null);
  const timersRef = useRef<number[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Limpa timers quando o componente desmonta
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  function clearTimers() {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
  }

  function startProgress() {
    setActiveStep(0);
    setElapsed(0);
    // Agenda transições entre steps
    STEP_MARKS.forEach((ms, i) => {
      const handle = window.setTimeout(() => setActiveStep(i), ms);
      timersRef.current.push(handle);
    });
    // Contador de segundos
    const interval = window.setInterval(() => setElapsed(e => e + 1), 1000);
    timersRef.current.push(interval);
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q || isSearching) return;

    setIsSearching(true);
    setError(null);
    setResult(null);
    clearTimers();
    startProgress();

    try {
      const res = await fetch("/api/dit/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ territory: q }),
      });
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((errPayload as { error?: string }).error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as DitAnalyzeResult;
      // Completa todos os steps visualmente antes de mostrar
      setActiveStep(LOADING_STEPS.length);
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha na conexão com o servidor DIT";
      setError(msg);
    } finally {
      clearTimers();
      setIsSearching(false);
    }
  };

  // Scroll para o relatório quando aparecer
  useEffect(() => {
    if (result && reportRef.current) {
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [result]);

  const socialProof = [
    {
      territory: "Macaé - RJ",
      summary: "Pressão estrutural elevada em Cabiúnas devido ao avanço de novos terminais logísticos e conflitos de uso do solo com comunidades tradicionais de pescadores. O score ITT (Infraestrutura) atingiu 82 pontos.",
      stt: 78
    },
    {
      territory: "Alagoinhas - BA",
      summary: "Complexidade hídrica crítica. O cruzamento de dados industriais com o IVE (Vulnerabilidade Econômica) revela uma saturação iminente dos aquíferos locais, exigindo novas estratégias de governança regional.",
      stt: 64
    },
    {
      territory: "Bacia do Teles Pires - MT/PA",
      summary: "Cenário de escalada sistêmica. A expansão da fronteira agrícola sobre terras indígenas e áreas de preservação ambiental ativou 4 das 6 dimensões de risco em 24 meses.",
      stt: 89
    }
  ];

  const products = [
    {
      id: "radar",
      title: "Radar Territorial™",
      description: "Monitoramento contínuo com alertas mensais de ativação. Não seja pego de surpresa por mudanças no território.",
      icon: Radio,
      path: "/radar",
      color: "text-primary"
    },
    {
      id: "sse",
      title: "SSE™ - Setorial",
      description: "Exposição socio-territorial específica para o seu setor (Energia, Logística, Saneamento).",
      icon: Target,
      path: "/sse",
      color: "text-accent"
    },
    {
      id: "dit",
      title: "DIT Completo",
      description: "Diagnóstico profundo e fundacional. O ponto de partida para qualquer operação de grande porte.",
      icon: ShieldCheck,
      path: "/",
      color: "text-foreground"
    }
  ];

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      <Header />

      {/* Hero Section */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-4 pt-20">
        <div className="absolute inset-0 -z-10 bg-neural-pattern opacity-10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background/80 to-background" />

        <div className="container max-w-4xl space-y-12 text-center">
          <div className="space-y-6">
            <h1 className="font-display text-5xl font-bold leading-tight tracking-tight text-foreground lg:text-7xl text-glow">
              Conheça o território <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                em que você está inserido.
              </span>
            </h1>
            <p className="mx-auto max-w-2xl font-body text-xl text-muted-foreground lg:text-2xl">
              Inteligência territorial direta e precisa. O diagnóstico antes da decisão.
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative mx-auto max-w-2xl">
            <div className="group relative overflow-hidden rounded-2xl bg-card p-1 shadow-2xl transition-all hover:shadow-primary/20 border border-border/50">
              <div className="flex items-center gap-2 px-4">
                <Search className="h-6 w-6 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Pesquisar território (ex: Baía de Guanabara, Macaé...)"
                  className="h-16 border-none bg-transparent font-body text-lg focus-visible:ring-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isSearching}
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSearching}
                  className="hidden h-12 bg-primary px-8 font-bold sm:flex glow"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Pesquisar"
                  )}
                </Button>
              </div>
            </div>
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              <span className="text-primary font-bold animate-pulse">●</span> DIT Engine ativado e monitorando 47 territórios estratégicos
            </p>
          </form>

          {/* Loading panel — visível durante a análise */}
          {isSearching && (
            <div className="mx-auto max-w-2xl rounded-2xl border border-primary/30 bg-card/60 p-6 text-left glass">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                  Gerando diagnóstico · {searchQuery.toUpperCase()}
                </div>
              </div>
              <div className="space-y-2">
                {LOADING_STEPS.map((s, i) => {
                  const state = i < activeStep ? "done" : i === activeStep ? "running" : "pending";
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm flex-shrink-0 ${
                          state === "done"
                            ? "bg-primary/20 text-primary"
                            : state === "running"
                              ? "bg-accent/20 text-accent animate-pulse"
                              : "bg-muted/30 text-muted-foreground/40"
                        }`}
                      >
                        {state === "done" ? "✓" : s.icon}
                      </div>
                      <div className="flex-1">
                        <div
                          className={`font-mono text-xs font-bold uppercase tracking-wider ${
                            state === "pending" ? "text-muted-foreground/40" : state === "running" ? "text-accent" : "text-primary"
                          }`}
                        >
                          {s.title}
                        </div>
                        <div className={`text-xs ${state === "pending" ? "text-muted-foreground/30" : "text-muted-foreground"}`}>
                          {s.detail}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 font-mono text-[10px] text-muted-foreground/60">
                Analisando há {elapsed}s · Estimativa: 30–60 segundos
              </div>
            </div>
          )}

          {/* Erro */}
          {error && !isSearching && (
            <div className="mx-auto max-w-2xl rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-left">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-xs font-bold uppercase tracking-wider text-destructive mb-1">
                    Não foi possível gerar o diagnóstico
                  </div>
                  <div className="text-sm text-foreground/80">{error}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Tente novamente em alguns instantes ou ajuste o nome do território.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Relatório inline — substitui o redirect para /pesquisa.html */}
      {result && (
        <section ref={reportRef} className="border-t border-border/40">
          <DiagnosisReport result={result} />
        </section>
      )}

      {/* Social Proof & Intelligence Sections */}
      <section className="border-t border-border/40 bg-card/10 py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-neural-pattern opacity-5" />
        <div className="container relative z-10">
          <div className="grid gap-16 lg:grid-cols-2">
            {/* Left: Signal Feed (The 'Intelligence' part) */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 glass">
                  <Radio className="h-4 w-4 text-primary" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">Live Engine Feed</span>
                </div>
                <h2 className="font-display text-4xl font-bold tracking-tight text-glow">
                  Inteligência em Tempo Real
                </h2>
                <p className="font-body text-lg text-muted-foreground">
                  Nossa IA processa milhares de sinais diários para detectar variações na complexidade territorial. O feed abaixo mostra o processamento ao vivo.
                </p>
              </div>
              <SignalFeed maxItems={6} />
              <div className="flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-6 glass">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold">Score STT Dinâmico</p>
                  <p className="font-body text-sm text-muted-foreground">Variações capturadas mensalmente para assinantes Radar™.</p>
                </div>
              </div>
            </div>

            {/* Right: Social Proof */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 glass">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">Prova Social</span>
                </div>
                <h2 className="font-display text-4xl font-bold tracking-tight text-glow">
                  Casos de Sucesso DIT
                </h2>
                <p className="font-body text-lg text-muted-foreground">
                  O que a inteligência territorial já entregou para operações reais de alto impacto.
                </p>
              </div>

              <div className="grid gap-6">
                {socialProof.map((item, idx) => (
                  <Card key={idx} className="glass border-border/50 transition-all hover:border-primary/30 hover:scale-[1.02]">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-display text-xl font-bold text-primary">
                          {item.territory}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-muted-foreground">STT</span>
                          <span className="font-mono text-xl font-bold text-glow">{item.stt}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="font-body text-sm leading-relaxed text-muted-foreground italic">
                        "{item.summary}"
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence Ecosystem */}
      <section className="border-t border-border/40 bg-background py-24 relative">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center space-y-4">
            <h2 className="font-display text-5xl font-bold tracking-tight text-glow">Ecossistema de Inteligência</h2>
            <p className="font-body text-xl text-muted-foreground">Da análise profunda ao monitoramento contínuo.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {products.map((product) => (
              <a key={product.id} href={product.path} className="group">
                <Card className="glass h-full border-border/40 transition-all group-hover:-translate-y-2 group-hover:border-primary/50 group-hover:shadow-2xl">
                  <CardHeader>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/20 group-hover:bg-primary/10 transition-colors">
                      <product.icon className={`h-10 w-10 ${product.color} transition-all group-hover:scale-110`} />
                    </div>
                    <CardTitle className="font-display text-2xl font-bold">{product.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-body text-base text-muted-foreground leading-relaxed">
                      {product.description}
                    </p>
                    <div className="mt-8 flex items-center gap-2 font-mono text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-all">
                      SAIBA MAIS <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40 bg-card/20 py-24">
        <div className="container max-w-4xl text-center space-y-8">
          <h2 className="font-display text-5xl font-bold tracking-tight text-glow">
            Pronto para inteligenciar seu território?
          </h2>
          <p className="mx-auto max-w-2xl font-body text-xl text-muted-foreground">
            O DIT é o ponto de partida. Radar e SSE são a sua base de operações contínua.
          </p>
          <Button size="lg" className="glow h-16 bg-primary px-12 text-lg font-bold">
            Agendar Conversa Estratégica
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/40 py-20 bg-card/30">
        <div className="container">
          <div className="flex flex-col items-center justify-between gap-10 md:flex-row">
            <div className="flex flex-col items-center gap-3 md:items-start">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 glow">
                  <Zap className="h-6 w-6 text-primary" fill="currentColor" />
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-2xl font-bold leading-none tracking-tight">PRINT</span>
                  <span className="font-mono text-[10px] font-medium leading-none tracking-widest text-accent uppercase">Territorial Intelligence</span>
                </div>
              </div>
            </div>

            <div className="flex gap-8 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Metodologia</a>
              <a href="#" className="hover:text-primary transition-colors">Privacidade</a>
              <a href="#" className="hover:text-primary transition-colors">Termos</a>
            </div>

            <p className="font-body text-sm text-muted-foreground">
              © 2026 Print. A inteligência que precede a operação.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
