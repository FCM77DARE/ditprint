/**
 * DiagnosisReport — Renders the full DIT diagnosis inline in the React home.
 *
 * Source of truth: client/public/pesquisa.html (legacy static page).
 * This component replicates ALL visual blocks (hero+gauge, scenario badge,
 * executive summary, signals table, dimensions D1-D6, forecast, recommendations,
 * strategic cases, resources, sectors, hotspots) using inline styles + a self-
 * contained <style> block to preserve the cyber-luxury aesthetic without
 * Tailwind interference. It's a one-off premium report block.
 *
 * Props: { result } — the JSON body returned by POST /api/dit/analyze.
 */

import { useEffect, useRef } from "react";

// ── Tipos vindos de /api/dit/analyze (shape replicado de server/routes/ditLanding.ts)
interface DimensionBlock {
  code?: string;
  name?: string;
  complexity?: string;
  complexityNote?: string;
  insight?: string;
  signals?: string[];
}

interface KeySignal {
  source?: string;
  dimension?: string;
  dimTag?: string;
  text?: string;
  impact?: number;
  impactCls?: string;
  status?: string;
  statusCls?: string;
}

interface ForecastBlock {
  horizon?: string;
  text?: string;
  risks?: string[];
  opportunities?: string;
}

interface Recommendation {
  title?: string;
  text?: string;
  urgency?: string;
  urgCls?: string;
}

interface StrategicCase {
  caseId?: string;
  title?: string;
  relevance?: string;
  thesis?: string;
  evidence?: string[];
  potential?: string;
  risks?: string[];
}

interface ResourceItem {
  name?: string;
  abundance?: string;
  category?: string;
  notes?: string;
}

interface SectorItem {
  sectorId?: string;
  name?: string;
  maturity?: string;
  insight?: string;
}

interface Hotspot {
  lat?: number;
  lng?: number;
  name?: string;
  type?: string;
  category?: string;
  source?: string;
  impact?: number;
}

interface TerritoryGeo {
  centroid?: { lat: number; lng: number };
  bbox?: [number, number, number, number];
}

export interface DitAnalyzeResult {
  territory?: string;
  region?: string;
  stt?: number;
  scenario?: string;
  scenarioLabel?: string;
  gaugeColor?: string;
  executiveSummary?: string | string[];
  dimensions?: DimensionBlock[];
  keySignals?: KeySignal[];
  forecast?: ForecastBlock;
  recommendations?: Recommendation[];
  strategicCases?: StrategicCase[];
  resources?: ResourceItem[];
  sectors?: SectorItem[];
  hotspots?: Hotspot[];
  territoryGeo?: TerritoryGeo;
}

interface Props {
  result: DitAnalyzeResult;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function gaugeColor(scenario?: string): string {
  if (scenario === "escalada") return "#B84A3A";
  if (scenario === "pressao") return "#D4A574";
  return "#6B9B7C";
}

function dimCssClassFromComplexity(complexity?: string): string {
  if (!complexity) return "dc-zero";
  const c = complexity.toLowerCase();
  if (c.includes("alta")) return "dc-critical";
  if (c.includes("média") || c.includes("media")) return "dc-high";
  if (c.includes("baixa")) return "dc-medium";
  if (c.includes("vácuo") || c.includes("vacuo")) return "dc-zero";
  return "dc-low";
}

function relevanceCls(r?: string): string {
  const m: Record<string, string> = {
    "ESTRATÉGICO": "estrategico",
    "POTENCIAL": "potencial",
    "LATENTE": "latente",
    "NÃO APLICÁVEL": "nao-aplicavel",
  };
  return (r && m[r]) || "potencial";
}

function maturityCls(m?: string): string {
  const map: Record<string, string> = {
    "Alta Maturidade": "alta",
    "Em Desenvolvimento": "dev",
    "Latente": "latente",
    "Inexistente": "inex",
  };
  return (m && map[m]) || "latente";
}

function drawGaugeSvg(score: number, color: string): string {
  const r = 75;
  const cx = 95;
  const cy = 95;
  const pct = Math.min(score, 100) / 100;
  const start = -Math.PI * 0.75;
  const end = start + Math.PI * 1.5 * pct;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = pct > 0.5 ? 1 : 0;
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(245,241,237,0.1)" stroke-width="14" stroke-linecap="round"/>
    <path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"/>
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="Bebas Neue,sans-serif" font-size="44" fill="#F5F1ED">${score}</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="DM Mono,monospace" font-size="11" fill="rgba(245,241,237,0.5)" letter-spacing="2">/100</text>`;
}

function buildHotspotsSvg(hotspots: Hotspot[], geo?: TerritoryGeo): { svg: string; viewBox: string } | null {
  const pts = hotspots.filter(h => typeof h.lat === "number" && typeof h.lng === "number") as Array<
    Required<Pick<Hotspot, "lat" | "lng">> & Hotspot
  >;
  if (!pts.length) return null;

  let west: number;
  let south: number;
  let east: number;
  let north: number;
  if (geo && Array.isArray(geo.bbox) && geo.bbox.length === 4) {
    [west, south, east, north] = geo.bbox;
  } else {
    west = Math.min(...pts.map(p => p.lng));
    east = Math.max(...pts.map(p => p.lng));
    south = Math.min(...pts.map(p => p.lat));
    north = Math.max(...pts.map(p => p.lat));
  }
  const padX = Math.max((east - west) * 0.05, 0.01);
  const padY = Math.max((north - south) * 0.05, 0.01);
  west -= padX; east += padX; south -= padY; north += padY;

  const W = 800;
  const H = 340;
  const px = (ln: number) => ((ln - west) / (east - west)) * W;
  const py = (lt: number) => H - ((lt - south) / (north - south)) * H;
  const colorFor = (t?: string) => (t === "risco" ? "#B84A3A" : t === "vulnerabilidade" ? "#D4A574" : "#2D5340");

  let svg = `<rect x="0" y="0" width="${W}" height="${H}" fill="#f8f5f0"/>`;
  for (let i = 1; i < 5; i++) {
    svg += `<line x1="${(W * i) / 5}" y1="0" x2="${(W * i) / 5}" y2="${H}" stroke="#e8dfd0" stroke-width="1"/>`;
    svg += `<line x1="0" y1="${(H * i) / 5}" x2="${W}" y2="${(H * i) / 5}" stroke="#e8dfd0" stroke-width="1"/>`;
  }
  if (geo && geo.centroid) {
    const cxC = px(geo.centroid.lng);
    const cyC = py(geo.centroid.lat);
    svg += `<circle cx="${cxC}" cy="${cyC}" r="6" fill="none" stroke="#2D5340" stroke-width="2" stroke-dasharray="3,3"/>`;
    svg += `<text x="${cxC + 10}" y="${cyC + 4}" font-family="DM Mono,monospace" font-size="10" fill="#2D5340">centro</text>`;
  }
  pts.forEach(p => {
    const x = px(p.lng);
    const y = py(p.lat);
    const r = 4 + (p.impact || 0.5) * 5;
    const safeName = (p.name || "").replace(/[<>"&]/g, "");
    svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="${colorFor(p.type)}" fill-opacity="0.65" stroke="${colorFor(p.type)}" stroke-width="1.5"><title>${safeName}</title></circle>`;
  });

  return { svg, viewBox: `0 0 ${W} ${H}` };
}

