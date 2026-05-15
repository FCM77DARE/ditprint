/**
 * Contexto Territorial Pré-Definido — Print Territorial Intelligence™
 *
 * Este arquivo contém o conhecimento estruturado sobre cada território analisado:
 * - Metodologia DIT completa (pesos dos índices, fórmula do STT)
 * - Contexto histórico, institucional e socioambiental
 * - Histórico de scores STT para calibração
 * - Fontes de referência e dados estruturais
 *
 * O LLM usa este contexto para calcular o STT automaticamente.
 * NENHUM campo do STT deve ser preenchido manualmente pelo analista.
 */

// ─── Metodologia DIT ─────────────────────────────────────────────────────────

export const DIT_METHODOLOGY = `
## METODOLOGIA DIT — Diagnóstico de Inteligência Territorial

### Fórmula do STT (Score de Tensão Territorial)
STT = (ITT × 0.25) + (ICS × 0.20) + (IVS × 0.20) + (IVE × 0.20) + (ICI × 0.15)

Onde:
- **ITT** — Índice de Tensão Territorial (peso 25%)
  Mede disputas de uso e ocupação do território: sobreposição de jurisdições, conflitos fundiários, 
  demarcações, invasões, disputas entre setores (energia vs. pesca, mineração vs. indígenas).
  
- **ICS** — Índice de Complexidade Social (peso 20%)
  Mede o grau de organização e articulação dos atores sociais: presença de lideranças, 
  associações, cooperativas, sindicatos, capacidade de mobilização e negociação.
  
- **IVS** — Índice de Vulnerabilidade Social (peso 20%)
  Mede a exposição de populações vulneráveis: comunidades tradicionais, pescadores artesanais,
  indígenas, quilombolas, populações de baixa renda em áreas de risco.
  
- **IVE** — Índice de Vulnerabilidade Ecossistêmica (peso 20%)
  Mede a fragilidade e pressão sobre ecossistemas: poluição, desmatamento, contaminação,
  perda de biodiversidade, impactos sobre recursos hídricos.
  
- **ICI** — Índice de Complexidade Institucional (peso 15%)
  Mede a fragmentação e sobreposição de competências institucionais: número de órgãos reguladores,
  conflitos de jurisdição, instabilidade regulatória, litigiosidade.

### Classificação do STT
- 0–39: Baixa Complexidade Territorial
- 40–59: Complexidade Moderada
- 60–74: Alta Complexidade Territorial
- 75–89: Complexidade Crítica
- 90–100: Complexidade Extrema (Alerta Máximo)

### Cenários Estruturais
- **Estabilidade Condicionada**: STT estável, sem variação significativa, riscos controlados
- **Pressão Gradual**: STT em elevação lenta, acúmulo de tensões, atenção recomendada
- **Escalada Sistêmica**: STT em elevação acelerada, múltiplos índices ativados, intervenção urgente
`;

// ─── Contextos Territoriais ───────────────────────────────────────────────────

