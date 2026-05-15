/**
 * STT Calculation Types
 *
 * Defines the contextData JSON shape stored in territories.contextData
 * and the structures used by the STT calculator.
 */

import type { DimensionId } from "../indicators";

// ─── Territory Context Data ────────────────────────────────────────────────────
// Stored as JSON in territories.contextData.
// All hardcoded TERRITORY_QUERIES / TERRITORY_DATA_CONFIG are migrated here.

export interface TerritoryContextData {
  // ── Identity ──
  /** State abbreviation: "RJ", "PA", "MT" */
  estado?: string;
  /** List of municipality names in the territory */
  municipios?: string[];
  /** IBGE 7-digit codes for the municipalities */
  ibgeMunicipios?: string[];
  /** Bounding box "minx,miny,maxx,maxy" (WGS84) for geo queries */
  bbox?: string;
  /** Biome name: "Mata Atlântica", "Amazônia" */
  bioma?: string;

  // ── Collection config ──
  /** Google News RSS search queries */
  rssQueries?: string[];
  /** NewsAPI search queries */
  newsApiQueries?: string[];
  /** Keyword groups for structured data sources */
  newsKeywords?: {
    ibama?: string[];
    ana?: string[];
    queiroDiario?: string[];
  };

  // ── Source agent config ──
  /** Fogo Cruzado API city ID */
  fogoCruzadoCidadeId?: string;
  /** ISP-RJ CISP code (circunscrição integrada de segurança pública) */
  ispCisp?: number;
  /** INPE layer name for DETER alerts */
  inpeLayer?: string;

  // ── LLM context ──
  /** Human-readable summary of the territory for LLM prompts */
  llmContext?: string;
  /** Current baseline STT (used as reference for LLM) */
  baselineStt?: number;
  /** Dimension-specific notes for each PRINT dimension */
  dimensionNotes?: Partial<Record<DimensionId, string>>;

  // ── Historical context ──
  /** Notable historical events for LLM rationale enrichment */
  keyEvents?: Array<{
    period: string;
    stt: number;
    activatedIndex: string;
    scenario: string;
    note: string;
  }>;
}

// ─── STT Calculator Input ─────────────────────────────────────────────────────

export interface DimensionScore {
  id: DimensionId;
  score: number;
  /** Classified signals that contributed to this dimension's score */
  topSignals: Array<{
    title: string;
    indicatorCode: string;
    impactScore: number;
    dimension: DimensionId;
  }>;
}

export interface SttCalculatorInput {
  territory: {
    id: number;
    slug: string;
    name: string;
    contextData: TerritoryContextData | null;
  };
  period: string;
  /** Current scores from previous period (for delta calculation) */
  previousScores: {
    stt: number;
    d1?: number;
    d2?: number;
    d3?: number;
    d4?: number;
    d5?: number;
    d6?: number;
  } | null;
  /** Scores from dimension agents */
  dimensionScores: DimensionScore[];
}

// ─── STT Calculator Output ────────────────────────────────────────────────────

export interface SttCalculatorOutput {
  stt: number;
  d1Score: number;
  d2Score: number;
  d3Score: number;
  d4Score: number;
  d5Score: number;
  d6Score: number;
  sttDelta: number;
  d1Delta: number;
  d2Delta: number;
  d3Delta: number;
  d4Delta: number;
  d5Delta: number;
  d6Delta: number;
  activatedDimension: DimensionId | "GERAL";
  scenario: "estabilidade" | "pressao" | "escalada";
  executiveNote: string;
  llmVerificationPassed: boolean;
  /** Discrepancy between LLM-stated STT and our recalculated STT */
  llmDiscrepancy: number;
}

// ─── Anomaly Result ───────────────────────────────────────────────────────────

export interface AnomalyResult {
  isAnomaly: boolean;
  isEscalation: boolean;
  /** STT deviation from 30-day mean in standard deviations */
  sigmaDeviation: number;
  /** STT change since yesterday */
  dayDelta: number;
  /** 30-day mean */
  mean30d: number;
  /** 30-day standard deviation */
  sigma30d: number;
}