// ── Componente ──────────────────────────────────────────────────────────────
export default function DiagnosisReport({ result: t }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Faz scroll para o relatório quando ele aparece — UX igual à pesquisa.html
    if (rootRef.current) {
      setTimeout(() => {
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, []);

  const score = typeof t.stt === "number" ? Math.round(t.stt) : 0;
  const scenario = t.scenario || "estabilidade";
  const color = t.gaugeColor || gaugeColor(scenario);
  const scenLabel = t.scenarioLabel || scenario;
  const gaugeSvg = drawGaugeSvg(score, color);

  const execSummary = Array.isArray(t.executiveSummary)
    ? t.executiveSummary
    : t.executiveSummary
      ? [t.executiveSummary]
      : [];

  const signals = Array.isArray(t.keySignals) ? t.keySignals : [];
  const dims = Array.isArray(t.dimensions) ? t.dimensions : [];
  const fc = t.forecast || {};
  const recs = Array.isArray(t.recommendations) ? t.recommendations : [];
  const cases = Array.isArray(t.strategicCases) ? t.strategicCases : [];
  const resources = Array.isArray(t.resources) ? t.resources : [];
  const sectors = Array.isArray(t.sectors) ? t.sectors : [];
  const hotspots = Array.isArray(t.hotspots) ? t.hotspots : [];
  const hotspotsRendered = hotspots.length > 0 ? buildHotspotsSvg(hotspots, t.territoryGeo) : null;

  const barWidthMap: Record<string, string> = {
    "dc-critical": "88%",
    "dc-high": "65%",
    "dc-medium": "42%",
    "dc-low": "20%",
    "dc-zero": "5%",
  };

  return (
    <div ref={rootRef} className="dit-report-root">
      {/* CSS self-contained — copiado de pesquisa.html, escopado em .dit-report-root */}
      <style>{`
        .dit-report-root { font-family:'Nunito',sans-serif; background:#fff; color:#2C2C2C; }
        .dit-report-root * { box-sizing:border-box; }
        .dit-report-root .result-hero { background:#1e3a2d; padding:80px 24px 60px; position:relative; overflow:hidden; }
        .dit-report-root .result-hero::before { content:''; position:absolute; inset:0; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cg fill='none' stroke='%236B9B7C' stroke-width='1' opacity='0.1'%3E%3Cellipse cx='300' cy='300' rx='280' ry='120'/%3E%3Cellipse cx='300' cy='300' rx='220' ry='90'/%3E%3Cellipse cx='300' cy='300' rx='160' ry='60'/%3E%3C/g%3E%3C/svg%3E"); background-size:600px; pointer-events:none; }
        .dit-report-root .result-hero-inner { max-width:1100px; margin:0 auto; position:relative; z-index:1; display:grid; grid-template-columns:1fr auto; gap:40px; align-items:center; }
        .dit-report-root .result-meta { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:.2em; color:#6B9B7C; text-transform:uppercase; margin-bottom:10px; }
        .dit-report-root .result-name { font-family:'Bebas Neue',sans-serif; font-size:clamp(48px,7vw,88px); color:#F5F1ED; line-height:.9; letter-spacing:.02em; margin-bottom:12px; }
        .dit-report-root .result-region { font-size:16px; color:#D4C9B8; font-weight:600; opacity:.7; margin-bottom:24px; }
        .dit-report-root .result-scenario-pill { display:inline-block; padding:7px 20px; border-radius:100px; font-family:'DM Mono',monospace; font-size:12px; letter-spacing:.12em; font-weight:500; }
        .dit-report-root .scenario-escalada { background:rgba(184,74,58,.18); color:#e8836f; border:1px solid rgba(184,74,58,.4); }
        .dit-report-root .scenario-pressao { background:rgba(212,165,116,.2); color:#D4A574; border:1px solid rgba(212,165,116,.4); }
        .dit-report-root .scenario-estabilidade { background:rgba(107,155,124,.15); color:#6B9B7C; border:1px solid rgba(107,155,124,.4); }
        .dit-report-root .gauge-wrap { text-align:center; min-width:200px; }
        .dit-report-root .gauge-stt { font-family:'Bebas Neue',sans-serif; font-size:18px; color:#6B9B7C; letter-spacing:.15em; margin-top:12px; }
        .dit-report-root .result-body { max-width:1100px; margin:0 auto; padding:64px 24px; background:#fff; }
        .dit-report-root .exec-summary { background:#F5F1ED; border:1px solid #D4C9B8; border-radius:16px; padding:36px; margin-bottom:48px; border-left:4px solid #D4A574; }
        .dit-report-root .exec-summary-label { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.25em; color:#6B9B7C; text-transform:uppercase; margin-bottom:12px; }
        .dit-report-root .exec-summary-text { font-size:16px; line-height:1.75; color:#2C2C2C; }
        .dit-report-root .exec-summary-text p + p { margin-top:12px; }
        .dit-report-root .result-section-title { font-family:'Bebas Neue',sans-serif; font-size:32px; color:#2D5340; letter-spacing:.04em; margin-bottom:20px; display:flex; align-items:center; gap:14px; }
        .dit-report-root .result-section-title::after { content:''; flex:1; height:1px; background:#D4C9B8; }
        .dit-report-root .signals-section,
        .dit-report-root .dims-section,
        .dit-report-root .forecast-section,
        .dit-report-root .rec-section,
        .dit-report-root .strategic-section { margin-bottom:56px; }

        /* Signals table */
        .dit-report-root .signals-table { width:100%; border-collapse:collapse; border-radius:12px; overflow:hidden; border:1px solid #D4C9B8; }
        .dit-report-root .signals-table thead { background:#2D5340; }
        .dit-report-root .signals-table thead th { padding:12px 16px; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.15em; color:#D4C9B8; text-transform:uppercase; text-align:left; font-weight:500; }
        .dit-report-root .signals-table tbody tr { border-bottom:1px solid #D4C9B8; background:white; }
        .dit-report-root .signals-table tbody tr:last-child { border-bottom:none; }
        .dit-report-root .signals-table tbody tr:hover { background:#F5F1ED; }
        .dit-report-root .signals-table td { padding:12px 16px; font-size:13px; color:#2C2C2C; }
        .dit-report-root .signal-source { font-family:'DM Mono',monospace; font-size:11px; color:#5B8FA3; font-weight:500; }
        .dit-report-root .signal-dim-tag { display:inline-block; padding:2px 8px; border-radius:4px; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.1em; font-weight:600; }
        .dit-report-root .tag-d1 { background:rgba(184,74,58,.12); color:#B84A3A; }
        .dit-report-root .tag-d2 { background:rgba(212,165,116,.15); color:#6B5346; }
        .dit-report-root .tag-d3 { background:rgba(91,143,163,.12); color:#5B8FA3; }
        .dit-report-root .tag-d4 { background:rgba(45,83,64,.12); color:#2D5340; }
        .dit-report-root .tag-d5 { background:rgba(107,155,124,.12); color:#6B9B7C; }
        .dit-report-root .tag-d6 { background:rgba(107,83,70,.1); color:#6B5346; }
        .dit-report-root .impact-bar-wrap { display:flex; align-items:center; gap:8px; }
        .dit-report-root .impact-bar-track { flex:1; height:5px; background:#D4C9B8; border-radius:100px; overflow:hidden; }
        .dit-report-root .impact-bar-fill { height:100%; border-radius:100px; }
        .dit-report-root .impact-val { font-family:'DM Mono',monospace; font-size:11px; font-weight:600; }
        .dit-report-root .impact-high { color:#B84A3A; }
        .dit-report-root .impact-med { color:#D4A574; }
        .dit-report-root .impact-low { color:#5B8FA3; }
        .dit-report-root .signal-status { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.1em; padding:3px 8px; border-radius:4px; }
        .dit-report-root .status-critico { background:rgba(184,74,58,.12); color:#B84A3A; }
        .dit-report-root .status-alerta { background:rgba(212,165,116,.15); color:#6B5346; }
        .dit-report-root .status-monitoramento { background:rgba(91,143,163,.1); color:#5B8FA3; }

        /* Dimensions */
        .dit-report-root .dims-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:20px; }
        .dit-report-root .dim-full-card { border:1px solid #D4C9B8; border-radius:16px; overflow:hidden; background:white; }
        .dit-report-root .dim-full-top { padding:24px 24px 20px; }
        .dit-report-root .dim-full-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; }
        .dit-report-root .dim-full-code { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.2em; color:#6B9B7C; margin-bottom:3px; }
        .dit-report-root .dim-full-name { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:.04em; }
        .dit-report-root .dim-lock-wrap { display:flex; flex-direction:column; align-items:center; gap:3px; padding:8px 12px; background:rgba(0,0,0,.04); border-radius:10px; border:1px dashed rgba(0,0,0,.1); }
        .dit-report-root .dim-lock-icon { font-size:20px; line-height:1; }
        .dit-report-root .dim-lock-label { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:.1em; color:#6B5346; text-transform:uppercase; white-space:nowrap; }
        .dit-report-root .dim-track-locked { height:6px; background:#D4C9B8; border-radius:100px; overflow:hidden; margin-bottom:16px; position:relative; }
        .dit-report-root .dim-track-locked::after { content:''; position:absolute; inset:0; background:repeating-linear-gradient(90deg,transparent,transparent 8px,rgba(255,255,255,.5) 8px,rgba(255,255,255,.5) 10px); }
        .dit-report-root .dim-track-locked-fill { height:100%; border-radius:100px; opacity:.35; }
        .dit-report-root .dim-complexity-row { display:flex; align-items:center; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
        .dit-report-root .dim-cplx-badge { font-family:'DM Mono',monospace; font-size:11px; letter-spacing:.1em; padding:3px 10px; border-radius:100px; font-weight:700; }
        .dit-report-root .dim-upsell { display:flex; align-items:center; gap:10px; margin-top:12px; padding:10px 14px; background:rgba(212,165,116,.08); border:1px solid rgba(212,165,116,.25); border-radius:8px; }
        .dit-report-root .dim-upsell-text { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.08em; color:#6B5346; flex:1; }
        .dit-report-root .dim-upsell-btn { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.1em; color:#D4A574; white-space:nowrap; font-weight:700; }
        .dit-report-root .dim-full-bottom { padding:16px 24px; border-top:1px solid #D4C9B8; }
        .dit-report-root .dim-full-insight { font-size:13px; line-height:1.6; margin-bottom:10px; }
        .dit-report-root .dim-signal-chip { display:inline-block; margin:2px; padding:3px 10px; border-radius:4px; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.08em; }
        .dit-report-root .dc-critical .dim-full-top{border-top:4px solid #B84A3A}
        .dit-report-root .dc-critical .dim-full-name{color:#B84A3A}
        .dit-report-root .dc-critical .dim-cplx-badge{background:rgba(184,74,58,.1);color:#B84A3A}
        .dit-report-root .dc-critical .dim-track-locked-fill{background:#B84A3A;width:88%}
        .dit-report-root .dc-critical .dim-full-bottom{background:rgba(184,74,58,.04)}
        .dit-report-root .dc-critical .dim-signal-chip{background:rgba(184,74,58,.1);color:#B84A3A}
        .dit-report-root .dc-high .dim-full-top{border-top:4px solid #D4A574}
        .dit-report-root .dc-high .dim-full-name{color:#6B5346}
        .dit-report-root .dc-high .dim-cplx-badge{background:rgba(212,165,116,.15);color:#6B5346}
        .dit-report-root .dc-high .dim-track-locked-fill{background:#D4A574;width:65%}
        .dit-report-root .dc-high .dim-full-bottom{background:rgba(212,165,116,.05)}
        .dit-report-root .dc-high .dim-signal-chip{background:rgba(212,165,116,.12);color:#6B5346}
        .dit-report-root .dc-medium .dim-full-top{border-top:4px solid #5B8FA3}
        .dit-report-root .dc-medium .dim-full-name{color:#5B8FA3}
        .dit-report-root .dc-medium .dim-cplx-badge{background:rgba(91,143,163,.1);color:#5B8FA3}
        .dit-report-root .dc-medium .dim-track-locked-fill{background:#5B8FA3;width:42%}
        .dit-report-root .dc-medium .dim-full-bottom{background:rgba(91,143,163,.04)}
        .dit-report-root .dc-medium .dim-signal-chip{background:rgba(91,143,163,.1);color:#5B8FA3}
        .dit-report-root .dc-low .dim-full-top{border-top:4px solid #6B9B7C}
        .dit-report-root .dc-low .dim-full-name{color:#2D5340}
        .dit-report-root .dc-low .dim-cplx-badge{background:rgba(107,155,124,.1);color:#2D5340}
        .dit-report-root .dc-low .dim-track-locked-fill{background:#6B9B7C;width:20%}
        .dit-report-root .dc-low .dim-full-bottom{background:rgba(107,155,124,.04)}
        .dit-report-root .dc-low .dim-signal-chip{background:rgba(107,155,124,.1);color:#2D5340}
        .dit-report-root .dc-zero .dim-full-top{border-top:4px solid #bbb}
        .dit-report-root .dc-zero .dim-full-name{color:#888}
        .dit-report-root .dc-zero .dim-cplx-badge{background:rgba(0,0,0,.06);color:#777}
        .dit-report-root .dc-zero .dim-track-locked-fill{background:#ccc;width:5%}
        .dit-report-root .dc-zero .dim-full-bottom{background:rgba(0,0,0,.02)}
        .dit-report-root .dc-zero .dim-signal-chip{background:rgba(0,0,0,.05);color:#888}

        /* Forecast */
        .dit-report-root .forecast-box { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .dit-report-root .forecast-card { background:white; border:1px solid #D4C9B8; border-radius:14px; padding:28px; }
        .dit-report-root .forecast-card-label { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.2em; color:#6B9B7C; text-transform:uppercase; margin-bottom:10px; }
        .dit-report-root .forecast-card-title { font-family:'Bebas Neue',sans-serif; font-size:22px; color:#2D5340; letter-spacing:.04em; margin-bottom:12px; }
        .dit-report-root .forecast-card-text { font-size:14px; line-height:1.7; color:#2C2C2C; opacity:.85; }
        .dit-report-root .forecast-risks { list-style:none; display:flex; flex-direction:column; gap:8px; margin-top:12px; padding:0; }
        .dit-report-root .forecast-risks li { display:flex; align-items:flex-start; gap:10px; font-size:13px; line-height:1.5; }
        .dit-report-root .forecast-risks li::before { content:'→'; color:#B84A3A; font-weight:700; flex-shrink:0; margin-top:1px; }

        /* Recommendations */
        .dit-report-root .rec-list { display:flex; flex-direction:column; gap:16px; }
        .dit-report-root .rec-item { display:flex; gap:20px; align-items:flex-start; background:white; border:1px solid #D4C9B8; border-radius:14px; padding:24px; }
        .dit-report-root .rec-num { font-family:'Bebas Neue',sans-serif; font-size:40px; color:#D4C9B8; line-height:1; flex-shrink:0; width:40px; }
        .dit-report-root .rec-title { font-family:'Bebas Neue',sans-serif; font-size:20px; color:#2D5340; letter-spacing:.04em; margin-bottom:6px; }
        .dit-report-root .rec-text { font-size:14px; line-height:1.65; color:#2C2C2C; opacity:.85; }
        .dit-report-root .rec-urgency { margin-top:10px; display:inline-block; padding:3px 12px; border-radius:100px; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.1em; }
        .dit-report-root .urg-imediato { background:rgba(184,74,58,.1); color:#B84A3A; }
        .dit-report-root .urg-curto { background:rgba(212,165,116,.15); color:#6B5346; }
        .dit-report-root .urg-medio { background:rgba(91,143,163,.1); color:#5B8FA3; }

        /* Strategic — Casos */
        .dit-report-root .cases-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:12px; }
        .dit-report-root .case-card { background:white; border:1px solid #D4C9B8; border-radius:14px; padding:24px; position:relative; overflow:hidden; }
        .dit-report-root .case-card::before { content:''; position:absolute; top:0; left:0; width:4px; height:100%; background:#B84A3A; }
        .dit-report-root .case-card.estrategico::before { background:#B84A3A; }
        .dit-report-root .case-card.potencial::before { background:#D4A574; }
        .dit-report-root .case-card.latente::before { background:#6B5346; }
        .dit-report-root .case-card.nao-aplicavel::before { background:#D4C9B8; opacity:.5; }
        .dit-report-root .case-label { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.2em; color:#6B9B7C; text-transform:uppercase; margin-bottom:6px; }
        .dit-report-root .case-title { font-family:'Bebas Neue',sans-serif; font-size:22px; color:#2D5340; letter-spacing:.04em; margin-bottom:8px; }
        .dit-report-root .case-relevance { display:inline-block; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.15em; padding:4px 10px; border-radius:4px; background:rgba(184,74,58,.1); color:#B84A3A; margin-bottom:14px; text-transform:uppercase; }
        .dit-report-root .case-thesis { font-size:13px; line-height:1.65; color:#2C2C2C; margin-bottom:14px; }
        .dit-report-root .case-evidence { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; padding:0; }
        .dit-report-root .case-evidence li { font-size:12px; line-height:1.5; color:#2C2C2C; opacity:.8; list-style:none; padding-left:14px; position:relative; }
        .dit-report-root .case-evidence li::before { content:'■'; position:absolute; left:0; color:#D4A574; font-size:7px; top:5px; }
        .dit-report-root .case-potential { background:rgba(45,83,64,.06); border-radius:8px; padding:12px; font-size:12px; line-height:1.55; color:#2D5340; margin-bottom:10px; }
        .dit-report-root .case-risks { display:flex; flex-direction:column; gap:4px; padding:0; }
        .dit-report-root .case-risks li { font-size:11px; line-height:1.5; color:#B84A3A; list-style:none; padding-left:14px; position:relative; }
        .dit-report-root .case-risks li::before { content:'⚠'; position:absolute; left:0; font-size:10px; }

        /* Strategic — Recursos */
        .dit-report-root .resources-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-top:12px; }
        .dit-report-root .res-card { background:white; border:1px solid #D4C9B8; border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:6px; }
        .dit-report-root .res-head { display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .dit-report-root .res-name { font-family:'Bebas Neue',sans-serif; font-size:16px; color:#2D5340; letter-spacing:.03em; }
        .dit-report-root .res-abundance { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:.15em; padding:3px 8px; border-radius:3px; text-transform:uppercase; }
        .dit-report-root .res-abundance.abundante { background:rgba(45,83,64,.12); color:#2D5340; }
        .dit-report-root .res-abundance.presente { background:rgba(212,165,116,.15); color:#6B5346; }
        .dit-report-root .res-abundance.limitado { background:rgba(184,74,58,.1); color:#B84A3A; }
        .dit-report-root .res-abundance.ausente { background:rgba(0,0,0,.05); color:#2C2C2C; opacity:.6; }
        .dit-report-root .res-category { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:.15em; color:#6B9B7C; text-transform:uppercase; }
        .dit-report-root .res-notes { font-size:12px; line-height:1.5; color:#2C2C2C; opacity:.85; }

        /* Strategic — Setores */
        .dit-report-root .sectors-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:12px; }
        .dit-report-root .sec-card { background:white; border:1px solid #D4C9B8; border-radius:10px; padding:16px; }
        .dit-report-root .sec-id { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.2em; color:#6B9B7C; }
        .dit-report-root .sec-name { font-family:'Bebas Neue',sans-serif; font-size:17px; color:#2D5340; letter-spacing:.03em; margin:4px 0 8px; }
        .dit-report-root .sec-maturity { display:inline-block; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:.15em; padding:3px 8px; border-radius:3px; text-transform:uppercase; margin-bottom:10px; }
        .dit-report-root .sec-maturity.alta { background:rgba(45,83,64,.15); color:#2D5340; }
        .dit-report-root .sec-maturity.dev { background:rgba(212,165,116,.18); color:#6B5346; }
        .dit-report-root .sec-maturity.latente { background:rgba(184,74,58,.1); color:#B84A3A; }
        .dit-report-root .sec-maturity.inex { background:rgba(0,0,0,.05); color:#2C2C2C; opacity:.6; }
        .dit-report-root .sec-insight { font-size:12px; line-height:1.55; color:#2C2C2C; }

        /* Strategic — Hotspots */
        .dit-report-root .hotspots-wrap { background:white; border:1px solid #D4C9B8; border-radius:14px; padding:20px; margin-top:12px; }
        .dit-report-root .hotspots-svg { width:100%; height:340px; background:#f8f5f0; border-radius:8px; display:block; }
        .dit-report-root .hs-legend { display:flex; gap:18px; flex-wrap:wrap; margin-top:14px; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.1em; color:#2C2C2C; }
        .dit-report-root .hs-legend-dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; vertical-align:middle; }
        .dit-report-root .hs-list { margin-top:14px; display:grid; grid-template-columns:1fr 1fr; gap:8px; max-height:280px; overflow-y:auto; }
        .dit-report-root .hs-item { display:flex; gap:10px; padding:8px 10px; background:rgba(0,0,0,.02); border-radius:6px; font-size:12px; line-height:1.4; }
        .dit-report-root .hs-marker { width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-top:5px; }
        .dit-report-root .hs-meta { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:.1em; color:#6B9B7C; text-transform:uppercase; display:block; margin-top:2px; }

        /* Methodology */
        .dit-report-root .methodology-box { background:#2D5340; border-radius:16px; padding:36px; display:grid; grid-template-columns:1fr 1fr; gap:32px; align-items:center; }
        .dit-report-root .method-label { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.2em; color:#6B9B7C; text-transform:uppercase; margin-bottom:10px; }
        .dit-report-root .method-title { font-family:'Bebas Neue',sans-serif; font-size:32px; color:#F5F1ED; letter-spacing:.04em; margin-bottom:14px; }
        .dit-report-root .method-text { font-size:13px; color:#D4C9B8; line-height:1.65; opacity:.8; }
        .dit-report-root .method-right { display:flex; flex-direction:column; gap:10px; }
        .dit-report-root .method-source-row { display:flex; align-items:center; gap:10px; }
        .dit-report-root .method-source-tag { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:.1em; padding:4px 10px; border-radius:4px; flex-shrink:0; }
        .dit-report-root .ms-d1{background:rgba(184,74,58,.2);color:#e8836f}
        .dit-report-root .ms-d2{background:rgba(212,165,116,.2);color:#D4A574}
        .dit-report-root .ms-d3{background:rgba(91,143,163,.2);color:#8fc0d8}
        .dit-report-root .ms-d4{background:rgba(107,155,124,.2);color:#6B9B7C}
        .dit-report-root .ms-d5{background:rgba(212,165,116,.12);color:#D4C9B8}
        .dit-report-root .ms-d6{background:rgba(107,83,70,.2);color:#D4C9B8}
        .dit-report-root .method-source-text { font-size:12px; color:#D4C9B8; opacity:.7; }

        @media(max-width:768px){
          .dit-report-root .result-hero-inner{ grid-template-columns:1fr; }
          .dit-report-root .gauge-wrap{ display:none; }
          .dit-report-root .dims-grid{ grid-template-columns:1fr; }
          .dit-report-root .forecast-box{ grid-template-columns:1fr; }
          .dit-report-root .methodology-box{ grid-template-columns:1fr; }
          .dit-report-root .cases-grid{ grid-template-columns:1fr; }
          .dit-report-root .resources-grid{ grid-template-columns:1fr; }
          .dit-report-root .sectors-grid{ grid-template-columns:1fr; }
        }
      `}</style>

      {/* HERO */}
      <section className="result-hero">
        <div className="result-hero-inner">
          <div>
            <div className="result-meta">DIT · Ciclo Atual / 2026</div>
            <div className="result-name">{t.territory || ""}</div>
            <div className="result-region">{t.region || ""}</div>
            <div className={`result-scenario-pill scenario-${scenario}`}>{scenLabel}</div>
          </div>
          <div className="gauge-wrap">
            <svg width="190" height="190" viewBox="0 0 190 190" dangerouslySetInnerHTML={{ __html: gaugeSvg }} />
            <div className="gauge-stt">STT</div>
          </div>
        </div>
      </section>

      <div className="result-body">
        {/* Executive Summary */}
        {execSummary.length > 0 && (
          <div className="exec-summary">
            <div className="exec-summary-label">Síntese Executiva · DIT PRINT Intelligence</div>
            <div className="exec-summary-text">
              {execSummary.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </div>
        )}

        {/* Signals */}
        <div className="signals-section">
          <div className="result-section-title">Sinais Críticos Detectados</div>
          <table className="signals-table">
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Dimensão</th>
                <th>Sinal Detectado</th>
                <th style={{ width: 120 }}>Impacto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "#6B9B7C", fontFamily: "DM Mono,monospace", fontSize: 12 }}>
                    Nenhum sinal crítico detectado
                  </td>
                </tr>
              ) : (
                signals.map((s, i) => {
                  const pct = Math.round((s.impact || 0) * 100);
                  const barColor = (s.impact || 0) >= 0.7 ? "#B84A3A" : (s.impact || 0) >= 0.5 ? "#D4A574" : "#5B8FA3";
                  return (
                    <tr key={i}>
                      <td><span className="signal-source">{s.source || "—"}</span></td>
                      <td><span className={`signal-dim-tag ${s.dimTag || "tag-d1"}`}>{s.dimension || "D1"}</span></td>
                      <td style={{ fontSize: 13 }}>{s.text || ""}</td>
                      <td>
                        <div className="impact-bar-wrap">
                          <div className="impact-bar-track">
                            <div className="impact-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <span className={`impact-val ${s.impactCls || "impact-med"}`}>{s.impact ?? 0}</span>
                        </div>
                      </td>
                      <td><span className={`signal-status ${s.statusCls || "status-alerta"}`}>{s.status || "ALERTA"}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Dimensions */}
        <div className="dims-section">
          <div className="result-section-title">Análise por Dimensão</div>
          <div className="dims-grid">
            {dims.map((d, i) => {
              const cls = dimCssClassFromComplexity(d.complexity);
              const chips = Array.isArray(d.signals) ? d.signals : [];
              return (
                <div key={i} className={`dim-full-card ${cls}`}>
                  <div className="dim-full-top">
                    <div className="dim-full-header">
                      <div>
                        <div className="dim-full-code">{d.code || ""} · PRINT INTELLIGENCE</div>
                        <div className="dim-full-name">{d.name || ""}</div>
                      </div>
                      <div className="dim-lock-wrap">
                        <div className="dim-lock-icon">🔒</div>
                        <div className="dim-lock-label">DIT Completo</div>
                      </div>
                    </div>
                    <div className="dim-complexity-row">
                      <span className="dim-cplx-badge">{d.complexity || ""}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#6B5346", letterSpacing: ".08em", opacity: .8 }}>
                        {d.complexityNote || ""}
                      </span>
                    </div>
                    <div className="dim-track-locked">
                      <div className="dim-track-locked-fill" style={{ width: barWidthMap[cls] || "40%" }} />
                    </div>
                  </div>
                  <div className="dim-full-bottom">
                    <div className="dim-full-insight">{d.insight || ""}</div>
                    <div style={{ marginTop: 8 }}>
                      {chips.map((c, j) => <span key={j} className="dim-signal-chip">{c}</span>)}
                    </div>
                    <div className="dim-upsell">
                      <div className="dim-upsell-text">Score por dimensão disponível no</div>
                      <div className="dim-upsell-btn">→ DIT COMPLETO</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Forecast */}
        <div className="forecast-section">
          <div className="result-section-title">Cenário Projetado</div>
          <div className="forecast-box">
            <div className="forecast-card">
              <div className="forecast-card-label">Horizonte: {fc.horizon || "Próximo trimestre"}</div>
              <div className="forecast-card-title">RISCOS PROJETADOS</div>
              <p className="forecast-card-text">{fc.text || ""}</p>
              <ul className="forecast-risks">
                {(fc.risks || []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div className="forecast-card">
              <div className="forecast-card-label">Oportunidades Identificadas</div>
              <div className="forecast-card-title">JANELAS DE ATUAÇÃO</div>
              <p className="forecast-card-text">{fc.opportunities || ""}</p>
              <div style={{ marginTop: 20, padding: 16, background: "rgba(45,83,64,.06)", borderRadius: 10, borderLeft: "3px solid #6B9B7C" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: ".15em", color: "#6B9B7C", marginBottom: 6 }}>
                  PRÓXIMO PASSO
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: "#2C2C2C" }}>
                  Assine o DIT ciclo mensal para acompanhar o STT e receber alertas em tempo real quando impacto ≥ 0,7 for detectado.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {recs.length > 0 && (
          <div className="rec-section">
            <div className="result-section-title">Recomendações Estratégicas</div>
            <div className="rec-list">
              {recs.map((r, i) => (
                <div key={i} className="rec-item">
                  <div className="rec-num">{`0${i + 1}`}</div>
                  <div>
                    <div className="rec-title">{r.title || ""}</div>
                    <div className="rec-text">{r.text || ""}</div>
                    <span className={`rec-urgency ${r.urgCls || "urg-medio"}`}>{r.urgency || ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strategic Cases */}
        {cases.length > 0 && (
          <div className="strategic-section">
            <div className="result-section-title">Casos Estratégicos — Brasil 2025/26</div>
            <div className="cases-grid">
              {cases.map((c, i) => (
                <div key={i} className={`case-card ${relevanceCls(c.relevance)}`}>
                  <div className="case-label">{c.caseId || ""}</div>
                  <div className="case-title">{c.title || ""}</div>
                  <span className="case-relevance">{c.relevance || ""}</span>
                  <div className="case-thesis">{c.thesis || ""}</div>
                  <ul className="case-evidence">
                    {(c.evidence || []).slice(0, 4).map((e, j) => <li key={j}>{e}</li>)}
                  </ul>
                  {c.potential && <div className="case-potential"><strong>Potencial:</strong> {c.potential}</div>}
                  <ul className="case-risks">
                    {(c.risks || []).slice(0, 4).map((r, j) => <li key={j}>{r}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resources */}
        {resources.length > 0 && (
          <div className="strategic-section">
            <div className="result-section-title">Recursos Territoriais</div>
            <div className="resources-grid">
              {resources.map((r, i) => (
                <div key={i} className="res-card">
                  <div className="res-head">
                    <div className="res-name">{r.name || ""}</div>
                    <span className={`res-abundance ${r.abundance || ""}`}>{r.abundance || ""}</span>
                  </div>
                  <div className="res-category">{r.category || ""}</div>
                  <div className="res-notes">{r.notes || ""}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sectors */}
        {sectors.length > 0 && (
          <div className="strategic-section">
            <div className="result-section-title">Setores PRINT — Maturidade</div>
            <div className="sectors-grid">
              {sectors.map((s, i) => (
                <div key={i} className="sec-card">
                  <div className="sec-id">{s.sectorId || ""}</div>
                  <div className="sec-name">{s.name || ""}</div>
                  <span className={`sec-maturity ${maturityCls(s.maturity)}`}>{s.maturity || ""}</span>
                  <div className="sec-insight">{s.insight || ""}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hotspots */}
        {hotspotsRendered && (
          <div className="strategic-section">
            <div className="result-section-title">Hotspots Tangíveis · Locais dentro do Território</div>
            <div className="hotspots-wrap">
              <svg
                className="hotspots-svg"
                preserveAspectRatio="xMidYMid meet"
                viewBox={hotspotsRendered.viewBox}
                dangerouslySetInnerHTML={{ __html: hotspotsRendered.svg }}
              />
              <div className="hs-legend">
                <span><span className="hs-legend-dot" style={{ background: "#B84A3A" }} />Risco</span>
                <span><span className="hs-legend-dot" style={{ background: "#2D5340" }} />Potencial</span>
                <span><span className="hs-legend-dot" style={{ background: "#D4A574" }} />Vulnerabilidade</span>
              </div>
              <div className="hs-list">
                {hotspots
                  .filter(h => typeof h.lat === "number" && typeof h.lng === "number")
                  .slice(0, 30)
                  .map((p, i) => {
                    const c = p.type === "risco" ? "#B84A3A" : p.type === "vulnerabilidade" ? "#D4A574" : "#2D5340";
                    return (
                      <div key={i} className="hs-item">
                        <span className="hs-marker" style={{ background: c }} />
                        <div>
                          <strong>{p.name || ""}</strong>
                          <span className="hs-meta">{p.category || ""} · {p.source || ""}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Methodology */}
        <div className="methodology-box">
          <div>
            <div className="method-label">Metodologia · PRINT Intelligence</div>
            <div className="method-title">6 DIMENSÕES,<br />32 FONTES VERIFICADAS</div>
            <p className="method-text">
              STT = Σ(Di × Wi) com pesos calibrados por impacto territorial. Coleta em tempo real de APIs governamentais, mídia e inteligência de campo.
            </p>
          </div>
          <div className="method-right">
            <div className="method-source-row"><span className="method-source-tag ms-d1">D1</span><span className="method-source-text">IBAMA · CEMADEN · INPE DETER · INMET</span></div>
            <div className="method-source-row"><span className="method-source-tag ms-d2">D2</span><span className="method-source-text">IBGE · PNAD Contínua · IPEAData · PNUD</span></div>
            <div className="method-source-row"><span className="method-source-tag ms-d3">D3</span><span className="method-source-text">SNIS · DataSUS · INEP · Mapa de Empresas</span></div>
            <div className="method-source-row"><span className="method-source-tag ms-d4">D4</span><span className="method-source-text">Fogo Cruzado · ISP-RJ · FUNAI · Judiciário</span></div>
            <div className="method-source-row"><span className="method-source-tag ms-d5">D5</span><span className="method-source-text">Querido Diário · Conselhos · Audiências</span></div>
            <div className="method-source-row"><span className="method-source-tag ms-d6">D6</span><span className="method-source-text">Google News · Google Trends · Redes Sociais</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
