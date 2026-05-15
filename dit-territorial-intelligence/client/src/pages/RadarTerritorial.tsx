/**
 * Radar Territorial™ Page
 * Design: Minimalista Tech
 * Produto de assinatura mensal — monitoramento contínuo de complexidade territorial
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Radio,
  TrendingUp,
  Zap,
  BarChart3,
  FileText,
  Target,
  Clock,
  Users,
  XCircle,
  AlertTriangle,
  TrendingDown,
  Minus,
  MapPin,
  Calendar,
  Eye,
  EyeOff,
} from "lucide-react";
import { Link } from "wouter";

export default function RadarTerritorial() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    empresa: "",
    cargo: "",
    setor: "",
    territorio: "",
    email: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const deliverables = [
    {
      icon: BarChart3,
      title: "STT Atualizado",
      description:
        "Score de Território Total revisado mensalmente com variação em relação ao período anterior. Você sabe exatamente se a complexidade aumentou, estabilizou ou recuou.",
    },
    {
      icon: Bell,
      title: "Alerta de Ativação",
      description:
        "Notificação imediata quando um índice componente se move de forma relevante. Você é avisado antes de ser surpreendido.",
    },
    {
      icon: FileText,
      title: "Nota Executiva de Contexto",
      description:
        "Parágrafo executivo explicando o que mudou no território, por que mudou e quais dimensões estruturais foram ativadas no período.",
    },
    {
      icon: TrendingUp,
      title: "Termômetro de Cenários",
      description:
        "Indicação de qual dos cenários estruturais está mais próximo de se consolidar, com base nas variações dos índices no período.",
    },
    {
      icon: Target,
      title: "Briefing Setorial",
      description:
        "Análise do impacto específico para o setor de atuação do assinante. O mesmo território afeta setores de formas distintas.",
    },
    {
      icon: Clock,
      title: "Histórico de Variação",
      description:
        "Acesso ao histórico completo de variações do STT e dos índices componentes desde o início da assinatura.",
    },
  ];

  const comparison = [
    {
      feature: "Score STT",
      radar: "Mensal, com variação",
      dit: "Pontual, estrutural",
    },
    {
      feature: "Profundidade de análise",
      radar: "Monitoramento contínuo",
      dit: "Diagnóstico completo",
    },
    {
      feature: "Alerta de mudança",
      radar: true,
      dit: false,
    },
    {
      feature: "Nota executiva",
      radar: true,
      dit: false,
    },
    {
      feature: "Briefing setorial",
      radar: true,
      dit: "Incluso no DIT",
    },
    {
      feature: "Panorama institucional",
      radar: false,
      dit: true,
    },
    {
      feature: "Arquitetura social",
      radar: false,
      dit: true,
    },
    {
      feature: "Cenários estruturais",
      radar: "Termômetro",
      dit: "Análise completa",
    },
    {
      feature: "Formato de entrega",
      radar: "Painel digital mensal",
      dit: "Produto executivo",
    },
    {
      feature: "Modelo comercial",
      radar: "Assinatura recorrente",
      dit: "Sob consulta",
    },
  ];

  const profiles = [
    {
      icon: Users,
      title: "Executivos de infraestrutura",
      description:
        "Que precisam monitorar continuamente territórios onde operam ou pretendem operar.",
    },
    {
      icon: TrendingUp,
      title: "Gestores de energia e recursos",
      description:
        "Que atuam em territórios sensíveis e precisam antecipar variações de complexidade.",
    },
    {
      icon: BarChart3,
      title: "Fundos de investimento",
      description:
        "Que avaliam risco territorial como variável de due diligence em projetos de infraestrutura.",
    },
    {
      icon: BookOpen,
      title: "Equipes de relações institucionais",
      description:
        "Que precisam de inteligência estrutural para orientar estratégias de engajamento territorial.",
    },
  ];

  const faqs = [
    {
      question: "Como funciona a atualização mensal?",
      answer:
        "A cada mês, nossa equipe revisa os índices componentes do STT para cada território monitorado. Quando há variação relevante, o assinante recebe um alerta imediato. O painel é atualizado com o novo score, a nota executiva e o termômetro de cenários.",
    },
    {
      question: "Posso monitorar mais de um território?",
      answer:
        "Sim. Cada território é uma assinatura independente. Assinantes com múltiplos territórios recebem um painel consolidado com visão comparativa.",
    },
    {
      question: "O Radar substitui o DIT completo?",
      answer:
        "Não. O Radar é um produto de monitoramento contínuo — ideal para quem já tem clareza estrutural do território e quer acompanhar variações. O DIT é o diagnóstico fundacional que antecede qualquer operação.",
    },
    {
      question: "Como é definido o preço da assinatura?",
      answer:
        "O investimento é sob consulta e varia conforme o território monitorado, o setor de atuação e o volume de assinaturas. Entre em contato para receber uma proposta personalizada.",
    },
    {
      question: "Qual é o prazo mínimo de assinatura?",
      answer:
        "A assinatura é mensal, sem fidelidade mínima. Recomendamos ao menos 3 meses para capturar variações estruturais relevantes.",
    },
  ];

  const [alertExpanded, setAlertExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-neural-pattern pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/75 to-background" />

        <div className="container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 glass">
                <Radio className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                  Assinatura Mensal
                </span>
              </div>

              <div className="space-y-2">
                <h1 className="font-display text-7xl font-bold leading-none tracking-tight text-foreground lg:text-8xl">
                  Radar
                </h1>
                <h1 className="font-display text-7xl font-bold leading-none tracking-tight text-primary lg:text-8xl">
                  Territorial™
                </h1>
              </div>

              <p className="font-mono text-sm font-medium tracking-widest text-muted-foreground">
                by Print Territorial Intelligence™
              </p>
            </div>

            <p className="mx-auto mb-10 max-w-2xl font-body text-xl leading-relaxed text-muted-foreground">
              Monitoramento contínuo de complexidade territorial.{" "}
              <span className="font-bold text-foreground">
                Você sabe quando o território muda antes de ser surpreendido.
              </span>
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <a href="#cadastro">
                <Button
                  size="lg"
                  className="glow bg-primary font-body text-base font-bold text-primary-foreground transition-all hover:scale-105 hover:bg-primary/90"
                >
                  <Bell className="mr-2 h-5 w-5" />
                  Receber alerta gratuito
                </Button>
              </a>
              <a href="#o-que-inclui">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-accent/50 font-body text-base font-bold text-accent transition-all hover:scale-105 hover:border-accent hover:bg-accent/10"
                >
                  Ver o que está incluído
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Proposta de Valor */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container max-w-5xl">
          <div className="glass rounded-2xl p-12 text-center space-y-8">
            <h2 className="font-display text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
              O território não é estático.
            </h2>
            <p className="mx-auto max-w-3xl font-body text-xl leading-relaxed text-muted-foreground">
              Tensões se acumulam. Atores se reorganizam. Regulações mudam.
              O STT de hoje não é o STT de amanhã.
            </p>
            <div className="border-t border-border/40 pt-8">
              <p className="font-display text-3xl font-bold text-primary">
                O Radar Territorial™ acompanha essas variações.
              </p>
              <p className="mt-4 font-body text-lg text-muted-foreground">
                Mensalmente. Com precisão. Antes que virem problema.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Exemplo de Alerta */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container max-w-4xl">
          <div className="mb-16 text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2">
              <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Exemplo real de alerta
              </span>
            </div>
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground">
              Veja como funciona
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">
              Este é o formato do alerta que você recebe quando o STT de um território se move.
            </p>
          </div>

          {/* Mock Email Alert */}
          <div className="mx-auto max-w-2xl">
            {/* Email chrome */}
            <div className="rounded-2xl border border-border/60 overflow-hidden shadow-2xl">
              {/* Email header bar */}
              <div className="flex items-center gap-2 bg-muted/60 px-5 py-3 border-b border-border/40">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-4 font-mono text-xs text-muted-foreground">alerta@print-intelligence.com.br</span>
              </div>

              {/* Email body */}
              <div className="bg-card p-8 space-y-6">
                {/* Subject line */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                      <Zap className="h-4 w-4 text-primary" fill="currentColor" />
                    </div>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Print Territorial Intelligence™</span>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-foreground mt-3">
                    🔔 Alerta de Ativação — Baía de Guanabara
                  </h3>
                  <div className="flex items-center gap-4 pt-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs">Março 2026</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="font-mono text-xs">Rio de Janeiro, RJ</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/40" />

                {/* STT Movement */}
                <div className="glass rounded-xl p-6 border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                        Variação do Score STT
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="font-mono text-3xl font-bold text-muted-foreground">78</p>
                          <p className="font-mono text-xs text-muted-foreground">Fev/26</p>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                          <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">+4 pts</span>
                        </div>
                        <div className="text-center">
                          <p className="font-mono text-3xl font-bold text-foreground">82</p>
                          <p className="font-mono text-xs text-muted-foreground">Mar/26</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center">
                      <p className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">ALTA</p>
                      <p className="font-mono text-xs text-amber-600/70 dark:text-amber-400/70">COMPLEXIDADE</p>
                    </div>
                  </div>
                </div>

                {/* Index that moved */}
                <div className="space-y-3">
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Índice ativado</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: "ITT", prev: 82, curr: 82, moved: false },
                      { label: "ICS", prev: 74, curr: 74, moved: false },
                      { label: "IVS", prev: 68, curr: 79, moved: true },
                      { label: "IVE", prev: 85, curr: 85, moved: false },
                      { label: "ICI", prev: 71, curr: 71, moved: false },
                    ].map((idx) => (
                      <div
                        key={idx.label}
                        className={`rounded-lg border p-3 text-center transition-all ${
                          idx.moved
                            ? "border-amber-500/50 bg-amber-500/10"
                            : "border-border/40 bg-card/50 opacity-50"
                        }`}
                      >
                        <p className={`font-mono text-xs font-bold ${
                          idx.moved ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        }`}>{idx.label}</p>
                        {idx.moved ? (
                          <div className="mt-1">
                            <p className="font-mono text-xs text-muted-foreground line-through">{idx.prev}</p>
                            <p className="font-mono text-sm font-bold text-foreground">{idx.curr}</p>
                          </div>
                        ) : (
                          <p className="font-mono text-sm font-bold text-muted-foreground mt-1">{idx.curr}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Nota Executiva */}
                <div className="space-y-3">
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Nota executiva de contexto</p>
                  <div className="rounded-xl border border-border/50 bg-card/50 p-5">
                    <p className="font-body text-sm leading-relaxed text-foreground">
                      O IVS (Índice de Vulnerabilidade Social) da Baía de Guanabara registrou elevação de 11 pontos em março, impulsionado por mobilizações de comunidades pesqueiras na Ilha do Governador em resposta à retomada de dragagem no canal de acesso ao Porto do Rio. A pressão organizada ainda não atingiu instâncias regulatórias, mas o padrão de articulação observado sugere capacidade de escalada nos próximos 30 a 60 dias.
                    </p>
                  </div>
                </div>

                {/* Termômetro de Cenários */}
                <div className="space-y-3">
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Termômetro de cenários</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Estabilidade Condicionada", active: false, icon: Minus },
                      { label: "Pressão Gradual", active: true, icon: TrendingUp },
                      { label: "Escalada Sistêmica", active: false, icon: AlertTriangle },
                    ].map((scenario) => (
                      <div
                        key={scenario.label}
                        className={`rounded-lg border p-4 text-center ${
                          scenario.active
                            ? "border-amber-500/50 bg-amber-500/10"
                            : "border-border/40 bg-card/50 opacity-40"
                        }`}
                      >
                        <scenario.icon className={`mx-auto h-5 w-5 mb-2 ${
                          scenario.active ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        }`} />
                        <p className={`font-body text-xs font-semibold leading-tight ${
                          scenario.active ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                        }`}>{scenario.label}</p>
                        {scenario.active && (
                          <div className="mt-2 h-1.5 w-full rounded-full bg-amber-500/20">
                            <div className="h-full w-2/3 rounded-full bg-amber-500" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conteúdo bloqueado */}
                <div
                  className="relative overflow-hidden rounded-xl border border-border/50 cursor-pointer group"
                  onClick={() => setAlertExpanded(!alertExpanded)}
                >
                  <div className="p-5 space-y-3">
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Briefing setorial — Energia & Óleo/Gás</p>
                    <p className="font-body text-sm text-muted-foreground leading-relaxed">
                      Para operadores do setor de energia com ativos na região, a elevação do IVS representa...
                    </p>
                  </div>
                  {!alertExpanded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-card via-card/95 to-transparent">
                      <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5 backdrop-blur-sm">
                        <Eye className="h-4 w-4 text-primary" />
                        <span className="font-mono text-xs font-bold text-primary">Disponível para assinantes</span>
                      </div>
                      <p className="mt-2 font-body text-xs text-muted-foreground">Clique para ver como seria</p>
                    </div>
                  )}
                  {alertExpanded && (
                    <div className="px-5 pb-5">
                      <p className="font-body text-sm text-foreground leading-relaxed">
                        Para operadores do setor de energia com ativos na região, a elevação do IVS representa risco de interferência em cronogramas de manutenção e acesso a instalações costeiras. A janela de 30 a 60 dias indicada na nota executiva é crítica para decisões de engajamento preventivo com lideranças comunitárias locais.
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAlertExpanded(false); }}
                        className="mt-3 flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                      >
                        <EyeOff className="h-3.5 w-3.5" /> Recolher
                      </button>
                    </div>
                  )}
                </div>

                {/* CTA dentro do alerta */}
                <div className="border-t border-border/40 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="font-body text-sm text-muted-foreground">
                    Receba alertas como este para o território de seu interesse.
                  </p>
                  <a href="#cadastro">
                    <Button
                      size="sm"
                      className="glow bg-primary font-body text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 whitespace-nowrap"
                    >
                      <Bell className="mr-2 h-4 w-4" />
                      Cadastrar gratuitamente
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* O Que Está Incluído */}
      <section id="o-que-inclui" className="relative border-t border-border/40 bg-background py-24">
        <div className="container">
          <div className="mb-16 text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
                Entregáveis mensais
              </span>
            </div>
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground lg:text-6xl">
              O que está incluído
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">
              Seis componentes entregues mensalmente para cada território monitorado
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {deliverables.map((item, idx) => (
              <Card
                key={idx}
                className="glass border-border/50 transition-all hover:border-primary/40 hover:shadow-lg group"
              >
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 transition-all group-hover:bg-primary/20">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="font-display text-xl font-bold text-foreground">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-body text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Radar vs DIT */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center space-y-4">
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground">
              Radar Territorial™ vs DIT
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-muted-foreground">
              Produtos complementares, não concorrentes. Cada um com seu papel no ciclo de inteligência territorial.
            </p>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="px-6 py-5 text-left font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Dimensão
                    </th>
                    <th className="px-6 py-5 text-center font-mono text-xs font-bold uppercase tracking-wider text-primary">
                      Radar Territorial™
                    </th>
                    <th className="px-6 py-5 text-center font-mono text-xs font-bold uppercase tracking-wider text-accent">
                      DIT Completo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {comparison.map((row, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-card/40">
                      <td className="px-6 py-4 font-body text-sm font-medium text-foreground">
                        {row.feature}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {typeof row.radar === "boolean" ? (
                          row.radar ? (
                            <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
                          ) : (
                            <XCircle className="mx-auto h-5 w-5 text-muted-foreground/40" />
                          )
                        ) : (
                          <span className="font-body text-sm text-primary font-medium">
                            {row.radar}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {typeof row.dit === "boolean" ? (
                          row.dit ? (
                            <CheckCircle2 className="mx-auto h-5 w-5 text-accent" />
                          ) : (
                            <XCircle className="mx-auto h-5 w-5 text-muted-foreground/40" />
                          )
                        ) : (
                          <span className="font-body text-sm text-accent font-medium">
                            {row.dit}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 glass rounded-xl p-6 border-l-4 border-primary">
            <p className="font-body text-base text-foreground">
              <span className="font-bold text-primary">Recomendação:</span>{" "}
              O DIT é o diagnóstico fundacional. O Radar é o monitoramento contínuo que preserva o valor do diagnóstico ao longo do tempo.
            </p>
          </div>
        </div>
      </section>

      {/* Para Quem É */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container max-w-5xl">
          <div className="mb-16 text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                Público estratégico
              </span>
            </div>
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground">
              Para quem é o Radar
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {profiles.map((profile, idx) => (
              <Card key={idx} className="glass border-border/50 transition-all hover:border-primary/30">
                <CardContent className="flex gap-5 p-8">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <profile.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="mb-2 font-display text-lg font-bold text-foreground">
                      {profile.title}
                    </h3>
                    <p className="font-body text-sm leading-relaxed text-muted-foreground">
                      {profile.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Posição no Ciclo */}
      <section className="relative border-t border-border/40 bg-card/20 py-24">
        <div className="container max-w-4xl">
          <div className="mb-16 text-center space-y-4">
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground">
              Posição no ciclo de produto
            </h2>
            <p className="font-body text-lg text-muted-foreground">
              O Radar é a ponte entre o diagnóstico e a operação contínua
            </p>
          </div>

          <div className="glass rounded-2xl p-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {[
                { label: "Alerta Gratuito", sub: "Entrada", color: "bg-green-100 text-green-800 border-green-300", active: false },
                { label: "Radar Territorial™", sub: "Assinatura mensal", color: "bg-primary/10 text-primary border-primary/40", active: true },
                { label: "DIT Completo", sub: "Consultivo", color: "bg-accent/10 text-accent border-accent/40", active: false },
                { label: "SSE™", sub: "Setorial", color: "bg-accent/10 text-accent border-accent/40", active: false },
                { label: "Retainer", sub: "Exclusivo", color: "bg-primary/10 text-primary border-primary/40", active: false },
              ].map((step, idx, arr) => (
                <div key={idx} className="flex items-center gap-3 md:flex-col md:gap-2">
                  <div
                    className={`rounded-xl border-2 px-4 py-3 text-center transition-all ${step.color} ${step.active ? "shadow-lg scale-105" : "opacity-70"}`}
                  >
                    <p className={`font-display text-sm font-bold ${step.active ? "" : ""}`}>
                      {step.label}
                    </p>
                    <p className="font-mono text-xs opacity-70">{step.sub}</p>
                  </div>
                  {idx < arr.length - 1 && (
                    <ArrowRight className="h-4 w-4 flex-shrink-0 rotate-0 text-muted-foreground md:rotate-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative border-t border-border/40 bg-background py-24">
        <div className="container max-w-3xl">
          <div className="mb-16 text-center space-y-4">
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground">
              Perguntas frequentes
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="glass rounded-xl border border-border/50 overflow-hidden transition-all hover:border-primary/30"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="flex w-full items-center justify-between gap-4 px-8 py-6 text-left"
                >
                  <span className="font-body text-base font-semibold text-foreground">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-primary transition-transform ${openFaq === idx ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="border-t border-border/40 px-8 py-6">
                    <p className="font-body text-base leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formulário de Cadastro */}
      <section id="cadastro" className="relative border-t border-border/40 bg-gradient-to-br from-primary/10 via-accent/5 to-background py-24">
        <div className="container max-w-2xl">
          <div className="mb-12 text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                Acesso gratuito
              </span>
            </div>
            <h2 className="font-display text-5xl font-bold tracking-tight text-foreground">
              Receba o alerta gratuito
            </h2>
            <p className="font-body text-lg text-muted-foreground">
              Cadastre-se para receber um alerta quando o STT do território de seu interesse se mover.
              Sem compromisso. Sem cobrança.
            </p>
          </div>

          <div className="glass rounded-2xl p-10">
            {submitted ? (
              <div className="py-12 text-center space-y-4">
                <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
                <h3 className="font-display text-3xl font-bold text-foreground">
                  Cadastro realizado
                </h3>
                <p className="font-body text-lg text-muted-foreground">
                  Você receberá o próximo alerta de ativação por e-mail.
                  Nossa equipe entrará em contato em breve.
                </p>
                <div className="pt-4">
                  <Link href="/">
                    <Button
                      variant="outline"
                      className="border-2 border-primary/50 font-body font-bold text-primary"
                    >
                      Voltar para a home
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Nome completo *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card/50 px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                      placeholder="Seu nome"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      E-mail corporativo *
                    </label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card/50 px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                      placeholder="nome@empresa.com"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Empresa *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.empresa}
                      onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card/50 px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Cargo *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card/50 px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                      placeholder="Seu cargo"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Setor de atuação *
                    </label>
                    <select
                      required
                      value={formData.setor}
                      onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card/50 px-4 py-3 font-body text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    >
                      <option value="" disabled>Selecione</option>
                      <option value="energia">Energia / Óleo & Gás</option>
                      <option value="infraestrutura">Infraestrutura</option>
                      <option value="mineracao">Mineração</option>
                      <option value="logistica">Logística / Portuário</option>
                      <option value="saneamento">Saneamento</option>
                      <option value="fundo">Fundo de Investimento</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Território de interesse *
                    </label>
                    <select
                      required
                      value={formData.territorio}
                      onChange={(e) => setFormData({ ...formData, territorio: e.target.value })}
                      className="w-full rounded-lg border border-border bg-card/50 px-4 py-3 font-body text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    >
                      <option value="" disabled>Selecione</option>
                      <option value="baia-guanabara">Baía de Guanabara</option>
                      <option value="teles-pires">Bacia do Rio Teles Pires</option>
                      <option value="nordeste-eolico">Nordeste Eólico</option>
                      <option value="corredor-mineral">Corredor Mineral MG</option>
                      <option value="outro">Outro território</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full glow bg-primary font-body text-base font-bold text-primary-foreground transition-all hover:bg-primary/90"
                  >
                    <Bell className="mr-2 h-5 w-5" />
                    Cadastrar para alerta gratuito
                  </Button>
                </div>

                <p className="text-center font-body text-xs text-muted-foreground">
                  Seus dados são tratados com confidencialidade. Nenhuma informação é compartilhada com terceiros.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative border-t border-border/40 bg-card/20 py-20">
        <div className="container max-w-3xl text-center space-y-8">
          <h2 className="font-display text-4xl font-bold tracking-tight text-foreground">
            Prefere conversar antes?
          </h2>
          <p className="font-body text-lg text-muted-foreground">
            Nossa equipe está disponível para apresentar o Radar Territorial™ e entender como ele se encaixa na sua operação.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              className="glow bg-primary font-body text-base font-bold text-primary-foreground transition-all hover:scale-105 hover:bg-primary/90"
            >
              <Zap className="mr-2 h-5 w-5" fill="currentColor" />
              Agendar conversa estratégica
            </Button>
            <Link href="/metodologia">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-accent/50 font-body text-base font-bold text-accent transition-all hover:scale-105 hover:border-accent hover:bg-accent/10"
              >
                Ver metodologia STT
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
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
              <Link href="/radar" className="transition-all hover:text-foreground">
                Radar Territorial™
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
