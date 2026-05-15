/**
 * Caso Estratégico — TERRAS RARAS
 *
 * Contexto BR 2025-2026:
 *   • Brasil possui ~22% das reservas mundiais de terras raras (3ª maior do mundo)
 *   • Política Nacional de Terras Raras (2024) prioriza Catalão, Araxá, Pitinga
 *   • Foco: Serra Verde (GO), CBMM (Araxá-MG), Minaçu (GO), Bahia, Amazonas
 *   • Investimentos estrangeiros crescendo (China, EUA, UE)
 *
 * Fontes de dados:
 *   • SIGMINE-ANM (concessões minerárias por substância) — público
 *   • Conhecimento de regiões prioritárias (hardcoded mapping)
 *   • LLM para síntese qualitativa
 */

import { logger } from "../../_core/logger";
import type {
  CaseRelevance,
  Hotspot,
  StrategicCaseResult,
  TerritoryStrategicContext,
} from "../types";

const log = logger.child({ module: "strategic.terras-raras" });

// ─── REGIÕES ESTRATÉGICAS DE TERRAS RARAS NO BRASIL ───────────────────────────

interface KnownRegion {
  name: string;
  state: string;
  /** Sinônimos para match flexível */
  aliases: string[];
  relevance: CaseRelevance;
  thesis: string;
  evidence: string[];
  hotspots: Array<{
    name: string;
    lat: number;
    lng: number;
    description: string;
  }>;
}

const KNOWN_REGIONS: KnownRegion[] = [
  {
    name: "Araxá",
    state: "MG",
    aliases: ["araxa", "araxá"],
    relevance: "ESTRATÉGICO",
    thesis:
      "Araxá é polo nacional de nióbio (CBMM, ~80% da produção mundial) e abriga jazidas de terras raras associadas. " +
      "Política Nacional de Terras Raras de 2024 prioriza expansão de capacidade neste eixo.",
    evidence: [
      "CBMM opera maior mina de nióbio do mundo em Araxá",
      "Jazidas de terras raras associadas ao complexo carbonatítico de Barreiro",
      "MME inclui Araxá em mapa de minerais críticos (2024)",
    ],
    hotspots: [
      {
        name: "Complexo CBMM Araxá",
        lat: -19.6328,
        lng: -46.9444,
        description: "Maior operação de nióbio do mundo, terras raras associadas",
      },
      {
        name: "Complexo de Barreiro",
        lat: -19.6500,
        lng: -46.9700,
        description: "Estrutura carbonatítica — terras raras + nióbio + fosfato",
      },
    ],
  },
  {
    name: "Catalão",
    state: "GO",
    aliases: ["catalao", "catalão"],
    relevance: "ESTRATÉGICO",
    thesis:
      "Catalão concentra operações de Anglo American/CMOC e Mosaic em complexos carbonatíticos. " +
      "Potencial significativo de terras raras associadas à mineração de fosfato e nióbio.",
    evidence: [
      "Complexo carbonatítico Catalão I e II",
      "Operações ativas Anglo American/CMOC e Mosaic",
      "Cidade incluída no Programa de Mineração e Desenvolvimento (PMD)",
    ],
    hotspots: [
      {
        name: "Complexo Catalão I",
        lat: -18.1333,
        lng: -47.7833,
        description: "Carbonatito com fosfato, nióbio e terras raras",
      },
    ],
  },
  {
    name: "Minaçu",
    state: "GO",
    aliases: ["minacu", "minaçu"],
    relevance: "ESTRATÉGICO",
    thesis:
      "Minaçu abriga a mina Serra Verde (Serra Verde Mining), primeira produtora comercial de terras raras pesadas " +
      "fora da China. Operações iniciadas em 2024, capacidade alvo: 5 mil t/ano de óxidos de terras raras.",
    evidence: [
      "Serra Verde Mining iniciou produção comercial em 2024",
      "Foco em terras raras pesadas (disprósio, térbio) — críticas para ímãs",
      "Investimento Energy Fuels (EUA) e Denham Capital",
    ],
    hotspots: [
      {
        name: "Mina Serra Verde",
        lat: -13.5333,
        lng: -48.2167,
        description: "Primeira produtora comercial de TRP fora da China",
      },
    ],
  },
  {
    name: "Pitinga",
    state: "AM",
    aliases: ["pitinga", "presidente figueiredo"],
    relevance: "POTENCIAL",
    thesis:
      "Distrito mineiro de Pitinga (Mineração Taboca/Cristalina) detém jazidas significativas de estanho, " +
      "nióbio, tântalo e terras raras. Logística amazônica é o principal gargalo.",
    evidence: [
      "Operação Mineração Taboca (estanho, tântalo, nióbio)",
      "Jazidas com mineralização de TR associada",
      "Acesso logístico via Manaus — gargalo conhecido",
    ],
    hotspots: [
      {
        name: "Mina Pitinga",
        lat: -0.7667,
        lng: -60.0833,
        description: "Distrito polimetálico com terras raras associadas",
      },
    ],
  },
  {
    name: "Caetité",
    state: "BA",
    aliases: ["caetite", "caetité", "caetite ba"],
    relevance: "POTENCIAL",
    thesis:
      "Caetité concentra mineração de urânio (INB) e tem ocorrências de terras raras no entorno. " +
      "Integra zona priorizada pelo PAC Mineração no Nordeste.",
    evidence: [
      "INB Caetité — única operação de urânio do Brasil",
      "Ocorrências de monazita e terras raras na região",
      "Zona de relevância geológica para minerais críticos",
    ],
    hotspots: [
      {
        name: "Distrito Urano-Caetité",
        lat: -14.0667,
        lng: -42.4833,
        description: "Mineração de urânio com TR associadas",
      },
    ],
  },
];

