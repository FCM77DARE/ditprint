/**
 * Caso Estratégico — DATA CENTERS
 *
 * Contexto BR 2025-2026:
 *   • Brasil é o maior mercado de data centers da AL (~600 MW instalados, 2024)
 *   • Tamboré/Barueri-SP é o maior cluster (≥40% da capacidade nacional)
 *   • Fortaleza-CE concentra pousos de cabos submarinos (EllaLink, Monet, etc.)
 *   • Política "Redata" (2024-25) busca incentivos fiscais para hiperescala
 *   • Bottleneck: energia (capacidade de subestação), água (cooling), conectividade
 *
 * Fontes de dados:
 *   • ABRINTEL / DCD census (público parcial)
 *   • ANEEL (capacidade de transmissão por município)
 *   • Lista de cabos submarinos (TeleGeography)
 *   • Conhecimento de hubs (hardcoded mapping)
 */

import { logger } from "../../_core/logger";
import type {
  CaseRelevance,
  Hotspot,
  StrategicCaseResult,
  TerritoryStrategicContext,
} from "../types";

const log = logger.child({ module: "strategic.data-centers" });

interface KnownHub {
  name: string;
  state: string;
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

const KNOWN_HUBS: KnownHub[] = [
  {
    name: "Barueri / Tamboré",
    state: "SP",
    aliases: ["barueri", "tambore", "tamboré", "alphaville"],
    relevance: "ESTRATÉGICO",
    thesis:
      "Tamboré/Barueri é o maior cluster de data centers da América Latina, com presença de Equinix, " +
      "Ascenty, ODATA, Scala e hiperescaladores (AWS, Google, Azure availability zones). " +
      "Concentra ~40% da capacidade instalada do país.",
    evidence: [
      "Mais de 15 data centers tier III/IV operacionais",
      "Subestações dedicadas ENEL + redundância de fibra",
      "Latência <2ms para Av. Paulista (PTT-SP)",
      "Plano de expansão hiperescala anunciado por AWS e Microsoft (2024-25)",
    ],
    hotspots: [
      {
        name: "Equinix SP4",
        lat: -23.5066,
        lng: -46.8478,
        description: "Hub Equinix em Tamboré, interconexão regional",
      },
      {
        name: "Ascenty Tamboré",
        lat: -23.5119,
        lng: -46.8525,
        description: "Campus Ascenty com múltiplos prédios DC",
      },
      {
        name: "ODATA SP01",
        lat: -23.5022,
        lng: -46.8389,
        description: "Data center hiperescala em Santana de Parnaíba",
      },
    ],
  },
  {
    name: "São Paulo (Capital)",
    state: "SP",
    aliases: ["sao paulo", "são paulo"],
    relevance: "ESTRATÉGICO",
    thesis:
      "Capital paulista concentra PTT-SP (maior IXP da AL) e diversos data centers " +
      "metropolitanos. Eixo Faria Lima / Marginal Pinheiros é polo de colocation premium.",
    evidence: [
      "PTT-SP (NIC.br) é o maior ponto de troca de tráfego da América Latina",
      "Presença de Equinix SP1/SP2/SP3, Cirion, Scala Lapa",
      "Conectividade densa: backbone de fibra de todas as operadoras",
    ],
    hotspots: [
      {
        name: "Equinix SP1",
        lat: -23.5167,
        lng: -46.6500,
        description: "Hub histórico de interconexão em São Paulo capital",
      },
      {
        name: "PTT-SP (NIC.br)",
        lat: -23.5618,
        lng: -46.6918,
        description: "Maior ponto de troca de tráfego da América Latina",
      },
    ],
  },
  {
    name: "Fortaleza",
    state: "CE",
    aliases: ["fortaleza"],
    relevance: "ESTRATÉGICO",
    thesis:
      "Fortaleza é o principal ponto de pouso de cabos submarinos da América do Sul " +
      "(EllaLink, Monet, GlobeNet, SAm-1, Curie). Polo natural para data centers " +
      "voltados a tráfego internacional e latência transatlântica.",
    evidence: [
      "≥6 cabos submarinos ativos com pouso na Praia do Futuro",
      "EllaLink (BR-Europa) operacional desde 2021",
      "Programa CE Hub Digital (governo do estado)",
      "Presença de V.tal, ODATA e operadores menores",
    ],
    hotspots: [
      {
        name: "Estação de Cabos Praia do Futuro",
        lat: -3.7437,
        lng: -38.4756,
        description: "Pouso de cabos submarinos EllaLink, Monet, GlobeNet",
      },
      {
        name: "V.tal Fortaleza",
        lat: -3.7327,
        lng: -38.5267,
        description: "Data center neutro com conexão direta aos cabos",
      },
    ],
  },
  {
    name: "Rio de Janeiro",
    state: "RJ",
    aliases: ["rio de janeiro", "rio"],
    relevance: "POTENCIAL",
    thesis:
      "Rio de Janeiro abriga data centers legados (Globo, Embratel/Cirion) e infraestrutura " +
      "de cabos submarinos secundária. Capacidade de expansão limitada por restrições urbanas e energéticas.",
    evidence: [
      "Cabos submarinos com pouso em Maricá e Praia Grande",
      "Cirion (ex-CenturyLink/Lumen) opera data center no centro",
      "Restrições energéticas mitigam expansão hiperescala",
    ],
    hotspots: [
      {
        name: "Cirion Rio Lapa",
        lat: -22.9143,
        lng: -43.1820,
        description: "Data center metropolitano legado",
      },
      {
        name: "Pouso de cabos Maricá",
        lat: -22.9286,
        lng: -42.7800,
        description: "Pousos de cabos submarinos secundários (Seabras-1, etc.)",
      },
    ],
  },
  {
    name: "Porto Alegre / Eldorado do Sul",
    state: "RS",
    aliases: ["porto alegre", "eldorado do sul", "canoas"],
    relevance: "POTENCIAL",
    thesis:
      "Região Sul tem clima mais frio (reduz custo de cooling) e matriz energética " +
      "majoritariamente hidrelétrica/eólica. Potencial subexplorado para data centers green.",
    evidence: [
      "Clima temperado reduz PUE (Power Usage Effectiveness)",
      "Matriz RS com forte componente eólica (Litoral Sul)",
      "Presença de Scala Data Centers em projeto na região metropolitana",
    ],
    hotspots: [
      {
        name: "Scala POA01 (projetado)",
        lat: -29.9722,
        lng: -51.0814,
        description: "Projeto de data center hiperescala em Eldorado do Sul",
      },
    ],
  },
  {
    name: "Camaçari / Salvador",
    state: "BA",
    aliases: ["camacari", "camaçari", "salvador"],
    relevance: "POTENCIAL",
    thesis:
      "Bahia tem matriz energética majoritariamente renovável (eólica + solar) e custos " +
      "fundiários menores que SP/RJ. Camaçari é candidata a polo de data center sustentável.",
    evidence: [
      "Matriz BA com ~80% renovável (eólica do São Francisco)",
      "Polo Industrial de Camaçari oferece infraestrutura compartilhada",
      "Custo de energia industrial competitivo (subsídios PEC)",
    ],
    hotspots: [
      {
        name: "Polo Industrial Camaçari",
        lat: -12.6975,
        lng: -38.3242,
        description: "Polo industrial com infraestrutura compartilhada",
      },
    ],
  },
];

// ─── ANÁLISE PRINCIPAL ────────────────────────────────────────────────────────

function findKnownHub(ctx: TerritoryStrategicContext): KnownHub | null {
  const normalized = ctx.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const h of KNOWN_HUBS) {
    if (h.state !== ctx.state) continue;
    if (h.aliases.some(a => normalized.includes(a))) return h;
  }
  return null;
}

