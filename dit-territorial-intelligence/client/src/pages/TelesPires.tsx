/**
 * Teles Pires Territory Detail Page
 * Design: Minimalista Tech
 * STT 84 - Complexidade Territorial Crítica
 * Versão pública - sem dados sensíveis
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import STTGauge from "@/components/STTGauge";
import { 
  ArrowRight, 
  Zap,
  AlertTriangle,
  Users,
  Droplet,
  Shield,
  TrendingUp
} from "lucide-react";
import { Link } from "wouter";

export default function TelesPires() {
  const indices = [
    { code: "ITT", name: "Índice de Tensão Territorial", level: "CRÍTICO", color: "text-red-600", bg: "bg-red-100" },
    { code: "ICS", name: "Índice de Coesão Social", level: "ALTO", color: "text-orange-600", bg: "bg-orange-100" },
    { code: "IVS", name: "Índice de Vulnerabilidade Social", level: "ALTO", color: "text-orange-600", bg: "bg-orange-100" },
    { code: "IVE", name: "Índice de Visibilidade Externa", level: "ELEVADO", color: "text-yellow-600", bg: "bg-yellow-100" },
    { code: "ICI", name: "Índice de Complexidade Institucional", level: "ALTO", color: "text-orange-600", bg: "bg-orange-100" },
  ];

  const territorialProfile = [
    { dimension: "Sensibilidade Sociocultural", classification: "Crítica" },
    { dimension: "Dependência Ambiental", classification: "Elevada" },
    { dimension: "Capacidade de Mobilização", classification: "Alta" },
    { dimension: "Confiança Relacional", classification: "Fragilizada" },
    { dimension: "Complexidade Institucional", classification: "Alta" },
  ];

  const scenarios = [
    {
      name: "Reconstrução Gradual",
      description: "Retomada progressiva de confiança mediante diálogo consistente",
      probability: "Condicionado"
    },
    {
      name: "Instabilidade Latente",
      description: "Manutenção de tensão estrutural, com ativação pontual",
      probability: "Provável"
    },
    {
      name: "Reativação Crítica",
      description: "Novo episódio de ruptura caso percepções não sejam enfrentadas",
      probability: "Possível"
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center overflow-hidden bg-neural-pattern pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />

        <div className="container relative z-10">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            {/* Left: Info */}
            <div className="flex flex-col justify-center">
              <div className="mb-6">
                <Link href="/" className="inline-flex items-center gap-2 font-body text-sm font-medium text-muted-foreground transition-all hover:text-foreground">
                  ← Voltar para territórios
                </Link>
              </div>

              <div className="mb-8 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 glass">
                <Droplet className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                  Território Estratégico
                </span>
              </div>

              <h1 className="mb-6 font-display text-6xl font-bold leading-tight tracking-tight text-foreground lg:text-7xl">
                Bacia do Rio Teles Pires
              </h1>

              <p className="mb-8 font-body text-xl leading-relaxed text-muted-foreground">
                Território de <span className="font-bold text-red-600">elevada sensibilidade sociocultural e ambiental</span>, 
                com complexidade institucional e alta capacidade de mobilização comunitária.
              </p>

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
                  Solicitar proposta formal
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Right: Gauge */}
            <div className="flex items-center justify-center">
              <STTGauge score={84} label="Bacia do Rio Teles Pires" size="xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Interpretação Executiva */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground">
              Interpretação Executiva
            </h2>
          </div>

          <div className="glass rounded-2xl p-10 space-y-6">
            <p className="font-body text-lg leading-relaxed text-foreground">
              A Bacia do Rio Teles Pires configura território onde:
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-border/50 bg-card/50">
                <CardContent className="p-6 text-center">
                  <Shield className="mx-auto mb-3 h-8 w-8 text-primary" />
                  <p className="font-body text-sm font-medium text-foreground">
                    A comunicação é componente estrutural da estabilidade
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card/50">
                <CardContent className="p-6 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 text-primary" />
                  <p className="font-body text-sm font-medium text-foreground">
                    A confiança é variável crítica
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/50 bg-card/50">
                <CardContent className="p-6 text-center">
                  <TrendingUp className="mx-auto mb-3 h-8 w-8 text-primary" />
                  <p className="font-body text-sm font-medium text-foreground">
                    A percepção comunitária influencia diretamente a governabilidade
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Índices Proprietários */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground">
              Índices Proprietários
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {indices.map((index, idx) => (
              <Card key={idx} className="glass border-border/50">
                <CardHeader>
                  <div className={`mb-2 inline-flex w-fit rounded-lg ${index.bg} px-3 py-1`}>
                    <span className={`font-mono text-sm font-bold ${index.color}`}>
                      {index.code}
                    </span>
                  </div>
                  <CardTitle className="font-body text-base font-medium text-foreground">
                    {index.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className={`font-display text-2xl font-bold ${index.color}`}>
                    {index.level}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Arquitetura Territorial */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground">
              Arquitetura Territorial
            </h2>
          </div>

          <div className="glass rounded-2xl p-10 space-y-8">
            <div>
              <h3 className="mb-4 font-display text-2xl font-bold text-foreground">
                Estrutura Sociocultural
              </h3>
              <p className="mb-6 font-body text-base leading-relaxed text-muted-foreground">
                Território caracterizado por múltiplas comunidades tradicionais com forte identidade cultural 
                e vínculos históricos com o rio e seus recursos naturais.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/50 bg-card/50 p-5">
                  <Users className="mb-3 h-6 w-6 text-primary" />
                  <p className="font-body text-sm font-medium text-foreground">
                    Múltiplas comunidades tradicionais
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/50 p-5">
                  <Shield className="mb-3 h-6 w-6 text-primary" />
                  <p className="font-body text-sm font-medium text-foreground">
                    Forte identidade territorial
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/50 p-5">
                  <Droplet className="mb-3 h-6 w-6 text-primary" />
                  <p className="font-body text-sm font-medium text-foreground">
                    Dependência direta do rio
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/50 p-5">
                  <AlertTriangle className="mb-3 h-6 w-6 text-primary" />
                  <p className="font-body text-sm font-medium text-foreground">
                    Alta capacidade de mobilização
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-border/40 pt-8">
              <h3 className="mb-4 font-display text-2xl font-bold text-foreground">
                Sensibilidades Ambientais
              </h3>
              <p className="mb-4 font-body text-base leading-relaxed text-muted-foreground">
                A ictiofauna e a dinâmica do rio são elementos centrais da segurança alimentar e identidade cultural. 
                Alterações percebidas no ecossistema ativam tensão territorial.
              </p>
              <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-5">
                <p className="font-body text-sm font-medium text-blue-900">
                  <span className="font-bold">Atenção:</span> A pesca é fonte de proteína, 
                  elemento cultural e componente de segurança alimentar. Qualquer mudança percebida 
                  no ecossistema aquático gera preocupação comunitária.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Perfil Territorial */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground">
              Perfil Territorial Sintético
            </h2>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-card/50">
                  <tr>
                    <th className="px-6 py-4 text-left font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Dimensão
                    </th>
                    <th className="px-6 py-4 text-right font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Classificação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {territorialProfile.map((item, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-card/30">
                      <td className="px-6 py-4 font-body text-base font-medium text-foreground">
                        {item.dimension}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex rounded-full px-4 py-1 font-mono text-sm font-bold ${
                          item.classification === "Crítica" ? "bg-red-100 text-red-800" :
                          item.classification === "Fragilizada" ? "bg-orange-100 text-orange-800" :
                          item.classification === "Elevada" || item.classification === "Alta" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {item.classification}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Cenários Territoriais */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground">
              Cenários Territoriais Estruturais
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">
              Sem recomendação operacional. Apenas leitura estrutural.
            </p>
          </div>

          <div className="space-y-6">
            {scenarios.map((scenario, idx) => (
              <Card key={idx} className="glass border-border/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="mb-2 font-display text-2xl font-bold text-foreground">
                        Cenário {idx + 1} — {scenario.name}
                      </CardTitle>
                      <p className="font-body text-base text-muted-foreground">
                        {scenario.description}
                      </p>
                    </div>
                    <span className="flex-shrink-0 rounded-lg bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
                      {scenario.probability}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Consideração Final */}
      <section className="relative bg-gradient-to-br from-red-500/10 via-orange-500/10 to-background py-24">
        <div className="container max-w-4xl">
          <div className="glass rounded-2xl p-12 text-center space-y-6">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-600" />
            <h2 className="font-display text-4xl font-bold tracking-tight text-foreground">
              Consideração Executiva Final
            </h2>
            <div className="space-y-4">
              <p className="font-body text-lg leading-relaxed text-muted-foreground">
                A Bacia do Rio Teles Pires não é território apenas ambientalmente sensível.
              </p>
              <p className="font-body text-lg leading-relaxed text-foreground">
                É território <span className="font-bold text-red-600">relacionalmente sensível</span>, 
                culturalmente estruturado e simbolicamente ancorado no rio.
              </p>
              <div className="pt-4">
                <p className="font-display text-3xl font-bold text-red-600">
                  STT 84 = Complexidade Crítica
                </p>
                <p className="mt-4 font-body text-lg font-medium text-foreground">
                  Qualquer atuação deve considerar que, neste território, 
                  <span className="font-bold text-primary"> confiança é variável estrutural.</span>
                </p>
              </div>
            </div>

            <div className="pt-8">
              <h3 className="mb-6 font-display text-2xl font-bold text-foreground">
                Investimento sob consulta
              </h3>
              <p className="mb-8 font-body text-base text-muted-foreground">
                Comercialização limitada por categoria de atuação no território.
              </p>
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
              <Link href="/" className="transition-all hover:text-foreground">
                Territórios
              </Link>
              <Link href="/sse" className="transition-all hover:text-foreground">
                SSE™
              </Link>
              <Link href="/metodologia" className="transition-all hover:text-foreground">
                Metodologia
              </Link>
              <Link href="/sobre" className="transition-all hover:text-foreground">
                Sobre
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