export const TERRITORY_CONTEXTS: Record<string, TerritoryContext> = {

  "baia-guanabara": {
    name: "Baía de Guanabara",
    region: "Sudeste — Rio de Janeiro (RJ)",
    area: "412 km² de espelho d'água, 16 municípios no entorno",

    historicalBackground: `
A Baía de Guanabara é um dos territórios de maior complexidade territorial do Brasil. 
Localizada no coração da Região Metropolitana do Rio de Janeiro, concentra simultaneamente:
- O maior porto da América Latina (Porto do Rio de Janeiro / Porto de Itaguaí)
- A Refinaria Duque de Caxias (REDUC) — maior refinaria da Petrobras
- Comunidades tradicionais de pescadores artesanais (estimativa: 6.000 pescadores ativos)
- Área de Proteção Ambiental (APA Guapimirim) com manguezais críticos
- Sobreposição de jurisdições: IBAMA, INEA, ANTAQ, ANP, Marinha do Brasil, 16 prefeituras, Estado do RJ

Histórico de incidentes críticos:
- 2000: Vazamento de 1,3 milhão de litros de óleo da REDUC (maior desastre ambiental da história do RJ)
- 2015: Operações de dragagem do Porto controversas com impacto em comunidades pesqueiras
- 2019-2023: Programa de despoluição da Baía (ODS 2016) com execução abaixo do esperado
- 2024: Conflitos entre expansão do Porto de Itaguaí e comunidades de Mangaratiba
`,

    institutionalActors: `
Atores institucionais presentes no território:
- IBAMA: licenciamento ambiental federal, fiscalização
- INEA (Instituto Estadual do Ambiente): licenciamento estadual, monitoramento hídrico
- ANTAQ: regulação portuária
- ANP: regulação de petróleo e gás (REDUC, terminais)
- Marinha do Brasil: segurança da navegação, soberania
- FUNPESCA / Colônias de Pescadores: representação dos pescadores artesanais
- ICMBio: gestão da APA Guapimirim
- Petrobras: operação da REDUC e terminais
- Porto do Rio / Companhia Docas: operação portuária
- 16 prefeituras municipais: Niterói, São Gonçalo, Magé, Guapimirim, etc.
`,

    sttHistory: [
      { period: "2024-01", stt: 74, activatedIndex: "IVE", scenario: "pressao", note: "Início do monitoramento DIT" },
      { period: "2024-06", stt: 76, activatedIndex: "ICS", scenario: "pressao", note: "Conflito pescadores vs. dragagem Porto Itaguaí" },
      { period: "2024-09", stt: 77, activatedIndex: "IVE", scenario: "pressao", note: "Relatório INEA sobre contaminação por metais pesados" },
      { period: "2024-12", stt: 78, activatedIndex: "ICI", scenario: "pressao", note: "Disputa de competência IBAMA-INEA sobre licença REDUC" },
      { period: "2025-03", stt: 78, activatedIndex: "IVS", scenario: "pressao", note: "Mobilização de pescadores contra novo terminal" },
      { period: "2025-06", stt: 79, activatedIndex: "IVE", scenario: "pressao", note: "Derramamento menor de óleo no Canal do Fundão" },
      { period: "2025-09", stt: 78, activatedIndex: "ICS", scenario: "estabilidade", note: "Acordo mediado entre Petrobras e colônias de pescadores" },
      { period: "2025-12", stt: 78, activatedIndex: "ICI", scenario: "pressao", note: "Renovação de licença REDUC em disputa" },
    ],

    baselineScores: {
      stt: 78,
      itt: 72,
      ics: 80,
      ivs: 82,
      ive: 85,
      ici: 70,
    },

    keyRisks: `
Riscos estruturais do território:
1. Expansão portuária vs. pesca artesanal: tensão crônica entre crescimento do Porto de Itaguaí e modos de vida tradicionais
2. REDUC e risco de vazamento: infraestrutura envelhecida, histórico de incidentes, pressão regulatória crescente
3. Saneamento: apenas 30% do esgoto tratado antes de chegar à baía (meta 2033 do Marco Legal do Saneamento)
4. Sobreposição de licenças: projetos de infraestrutura frequentemente paralisados por conflito de competência entre IBAMA e INEA
5. Mudanças climáticas: aumento do nível do mar ameaça comunidades costeiras e infraestrutura portuária
`,

    signalWeights: `
Pesos de impacto por tipo de sinal para este território:
- Notícias sobre IBAMA/INEA/licença ambiental → IVE (peso alto)
- Notícias sobre pescadores/comunidades → IVS + ICS (peso alto)
- Notícias sobre Porto/ANTAQ/dragagem → ITT + ICI (peso médio-alto)
- Notícias sobre REDUC/Petrobras/petróleo → IVE + ICI (peso alto)
- Notícias sobre saneamento/esgoto → IVE (peso médio)
- Notícias sobre conflito fundiário → ITT (peso alto)
- Notícias sobre decisão judicial/liminar → ICI (peso alto)
`,

    searchQueries: [
      "Baía de Guanabara poluição",
      "Baía de Guanabara licença ambiental IBAMA",
      "Porto Rio de Janeiro dragagem pescadores",
      "REDUC Petrobras Duque de Caxias",
      "INEA Rio de Janeiro licença",
      "Baía de Guanabara saneamento esgoto",
      "pescadores artesanais Rio de Janeiro conflito",
      "Baía de Guanabara conflito territorial",
    ],
  },

  "teles-pires": {
    name: "Bacia do Rio Teles Pires",
    region: "Centro-Oeste/Norte — Mato Grosso (MT) e Pará (PA)",
    area: "141.000 km² de bacia hidrográfica",

    historicalBackground: `
A Bacia do Rio Teles Pires é um dos territórios de maior tensão socioambiental do Brasil.
Afluente do Tapajós, concentra simultaneamente:
- 3 etnias indígenas: Munduruku, Kayabi (Kawaiwete) e Apiaká — 14 aldeias, ~4.000 indígenas
- Complexo hidrelétrico: UHE Teles Pires (1.820 MW), UHE São Manoel, PCH Sinop, PCH Colíder
- Alta sensibilidade ictiofaunística: 95% das espécies de peixe da bacia são endêmicas
- Fronteira do agronegócio: expansão da soja e pecuária no Mato Grosso
- Garimpo ilegal crescente na região do Tapajós

Histórico de conflitos críticos:
- 2012-2013: Protesto Munduruku contra UHE Teles Pires — bloqueio do rio, confronto com PF
- 2013: Destruição do Sítio Sagrado Sete Quedas durante construção da UHE (crime ambiental)
- 2015: IBAMA embarga obras da UHE São Manoel por irregularidades no licenciamento
- 2019: Relatório FUNAI aponta 14 aldeias impactadas por hidrelétricas sem consulta prévia (Conv. 169 OIT)
- 2022: Garimpo ilegal avança para áreas próximas às Terras Indígenas
- 2024: Munduruku entram com ação no STF contra licença da UHE São Manoel
`,

    institutionalActors: `
Atores institucionais presentes no território:
- FUNAI: demarcação e proteção das Terras Indígenas Munduruku, Kayabi, Apiaká
- IBAMA: licenciamento ambiental das hidrelétricas, fiscalização
- ANEEL: regulação do setor elétrico, concessões das UHEs
- ANA (Agência Nacional de Águas): gestão dos recursos hídricos
- MPF (Ministério Público Federal): ações judiciais em defesa dos indígenas
- Lideranças Munduruku (Cacique Juarez Saw, Alessandra Korap): articulação política nacional e internacional
- Consórcio UHE Teles Pires: Neoenergia, Furnas, Odebrecht (em recuperação)
- Consórcio UHE São Manoel: EDF, Furnas, Eletrobras
- Governo do MT: apoio ao agronegócio e infraestrutura energética
- SEMA-MT: licenciamento ambiental estadual
`,

    sttHistory: [
      { period: "2024-01", stt: 82, activatedIndex: "ITT", scenario: "pressao", note: "Ação Munduruku no STF contra UHE São Manoel" },
      { period: "2024-06", stt: 83, activatedIndex: "IVS", scenario: "pressao", note: "Relatório FUNAI sobre impactos nas aldeias" },
      { period: "2024-09", stt: 84, activatedIndex: "IVE", scenario: "escalada", note: "Avanço do garimpo ilegal próximo às TIs" },
      { period: "2024-12", stt: 84, activatedIndex: "ICI", scenario: "pressao", note: "Disputa IBAMA-ANEEL sobre renovação de licença" },
      { period: "2025-03", stt: 85, activatedIndex: "ITT", scenario: "escalada", note: "Bloqueio do rio por Munduruku — 3ª vez em 10 anos" },
      { period: "2025-06", stt: 84, activatedIndex: "ICS", scenario: "pressao", note: "Acordo de compensação entre consórcio e comunidades" },
      { period: "2025-09", stt: 83, activatedIndex: "IVE", scenario: "pressao", note: "Relatório ICMBio sobre ictiofauna — 12 espécies em risco" },
      { period: "2025-12", stt: 84, activatedIndex: "ITT", scenario: "pressao", note: "Demarcação de nova TI em área de expansão agrícola" },
    ],

    baselineScores: {
      stt: 84,
      itt: 88,
      ics: 85,
      ivs: 86,
      ive: 82,
      ici: 78,
    },

    keyRisks: `
Riscos estruturais do território:
1. Consulta prévia não realizada: risco de nulidade de licenças por violação da Convenção 169 da OIT
2. Garimpo ilegal: avanço sobre TIs e recursos hídricos, contaminação por mercúrio
3. Fragmentação da bacia: barragens impactam migração de peixes, afetando segurança alimentar indígena
4. Conflito fundiário: sobreposição entre TIs, áreas de expansão agrícola e concessões hidrelétricas
5. Litigiosidade crescente: múltiplas ações no STF e TRF1 podem paralisar operações das UHEs
6. Mudanças climáticas: redução do regime de chuvas impacta geração e disponibilidade hídrica
`,

    signalWeights: `
Pesos de impacto por tipo de sinal para este território:
- Notícias sobre Munduruku/Kayabi/Apiaká/indígena → IVS + ITT (peso muito alto)
- Notícias sobre hidrelétrica/UHE/ANEEL → ICI + ITT (peso alto)
- Notícias sobre IBAMA/licença/embargo → ICI + IVE (peso alto)
- Notícias sobre garimpo/mineração → IVE + ITT (peso alto)
- Notícias sobre FUNAI/demarcação → ITT (peso muito alto)
- Notícias sobre peixe/ictiofauna/pesca → IVE + IVS (peso médio-alto)
- Notícias sobre agronegócio/soja/desmatamento → IVE + ITT (peso médio)
- Notícias sobre STF/MPF/decisão judicial → ICI (peso alto)
`,

    searchQueries: [
      "Rio Teles Pires hidrelétrica indígena",
      "Munduruku Kayabi Apiaká conflito",
      "UHE Teles Pires IBAMA licença",
      "Bacia Teles Pires garimpo ilegal",
      "Teles Pires demarcação terra indígena",
      "UHE São Manoel STF",
      "Teles Pires pesca ictiofauna",
      "Munduruku protesto bloqueio",
    ],
  },
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type SttHistoryEntry = {
  period: string;
  stt: number;
  activatedIndex: string;
  scenario: "estabilidade" | "pressao" | "escalada";
  note: string;
};

export type TerritoryContext = {
  name: string;
  region: string;
  area: string;
  historicalBackground: string;
  institutionalActors: string;
  sttHistory: SttHistoryEntry[];
  baselineScores: {
    stt: number;
    itt: number;
    ics: number;
    ivs: number;
    ive: number;
    ici: number;
  };
  keyRisks: string;
  signalWeights: string;
  searchQueries: string[];
};

// ─── Helper: montar prompt de contexto completo ───────────────────────────────

export function buildTerritoryContextPrompt(slug: string): string {
  const ctx = TERRITORY_CONTEXTS[slug];
  if (!ctx) return "";

  const historyStr = ctx.sttHistory
    .slice(-6) // últimos 6 períodos
    .map((h) => `  ${h.period}: STT ${h.stt} | Índice ativado: ${h.activatedIndex} | Cenário: ${h.scenario} | ${h.note}`)
    .join("\n");

  const baseline = ctx.baselineScores;

  return `
=== CONTEXTO TERRITORIAL: ${ctx.name.toUpperCase()} ===

LOCALIZAÇÃO: ${ctx.region}
ÁREA: ${ctx.area}

SCORES BASELINE (referência para calibração):
  STT: ${baseline.stt} | ITT: ${baseline.itt} | ICS: ${baseline.ics} | IVS: ${baseline.ivs} | IVE: ${baseline.ive} | ICI: ${baseline.ici}

HISTÓRICO RECENTE DE SCORES STT:
${historyStr}

CONTEXTO HISTÓRICO E ESTRUTURAL:
${ctx.historicalBackground}

ATORES INSTITUCIONAIS:
${ctx.institutionalActors}

RISCOS ESTRUTURAIS:
${ctx.keyRisks}

PESOS DE IMPACTO DOS SINAIS:
${ctx.signalWeights}

${DIT_METHODOLOGY}
`;
}
