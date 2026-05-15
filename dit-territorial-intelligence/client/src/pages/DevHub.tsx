/**
 * DevHub — Painel de Navegação Local
 *
 * Mapa visual de todas as rotas e seções do DIT.
 * Não depende de backend. Acesse em: /dev
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  FileText,
  Globe,
  Home,
  Layers,
  LayoutDashboard,
  Lock,
  Map,
  Radio,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Status = "checking" | "online" | "offline";

interface RouteCard {
  icon: React.ReactNode;
  title: string;
  route: string;
  description: string;
  badge?: string;
  accent?: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const PUBLIC_ROUTES: RouteCard[] = [
  {
    icon: <Home className="h-5 w-5" />,
    title: "Landing Page",
    route: "/",
    description: "Hero com carrossel de territórios, gauge STT ao vivo e call-to-action.",
    badge: "público",
    accent: "blue",
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: "Território — Baía de Guanabara",
    route: "/territorio/baia-guanabara",
    description: "Detalhe completo do território: STT, dimensões, sinais coletados.",
    badge: "público",
    accent: "blue",
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: "Território — Teles Pires",
    route: "/territorio/teles-pires",
    description: "Detalhe do território do bioma amazônico com dados INPE/IBAMA.",
    badge: "público",
    accent: "blue",
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Metodologia",
    route: "/metodologia",
    description: "Explicação da metodologia PRINT: 6 dimensões e fórmula STT.",
    badge: "público",
    accent: "blue",
  },
  {
    icon: <Radio className="h-5 w-5" />,
    title: "Radar™ Landing",
    route: "/radar",
    description: "Landing page do produto Radar Territorial — vista externa.",
    badge: "público",
    accent: "blue",
  },
  {
    icon: <Wifi className="h-5 w-5" />,
    title: "SSE Feed",
    route: "/sse",
    description: "Feed de eventos em tempo real via Server-Sent Events.",
    badge: "público",
    accent: "blue",
  },
];

const PORTAL_ROUTES: RouteCard[] = [
  {
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: "Portal do Assinante",
    route: "/portal",
    description: "Visão geral dos territórios monitorados com STT ao vivo e feed de alertas.",
    badge: "assinante",
    accent: "purple",
  },
  {
    icon: <Map className="h-5 w-5" />,
    title: "Território — Portal",
    route: "/portal/territorio/baia-guanabara",
    description: "Detalhe do território no contexto do assinante: histórico, feed, configuração.",
    badge: "assinante",
    accent: "purple",
  },
  {
    icon: <Bell className="h-5 w-5" />,
    title: "Histórico de Alertas",
    route: "/portal/alertas",
    description: "Log de alertas enviados: canal, impacto, status de entrega.",
    badge: "assinante",
    accent: "purple",
  },
  {
    icon: <Settings className="h-5 w-5" />,
    title: "Configurações de Alertas",
    route: "/portal/configuracoes",
    description: "Canais, threshold de impacto e horário de silêncio por território.",
    badge: "assinante",
    accent: "purple",
  },
];

const DASHBOARD_ROUTES: RouteCard[] = [
  {
    icon: <Lock className="h-5 w-5" />,
    title: "Login — Dashboard",
    route: "/dashboard/login",
    description: "Autenticação JWT para acesso ao painel interno da equipe PRINT.",
    badge: "admin",
    accent: "amber",
  },
  {
    icon: <LayoutDashboard className="h-5 w-5" />,
    title: "Dashboard Interno",
    route: "/dashboard",
    description: "Coleta, análise LLM, publicação STT, agentes e monitoramento.",
    badge: "admin",
    accent: "amber",
  },
];

const STACK: { label: string; value: string; icon: React.ReactNode }[] = [
  { label: "Runtime", value: "Node.js + tsx", icon: <Cpu className="h-3.5 w-3.5" /> },
  { label: "Frontend", value: "React 19 + Vite", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { label: "API", value: "tRPC + Express", icon: <Layers className="h-3.5 w-3.5" /> },
  { label: "DB", value: "MySQL + Drizzle", icon: <Database className="h-3.5 w-3.5" /> },
  { label: "Agentes", value: "39 (1 orq. + 6 dim. + 32 src.)", icon: <Bot className="h-3.5 w-3.5" /> },
  { label: "Dimensões", value: "D1–D6 PRINT", icon: <BarChart2 className="h-3.5 w-3.5" /> },
];

// ─── Badge accent map ─────────────────────────────────────────────────────────

const BADGE_STYLES: Record<string, string> = {
  blue:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  amber:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const BADGE_LABEL: Record<string, string> = {
  público:   "público",
  assinante: "assinante",
  admin:     "admin",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status, onRetry }: { status: Status; onRetry: () => void }) {
  return (
    <button
      onClick={onRetry}
      className="flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs transition-all hover:opacity-80"
      style={{
        borderColor: status === "online" ? "oklch(0.5 0.2 145 / 0.3)" : status === "offline" ? "oklch(0.5 0.2 20 / 0.3)" : "oklch(0.5 0.05 260 / 0.3)",
        background:  status === "online" ? "oklch(0.5 0.2 145 / 0.08)" : status === "offline" ? "oklch(0.5 0.2 20 / 0.08)" : "oklch(0.5 0.05 260 / 0.08)",
        color:       status === "online" ? "oklch(0.7 0.2 145)" : status === "offline" ? "oklch(0.7 0.2 20)" : "oklch(0.65 0.05 260)",
      }}
    >
      {status === "checking" && <RefreshCw className="h-3 w-3 animate-spin" />}
      {status === "online"   && <CheckCircle2 className="h-3 w-3" />}
      {status === "offline"  && <WifiOff className="h-3 w-3" />}
      {status === "checking" ? "verificando…" : status === "online" ? "backend online" : "backend offline"}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {children}
      </span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

function RouteCardItem({ card }: { card: RouteCard }) {
  const accentKey = card.accent ?? "blue";
  const badgeStyle = BADGE_STYLES[accentKey];

  return (
    <Link href={card.route}>
      <div className="group relative flex flex-col gap-3 rounded-xl border border-border/40 bg-card/50 p-5 transition-all duration-200 hover:border-border/80 hover:bg-card hover:shadow-lg hover:-translate-y-0.5 cursor-pointer h-full">
        {/* Icon + badge row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/40 bg-muted/30 text-muted-foreground group-hover:border-border/80 group-hover:text-foreground transition-all">
            {card.icon}
          </div>
          {card.badge && (
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}>
              {BADGE_LABEL[card.badge] ?? card.badge}
            </span>
          )}
        </div>

        {/* Title */}
        <div>
          <p className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
            {card.title}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/70 truncate">
            {card.route}
          </p>
        </div>

        {/* Description */}
        <p className="font-body text-xs text-muted-foreground leading-relaxed flex-1">
          {card.description}
        </p>

        {/* CTA */}
        <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors pt-1">
          Abrir
          <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

