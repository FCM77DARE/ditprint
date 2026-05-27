/**
 * DIT — Camada Estratégica (Setores, Recursos, Hotspots, Casos)
 *
 * Esta camada complementa as 6 dimensões (D1-D6) com:
 *   • Setores PRINT (lógica SSE-like, indicadores próprios)
 *   • Recursos & Potencial territorial
 *   • Hotspots georreferenciados (locais tangíveis dentro do território)
 *   • Casos estratégicos (terras raras, data centers, etc.)
 */

// ─── SETORES PRINT (transversais às 6 dimensões) ──────────────────────────────

export type SectorId = "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

export interface Sector {
  id: SectorId;
  name: string;
  focus: string;
  description: string;
  /** Dimensões PRINT que alimentam este setor (peso 0-1) */
  dimensionContribution: Partial<Record<"D1" | "D2" | "D3" | "D4" | "D5" | "D6", number>>;
}

export interface SectorResult {
  sectorId: SectorId;
  name: string;
  /** "Alta Maturidade" | "Em Desenvolvimento" | "Latente" | "Inexistente" */
  maturity: SectorMaturity;
  maturityNote: string;
  /** Score interno 0-100 (não exposto ao frontend) */
  internalScore: number;
  insight: string;
  signals: string[];
}

export type SectorMaturity =
  | "Alta Maturidade"
  | "Em Desenvolvimento"
  | "Latente"
  | "Inexistente";

// ─── RECURSOS NATURAIS / AMBIENTAIS / MINERAIS / ENERGÉTICOS ──────────────────

export type ResourceCategory =
  | "minerais"
  | "hidricos"
  | "energeticos"
  | "florestais"
  | "agricolas"
  | "ambientais";

export interface Resource {
  category: ResourceCategory;
  /** Ex: "Terras Raras", "Energia Solar", "Aquífero Guarani" */
  name: string;
  /** "abundante" | "presente" | "limitado" | "ausente" */
  abundance: "abundante" | "presente" | "limitado" | "ausente";
  /** Notas sobre exploração atual ou potencial */
  notes: string;
  /** Fontes que comprovam ou indicam */
  sources: string[];
}

// ─── HOTSPOTS GEORREFERENCIADOS ───────────────────────────────────────────────

export type HotspotType = "risco" | "potencial" | "vulnerabilidade";

export interface Hotspot {
  /** Tipo principal do hotspot */
  type: HotspotType;
  /** Categoria específica: "mineração", "desmatamento", "indústria", "hospital", "área de risco" */
  category: string;
  /** Nome / descrição curta do ponto */
  name: string;
  /** Coordenadas (lat, lng) — null quando agregado a nível municipal */
  lat: number | null;
  lng: number | null;
  /** Descrição mais longa */
  description: string;
  /** Fonte primária */
  source: string;
  /** Impacto/relevância 0-1 */
  impact: number;
  /** Dimensão PRINT relacionada (quando aplicável) */
  dimension?: "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
}

// ─── CASOS ESTRATÉGICOS (foco BR 2025-2026) ───────────────────────────────────

export type StrategicCaseId =
  | "TERRAS_RARAS"
  | "DATA_CENTERS"
  | "HIDROGENIO_VERDE"
  | "LITIO"
  | "BIOECONOMIA";

export type CaseRelevance =
  | "ESTRATÉGICO"   // território é hub nacional / referência
  | "POTENCIAL"     // tem condições mas não desenvolvido
  | "LATENTE"       // condições parciais, exige investimento
  | "NÃO APLICÁVEL"; // não tem condições

export interface StrategicCaseResult {
  caseId: StrategicCaseId;
  title: string;
  relevance: CaseRelevance;
  /** Tese curta: por que esse território (não) se encaixa neste case */
  thesis: string;
  /** Evidências que sustentam a tese */
  evidence: string[];
  /** Potencial específico (apenas se relevance != NÃO APLICÁVEL) */
  potential: string | null;
  /** Riscos específicos ao caso */
  risks: string[];
  /** Hotspots relacionados ao caso */
  hotspots: Hotspot[];
  /** Fontes consultadas */
  sources: string[];
}

// ─── RESULTADO DA CAMADA ESTRATÉGICA ──────────────────────────────────────────

export interface StrategicLayerResult {
  sectors: SectorResult[];
  resources: Resource[];
  hotspots: Hotspot[];
  strategicCases: StrategicCaseResult[];
  /** ISO timestamp */
  completedAt: string;
}

// ─── CONTEXTO COMPARTILHADO ───────────────────────────────────────────────────

export interface TerritoryStrategicContext {
  /** Nome do município (resolvido via IBGE) */
  name: string;
  /** Sigla UF */
  state: string;
  /** Nome completo da UF (ex: "Bahia") — usado em queries de busca */
  stateName?: string;
  /** Região (Norte, Nordeste, etc.) */
  region: string;
  /** Mesorregião IBGE (ex: "Sul Baiano", "Metropolitana de Salvador") */
  mesoregion?: string;
  /** Microrregião IBGE (ex: "Valença") */
  microregion?: string;
  /** ID IBGE */
  ibgeId: number;
  /** Centroide aproximado do município (lat, lng) */
  centroid?: { lat: number; lng: number };
  /** Bounding box [west, south, east, north] */
  bbox?: [number, number, number, number];
}