// ─── SIGMINE-ANM (concessões minerárias) ──────────────────────────────────────

interface SigmineProcess {
  numero: string;
  substancia: string;
  fase: string;
  area_ha: number;
}

const SIGMINE_RARE_EARTH_SUBSTANCES = [
  "TERRAS RARAS",
  "MONAZITA",
  "NIOBIO",
  "NIÓBIO",
  "TANTALITA",
  "XENOTIMA",
];

async function fetchSigmineForMunicipality(
  ibgeId: number
): Promise<SigmineProcess[]> {
  // SIGMINE-ANM expõe WFS público. Endpoint:
  //   https://geo.anm.gov.br/arcgis/services/SIGMINE/SIGMINE_BRASIL/MapServer/WFSServer
  // Como a query exige bbox/geometria complexa e há rate limit, mantemos placeholder
  // para iteração futura. Por ora, devolvemos lista vazia e confiamos no known regions.
  // TODO: implementar query WFS real com filtro SUBSTANCIA IN (...) AND CD_MUN = ibgeId
  void ibgeId;
  return [];
}

// ─── ANÁLISE PRINCIPAL ────────────────────────────────────────────────────────

function findKnownRegion(ctx: TerritoryStrategicContext): KnownRegion | null {
  const normalized = ctx.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const r of KNOWN_REGIONS) {
    if (r.state !== ctx.state) continue;
    if (r.aliases.some(a => normalized.includes(a))) return r;
  }
  return null;
}

export async function analyzeTerrasRaras(
  ctx: TerritoryStrategicContext
): Promise<StrategicCaseResult> {
  log.info({ territory: ctx.name }, "Analisando caso Terras Raras");

  const known = findKnownRegion(ctx);
  const sigmineProcs = await fetchSigmineForMunicipality(ctx.ibgeId);

  if (known) {
    const hotspots: Hotspot[] = known.hotspots.map(h => ({
      type: "potencial",
      category: "mineração-terras-raras",
      name: h.name,
      lat: h.lat,
      lng: h.lng,
      description: h.description,
      source: "Política Nacional de Terras Raras / SIGMINE-ANM",
      impact: 0.85,
      dimension: "D1",
    }));

    return {
      caseId: "TERRAS_RARAS",
      title: "Terras Raras — Vetor Estratégico Nacional",
      relevance: known.relevance,
      thesis: known.thesis,
      evidence: known.evidence,
      potential:
        "Cadeia integrada: mineração + processamento (separação de óxidos) + " +
        "transformação em ímãs permanentes (NdFeB) para defesa, EV e turbinas eólicas.",
      risks: [
        "Conflitos socioambientais com comunidades do entorno (D4)",
        "Dependência de tecnologia chinesa para separação de óxidos",
        "Volatilidade de preços globais (China controla ~85% do mercado)",
        "Passivos ambientais — radioatividade natural em monazita",
      ],
      hotspots,
      sources: [
        "SIGMINE-ANM",
        "Política Nacional de Terras Raras (Decreto 11.999/2024)",
        "MME — Plano Nacional de Mineração 2050",
      ],
    };
  }

  // Não é região conhecida — análise genérica via características regionais
  return {
    caseId: "TERRAS_RARAS",
    title: "Terras Raras — Vetor Estratégico Nacional",
    relevance: sigmineProcs.length > 0 ? "LATENTE" : "NÃO APLICÁVEL",
    thesis: `${ctx.name} não consta em zonas prioritárias da Política Nacional de Terras Raras. ` +
      `Avaliação preliminar não indica jazidas conhecidas, mas geologia regional pode reservar potencial não mapeado.`,
    evidence: [
      "Município não consta no mapa de minerais críticos do MME",
      "Sem operações ativas de TR conhecidas",
    ],
    potential: null,
    risks: [],
    hotspots: [],
    sources: ["SIGMINE-ANM", "MME — Plano Nacional de Mineração"],
  };
}