// ─── STT Mini Gauge ───────────────────────────────────────────────────────────

function MiniGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const pct = value / 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
        <circle
          cx="36" cy="36" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="currentColor" fontFamily="JetBrains Mono, monospace">
          {value}
        </text>
      </svg>
      <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DevHub() {
  const [status, setStatus] = useState<Status>("checking");

  const checkBackend = () => {
    setStatus("checking");
    fetch("/api/trpc/system.health?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D", {
      method: "GET",
    })
      .then((r) => setStatus(r.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"));
  };

  useEffect(() => {
    checkBackend();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle grid */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.45 0.20 250 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(0.45 0.20 250 / 0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10">
        {/* ── Top Bar ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
          <div className="container">
            <div className="flex h-16 items-center justify-between gap-4">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/20">
                  <Zap className="h-4 w-4 text-primary" fill="currentColor" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold leading-none text-foreground">PRINT</p>
                  <p className="font-mono text-[9px] leading-none tracking-widest text-primary/70 mt-0.5">
                    DEV HUB
                  </p>
                </div>
              </div>

              {/* Center — Route count */}
              <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <span className="tabular-nums font-bold text-foreground">
                  {PUBLIC_ROUTES.length + PORTAL_ROUTES.length + DASHBOARD_ROUTES.length}
                </span>
                rotas mapeadas
              </div>

              {/* Right — Status */}
              <StatusPill status={status} onRetry={checkBackend} />
            </div>
          </div>
        </header>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="container py-12">
          <div className="flex flex-col gap-2 mb-10">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                DIT · Diagnóstico de Inteligência Territorial
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold leading-none tracking-tight text-foreground">
              Navigator Local
            </h1>
            <p className="font-body text-sm text-muted-foreground max-w-xl mt-1">
              Mapa completo de todas as rotas e seções da plataforma.
              Clique em qualquer card para navegar — o backend precisa estar rodando
              para as rotas que consultam dados.
            </p>
          </div>

          {/* ── STT Demo Row ──────────────────────────────────────────── */}
          <div className="mb-12 flex flex-wrap items-center gap-8 rounded-xl border border-border/40 bg-muted/10 px-8 py-6">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Score STT — Visualização demo
              </p>
              <div className="flex items-center gap-6">
                <MiniGauge value={78} label="Escalada" color="oklch(0.6 0.22 25)" />
                <MiniGauge value={54} label="Pressão" color="oklch(0.7 0.18 60)" />
                <MiniGauge value={32} label="Estabilidade" color="oklch(0.65 0.2 145)" />
              </div>
            </div>
            <div className="hidden lg:block h-16 w-px bg-border/40" />
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {STACK.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-muted-foreground/60">{s.icon}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{s.label}</span>
                  <span className="font-mono text-[10px] font-bold text-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Seção: Públicas ───────────────────────────────────────── */}
          <div className="mb-10">
            <SectionLabel>
              <Globe className="h-3.5 w-3.5 inline mr-1.5" />
              Páginas Públicas
            </SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PUBLIC_ROUTES.map((card) => (
                <RouteCardItem key={card.route} card={card} />
              ))}
            </div>
          </div>

          {/* ── Seção: Portal ─────────────────────────────────────────── */}
          <div className="mb-10">
            <SectionLabel>
              <Users className="h-3.5 w-3.5 inline mr-1.5" />
              Portal do Assinante
            </SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PORTAL_ROUTES.map((card) => (
                <RouteCardItem key={card.route} card={card} />
              ))}
            </div>
          </div>

          {/* ── Seção: Dashboard ──────────────────────────────────────── */}
          <div className="mb-12">
            <SectionLabel>
              <Shield className="h-3.5 w-3.5 inline mr-1.5" />
              Dashboard Interno (Admin)
            </SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2">
              {DASHBOARD_ROUTES.map((card) => (
                <RouteCardItem key={card.route} card={card} />
              ))}
            </div>
          </div>

          {/* ── Roadmap de Fases ─────────────────────────────────────── */}
          <div className="mb-10">
            <SectionLabel>
              <TrendingUp className="h-3.5 w-3.5 inline mr-1.5" />
              Status das Fases
            </SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { fase: "0", label: "Segurança", items: ["bcrypt", "JWT guard", "rate limit", "protectedProcedure"], done: true },
                { fase: "1", label: "Indicadores", items: ["6 dimensões", "schema DB", "indicators.ts", "premissas LLM"], done: true },
                { fase: "2", label: "Agentes", items: ["39 agentes", "orquestrador", "32 sources", "classificação auto"], done: true },
                { fase: "3", label: "Cálculo STT", items: ["calculator.ts", "anomalyDetector", "config migration", "wiring"], done: true },
                { fase: "4", label: "Alertas", items: ["SSE engine", "email Resend", "push FCM", "alert log"], done: true },
              ].map((f) => (
                <div key={f.fase} className="rounded-xl border border-border/40 bg-card/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">Fase {f.fase}</span>
                    {f.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Activity className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </div>
                  <p className="font-display text-sm font-bold text-foreground">{f.label}</p>
                  <ul className="space-y-1">
                    {f.items.map((item) => (
                      <li key={item} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* ── Variáveis de Ambiente ─────────────────────────────────── */}
          <div className="mb-12">
            <SectionLabel>
              <Database className="h-3.5 w-3.5 inline mr-1.5" />
              Variáveis de Ambiente Necessárias
            </SectionLabel>
            <div className="rounded-xl border border-border/40 bg-muted/10 overflow-hidden">
              <div className="grid grid-cols-1 divide-y divide-border/30">
                {[
                  { key: "DATABASE_URL",       required: true,  desc: "MySQL connection string" },
                  { key: "JWT_SECRET",          required: true,  desc: "Min 32 chars — dashboard auth" },
                  { key: "OPENAI_API_KEY",       required: true,  desc: "LLM para cálculo STT diário" },
                  { key: "RESEND_API_KEY",       required: false, desc: "Email de alertas (opcional)" },
                  { key: "NEWS_API_KEY",         required: false, desc: "NewsAPI — coleta de sinais" },
                  { key: "FIREBASE_SERVER_KEY",  required: false, desc: "Push mobile FCM (opcional)" },
                ].map((env) => (
                  <div key={env.key} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${env.required ? "bg-red-500" : "bg-muted-foreground/40"}`} />
                      <code className="font-mono text-xs font-bold text-foreground">{env.key}</code>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-body text-xs text-muted-foreground hidden sm:block">{env.desc}</span>
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold ${
                        env.required
                          ? "border-red-500/30 bg-red-500/10 text-red-400"
                          : "border-border/40 bg-muted/20 text-muted-foreground"
                      }`}>
                        {env.required ? "obrigatório" : "opcional"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Footer ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/30 pt-8 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/15">
                <Zap className="h-3 w-3 text-primary" fill="currentColor" />
              </div>
              <span className="font-mono text-xs font-bold text-foreground">PRINT</span>
              <span className="font-mono text-[10px] text-muted-foreground">Territorial Intelligence™</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                Landing
              </Link>
              <Link href="/portal" className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                Portal
              </Link>
              <Link href="/dashboard/login" className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <span className="font-mono text-[10px] text-muted-foreground/40">v0.5 · build local</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
