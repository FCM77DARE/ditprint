/**
 * AnalyticsPanel — Painel de Análise Histórica Temporal
 * Exibe evolução dos 5 índices STT (ITT, ICS, IVS, IVE, ICI) ao longo do tempo
 * com gráficos de linha, barras empilhadas, tabela de variações e eventos críticos
 */

import { useState, Fragment } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronRight, ExternalLink, Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, History, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
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
  AreaChart,
  Area,
} from "recharts";

type Territory = {
  id: number;
  slug: string;
  name: string;
};

// Cores dos índices
const INDEX_COLORS = {
  stt: "#6366f1",
  d1: "#10b981", // green
  d2: "#f59e0b", // orange
  d3: "#3b82f6", // blue
  d4: "#ef4444", // red
  d5: "#8b5cf6", // purple
  d6: "#14b8a6", // teal
  d7: "#06b6d4", // cyan
};

const INDEX_LABELS = {
  stt: "STT",
  d1: "D1 — Socioambiental",
  d2: "D2 — Socioeconômica",
  d3: "D3 — Infraestrutura",
  d4: "D4 — Dinâmica Territorial",
  d5: "D5 — Governança",
  d6: "D6 — Reputação",
  d7: "D7 — Recursos Naturais e Pot.",
};

const SCENARIO_COLORS: Record<string, string> = {
  estabilidade: "text-green-600 bg-green-50",
  pressao: "text-amber-600 bg-amber-50",
  escalada: "text-red-600 bg-red-50",
};

const SCENARIO_LABELS: Record<string, string> = {
  estabilidade: "Estabilidade",
  pressao: "Pressão",
  escalada: "Escalada",
};

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === undefined) return <span className="text-muted-foreground text-xs">—</span>;
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-red-600 text-xs font-mono font-bold">
      <TrendingUp className="h-3 w-3" />+{delta.toFixed(1)}
    </span>
  );
  if (delta < 0) return (
    <span className="flex items-center gap-0.5 text-green-600 text-xs font-mono font-bold">
      <TrendingDown className="h-3 w-3" />{delta.toFixed(1)}
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground text-xs font-mono">
      <Minus className="h-3 w-3" />0
    </span>
  );
}

