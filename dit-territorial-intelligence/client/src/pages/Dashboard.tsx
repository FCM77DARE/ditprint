/**
 * Dashboard Interno — Radar Territorial™ v2
 * Acesso exclusivo para a equipe Print (admin)
 * Funcionalidades:
 * - Coleta de sinais via Google RSS + NewsAPI
 * - Cards de sinais com imagens (Open Graph)
 * - Análise LLM automática de sinais
 * - Sugestão de STT com revisão humana
 * - Gerador de one-pager executivo
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Streamdown } from "streamdown";
import AnalyticsPanel from "./AnalyticsPanel";
import TerritoryWizard from "./TerritoryWizard";
import AgentHealthPanel from "@/components/AgentHealthPanel";
import SignalFeed from "@/components/SignalFeed";
import SttPublishPanel from "@/components/SttPublishPanel";

import {
  Activity,
  ArrowLeft,
  BarChart2,
  Brain,
  Globe,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  LogOut,
  Radio,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
  Bot,
  Rss,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { Link } from "wouter";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Signal = {
  id: number;
  source: string;
  relatedIndex: string | null;
  title: string;
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
  curationStatus: string;
  curationNote: string | null;
  llmAnalysis: string | null;
  llmImpactScore: number | null;
  llmSuggestedIndex: string | null;
  createdAt: Date;
};

type Territory = {
  id: number;
  slug: string;
  name: string;
  region: string | null;
  state: string | null;
};

// ─── Componentes Auxiliares ───────────────────────────────────────────────────

const IndexBadge = ({ index }: { index: string | null }) => {
  const colors: Record<string, string> = {
    ITT: "bg-red-100 text-red-800 border-red-200",
    ICS: "bg-blue-100 text-blue-800 border-blue-200",
    IVS: "bg-orange-100 text-orange-800 border-orange-200",
    IVE: "bg-green-100 text-green-800 border-green-200",
    ICI: "bg-purple-100 text-purple-800 border-purple-200",
    GERAL: "bg-gray-100 text-gray-700 border-gray-200",
  };
  const label = index ?? "GERAL";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${colors[label] ?? colors.GERAL}`}>
      {label}
    </span>
  );
};

const SourceBadge = ({ source, metadata }: { source: string; metadata?: Record<string, string> | null }) => {
  const provider = (metadata as any)?.provider ?? source;
  const sourceName = (metadata as any)?.sourceName;

  // Notícias (azul)
  const newsMap: Record<string, { label: string; cls: string }> = {
    "google-rss": { label: "📰 Google RSS", cls: "bg-sky-100 text-sky-800 border border-sky-200" },
    google_rss: { label: "📰 Google RSS", cls: "bg-sky-100 text-sky-800 border border-sky-200" },
    newsapi: { label: "📰 NewsAPI", cls: "bg-indigo-100 text-indigo-800 border border-indigo-200" },
    manual: { label: "✏️ Manual", cls: "bg-violet-100 text-violet-800 border border-violet-200" },
  };

  // Dados estruturados (verde/laranja/vermelho — distingue visualmente das notícias)
  const dataMap: Record<string, { label: string; cls: string }> = {
    ibama: { label: "🌳 IBAMA", cls: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
    "ibama-embargo": { label: "🚫 IBAMA Embargo", cls: "bg-red-100 text-red-800 border border-red-200" },
    "ibama-auto-infracao": { label: "⚠️ IBAMA Auto", cls: "bg-orange-100 text-orange-800 border border-orange-200" },
    "ibge-censo": { label: "📊 IBGE Censo", cls: "bg-teal-100 text-teal-800 border border-teal-200" },
    "ibge-rendimento": { label: "💰 IBGE Renda", cls: "bg-teal-100 text-teal-800 border border-teal-200" },
    "inpe-deter": { label: "🛰️ INPE/DETER", cls: "bg-amber-100 text-amber-800 border border-amber-200" },
    "inpe-prodes": { label: "🛰️ INPE/PRODES", cls: "bg-amber-100 text-amber-800 border border-amber-200" },
    "ana-hidroweb": { label: "💧 ANA Hidro", cls: "bg-blue-100 text-blue-800 border border-blue-200" },
    "ana-outorgas": { label: "💧 ANA Outorga", cls: "bg-blue-100 text-blue-800 border border-blue-200" },
    "querido-diario": { label: "📜 Diário Oficial", cls: "bg-purple-100 text-purple-800 border border-purple-200" },
    dou: { label: "📜 DOU", cls: "bg-amber-100 text-amber-800 border border-amber-200" },
  };

  const allMap = { ...newsMap, ...dataMap };
  const { label, cls } = allMap[provider] ?? { label: provider, cls: "bg-gray-100 text-gray-700 border border-gray-200" };

  // Indicador de tipo: notícia vs. dado estruturado
  const isStructured = Boolean(dataMap[provider]);

  return (
    <div className="flex items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
      {isStructured && (
        <span className="rounded-full bg-gray-100 border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
          dado
        </span>
      )}
      {sourceName && <span className="text-xs text-muted-foreground">· {sourceName}</span>}
    </div>
  );
};

const ImpactBar = ({ score }: { score: number | null }) => {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "bg-red-500" : score >= 0.4 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
    </div>
  );
};

// ─── Legenda de Composição STT ──────────────────────────────────────────────

const STT_INDICES = [
  {
    key: "D1",
    name: "Socioambiental",
    weight: "20%",
    color: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
    description: "Mede impactos ambientais, clima e fiscalização do território. Fontes: IBAMA, alertas de desmatamento, INPE.",
  },
  {
    key: "D2",
    name: "Socioeconômica",
    weight: "14%",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
    description: "Avalia densidade demográfica, pobreza e desenvolvimento social. Fontes: IBGE Censo 2022, rendimento.",
  },
  {
    key: "D3",
    name: "Infraestrutura",
    weight: "14%",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
    description: "Analisa capacidades urbanas, saneamento e logística. Fontes: notícias, PAC.",
  },
  {
    key: "D4",
    name: "Dinâmica Territorial",
    weight: "20%",
    color: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
    description: "Mapeia conflitos, uso do solo e segurança pública. Fontes: embargos, notícias de disputas.",
  },
  {
    key: "D5",
    name: "Governança",
    weight: "12%",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    dot: "bg-purple-500",
    description: "Mede o engajamento cívico e a capacidade institucional. Fontes: Querido Diário, reuniões.",
  },
  {
    key: "D6",
    name: "Reputação",
    weight: "10%",
    color: "bg-teal-100 text-teal-800 border-teal-200",
    dot: "bg-teal-500",
    description: "Dimensiona a exposição midiática e o interesse digital. Fontes: Google RSS, NewsAPI.",
  },
  {
    key: "D7",
    name: "Recursos Naturais e Potencial",
    weight: "10%",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
    dot: "bg-cyan-500",
    description: "Potencial para minerais estratégicos e tecnologias emergentes. Fontes: ANA, pesquisas geológicas.",
  },
];

function SttLegend({ currentScore }: { currentScore: { stt: number; d1Score?: number | null; d2Score?: number | null; d3Score?: number | null; d4Score?: number | null; d5Score?: number | null; d6Score?: number | null; d7Score?: number | null; activatedIndex?: string | null; period?: string } | null }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Composição do STT — Score de Tensão Territorial</span>
          {currentScore && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              Score atual: {currentScore.stt} · {currentScore.period}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-3">
          {/* Fórmula */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs font-mono font-bold text-primary">
              STT = (D1×20%) + (D2×14%) + (D3×14%) + (D4×20%) + (D5×12%) + (D6×10%) + (D7×10%)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Escala 0–100. Quanto maior o score, maior a complexidade territorial e o risco operacional.
            </p>
          </div>

          {/* Índices */}
          <div className="space-y-2">
            {STT_INDICES.map((idx) => {
              const currentVal = currentScore
                ? ({
                    D1: currentScore.d1Score,
                    D2: currentScore.d2Score,
                    D3: currentScore.d3Score,
                    D4: currentScore.d4Score,
                    D5: currentScore.d5Score,
                    D6: currentScore.d6Score,
                    D7: currentScore.d7Score,
                  }[idx.key] ?? null)
                : null;
              const isActivated = currentScore?.activatedIndex === idx.key;

              return (
                <div
                  key={idx.key}
                  className={`rounded-lg border px-3 py-2.5 ${
                    isActivated ? "border-primary/40 bg-primary/5" : "border-border/40 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${idx.color}`}>
                        {idx.key}
                      </span>
                      <span className="text-xs font-semibold text-foreground truncate">{idx.name}</span>
                      {isActivated && (
                        <span className="text-xs font-bold text-primary">← ativado</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {currentVal !== null && (
                        <span className="font-mono text-sm font-bold text-foreground">{currentVal}</span>
                      )}
                      <span className="text-xs text-muted-foreground font-mono">{idx.weight}</span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{idx.description}</p>
                </div>
              );
            })}
          </div>

          {/* Cenários */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <p className="text-xs font-bold text-green-800">Estabilidade Condicionada</p>
              <p className="text-xs text-green-700">STT 0–55: pressões existentes mas controladas</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs font-bold text-amber-800">Pressão Gradual</p>
              <p className="text-xs text-amber-700">STT 56–74: tensões em aceleração, monitoramento intensivo</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs font-bold text-red-800">Escalada Sistêmica</p>
              <p className="text-xs text-red-700">STT 75–100: múltiplos vetores ativos, risco operacional alto</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Painel de Sinais ─────────────────────────────────────────────────────────

function SignalsPanel({ territory }: { territory: Territory }) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<Record<number, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Score atual do território como base de comparação
  const { data: currentScore } = trpc.stt.latest.useQuery({ territoryId: territory.id });

  const { data: signalData, isLoading, refetch } = trpc.signals.list.useQuery({
    territoryId: territory.id,
    status: statusFilter as any,
    limit: 100,
  });

  const curateMutation = trpc.signals.curate.useMutation({
    onSuccess: () => {
      toast.success("Sinal atualizado");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const collectMutation = trpc.signals.collect.useMutation({
    onSuccess: (data) => {
      const total = data.results.reduce((s: number, r: any) => s + r.total, 0);
      toast.success(`${total} novos sinais coletados via Google RSS!`);
      refetch();
    },
    onError: (e) => toast.error(`Erro na coleta: ${e.message}`),
  });

  const collectStructuredMutation = trpc.signals.collectStructuredData.useMutation({
    onSuccess: (data) => {
      const total = data.results.reduce((s: number, r: any) => s + r.total, 0);
      toast.success(`${total} registros de dados estruturados coletados (IBAMA/IBGE/INPE/ANA/Querido Diário)!`);
      refetch();
    },
    onError: (e) => toast.error(`Erro na coleta de dados estruturados: ${e.message}`),
  });

  const analyzeMutation = trpc.signals.analyze.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.analyzed} sinais analisados pelo LLM. STT calculado: ${data.calculatedStt}`);
      refetch();
    },
    onError: (e) => toast.error(`Erro na análise: ${e.message}`),
  });

  const handleCurate = (signalId: number, status: "relevant" | "ignored" | "analyzed") => {
    curateMutation.mutate({
      signalId,
      status,
      note: noteText[signalId] ?? null,
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendentes",
    relevant: "Relevantes",
    ignored: "Ignorados",
    analyzed: "Analisados",
  };

  return (
    <div className="space-y-4">
      {/* Legenda de Composição STT */}
      <SttLegend currentScore={currentScore ?? null} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["pending", "relevant", "ignored", "analyzed"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
              className="text-xs"
            >
              {statusLabels[s]}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => analyzeMutation.mutate({ territorySlug: territory.slug })}
                  disabled={analyzeMutation.isPending}
                  className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  {analyzeMutation.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Brain className="mr-2 h-3 w-3" />
                  )}
                  Analisar com LLM
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">Envia os sinais coletados para o LLM, que classifica cada um por índice STT (D1 a D7), atribui um score de impacto (0–100%) e gera uma análise executiva de 1–2 frases. Sinais históricos são classificados automaticamente; sinais atuais aguardam curadoria do time.</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>

          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => collectStructuredMutation.mutate({ territorySlug: territory.slug })}
                  disabled={collectStructuredMutation.isPending}
                  className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  {collectStructuredMutation.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-3 w-3" />
                  )}
                  Dados estruturados
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">Coleta dados públicos de 5 fontes: IBAMA (embargos e autos de infração → IVE/ICI), IBGE (PIB e população Censo 2022 → IVS), INPE/DETER (alertas de desmatamento → IVE), ANA (dados hídricos → IVE) e Querido Diário (atos oficiais → ICI). Cada dado vira um sinal estruturado no painel.</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>

          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => collectMutation.mutate({ territorySlug: territory.slug })}
                  disabled={collectMutation.isPending}
                  className="bg-primary text-primary-foreground text-xs"
                >
                  {collectMutation.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-3 w-3" />
                  )}
                  Coletar notícias
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">Busca notícias recentes no Google News RSS usando 8 queries específicas do território. Cada notícia vira um sinal com título, fonte, imagem de capa e data. Sinais do mês atual ficam com status “Pendente” para curadoria manual do time.</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Resultado da análise LLM */}
      {analyzeMutation.data && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-semibold text-sm text-purple-900">Análise LLM Concluída</span>
                <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs font-bold text-purple-800">
                  STT Calculado: {analyzeMutation.data.calculatedStt}
                </span>
                <IndexBadge index={analyzeMutation.data.activatedIndex} />
              </div>
              <p className="text-sm text-purple-800 leading-relaxed">{analyzeMutation.data.summary}</p>
              <p className="mt-2 text-xs text-purple-600">{analyzeMutation.data.analyzed} sinais analisados</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Sinais */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !signalData?.length ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Database className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {statusFilter === "pending"
              ? "Nenhum sinal pendente. Clique em 'Coletar sinais' para buscar novos sinais via Google RSS."
              : `Nenhum sinal com status "${statusLabels[statusFilter]}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{signalData.length} sinal(is)</p>
          {(signalData as Signal[]).map((signal) => (
            <Card
              key={signal.id}
              className={`border transition-all hover:border-primary/30 ${
                selectedIds.has(signal.id) ? "border-primary/60 bg-primary/5" : "border-border/60"
              }`}
            >
              <CardContent className="p-0">
                {/* Card com imagem */}
                <div className="flex gap-0">
                  {/* Imagem lateral */}
                  {signal.imageUrl && (
                    <div className="relative w-28 flex-shrink-0 overflow-hidden rounded-l-xl">
                      <img
                        src={signal.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}

                  {/* Conteúdo */}
                  <div className={`flex-1 p-4 ${signal.imageUrl ? "" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Badges */}
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <SourceBadge source={signal.source} metadata={signal as any} />
                          <IndexBadge index={signal.llmSuggestedIndex ?? signal.relatedIndex} />
                          {signal.llmImpactScore !== null && (
                            <ImpactBar score={signal.llmImpactScore} />
                          )}
                          {signal.publishedAt && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(signal.publishedAt).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          {/* Checkbox para seleção */}
                          <button
                            onClick={() => toggleSelect(signal.id)}
                            className={`ml-auto rounded-md border px-2 py-0.5 text-xs transition-colors ${
                              selectedIds.has(signal.id)
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:border-primary"
                            }`}
                          >
                            {selectedIds.has(signal.id) ? "✓ Selecionado" : "Selecionar"}
                          </button>
                        </div>

                        {/* Título */}
                        <p className="font-semibold text-sm text-foreground leading-tight">{signal.title}</p>

                        {/* Análise LLM */}
                        {signal.llmAnalysis && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-purple-50 border border-purple-100 px-3 py-2">
                            <Brain className="mt-0.5 h-3 w-3 flex-shrink-0 text-purple-500" />
                            <p className="text-xs text-purple-800 leading-relaxed">{signal.llmAnalysis}</p>
                          </div>
                        )}

                        {/* Resumo expandido */}
                        {signal.summary && expandedId === signal.id && (
                          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{signal.summary}</p>
                        )}

                        {/* Link */}
                        {signal.url && (
                          <a
                            href={signal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs text-primary hover:underline"
                          >
                            Ver fonte →
                          </a>
                        )}

                        {/* Nota de curadoria */}
                        {signal.curationNote && (
                          <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground italic">
                            Nota: {signal.curationNote}
                          </p>
                        )}
                      </div>

                      {/* Expandir */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => setExpandedId(expandedId === signal.id ? null : signal.id)}
                      >
                        {expandedId === signal.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {/* Ações de curadoria */}
                    {statusFilter === "pending" && (
                      <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                        <Textarea
                          placeholder="Nota de curadoria (opcional)..."
                          className="h-14 resize-none text-xs"
                          value={noteText[signal.id] ?? ""}
                          onChange={(e) => setNoteText((prev) => ({ ...prev, [signal.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  className="flex-1 bg-green-600 text-white hover:bg-green-700 text-xs"
                                  onClick={() => handleCurate(signal.id, "relevant")}
                                  disabled={curateMutation.isPending}
                                >
                                  <CheckCircle className="mr-1 h-3 w-3" /> Relevante
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Marca este sinal como relevante para o cálculo do STT. Sinais relevantes são incluídos na análise LLM e influenciam diretamente o score do território.</p>
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                  onClick={() => handleCurate(signal.id, "analyzed")}
                                  disabled={curateMutation.isPending}
                                >
                                  <Eye className="mr-1 h-3 w-3" /> Analisado
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Registra que o sinal foi lido e analisado pelo time, mas não é suficientemente relevante para alterar o STT. Fica arquivado para consulta futura.</p>
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => handleCurate(signal.id, "ignored")}
                                  disabled={curateMutation.isPending}
                                >
                                  <XCircle className="mr-1 h-3 w-3" /> Ignorar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">Descarta este sinal como não relevante para o território (ruído, conteúdo duplicado ou fora de escopo). Não será incluído na análise LLM.</p>
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Painel de STT Automático ─────────────────────────────────────────────────

type LLMAnalysisResult = {
  analyzed: number;
  calculatedStt: number;
  calculatedD1: number;
  calculatedD2: number;
  calculatedD3: number;
  calculatedD4: number;
  calculatedD5: number;
  calculatedD6: number;
  calculatedD7: number;
  activatedIndex: string;
  scenario: "estabilidade" | "pressao" | "escalada";
  executiveNote: string;
  variation: number;
  summary: string;
  success: boolean;
};

const scenarioLabels: Record<string, { label: string; color: string }> = {
  estabilidade: { label: "Estabilidade Condicionada", color: "text-green-700 bg-green-50 border-green-200" },
  pressao: { label: "Pressão Gradual", color: "text-amber-700 bg-amber-50 border-amber-200" },
  escalada: { label: "Escalada Sistêmica", color: "text-red-700 bg-red-50 border-red-200" },
};

function SttPanel({ territory }: { territory: Territory }) {
  const [llmResult, setLlmResult] = useState<LLMAnalysisResult | null>(null);
  const [published, setPublished] = useState(false);
  const [editNote, setEditNote] = useState("");
  const [noteEditing, setNoteEditing] = useState(false);

  const { data: history, refetch } = trpc.stt.history.useQuery({ territoryId: territory.id, limit: 12 });
  const { data: latestScore } = trpc.stt.latest.useQuery({ territoryId: territory.id });

  const analyzeMutation = trpc.signals.analyze.useMutation({
    onSuccess: (data) => {
      setLlmResult(data);
      setEditNote(data.executiveNote);
      setNoteEditing(false);
      toast.success(`STT calculado automaticamente: ${data.calculatedStt} (${data.variation >= 0 ? "+" : ""}${data.variation} pts)`);
    },
    onError: (e) => toast.error(`Erro na análise: ${e.message}`),
  });

  const publishMutation = trpc.stt.upsert.useMutation({
    onSuccess: () => {
      toast.success("Score STT publicado com sucesso!");
      setLlmResult(null);
      setPublished(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const handlePublish = () => {
    if (!llmResult) return;
    const period = new Date().toISOString().slice(0, 7);
    publishMutation.mutate({
      territoryId: territory.id,
      period,
      stt: llmResult.calculatedStt,
      d1Score: llmResult.calculatedD1,
      d2Score: llmResult.calculatedD2,
      d3Score: llmResult.calculatedD3,
      d4Score: llmResult.calculatedD4,
      d5Score: llmResult.calculatedD5,
      d6Score: llmResult.calculatedD6,
      d7Score: llmResult.calculatedD7,
      activatedIndex: llmResult.activatedIndex,
      variation: llmResult.variation,
      executiveNote: noteEditing ? editNote : llmResult.executiveNote,
      scenario: llmResult.scenario,
      published,
    });
  };

  const currentStt = latestScore?.stt ?? null;

  return (
    <div className="space-y-6">
      {/* Instrução */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <Brain className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Score STT calculado automaticamente pelo LLM</p>
            <p className="mt-1 text-xs text-blue-700 leading-relaxed">
              O sistema analisa os sinais coletados com base na metodologia DIT completa — histórico territorial, 
              pesos dos índices (D1-D7), contexto institucional e riscos estruturais.
              Clique em <strong>"Calcular STT"</strong> para gerar o score do período atual.
              Você pode editar a nota executiva antes de publicar.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Painel de Cálculo */}
        <div className="space-y-4">
          {/* Score atual */}
          {currentStt !== null && (
            <Card className="border border-border/60">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Score Atual</p>
                  <p className="font-mono text-4xl font-bold text-primary">{currentStt}</p>
                  <p className="text-xs text-muted-foreground">Último período registrado</p>
                </div>
                {latestScore?.activatedIndex && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Índice ativado</p>
                    <IndexBadge index={latestScore.activatedIndex} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Botão de cálculo */}
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Button
                  className="w-full bg-primary text-primary-foreground"
                  onClick={() => analyzeMutation.mutate({ territorySlug: territory.slug })}
                  disabled={analyzeMutation.isPending}
                >
                  {analyzeMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculando STT com IA...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Calcular STT — {new Date().toISOString().slice(0, 7)}</>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-sm">
                <p className="text-xs">Dispara a análise LLM completa com base nos sinais relevantes do período atual. O modelo aplica a metodologia DIT: calcula ITT, ICS, IVS, IVE e ICI individualmente, pondera pela fórmula STT = (ITT×25%) + (ICS×20%) + (IVS×20%) + (IVE×20%) + (ICI×15%), identifica o índice ativado, define o cenário e gera a nota executiva. Nenhuma interação manual é necessária para o cálculo.</p>
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>

          {analyzeMutation.isPending && (
            <div className="rounded-lg border border-purple-100 bg-purple-50 px-4 py-3 text-xs text-purple-700">
              <p className="font-semibold mb-1">Processando...</p>
              <p>O LLM está analisando os sinais coletados com base no contexto territorial completo da metodologia DIT.</p>
            </div>
          )}

          {/* Resultado do cálculo */}
          {llmResult && (
            <Card className="border-2 border-purple-300 bg-purple-50/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <CardTitle className="text-sm font-semibold text-purple-900">STT Calculado pelo LLM</CardTitle>
                  <span className="ml-auto text-xs text-purple-600">{llmResult.analyzed} sinais analisados</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Score principal */}
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">STT</p>
                    <p className="font-mono text-5xl font-bold text-primary">{llmResult.calculatedStt}</p>
                  </div>
                  <div className="pb-2">
                    <span className={`font-mono text-sm font-bold flex items-center gap-1 ${
                      llmResult.variation > 0 ? "text-red-600" : llmResult.variation < 0 ? "text-green-600" : "text-muted-foreground"
                    }`}>
                      {llmResult.variation > 0 ? <TrendingUp className="h-4 w-4" /> : llmResult.variation < 0 ? <TrendingDown className="h-4 w-4" /> : null}
                      {llmResult.variation > 0 ? "+" : ""}{llmResult.variation} pts
                    </span>
                    <p className="text-xs text-muted-foreground">em relação ao anterior</p>
                  </div>
                  <div className="pb-2 ml-auto">
                    <IndexBadge index={llmResult.activatedIndex} />
                    <p className="text-xs text-muted-foreground mt-1">índice ativado</p>
                  </div>
                </div>

                {/* Sub-índices */}
                <div className="grid grid-cols-5 gap-2">
                  {([
                    { key: "calculatedItt", label: "ITT" },
                    { key: "calculatedIcs", label: "ICS" },
                    { key: "calculatedIvs", label: "IVS" },
                    { key: "calculatedIve", label: "IVE" },
                    { key: "calculatedIci", label: "ICI" },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="rounded-lg border border-border/60 bg-white p-2 text-center">
                      <p className="text-xs font-bold text-muted-foreground">{label}</p>
                      <p className="font-mono text-lg font-bold text-foreground">{llmResult[key]}</p>
                    </div>
                  ))}
                </div>

                {/* Cenário */}
                <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                  scenarioLabels[llmResult.scenario]?.color ?? "text-gray-700 bg-gray-50 border-gray-200"
                }`}>
                  Cenário: {scenarioLabels[llmResult.scenario]?.label ?? llmResult.scenario}
                </div>

                {/* Nota executiva editável */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">Nota Executiva</Label>
                    <button
                      onClick={() => setNoteEditing(!noteEditing)}
                      className="text-xs text-primary hover:underline"
                    >
                      {noteEditing ? "Cancelar edição" : "Editar nota"}
                    </button>
                  </div>
                  {noteEditing ? (
                    <Textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="h-28 resize-none text-sm"
                    />
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed rounded-lg border border-border/60 bg-white px-3 py-2">
                      {editNote || llmResult.executiveNote}
                    </p>
                  )}
                </div>

                {/* Publicar */}
                <div className="space-y-3 border-t border-border/40 pt-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="publish-check"
                      checked={published}
                      onChange={(e) => setPublished(e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <Label htmlFor="publish-check" className="text-sm cursor-pointer">
                      Publicar alerta para assinantes
                    </Label>
                  </div>
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="w-full bg-green-600 text-white hover:bg-green-700"
                          onClick={handlePublish}
                          disabled={publishMutation.isPending}
                        >
                          {publishMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          )}
                          {published ? "Confirmar e Publicar Score" : "Salvar Score (rascunho)"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm">
                        <p className="text-xs">
                          {published
                            ? "Grava o score no histórico e envia um alerta para todos os assinantes do território com o novo STT, cenário e nota executiva. Esta ação é irreversível."
                            : "Grava o score no histórico como rascunho interno. Não envia alertas para assinantes. Pode ser publicado posteriormente."
                          }
                        </p>
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Histórico */}
        <Card className="border border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Histórico de Scores</CardTitle>
          </CardHeader>
          <CardContent>
            {!history?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum score registrado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((score) => (
                  <div
                    key={score.id}
                    className="rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{score.period}</span>
                        {score.activatedIndex && <IndexBadge index={score.activatedIndex} />}
                        {score.scenario && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            scenarioLabels[score.scenario]?.color ?? "text-gray-600 bg-gray-50 border-gray-200"
                          }`}>
                            {scenarioLabels[score.scenario]?.label ?? score.scenario}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {score.variation !== null && score.variation !== undefined && (
                          <span className={`font-mono text-xs font-bold flex items-center gap-0.5 ${
                            score.variation > 0 ? "text-red-600" : score.variation < 0 ? "text-green-600" : "text-muted-foreground"
                          }`}>
                            {score.variation > 0 ? <TrendingUp className="h-3 w-3" /> : score.variation < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                            {score.variation > 0 ? "+" : ""}{score.variation?.toFixed(1)}
                          </span>
                        )}
                        <span className="font-mono text-2xl font-bold text-primary">{score.stt}</span>
                        {score.published ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    {score.executiveNote && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {score.executiveNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Painel de Assinantes ─────────────────────────────────────────────────────

function SubscribersPanel() {
  const { data: subscribers, isLoading } = trpc.subscribers.list.useQuery();

  const planLabels: Record<string, string> = {
    free_alert: "Alerta Gratuito",
    radar: "Radar™",
    dit: "DIT",
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {subscribers?.length ?? 0} assinante(s) cadastrado(s)
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !subscribers?.length ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhum assinante ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Os cadastros do formulário de alerta gratuito aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Setor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Território</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Plano</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => (
                <tr key={sub.id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{sub.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sub.company ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sub.sector ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sub.territoryInterest ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {planLabels[sub.plan] ?? sub.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(sub.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Painel One-Pager ─────────────────────────────────────────────────────────

function OnePagerPanel({ territory }: { territory: Territory }) {
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

  const generateMutation = trpc.onepager.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      toast.success(`One-pager gerado para ${data.territory} — ${data.signalCount} sinais incluídos.`);
    },
    onError: (e) => toast.error(`Erro ao gerar: ${e.message}`),
  });

  const handleCopy = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent);
      toast.success("Conteúdo copiado para a área de transferência");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Gerar One-Pager Executivo
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            O LLM analisa os sinais relevantes curados e gera um relatório executivo formatado para o período selecionado.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">Período</Label>
              <Input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-03"
                className="h-8 text-sm w-32"
              />
            </div>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => generateMutation.mutate({ territorySlug: territory.slug, period })}
                    disabled={generateMutation.isPending}
                    className="bg-primary text-primary-foreground"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Gerar One-Pager
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  <p className="text-xs">Gera um relatório executivo de 1 página para o período selecionado. O LLM usa os sinais relevantes curados, o score STT publicado e o contexto territorial para produzir: síntese do período, score com variação, índice ativado, 3 sinais principais, cenário e recomendação estratégica. Pronto para copiar e enviar a clientes.</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-800">
              <strong>Como funciona:</strong> O gerador usa os sinais com status "Relevante" para o território selecionado.
              Curate os sinais na aba "Sinais Coletados" antes de gerar o relatório.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo Gerado */}
      {generatedContent && (
        <Card className="border border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Relatório Gerado</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopy} className="text-xs">
                  Copiar Markdown
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/60 bg-white p-6 prose prose-sm max-w-none">
              <Streamdown>{generatedContent}</Streamdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Dashboard Principal ──────────────────────────────────────────────────────

export default function Dashboard() {
  const { admin, isAuthenticated, isLoading: loading } = useDashboardAuth();
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<number | null>(null);

  const logoutMutation = trpc.dashboardAuth.logout.useMutation({
    onSuccess: () => { window.location.href = "/dashboard/login"; },
  });

  const { data: territories } = trpc.territories.list.useQuery();

  const selectedTerritory = territories?.find((t) => t.id === selectedTerritoryId) ?? territories?.[0];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirecionar automaticamente para a tela de login
    if (typeof window !== "undefined") {
      window.location.replace("/dashboard/login");
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Acesso Restrito</h1>
          <p className="mt-2 text-muted-foreground">Este painel é exclusivo para a equipe Print.</p>
        </div>
        <Link href="/dashboard/login">
          <Button className="bg-primary text-primary-foreground">
            Entrar no Dashboard
          </Button>
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar ao site
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Site</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm font-bold text-foreground">
                Radar Territorial™ — Curadoria
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
              Admin
            </span>
            <span className="text-sm text-muted-foreground">{admin?.email}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3 w-3" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Seletor de Território */}
        <div className="mb-8 flex items-center gap-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Território</Label>
            <div className="mt-1 flex gap-2">
              {territories?.map((t) => (
                <Button
                  key={t.id}
                  size="sm"
                  variant={selectedTerritory?.id === t.id ? "default" : "outline"}
                  onClick={() => setSelectedTerritoryId(t.id)}
                  className="text-xs"
                >
                  {t.name}
                </Button>
              ))}
            </div>
          </div>
          {selectedTerritory && (
            <div className="ml-auto flex items-end">
              <Link href={`/dashboard/dit/${selectedTerritory.slug}`}>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20">
                  <ShieldAlert className="h-4 w-4" />
                  Abrir Command Center Premium
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Aba de novo território — sempre visível */}
        <div className="mb-6">
          <Tabs defaultValue="signals">
            <TabsList className="mb-4">
              <TabsTrigger value="signals" className="gap-2">
                <Activity className="h-4 w-4" />
                Sinais
              </TabsTrigger>
              <TabsTrigger value="new-territory" className="gap-2">
                <Globe className="h-4 w-4" />
                Novo Território
              </TabsTrigger>
            </TabsList>
            <TabsContent value="signals">
              {/* conteúdo abaixo */}
            </TabsContent>
            <TabsContent value="new-territory">
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6">
                  <TerritoryWizard onComplete={() => window.location.reload()} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {selectedTerritory && (
          <Tabs defaultValue="signals">
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="signals" className="gap-2">
                <Activity className="h-4 w-4" />
                Sinais Coletados
              </TabsTrigger>
              <TabsTrigger value="stt" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Score STT
              </TabsTrigger>
              <TabsTrigger value="publish" className="gap-2">
                <Shield className="h-4 w-4" />
                Publicar STT
              </TabsTrigger>
              <TabsTrigger value="feed" className="gap-2">
                <Rss className="h-4 w-4" />
                Feed ao Vivo
              </TabsTrigger>
              <TabsTrigger value="agents" className="gap-2">
                <Bot className="h-4 w-4" />
                Agentes
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart2 className="h-4 w-4" />
                Histórico Temporal
              </TabsTrigger>
              <TabsTrigger value="onepager" className="gap-2">
                <FileText className="h-4 w-4" />
                One-Pager
              </TabsTrigger>
              <TabsTrigger value="subscribers" className="gap-2">
                <Users className="h-4 w-4" />
                Assinantes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signals">
              <SignalsPanel territory={selectedTerritory} />
            </TabsContent>

            <TabsContent value="stt">
              <SttPanel territory={selectedTerritory} />
            </TabsContent>

            <TabsContent value="publish">
              <SttPublishPanel territorySlug={selectedTerritory.slug} />
            </TabsContent>

            <TabsContent value="feed">
              <SignalFeed territoryId={selectedTerritory.id} maxItems={50} />
            </TabsContent>

            <TabsContent value="agents">
              <AgentHealthPanel />
            </TabsContent>

            <TabsContent value="analytics">
              <AnalyticsPanel territory={selectedTerritory} />
            </TabsContent>

            <TabsContent value="onepager">
              <OnePagerPanel territory={selectedTerritory} />
            </TabsContent>

            <TabsContent value="subscribers">
              <SubscribersPanel />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