export async function analyzeDataCenters(
  ctx: TerritoryStrategicContext
): Promise<StrategicCaseResult> {
  log.info({ territory: ctx.name }, "Analisando caso Data Centers");

  const known = findKnownHub(ctx);

  if (known) {
    const hotspots: Hotspot[] = known.hotspots.map(h => ({
      type: "potencial",
      category: "data-center",
      name: h.name,
      lat: h.lat,
      lng: h.lng,
      description: h.description,
      source: "ABRINTEL / DCD census / Telegeography",
      impact: 0.85,
      dimension: "D3",
    }));

    return {
      caseId: "DATA_CENTERS",
      title: "Data Centers — Vetor de Soberania Digital",
      relevance: known.relevance,
      thesis: known.thesis,
      evidence: known.evidence,
      potential:
        "Atração de hiperescaladores (AWS, Azure, Google), colocation neutro, " +
        "indústria de IA (inferência regional), redução de latência para usuários BR.",
      risks: [
        "Capacidade de subestação ENEL/Light/equivalente como gargalo (D3)",
        "Demanda hídrica para cooling em regiões com estresse (D1)",
        "Pressão sobre solo urbano e zoneamento (D4)",
        "Incertezas regulatórias do Redata e tributação ICMS",
      ],
      hotspots,
      sources: [
        "ABRINTEL — Associação Brasileira de Infraestrutura Digital",
        "DCD Census (Data Center Dynamics)",
        "TeleGeography Submarine Cable Map",
        "ANEEL — Capacidade de Transmissão",
      ],
    };
  }

  // Município genérico — sem hub identificado
  return {
    caseId: "DATA_CENTERS",
    title: "Data Centers — Vetor de Soberania Digital",
    relevance: "NÃO APLICÁVEL",
    thesis: `${ctx.name} não consta em mapeamento de hubs de data centers brasileiros. ` +
      `Latência elevada para PTT-SP e ausência de cabos submarinos próximos restringem viabilidade.`,
    evidence: [
      "Sem operações de data center hiperescala identificadas",
      "Latência típica > 30ms para PTT-SP em municípios fora dos eixos principais",
    ],
    potential: null,
    risks: [],
    hotspots: [],
    sources: ["ABRINTEL", "TeleGeography"],
  };
}
