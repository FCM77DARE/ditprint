/**
 * Methodology Page
 * Design: Minimalista Tech
 * - Explicação detalhada do cálculo do STT
 * - Índices componentes e validação técnica
 * - Reforça credibilidade científica
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import { 
  ArrowRight,
  Calculator,
  Database,
  Shield,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Layers,
  BarChart3,
  FileCheck
} from "lucide-react";

export default function Methodology() {
  const indices = [
    {
      code: "D1",
      name: "Socioambiental",
      description: "Mede impactos ambientais, clima e fiscalização do território",
      weight: "20%",
      variables: ["Bioma e Clima", "Passivos Ambientais", "Unidades de Conservação"],
      icon: Shield,
      color: "text-green-600"
    },
    {
      code: "D2",
      name: "Socioeconômica",
      description: "Avalia densidade demográfica, pobreza e desenvolvimento social",
      weight: "14%",
      variables: ["Demografia", "Emprego e Renda", "Índice de Gini"],
      icon: Layers,
      color: "text-orange-600"
    },
    {
      code: "D3",
      name: "Infraestrutura",
      description: "Analisa capacidades urbanas, saneamento e logística",
      weight: "14%",
      variables: ["Saneamento", "Habitação", "Portos e Transportes"],
      icon: Database,
      color: "text-blue-600"
    },
    {
      code: "D4",
      name: "Dinâmica Territorial",
      description: "Mapeia conflitos, uso do solo e segurança pública",
      weight: "20%",
      variables: ["Plano Diretor", "Segurança", "Comunidades Tradicionais"],
      icon: AlertTriangle,
      color: "text-red-600"
    },
    {
      code: "D5",
      name: "Governança",
      description: "Mede o engajamento cívico e a capacidade institucional",
      weight: "12%",
      variables: ["Transparência", "Conselhos", "Audiências Públicas"],
      icon: FileCheck,
      color: "text-purple-600"
    },
    {
      code: "D6",
      name: "Reputação",
      description: "Dimensiona a exposição midiática e o interesse digital",
      weight: "10%",
      variables: ["Notícias", "Redes Sociais", "Estudos Universitários"],
      icon: TrendingUp,
      color: "text-teal-600"
    },
    {
      code: "D7",
      name: "Recursos Naturais e Potencial",
      description: "Potencial para minerais estratégicos e tecnologias emergentes",
      weight: "10%",
      variables: ["Terras Raras", "Energia Limpa", "Data Centers"],
      icon: TrendingUp,
      color: "text-cyan-600"
    }
  ];

  const validationSteps = [
    "Coleta de dados primários e secundários de fontes oficiais",
    "Normalização estatística (0-100) para cada variável",
    "Aplicação de pesos calibrados por especialistas",
    "Validação cruzada com estudos de caso históricos",
    "Revisão por pares externos independentes"
  ];

  const interpretationLevels = [
    { range: "0-39", level: "Baixa Complexidade", description: "Território com estrutura simplificada e baixa tensão", color: "bg-green-100 text-green-800 border-green-300" },
    { range: "40-59", level: "Complexidade Moderada", description: "Presença de camadas estruturais que exigem atenção", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    { range: "60-79", level: "Alta Complexidade", description: "Múltiplas camadas ativadas e risco elevado", color: "bg-orange-100 text-orange-800 border-orange-300" },
    { range: "80-100", level: "Complexidade Crítica", description: "Território altamente sensível e estruturalmente denso", color: "bg-red-100 text-red-800 border-red-300" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative flex min-h-[60vh] items-center overflow-hidden bg-neural-pattern pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />

        <div className="container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 glass">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                  Metodologia Científica
                </span>
              </div>
            </div>

            <h1 className="mb-6 font-display text-6xl font-bold leading-tight tracking-tight text-foreground lg:text-7xl">
              Como calculamos o STT
            </h1>

            <p className="mx-auto max-w-2xl font-body text-xl leading-relaxed text-muted-foreground">
              O Score de Território Total (STT) é um índice proprietário que consolida{" "}
              <span className="font-bold text-primary">sete dimensões estruturais</span> em uma métrica única de complexidade territorial.
            </p>
          </div>
        </div>
      </section>

      {/* Fórmula do STT */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground">
              Fórmula do STT
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">
              Índice composto por sete dimensões dinamicamente ponderadas
            </p>
          </div>

          <div className="glass rounded-2xl p-12">
            <div className="mb-8 flex justify-center">
              <div className="rounded-xl bg-primary/10 px-8 py-6 font-mono text-2xl font-bold text-primary">
                STT = (D1×20%) + (D2×14%) + (D3×14%) + (D4×20%) + (D5×12%) + (D6×10%) + (D7×10%)
              </div>
            </div>

            <div className="space-y-4 text-center">
              <p className="font-body text-lg text-muted-foreground">
                Cada índice varia de <span className="font-bold text-foreground">0 a 100</span>, 
                resultando em um STT final também na escala <span className="font-bold text-foreground">0-100</span>.
              </p>
              <p className="font-body text-base text-muted-foreground">
                A distribuição de pesos reflete a relevância crítica das dinâmicas socioambientais (D1) e tensões territoriais (D4), complementadas por capacidades locais e potenciais inerentes (D7).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Índices Componentes */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container">
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2">
              <BarChart3 className="h-4 w-4 text-accent" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                Componentes
              </span>
            </div>
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground">
              As sete dimensões do STT
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">
              Cada índice captura uma dimensão específica da complexidade territorial
            </p>
          </div>

          <div className="mx-auto max-w-6xl space-y-6">
            {indices.map((index, idx) => (
              <Card key={idx} className="glass border-border/50 transition-all hover:border-primary/30 hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-${index.color.split('-')[1]}-100`}>
                      <index.icon className={`h-6 w-6 ${index.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
                          {index.code}
                        </CardTitle>
                        <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
                          {index.weight}
                        </span>
                      </div>
                      <p className="font-body text-lg font-medium text-foreground">
                        {index.name}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 font-body text-base text-muted-foreground">
                    {index.description}
                  </p>
                  <div className="space-y-2">
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Variáveis consideradas:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {index.variables.map((variable, vIdx) => (
                        <span
                          key={vIdx}
                          className="rounded-lg border border-border bg-card px-3 py-1 font-body text-sm text-foreground"
                        >
                          {variable}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Validação Técnica */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2">
              <FileCheck className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                Rigor Científico
              </span>
            </div>
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground">
              Processo de Validação
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">
              Metodologia validada por especialistas e testada em múltiplos territórios
            </p>
          </div>

          <div className="glass rounded-2xl p-10">
            <div className="space-y-4">
              {validationSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-4 rounded-lg border border-border/50 bg-card/50 p-5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-sm font-bold text-primary">
                    {idx + 1}
                  </div>
                  <p className="flex-1 font-body text-lg text-foreground">{step}</p>
                  <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-primary" />
                </div>
              ))}
            </div>

            <div className="mt-8 border-t border-border/40 pt-8 text-center">
              <p className="font-body text-lg text-muted-foreground">
                O DIT é atualizado periodicamente para incorporar novos dados e refinamentos metodológicos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interpretação do Score */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-6 font-display text-5xl font-bold tracking-tight text-foreground">
              Como interpretar o STT
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">
              Faixas de complexidade territorial e suas implicações estratégicas
            </p>
          </div>

          <div className="space-y-4">
            {interpretationLevels.map((level, idx) => (
              <Card key={idx} className={`border-2 ${level.color}`}>
                <CardContent className="flex items-center gap-6 p-6">
                  <div className="flex-shrink-0">
                    <div className="rounded-lg bg-background px-4 py-2 font-mono text-2xl font-bold text-foreground">
                      {level.range}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 font-display text-xl font-bold">
                      {level.level}
                    </h3>
                    <p className="font-body text-base opacity-90">
                      {level.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 glass rounded-2xl p-8 text-center">
            <p className="mb-4 font-body text-lg leading-relaxed text-muted-foreground">
              O STT não é uma recomendação operacional.
            </p>
            <p className="font-display text-2xl font-bold text-primary">
              É uma leitura estrutural que antecipa complexidade.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative bg-gradient-to-br from-primary/10 via-accent/10 to-background py-24">
        <div className="container max-w-4xl text-center">
          <div className="glass rounded-2xl p-12">
            <h2 className="mb-6 font-display text-4xl font-bold tracking-tight text-foreground">
              Quer entender a complexidade do seu território?
            </h2>
            <p className="mb-8 font-body text-lg text-muted-foreground">
              O DIT oferece clareza estratégica antes da operação.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                className="glow bg-primary font-body text-base font-bold text-primary-foreground transition-all hover:scale-105 hover:bg-primary/90"
              >
                Solicitar análise territorial
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
                  <Calculator className="h-5 w-5 text-primary" />
                </div>
                <span className="font-display text-xl font-bold tracking-tight text-foreground">
                  PRINT
                </span>
              </div>
              <span className="font-mono text-[10px] font-medium tracking-widest text-accent">
                TERRITORIAL INTELLIGENCE
              </span>
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