// Tooltip customizado para os gráficos
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-bold text-foreground">{entry.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Sub-componente: Sinais de um período específico ─────────────────────────
function PeriodSignals({ territoryId, period }: { territoryId: number; period: string }) {
  const { data: signals, isLoading } = trpc.signals.listByPeriod.useQuery({ territoryId, period, limit: 30 });

  if (isLoading) return (
    <div className="flex items-center gap-2 py-3 px-4 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Carregando sinais...
    </div>
  );
  if (!signals?.length) return (
    <div className="py-3 px-4 text-xs text-muted-foreground italic">
      Nenhum sinal coletado para este período.
    </div>
  );

  const SOURCE_ICONS: Record<string, string> = {
    newsapi: "📰",
    ibama: "🚫",
    ibge: "📊",
    inpe: "🛰️",
    ana: "💧",
    querido_diario: "📜",
  };

  const STATUS_COLORS: Record<string, string> = {
    pending: "text-amber-600 bg-amber-50 border-amber-200",
    relevant: "text-green-700 bg-green-50 border-green-200",
    ignored: "text-muted-foreground bg-muted/30 border-border",
    analyzed: "text-purple-700 bg-purple-50 border-purple-200",
  };
  const STATUS_LABELS: Record<string, string> = {
    pending: "Pendente",
    relevant: "Relevante",
    ignored: "Ignorado",
    analyzed: "Analisado",
  };

  return (
    <div className="border-t border-border/30 bg-muted/10">
      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {signals.length} sinal(is) coletado(s) em {period}
      </div>
      <div className="divide-y divide-border/20">
        {signals.map((s) => (
          <div key={s.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
            <span className="text-base mt-0.5 flex-shrink-0">{SOURCE_ICONS[s.source] ?? "📄"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                {s.relatedIndex && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: INDEX_COLORS[(s.relatedIndex?.toLowerCase() as keyof typeof INDEX_COLORS)] ?? "#6366f1" }}>
                    {s.relatedIndex}
                  </span>
                )}
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[s.curationStatus] ?? ""}`}>
                  {STATUS_LABELS[s.curationStatus] ?? s.curationStatus}
                </span>
                {s.publishedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(s.publishedAt).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-foreground leading-snug">{s.title}</p>
              {s.llmAnalysis && (
                <p className="mt-0.5 text-[11px] text-purple-700 leading-relaxed line-clamp-2">{s.llmAnalysis}</p>
              )}
            </div>
            {s.url && (
              <a href={s.url} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors mt-0.5">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPanel({ territory }: { territory: Territory }) {
  const [activeLines, setActiveLines] = useState<Set<string>>(
    new Set(["stt", "d1", "d2", "d3", "d4", "d5", "d6", "d7"])
  );
  const [chartView, setChartView] = useState<"line" | "area" | "bar">("area");
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: history, isLoading } = trpc.analytics.indexHistory.useQuery({
    territoryId: territory.id,
    limit: 24,
  });

  const { data: historicalStatus } = trpc.historical.status.useQuery({
    territoryId: territory.id,
  });

  const collectHistoricalMutation = trpc.historical.collect.useMutation({
    onSuccess: (data) => {
      toast.success(`Coleta histórica concluída: ${data.newPeriods} novos períodos`);
      utils.analytics.indexHistory.invalidate();
      utils.historical.status.invalidate();
    },
    onError: (err) => toast.error(`Erro na coleta histórica: ${err.message}`),
  });

  const backfillSignalsMutation = trpc.historical.backfillSignals.useMutation({
    onSuccess: (data) => {
      toast.success(`Recoleta concluída: ${data.totalNewSignals} novos sinais em ${data.periodsWithNewSignals} períodos`);
      utils.analytics.indexHistory.invalidate();
      utils.signals.listByPeriod.invalidate();
    },
    onError: (err) => toast.error(`Erro na recoleta: ${err.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-sm text-muted-foreground">Carregando série histórica...</span>
      </div>
    );
  }

  // Painel de cobertura histórica (sempre visível)
  const coveragePanel = (
    <Card className="border border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Cobertura Histórica (24 meses)</p>
              <p className="text-xs text-muted-foreground">
                {historicalStatus?.existingPeriods?.length ?? 0} de 24 períodos coletados
                {historicalStatus?.coverage !== undefined && (
                  <span className="ml-2 font-mono font-bold text-primary">{historicalStatus.coverage}%</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {historicalStatus?.missingPeriods && historicalStatus.missingPeriods.length > 0 && (
              <div className="flex gap-1 flex-wrap max-w-xs">
                {historicalStatus.missingPeriods.slice(0, 6).map(p => (
                  <Badge key={p} variant="outline" className="text-xs font-mono text-amber-600 border-amber-300">
                    <Clock className="h-2.5 w-2.5 mr-1" />{p}
                  </Badge>
                ))}
                {historicalStatus.missingPeriods.length > 6 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">+{historicalStatus.missingPeriods.length - 6} mais</Badge>
                )}
              </div>
            )}
            {historicalStatus?.missingPeriods?.length === 0 && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />Cobertura completa
              </Badge>
            )}
            <Button
              size="sm"
              onClick={() => backfillSignalsMutation.mutate({ territorySlug: territory.slug, monthsBack: 24 })}
              disabled={backfillSignalsMutation.isPending || collectHistoricalMutation.isPending}
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/10"
              title="Recoleta sinais (notícias e dados) para períodos que já têm STT calculado mas poucos sinais. Não recalcula o STT."
            >
              {backfillSignalsMutation.isPending ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Recoletando sinais...</>
              ) : (
                <><Newspaper className="h-3 w-3 mr-1" />Recoleta de Sinais</>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => collectHistoricalMutation.mutate({ territorySlug: territory.slug, monthsBack: 24 })}
              disabled={collectHistoricalMutation.isPending || backfillSignalsMutation.isPending}
              className="bg-primary text-primary-foreground"
              title="Coleta dados históricos e calcula o STT via LLM para os períodos ainda não processados (24 meses)."
            >
              {collectHistoricalMutation.isPending ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Coletando...</>
              ) : (
                <><History className="h-3 w-3 mr-1" />Coletar 24 meses</>  
              )}
            </Button>
          </div>
        </div>
        {collectHistoricalMutation.isPending && (
          <div className="mt-3 rounded-lg bg-primary/10 p-3">
            <p className="text-xs text-primary">
              Coletando dados históricos mês a mês e calculando STT via LLM para cada período.
              Este processo pode levar alguns minutos. Não feche esta aba.
            </p>
          </div>
        )}
        {backfillSignalsMutation.isPending && (
          <div className="mt-3 rounded-lg bg-primary/10 p-3">
            <p className="text-xs text-primary">
              Recoletando notícias e dados estruturados para todos os 24 períodos.
              Sinais já classificados como relevantes pela IA. Este processo pode levar alguns minutos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!history?.length) {
    return (
      <div className="space-y-4">
        {coveragePanel}
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhum dado histórico disponível.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique em "Coletar 24 meses" acima para iniciar a coleta retroativa automática.
          </p>
        </div>
      </div>
    );
  }

  // Formatar dados para os gráficos
  const chartData = history.map((h) => ({
    period: h.period,
    stt: h.stt ?? null,
    d1: h.d1Score ?? null,
    d2: h.d2Score ?? null,
    d3: h.d3Score ?? null,
    d4: h.d4Score ?? null,
    d5: h.d5Score ?? null,
    d6: h.d6Score ?? null,
    d7: h.d7Score ?? null,
    scenario: h.scenario,
    sttDelta: h.sttDelta ?? null,
    d1Delta: h.d1Delta ?? null,
    d2Delta: h.d2Delta ?? null,
    d3Delta: h.d3Delta ?? null,
    d4Delta: h.d4Delta ?? null,
    d5Delta: h.d5Delta ?? null,
    d6Delta: h.d6Delta ?? null,
    d7Delta: h.d7Delta ?? null,
    signalCount: h.signalCount ?? 0,
    relevantSignalCount: h.relevantSignalCount ?? 0,
    keyEvents: h.keyEvents as any[] ?? [],
    llmRationale: h.llmRationale ?? null,
  }));

  // Calcular estatísticas resumidas
  const latestPeriod = history[history.length - 1];
  const firstPeriod = history[0];
  const sttValues = history.map((h) => h.stt ?? 0).filter(Boolean);
  const sttMin = Math.min(...sttValues);
  const sttMax = Math.max(...sttValues);
  const sttAvg = sttValues.reduce((a, b) => a + b, 0) / sttValues.length;

  // Eventos críticos (sinais de alto impacto ao longo do histórico)
  const allKeyEvents = history
    .flatMap((h) => {
      const events = h.keyEvents as any[] ?? [];
      return events.map((e: any) => ({ ...e, period: h.period }));
    })
    .filter((e) => e.impactScore >= 0.6)
    .slice(0, 10);

  const toggleLine = (key: string) => {
    setActiveLines((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Painel de cobertura histórica */}
      {coveragePanel}

      {/* KPIs resumidos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">STT Atual</p>
            <p className="font-mono text-3xl font-bold text-primary mt-1">{latestPeriod?.stt?.toFixed(1) ?? "—"}</p>
            <DeltaBadge delta={latestPeriod?.sttDelta ?? null} />
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Máximo histórico</p>
            <p className="font-mono text-3xl font-bold text-red-500 mt-1">{sttMax.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">pico de tensão</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Mínimo histórico</p>
            <p className="font-mono text-3xl font-bold text-green-600 mt-1">{sttMin.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">menor tensão</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Média histórica</p>
            <p className="font-mono text-3xl font-bold text-foreground mt-1">{sttAvg.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">{history.length} períodos</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico principal — evolução temporal */}
      <Card className="border border-border/60">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Evolução Temporal dos Índices STT
            </CardTitle>
            <div className="flex gap-1">
              {(["area", "line", "bar"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setChartView(v)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    chartView === v
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {v === "area" ? "Área" : v === "line" ? "Linha" : "Barras"}
                </button>
              ))}
            </div>
          </div>
          {/* Toggles de índices */}
          <div className="flex flex-wrap gap-2 mt-3">
            {(Object.keys(INDEX_COLORS) as (keyof typeof INDEX_COLORS)[]).map((key) => (
              <button
                key={key}
                onClick={() => toggleLine(key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  activeLines.has(key)
                    ? "border-transparent text-white"
                    : "border-border bg-background text-muted-foreground opacity-50"
                }`}
                style={activeLines.has(key) ? { backgroundColor: INDEX_COLORS[key] } : {}}
              >
                {key.toUpperCase()}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={360}>
            {chartView === "bar" ? (
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activeLines.has("d1") && <Bar dataKey="d1" name="D1" fill={INDEX_COLORS.d1} stackId="a" />}
                {activeLines.has("d2") && <Bar dataKey="d2" name="D2" fill={INDEX_COLORS.d2} stackId="a" />}
                {activeLines.has("d3") && <Bar dataKey="d3" name="D3" fill={INDEX_COLORS.d3} stackId="a" />}
                {activeLines.has("d4") && <Bar dataKey="d4" name="D4" fill={INDEX_COLORS.d4} stackId="a" />}
                {activeLines.has("d5") && <Bar dataKey="d5" name="D5" fill={INDEX_COLORS.d5} stackId="a" />}
                {activeLines.has("d6") && <Bar dataKey="d6" name="D6" fill={INDEX_COLORS.d6} stackId="a" />}
                {activeLines.has("d7") && <Bar dataKey="d7" name="D7" fill={INDEX_COLORS.d7} stackId="a" />}
              </BarChart>
            ) : chartView === "area" ? (
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  {(Object.keys(INDEX_COLORS) as (keyof typeof INDEX_COLORS)[]).map((key) => (
                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={INDEX_COLORS[key]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={INDEX_COLORS[key]} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis domain={[55, 100]} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Alta tensão", position: "right", fontSize: 10, fill: "#ef4444" }} />
                <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Atenção", position: "right", fontSize: 10, fill: "#f59e0b" }} />
                {activeLines.has("stt") && (
                  <Area type="monotone" dataKey="stt" name="STT" stroke={INDEX_COLORS.stt} fill={`url(#grad-stt)`} strokeWidth={3} dot={{ r: 3 }} />
                )}
                {activeLines.has("d1") && (
                  <Area type="monotone" dataKey="d1" name="D1" stroke={INDEX_COLORS.d1} fill={`url(#grad-d1)`} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d2") && (
                  <Area type="monotone" dataKey="d2" name="D2" stroke={INDEX_COLORS.d2} fill={`url(#grad-d2)`} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d3") && (
                  <Area type="monotone" dataKey="d3" name="D3" stroke={INDEX_COLORS.d3} fill={`url(#grad-d3)`} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d4") && (
                  <Area type="monotone" dataKey="d4" name="D4" stroke={INDEX_COLORS.d4} fill={`url(#grad-d4)`} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d5") && (
                  <Area type="monotone" dataKey="d5" name="D5" stroke={INDEX_COLORS.d5} fill={`url(#grad-d5)`} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d6") && (
                  <Area type="monotone" dataKey="d6" name="D6" stroke={INDEX_COLORS.d6} fill={`url(#grad-d6)`} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d7") && (
                  <Area type="monotone" dataKey="d7" name="D7" stroke={INDEX_COLORS.d7} fill={`url(#grad-d7)`} strokeWidth={1.5} dot={false} />
                )}
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis domain={[55, 100]} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 4" />
                <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" />
                {activeLines.has("stt") && (
                  <Line type="monotone" dataKey="stt" name="STT" stroke={INDEX_COLORS.stt} strokeWidth={3} dot={{ r: 3 }} />
                )}
                {activeLines.has("d1") && (
                  <Line type="monotone" dataKey="d1" name="D1" stroke={INDEX_COLORS.d1} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d2") && (
                  <Line type="monotone" dataKey="d2" name="D2" stroke={INDEX_COLORS.d2} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d3") && (
                  <Line type="monotone" dataKey="d3" name="D3" stroke={INDEX_COLORS.d3} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d4") && (
                  <Line type="monotone" dataKey="d4" name="D4" stroke={INDEX_COLORS.d4} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d5") && (
                  <Line type="monotone" dataKey="d5" name="D5" stroke={INDEX_COLORS.d5} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d6") && (
                  <Line type="monotone" dataKey="d6" name="D6" stroke={INDEX_COLORS.d6} strokeWidth={1.5} dot={false} />
                )}
                {activeLines.has("d7") && (
                  <Line type="monotone" dataKey="d7" name="D7" stroke={INDEX_COLORS.d7} strokeWidth={1.5} dot={false} />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela de variações por período */}
      <Card className="border border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Variações por Período</CardTitle>
          <p className="text-xs text-muted-foreground">
            Delta em relação ao período anterior. Vermelho = aumento de tensão, verde = redução.
            <span className="ml-2 text-primary">Clique em um período para ver os sinais coletados.</span>
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-6"></th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Período</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: INDEX_COLORS.stt }}>STT</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: INDEX_COLORS.d1 }}>D1 Δ</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: INDEX_COLORS.d2 }}>D2 Δ</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: INDEX_COLORS.d3 }}>D3 Δ</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: INDEX_COLORS.d4 }}>D4 Δ</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: INDEX_COLORS.d5 }}>D5 Δ</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: INDEX_COLORS.d6 }}>D6 Δ</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: INDEX_COLORS.d7 }}>D7 Δ</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Cenário</th>
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Sinais</th>
                </tr>
              </thead>
              <tbody>
                {[...chartData].reverse().map((row) => (
                  <Fragment key={row.period}>
                    <tr
                      className={`border-b border-border/40 cursor-pointer transition-colors ${
                        expandedPeriod === row.period ? "bg-primary/5" : "hover:bg-muted/20"
                      }`}
                      onClick={() => setExpandedPeriod(expandedPeriod === row.period ? null : row.period)}
                    >
                      <td className="px-3 py-2 text-muted-foreground">
                        {expandedPeriod === row.period
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium">{row.period}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-mono font-bold text-sm" style={{ color: INDEX_COLORS.stt }}>
                          {row.stt?.toFixed(1) ?? "—"}
                        </span>
                        {row.sttDelta !== null && row.sttDelta !== undefined && (
                          <span className={`ml-1 text-xs ${row.sttDelta > 0 ? "text-red-500" : row.sttDelta < 0 ? "text-green-500" : "text-muted-foreground"}`}>
                            ({row.sttDelta > 0 ? "+" : ""}{row.sttDelta?.toFixed(1)})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center"><DeltaBadge delta={row.d1Delta} /></td>
                      <td className="px-3 py-2 text-center"><DeltaBadge delta={row.d2Delta} /></td>
                      <td className="px-3 py-2 text-center"><DeltaBadge delta={row.d3Delta} /></td>
                      <td className="px-3 py-2 text-center"><DeltaBadge delta={row.d4Delta} /></td>
                      <td className="px-3 py-2 text-center"><DeltaBadge delta={row.d5Delta} /></td>
                      <td className="px-3 py-2 text-center"><DeltaBadge delta={row.d6Delta} /></td>
                      <td className="px-3 py-2 text-center"><DeltaBadge delta={row.d7Delta} /></td>
                      <td className="px-3 py-2 text-center">
                        {row.scenario ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SCENARIO_COLORS[row.scenario] ?? ""}`}>
                            {SCENARIO_LABELS[row.scenario] ?? row.scenario}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-mono font-semibold ${
                          (row.signalCount ?? 0) > 0 ? "text-primary" : "text-muted-foreground"
                        }`}>
                          {row.signalCount ?? 0}
                        </span>
                      </td>
                    </tr>
                    {expandedPeriod === row.period && (
                      <tr key={`${row.period}-signals`} className="border-b border-border/40">
                        <td colSpan={9} className="p-0">
                          <PeriodSignals territoryId={territory.id} period={row.period} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Eventos críticos */}
      {allKeyEvents.length > 0 && (
        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Eventos Críticos Registrados
            </CardTitle>
            <p className="text-xs text-muted-foreground">Sinais com impacto ≥ 60% que influenciaram o cálculo do STT</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allKeyEvents.map((event, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-border/40 p-3">
                  <div className="flex-shrink-0 font-mono text-xs text-muted-foreground pt-0.5 w-14">{event.period}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-bold text-white`}
                        style={{ backgroundColor: INDEX_COLORS[event.index?.toLowerCase() as keyof typeof INDEX_COLORS] ?? "#6366f1" }}>
                        {event.index}
                      </span>
                      <span className={`text-xs font-semibold ${
                        event.impactScore >= 0.8 ? "text-red-600" : "text-amber-600"
                      }`}>
                        Impacto {Math.round(event.impactScore * 100)}%
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug">{event.title}</p>
                    {event.analysis && (
                      <p className="mt-1 text-xs text-muted-foreground">{event.analysis}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de sinais coletados por período */}
      <Card className="border border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Volume de Sinais por Período</CardTitle>
          <p className="text-xs text-muted-foreground">Total de sinais que embasaram o cálculo do STT em cada ciclo</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="signalCount" name="Total de sinais" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="relevantSignalCount" name="Sinais relevantes" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
