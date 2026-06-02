/**
 * PRINT Territorial Intelligence™ — Indicadores v.0
 *
 * Materialização da planilha "Indicadores Print_130426.xlsx" em código.
 * Esta é a fonte de verdade para a estrutura de 6 dimensões do DIT.
 *
 * Pesos das dimensões no STT final (Σ = 1.0):
 *   D1 Socioambiental        = 0.22
 *   D2 Socioeconômica        = 0.15
 *   D3 Infraestrutura        = 0.15
 *   D4 Dinâmica Territorial  = 0.22
 *   D5 Governança            = 0.15
 *   D6 Reputação             = 0.11
 *
 * Peso dos indicadores: escala 1-3 conforme planilha (1=baixo, 2=médio, 3=alto).
 *
 * Fórmula STT:
 *   STT = Σ (Di × Wi), onde i ∈ {1..6} e Σ Wi = 1.0
 *   Di  = Σ (indicador_j × peso_j) / Σ pesos_j   (score normalizado 0-100)
 */

// ─── Source agent IDs (32 fontes) ─────────────────────────────────────────────

export const SOURCE_IDS = {
  // D1 — Socioambiental
  INMET: "src-inmet",
  CPTEC_INPE: "src-cptec-inpe",
  IBGE_MAPBIOMAS: "src-ibge-mapbiomas",
  CNUC: "src-cnuc",
  SECRETARIAS_MA: "src-secretarias-ma",
  CEMADEN: "src-cemaden",
  FIOCRUZ_CLIMA: "src-fiocruz-clima",
  INPE_DETER: "src-inpe-deter",
  IBAMA: "src-ibama",
  MP_AMBIENTAL: "src-mp-ambiental",
  INEA: "src-inea",

  // D2 — Socioeconômica
  IBGE_CENSO: "src-ibge-censo",
  IBGE_RENDA: "src-ibge-renda",
  PNUD_ATLAS: "src-pnud-atlas",
  IPEADATA: "src-ipeadata",

  // D3 — Infraestrutura
  SNIS_SINASA: "src-snis-sinasa",
  DATASUS: "src-datasus",
  INEP: "src-inep",
  IBGE_HABITACAO: "src-ibge-habitacao",
  MAPA_EMPRESAS: "src-mapa-empresas",
  ANTT_PORTOS: "src-antt-portos",
  SINIR: "src-sinir",
  ANEEL_SIGA: "src-aneel-siga",
  SNIS: "src-snis",
  DATASUS_REAL: "src-datasus-real",
  INEP_IDEB: "src-inep-ideb",

  // D4 — Dinâmica Territorial
  PLANO_DIRETOR: "src-plano-diretor",
  INCRA_SIPRA: "src-incra-sipra",
  JUDICIARIO: "src-judiciario",
  FOGO_CRUZADO: "src-fogo-cruzado",
  GENI_UFF: "src-geni-uff",
  ISP_SSP: "src-isp-ssp",
  FUNAI_IPHAN: "src-funai-iphan",
  UNICAMP_TERR: "src-unicamp-terr",

  // D5 — Governança
  QUERIDO_DIARIO: "src-querido-diario",
  CONSELHOS: "src-conselhos",
  AUDIENCIAS: "src-audiencias",
  ORCAMENTO_PARTICIPATIVO: "src-orcamento-participativo",

  // D6 — Reputação
  GOOGLE_NEWS: "src-google-news",
  GOOGLE_TRENDS: "src-google-trends",
  REDES_SOCIAIS: "src-redes-sociais",
  UNIVERSIDADES: "src-universidades",
} as const;

export type SourceId = typeof SOURCE_IDS[keyof typeof SOURCE_IDS];

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DimensionId = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7";

export interface Indicator {
  /** Código hierárquico da planilha: "1.1.1.1", "2.2.2.1", etc. */
  code: string;
  /** ID kebab-case para uso em banco/API */
  id: string;
  dimension: DimensionId;
  /** Agrupamento temático dentro da dimensão: "1.1 Bioma", "2.2 Desigualdade", etc. */
  objectOfStudy: string;
  /** Item de estudo (nível intermediário): "1.1.3 APAs / APPs" */
  itemOfStudy: string;
  /** Nome legível do indicador */
  name: string;
  /** IDs dos agentes de fonte que alimentam este indicador */
  sources: SourceId[];
  /**
   * Peso do indicador na dimensão (1=baixo, 2=médio, 3=alto).
   * Fonte: coluna "PESO" da planilha v.0.
   */
  weight: 1 | 2 | 3;
  /** Observações da planilha / critérios de coleta */
  notes?: string;
}

export interface ObjectOfStudy {
  code: string;           // ex: "1.1"
  name: string;           // ex: "Bioma"
  indicators: Indicator[];
}

export interface Dimension {
  id: DimensionId;
  /** Número ordinal (1-6) */
  number: number;
  name: string;
  /** Peso no cálculo STT final (Σ pesos = 1.0) */
  weight: number;
  objectsOfStudy: ObjectOfStudy[];
}

// ─── D1 — Socioambiental ──────────────────────────────────────────────────────

const D1: Dimension = {
  id: "D1",
  number: 1,
  name: "Socioambiental",
  weight: 0.20,
  objectsOfStudy: [
    {
      code: "1.1",
      name: "Bioma",
      indicators: [
        {
          code: "1.1.1.1",
          id: "d1-clima-predominante",
          dimension: "D1",
          objectOfStudy: "1.1 Bioma",
          itemOfStudy: "1.1.1 Clima",
          name: "Clima predominante",
          sources: [SOURCE_IDS.INMET, SOURCE_IDS.CPTEC_INPE],
          weight: 1,
        },
        {
          code: "1.1.2.1",
          id: "d1-vegetacao-predominante",
          dimension: "D1",
          objectOfStudy: "1.1 Bioma",
          itemOfStudy: "1.1.2 Vegetação",
          name: "Vegetação predominante",
          sources: [SOURCE_IDS.IBGE_MAPBIOMAS, SOURCE_IDS.INPE_DETER],
          weight: 1,
        },
        {
          code: "1.1.3.1",
          id: "d1-apa-app-percentual",
          dimension: "D1",
          objectOfStudy: "1.1 Bioma",
          itemOfStudy: "1.1.3 Áreas de Proteção Ambiental (APA) / Áreas de Preservação Permanente (APP)",
          name: "Percentual/quantidade de APA e APP",
          sources: [SOURCE_IDS.CNUC, SOURCE_IDS.SECRETARIAS_MA],
          weight: 2,
          notes: "Cumprimento da legislação ambiental. Inclui CAR (Cadastro Ambiental Rural).",
        },
      ],
    },
    {
      code: "1.2",
      name: "Vulnerabilidade Ambiental",
      indicators: [
        {
          code: "1.2.1.1",
          id: "d1-eventos-extremos",
          dimension: "D1",
          objectOfStudy: "1.2 Vulnerabilidade Ambiental",
          itemOfStudy: "1.2.1 Eventos Climáticos",
          name: "Quantidade e frequência de eventos extremos (secas, enchentes, deslizamentos, incêndios) nos últimos 5 anos",
          sources: [SOURCE_IDS.CEMADEN, SOURCE_IDS.INMET, SOURCE_IDS.FIOCRUZ_CLIMA],
          weight: 3,
        },
        {
          code: "1.2.2.1",
          id: "d1-degradacao-ambiental",
          dimension: "D1",
          objectOfStudy: "1.2 Vulnerabilidade Ambiental",
          itemOfStudy: "1.2.2 Degradação Ambiental",
          name: "Índice de Degradação Ambiental (IDA) / alertas INPE-TerraBrasilis",
          sources: [SOURCE_IDS.INPE_DETER, SOURCE_IDS.FIOCRUZ_CLIMA],
          weight: 3,
        },
      ],
    },
    {
      code: "1.3",
      name: "Passivos Ambientais",
      indicators: [
        {
          code: "1.3.1.1",
          id: "d1-acidentes-contaminacao",
          dimension: "D1",
          objectOfStudy: "1.3 Passivos Ambientais",
          itemOfStudy: "1.3.1 Acidentes",
          name: "Quantidade de acidentes ambientais com contaminação nos últimos 5 anos",
          sources: [SOURCE_IDS.IBAMA, SOURCE_IDS.MP_AMBIENTAL],
          weight: 3,
        },
        {
          code: "1.3.1.2",
          id: "d1-tacs-ativos",
          dimension: "D1",
          objectOfStudy: "1.3 Passivos Ambientais",
          itemOfStudy: "1.3.1 Acidentes",
          name: "Número de TACs ambientais ativos",
          sources: [SOURCE_IDS.MP_AMBIENTAL, SOURCE_IDS.IBAMA],
          weight: 3,
        },
        {
          code: "1.3.1.3",
          id: "d1-acoes-civis-publicas",
          dimension: "D1",
          objectOfStudy: "1.3 Passivos Ambientais",
          itemOfStudy: "1.3.1 Acidentes",
          name: "Número de Ações Civis Públicas Ambientais (ACPs)",
          sources: [SOURCE_IDS.MP_AMBIENTAL],
          weight: 3,
        },
        {
          code: "1.3.2.1",
          id: "d1-empreendimentos-impacto",
          dimension: "D1",
          objectOfStudy: "1.3 Passivos Ambientais",
          itemOfStudy: "1.3.2 Empreendimentos com significativo grau de impacto",
          name: "Quantidade de empreendimentos médios/grandes na região",
          sources: [SOURCE_IDS.IBAMA, SOURCE_IDS.SECRETARIAS_MA],
          weight: 3,
        },
      ],
    },
  ],
};

// ─── D2 — Socioeconômica ──────────────────────────────────────────────────────

const D2: Dimension = {
  id: "D2",
  number: 2,
  name: "Socioeconômica",
  weight: 0.14,
  objectsOfStudy: [
    {
      code: "2.1",
      name: "População",
      indicators: [
        {
          code: "2.1.1.1",
          id: "d2-populacao-por-idade-genero",
          dimension: "D2",
          objectOfStudy: "2.1 População",
          itemOfStudy: "2.1.1 Perfil Demográfico / Pirâmide Etária",
          name: "População por idade e gênero (pirâmide etária)",
          sources: [SOURCE_IDS.IBGE_CENSO],
          weight: 1,
        },
        {
          code: "2.1.1.2",
          id: "d2-populacao-urbana-rural",
          dimension: "D2",
          objectOfStudy: "2.1 População",
          itemOfStudy: "2.1.1 Perfil Demográfico",
          name: "Distribuição urbana e rural",
          sources: [SOURCE_IDS.IBGE_CENSO],
          weight: 1,
        },
        {
          code: "2.1.1.3",
          id: "d2-densidade-demografica",
          dimension: "D2",
          objectOfStudy: "2.1 População",
          itemOfStudy: "2.1.1 Perfil Demográfico",
          name: "Densidade demográfica (hab/km²)",
          sources: [SOURCE_IDS.IBGE_CENSO],
          weight: 1,
        },
        {
          code: "2.1.1.4",
          id: "d2-idh",
          dimension: "D2",
          objectOfStudy: "2.1 População",
          itemOfStudy: "2.1.2 IDH",
          name: "Índice de Desenvolvimento Humano (IDH)",
          sources: [SOURCE_IDS.PNUD_ATLAS],
          weight: 1,
        },
      ],
    },
    {
      code: "2.2",
      name: "Desigualdade",
      indicators: [
        {
          code: "2.2.1.1",
          id: "d2-renda-per-capita",
          dimension: "D2",
          objectOfStudy: "2.2 Desigualdade",
          itemOfStudy: "2.2.1 Renda / Emprego",
          name: "Renda per capita média",
          sources: [SOURCE_IDS.IBGE_RENDA, SOURCE_IDS.IPEADATA],
          weight: 1,
        },
        {
          code: "2.2.1.2",
          id: "d2-desemprego-informalidade",
          dimension: "D2",
          objectOfStudy: "2.2 Desigualdade",
          itemOfStudy: "2.2.1 Renda / Emprego",
          name: "Taxa de desemprego e informalidade",
          sources: [SOURCE_IDS.IBGE_RENDA, SOURCE_IDS.IPEADATA],
          weight: 1,
        },
        {
          code: "2.2.2.1",
          id: "d2-taxa-pobreza",
          dimension: "D2",
          objectOfStudy: "2.2 Desigualdade",
          itemOfStudy: "2.2.2 Pobreza",
          name: "Taxa de Pobreza (abaixo da linha da pobreza)",
          sources: [SOURCE_IDS.IBGE_RENDA, SOURCE_IDS.IPEADATA],
          weight: 2,
        },
        {
          code: "2.2.2.2",
          id: "d2-indice-gini",
          dimension: "D2",
          objectOfStudy: "2.2 Desigualdade",
          itemOfStudy: "2.2.2 Pobreza",
          name: "Índice de Gini",
          sources: [SOURCE_IDS.IPEADATA, SOURCE_IDS.PNUD_ATLAS],
          weight: 2,
        },
      ],
    },
  ],
};

// ─── D3 — Infraestrutura e Serviços ───────────────────────────────────────────

const D3: Dimension = {
  id: "D3",
  number: 3,
  name: "Infraestrutura e Serviços",
  weight: 0.14,
  objectsOfStudy: [
    {
      code: "3.1",
      name: "Acesso a Políticas Públicas",
      indicators: [
        {
          code: "3.1.1.1",
          id: "d3-cobertura-saneamento",
          dimension: "D3",
          objectOfStudy: "3.1 Acesso a Políticas Públicas",
          itemOfStudy: "3.1.1 Saneamento",
          name: "Cobertura do saneamento básico (%)",
          sources: [SOURCE_IDS.SNIS_SINASA],
          weight: 2,
        },
        {
          code: "3.1.2.1",
          id: "d3-acesso-saude",
          dimension: "D3",
          objectOfStudy: "3.1 Acesso a Políticas Públicas",
          itemOfStudy: "3.1.2 Saúde",
          name: "Acesso a serviços de saúde (cobertura SUS, equipamentos de saúde)",
          sources: [SOURCE_IDS.DATASUS],
          weight: 1,
        },
        {
          code: "3.1.3.1",
          id: "d3-taxa-escolaridade",
          dimension: "D3",
          objectOfStudy: "3.1 Acesso a Políticas Públicas",
          itemOfStudy: "3.1.3 Educação",
          name: "Taxa de escolaridade média",
          sources: [SOURCE_IDS.INEP],
          weight: 1,
        },
        {
          code: "3.1.4.1",
          id: "d3-deficit-habitacional",
          dimension: "D3",
          objectOfStudy: "3.1 Acesso a Políticas Públicas",
          itemOfStudy: "3.1.4 Habitação",
          name: "Percentual de déficit habitacional",
          sources: [SOURCE_IDS.IBGE_HABITACAO],
          weight: 1,
        },
      ],
    },
    {
      code: "3.2",
      name: "Indústrias e Serviços",
      indicators: [
        {
          code: "3.2.1.1",
          id: "d3-perfil-industrias",
          dimension: "D3",
          objectOfStudy: "3.2 Indústrias e Serviços",
          itemOfStudy: "3.2.1 Indústrias",
          name: "Perfil e quantidade das indústrias locais",
          sources: [SOURCE_IDS.MAPA_EMPRESAS],
          weight: 1,
        },
        {
          code: "3.2.2.1",
          id: "d3-perfil-servicos",
          dimension: "D3",
          objectOfStudy: "3.2 Indústrias e Serviços",
          itemOfStudy: "3.2.2 Serviços",
          name: "Perfil e quantidade dos serviços locais",
          sources: [SOURCE_IDS.MAPA_EMPRESAS],
          weight: 1,
        },
        {
          code: "3.2.3.1",
          id: "d3-perfil-comercios",
          dimension: "D3",
          objectOfStudy: "3.2 Indústrias e Serviços",
          itemOfStudy: "3.2.3 Comércios",
          name: "Perfil e quantidade dos comércios locais",
          sources: [SOURCE_IDS.MAPA_EMPRESAS],
          weight: 1,
        },
      ],
    },
    {
      code: "3.3",
      name: "Logística",
      indicators: [
        {
          code: "3.3.1.1",
          id: "d3-transporte-empresas-linhas",
          dimension: "D3",
          objectOfStudy: "3.3 Logística",
          itemOfStudy: "3.3.1 Transporte / Mobilidade",
          name: "Quantitativo de empresas e linhas de transporte que atendem a localidade",
          sources: [SOURCE_IDS.ANTT_PORTOS],
          weight: 1,
        },
        {
          code: "3.3.2.1",
          id: "d3-distancia-rodovias",
          dimension: "D3",
          objectOfStudy: "3.3 Logística",
          itemOfStudy: "3.3.2 Acesso a rodovias",
          name: "Distância das principais rodovias",
          sources: [SOURCE_IDS.ANTT_PORTOS],
          weight: 1,
        },
        {
          code: "3.3.3.1",
          id: "d3-servicos-hidroviarios-portuarios",
          dimension: "D3",
          objectOfStudy: "3.3 Logística",
          itemOfStudy: "3.3.3 Transporte hidroviário / Portos",
          name: "Serviços de distribuição e logística hidroviária e portuária na região",
          sources: [SOURCE_IDS.ANTT_PORTOS],
          weight: 1,
        },
      ],
    },
  ],
};

// ─── D4 — Dinâmica Territorial ────────────────────────────────────────────────

const D4: Dimension = {
  id: "D4",
  number: 4,
  name: "Dinâmica Territorial",
  weight: 0.20,
  objectsOfStudy: [
    {
      code: "4.1",
      name: "Uso e Ocupação",
      indicators: [
        {
          code: "4.1.1",
          id: "d4-bairros-distritos",
          dimension: "D4",
          objectOfStudy: "4.1 Uso e Ocupação",
          itemOfStudy: "4.1.1 Zoneamento",
          name: "Quantidade de bairros / distritos e características do zoneamento",
          sources: [SOURCE_IDS.PLANO_DIRETOR],
          weight: 1,
        },
        {
          code: "4.1.2",
          id: "d4-areas-lazer",
          dimension: "D4",
          objectOfStudy: "4.1 Uso e Ocupação",
          itemOfStudy: "4.1.2 Áreas de lazer",
          name: "Quantidade de praças / quadras / espaços coletivos",
          sources: [SOURCE_IDS.PLANO_DIRETOR],
          weight: 1,
        },
      ],
    },
    {
      code: "4.2",
      name: "Conflitos de Uso",
      indicators: [
        {
          code: "4.2.1.1",
          id: "d4-conflitos-poder-publico",
          dimension: "D4",
          objectOfStudy: "4.2 Conflitos de Uso",
          itemOfStudy: "4.2.1 Conflitos poder público",
          name: "Histórico e quantitativo de conflitos com o poder público nos últimos 10 anos",
          sources: [SOURCE_IDS.JUDICIARIO, SOURCE_IDS.GOOGLE_NEWS],
          weight: 3,
        },
        {
          code: "4.2.2.1",
          id: "d4-conflitos-setor-privado",
          dimension: "D4",
          objectOfStudy: "4.2 Conflitos de Uso",
          itemOfStudy: "4.2.2 Conflitos setor privado",
          name: "Histórico e quantitativo de conflitos com empresas nos últimos 10 anos",
          sources: [SOURCE_IDS.JUDICIARIO, SOURCE_IDS.GOOGLE_NEWS],
          weight: 2,
        },
        {
          code: "4.2.3.1",
          id: "d4-poder-paralelo",
          dimension: "D4",
          objectOfStudy: "4.2 Conflitos de Uso",
          itemOfStudy: "4.2.3 Conflitos poder paralelo",
          name: "Dados sobre presença de poder paralelo na localidade",
          sources: [SOURCE_IDS.FOGO_CRUZADO, SOURCE_IDS.GENI_UFF, SOURCE_IDS.ISP_SSP],
          weight: 3,
        },
        {
          code: "4.2.4.1",
          id: "d4-sobrecarga-projetos",
          dimension: "D4",
          objectOfStudy: "4.2 Conflitos de Uso",
          itemOfStudy: "4.2.4 Sobrecarga de projetos / ações",
          name: "Quantitativo e tempo de execução de projetos / ações na localidade",
          sources: [SOURCE_IDS.GOOGLE_NEWS, SOURCE_IDS.CONSELHOS],
          weight: 1,
        },
      ],
    },
    {
      code: "4.3",
      name: "Expansão Urbana",
      indicators: [
        {
          code: "4.3.1.1",
          id: "d4-populacao-areas-risco",
          dimension: "D4",
          objectOfStudy: "4.3 Expansão Urbana",
          itemOfStudy: "4.3.1 Populações em áreas de risco",
          name: "Percentual da população em áreas de risco (enchentes, deslizamentos, desmatamento)",
          sources: [SOURCE_IDS.IBGE_CENSO, SOURCE_IDS.CEMADEN],
          weight: 2,
        },
      ],
    },
    {
      code: "4.4",
      name: "Populações Tradicionais e Assentamentos",
      indicators: [
        {
          code: "4.4.1",
          id: "d4-comunidades-tradicionais-qtd",
          dimension: "D4",
          objectOfStudy: "4.4 Populações Tradicionais e Assentamentos",
          itemOfStudy: "4.4.1 Existência de populações tradicionais",
          name: "Quantitativo de comunidades tradicionais existentes",
          sources: [SOURCE_IDS.FUNAI_IPHAN, SOURCE_IDS.UNICAMP_TERR, SOURCE_IDS.IBGE_CENSO],
          weight: 3,
        },
        {
          code: "4.4.2",
          id: "d4-comunidades-tradicionais-reconhecimento",
          dimension: "D4",
          objectOfStudy: "4.4 Populações Tradicionais e Assentamentos",
          itemOfStudy: "4.4.1 Existência de populações tradicionais",
          name: "Percentagem de comunidades reconhecidas pelos órgãos afins (FUNAI, IPHAN, IBGE)",
          sources: [SOURCE_IDS.FUNAI_IPHAN, SOURCE_IDS.UNICAMP_TERR],
          weight: 3,
        },
      ],
    },
  ],
};

// ─── D5 — Governança e Articulação ────────────────────────────────────────────

const D5: Dimension = {
  id: "D5",
  number: 5,
  name: "Governança e Articulação",
  weight: 0.12,
  objectsOfStudy: [
    {
      code: "5.1",
      name: "Capacidade Institucional",
      indicators: [
        {
          code: "5.1.1",
          id: "d5-instituicoes-atuantes",
          dimension: "D5",
          objectOfStudy: "5.1 Capacidade Institucional",
          itemOfStudy: "5.1 Quantitativo, atuação e influência das instituições",
          name: "Quantidade de instituições existentes e atuantes na localidade",
          sources: [SOURCE_IDS.CONSELHOS, SOURCE_IDS.QUERIDO_DIARIO],
          weight: 2,
        },
        {
          code: "5.1.2",
          id: "d5-instituicoes-em-conselhos",
          dimension: "D5",
          objectOfStudy: "5.1 Capacidade Institucional",
          itemOfStudy: "5.1 Quantitativo, atuação e influência das instituições",
          name: "Quantidade de instituições cadastradas nos Conselhos",
          sources: [SOURCE_IDS.CONSELHOS],
          weight: 2,
        },
        {
          code: "5.1.3",
          id: "d5-autogestion-capacidade",
          dimension: "D5",
          objectOfStudy: "5.1 Capacidade Institucional",
          itemOfStudy: "5.1 Quantitativo, atuação e influência das instituições",
          name: "Porcentagem de instituições com capacidade de autogestão",
          sources: [SOURCE_IDS.CONSELHOS],
          weight: 2,
        },
      ],
    },
    {
      code: "5.2",
      name: "Participação Social",
      indicators: [
        {
          code: "5.2.1.1",
          id: "d5-instituicoes-comunitarias",
          dimension: "D5",
          objectOfStudy: "5.2 Participação Social",
          itemOfStudy: "5.2.1 Perfil Comunitário",
          name: "Quantidade de instituições comunitárias existentes e atuantes",
          sources: [SOURCE_IDS.CONSELHOS, SOURCE_IDS.QUERIDO_DIARIO],
          weight: 3,
        },
        {
          code: "5.2.2.1",
          id: "d5-representatividade-controle-social",
          dimension: "D5",
          objectOfStudy: "5.2 Participação Social",
          itemOfStudy: "5.2.2 Representatividade e participação em espaços de controle social",
          name: "Quantidade de instituições / representantes da sociedade civil em espaços de controle social",
          sources: [SOURCE_IDS.AUDIENCIAS, SOURCE_IDS.CONSELHOS],
          weight: 3,
        },
        {
          code: "5.2.3.1",
          id: "d5-empreendimentos-em-instalacao",
          dimension: "D5",
          objectOfStudy: "5.2 Participação Social",
          itemOfStudy: "5.2.3 Sobrecarga Comunitária",
          name: "Quantidade de empreendimentos em instalação ou operação no território",
          sources: [SOURCE_IDS.IBAMA, SOURCE_IDS.GOOGLE_NEWS],
          weight: 3,
        },
        {
          code: "5.2.3.2",
          id: "d5-programas-educacao-ambiental",
          dimension: "D5",
          objectOfStudy: "5.2 Participação Social",
          itemOfStudy: "5.2.3 Sobrecarga Comunitária",
          name: "Quantidade de Programas de Educação Ambiental e Comunicação Social em atuação",
          sources: [SOURCE_IDS.IBAMA, SOURCE_IDS.CONSELHOS],
          weight: 3,
          notes: "Cruzar com número de habitantes e observação direta para avaliar saturação.",
        },
      ],
    },
    {
      code: "5.3",
      name: "Articulação com o Poder Público",
      indicators: [
        {
          code: "5.3.1",
          id: "d5-parcerias-poder-publico",
          dimension: "D5",
          objectOfStudy: "5.3 Articulação com o Poder Público",
          itemOfStudy: "5.3.1 Parcerias estabelecidas com o poder público local",
          name: "TACs estabelecidos e parcerias com o poder público local",
          sources: [SOURCE_IDS.QUERIDO_DIARIO, SOURCE_IDS.MP_AMBIENTAL, SOURCE_IDS.ORCAMENTO_PARTICIPATIVO],
          weight: 3,
        },
        {
          code: "5.3.2",
          id: "d5-influencias-negativas-poder-publico",
          dimension: "D5",
          objectOfStudy: "5.3 Articulação com o Poder Público",
          itemOfStudy: "5.3.2 Influências negativas do poder público no território",
          name: "Influências negativas documentadas do poder público no território",
          sources: [SOURCE_IDS.QUERIDO_DIARIO, SOURCE_IDS.JUDICIARIO, SOURCE_IDS.GOOGLE_NEWS],
          weight: 3,
        },
      ],
    },
  ],
};

// ─── D6 — Reputação e Visibilidade ────────────────────────────────────────────

const D6: Dimension = {
  id: "D6",
  number: 6,
  name: "Reputação e Visibilidade",
  weight: 0.10,
  objectsOfStudy: [
    {
      code: "6.1",
      name: "Mídia",
      indicators: [
        {
          code: "6.1.1.1",
          id: "d6-caracteristicas-marcantes",
          dimension: "D6",
          objectOfStudy: "6.1 Mídia",
          itemOfStudy: "6.1.1 Característica marcante do território",
          name: "Território turístico, polo industrial, área ambientalmente sensível, patrimônios",
          sources: [SOURCE_IDS.GOOGLE_NEWS, SOURCE_IDS.UNIVERSIDADES],
          weight: 2,
        },
        {
          code: "6.1.2.1",
          id: "d6-volume-buscas",
          dimension: "D6",
          objectOfStudy: "6.1 Mídia",
          itemOfStudy: "6.1.2 Interesse de busca",
          name: "Volume de buscas associadas ao território (Google Trends)",
          sources: [SOURCE_IDS.GOOGLE_TRENDS],
          weight: 2,
        },
        {
          code: "6.1.3.1",
          id: "d6-materias-alcance",
          dimension: "D6",
          objectOfStudy: "6.1 Mídia",
          itemOfStudy: "6.1.3 Escala de repercussão",
          name: "Quantitativo de matérias com alcance regional/nacional sobre o território",
          sources: [SOURCE_IDS.GOOGLE_NEWS],
          weight: 2,
        },
        {
          code: "6.1.3.2",
          id: "d6-engajamento-redes-sociais",
          dimension: "D6",
          objectOfStudy: "6.1 Mídia",
          itemOfStudy: "6.1.3 Escala de repercussão",
          name: "Engajamento em redes sociais (Instagram, X/Twitter, TikTok)",
          sources: [SOURCE_IDS.REDES_SOCIAIS],
          weight: 2,
        },
      ],
    },
    {
      code: "6.2",
      name: "Interesse Científico",
      indicators: [
        {
          code: "6.2.1",
          id: "d6-grupos-pesquisa",
          dimension: "D6",
          objectOfStudy: "6.2 Interesse Científico",
          itemOfStudy: "6.2.1 Grupos de estudos afins",
          name: "Núcleos / centros de pesquisa sobre o território (CAPES, SciELO, Lattes)",
          sources: [SOURCE_IDS.UNIVERSIDADES],
          weight: 2,
        },
        {
          code: "6.2.2",
          id: "d6-conselhos-comites",
          dimension: "D6",
          objectOfStudy: "6.2 Interesse Científico",
          itemOfStudy: "6.2.2 Conselhos / Comissões / Comitês existentes",
          name: "Participação de pesquisadores em conselhos, comissões e comitês",
          sources: [SOURCE_IDS.UNIVERSIDADES, SOURCE_IDS.CONSELHOS],
          weight: 2,
        },
      ],
    },
  ],
};

// ─── D7 — Recursos Naturais e Potencial ───────────────────────────────────────

const D7: Dimension = {
  id: "D7",
  number: 7,
  name: "Recursos Naturais e Potencial",
  weight: 0.10,
  objectsOfStudy: [
    {
      code: "7.1",
      name: "Recursos Naturais e Minerais",
      indicators: [
        {
          code: "7.1.1.1",
          id: "d7-recursos-minerais-estrategicos",
          dimension: "D7",
          objectOfStudy: "7.1 Recursos Naturais e Minerais",
          itemOfStudy: "7.1.1 Minerais Estratégicos",
          name: "Ocorrência e potencial de minerais críticos (ex: terras raras, lítio, nióbio)",
          sources: [SOURCE_IDS.GOOGLE_NEWS, SOURCE_IDS.UNIVERSIDADES],
          weight: 3,
        },
        {
          code: "7.1.2.1",
          id: "d7-disponibilidade-hidrica",
          dimension: "D7",
          objectOfStudy: "7.1 Recursos Naturais e Minerais",
          itemOfStudy: "7.1.2 Recursos Hídricos",
          name: "Balanço hídrico e saturação para grandes demandas",
          sources: [SOURCE_IDS.SNIS_SINASA, SOURCE_IDS.CEMADEN],
          weight: 3,
        },
      ],
    },
    {
      code: "7.2",
      name: "Potencial Energético e Tecnológico",
      indicators: [
        {
          code: "7.2.1.1",
          id: "d7-potencial-renovaveis",
          dimension: "D7",
          objectOfStudy: "7.2 Potencial Energético e Tecnológico",
          itemOfStudy: "7.2.1 Energias Renováveis",
          name: "Aptidão para plantas eólicas, solares ou hidrogênio verde",
          sources: [SOURCE_IDS.INMET, SOURCE_IDS.CPTEC_INPE, SOURCE_IDS.GOOGLE_NEWS],
          weight: 3,
        },
        {
          code: "7.2.2.1",
          id: "d7-infraestrutura-tecnologica",
          dimension: "D7",
          objectOfStudy: "7.2 Potencial Energético e Tecnológico",
          itemOfStudy: "7.2.2 Data Centers e Conectividade",
          name: "Atratividade para instalação de Data Centers (clima, energia, fibra ótica)",
          sources: [SOURCE_IDS.MAPA_EMPRESAS, SOURCE_IDS.GOOGLE_NEWS],
          weight: 3,
        },
      ],
    },
  ],
};

// ─── Registry completo das 7 dimensões ────────────────────────────────────────

export const DIMENSIONS: Record<DimensionId, Dimension> = {
  D1, D2, D3, D4, D5, D6, D7
};

export const DIMENSIONS_LIST: Dimension[] = [D1, D2, D3, D4, D5, D6, D7];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna todos os indicadores de todas as dimensões em lista plana. */
export function getAllIndicators(): Indicator[] {
  return DIMENSIONS_LIST.flatMap((d) =>
    d.objectsOfStudy.flatMap((o) => o.indicators)
  );
}

/** Busca um indicador pelo seu ID. */
export function getIndicatorById(id: string): Indicator | undefined {
  return getAllIndicators().find((i) => i.id === id);
}

/** Retorna todos os indicadores de uma dimensão específica. */
export function getIndicatorsByDimension(dimensionId: DimensionId): Indicator[] {
  return DIMENSIONS[dimensionId].objectsOfStudy.flatMap((o) => o.indicators);
}

/**
 * Calcula o score de uma dimensão a partir de um mapa de scores por indicador.
 * Usa média ponderada pelos pesos dos indicadores.
 * @param dimensionId - ID da dimensão (D1-D6)
 * @param indicatorScores - mapa { indicatorId: score (0-100) }
 * @returns score da dimensão (0-100)
 */
export function calculateDimensionScore(
  dimensionId: DimensionId,
  indicatorScores: Record<string, number>
): number {
  const indicators = getIndicatorsByDimension(dimensionId);
  let weightedSum = 0;
  let totalWeight = 0;
  for (const indicator of indicators) {
    const score = indicatorScores[indicator.id];
    if (score !== undefined && score !== null) {
      weightedSum += score * indicator.weight;
      totalWeight += indicator.weight;
    }
  }
  if (totalWeight === 0) return 0;
  return Math.min(100, Math.max(0, weightedSum / totalWeight));
}

/**
 * Calcula o STT final a partir dos scores das 6 dimensões.
 * STT = Σ (Di × Wi)
 * @param dimensionScores - mapa { D1: score, D2: score, ... }
 * @returns STT (0-100)
 */
export function calculateSTT(
  dimensionScores: Partial<Record<DimensionId, number>>
): number {
  let stt = 0;
  for (const [dimId, dim] of Object.entries(DIMENSIONS) as [DimensionId, Dimension][]) {
    const score = dimensionScores[dimId] ?? 0;
    
    // Dicotomia: D3 (Infraestrutura) e D5 (Governança) são capacidades.
    // Falta de capacidade (score baixo) = Alta Tensão/Complexidade.
    if (dimId === "D3" || dimId === "D5") {
      stt += (100 - score) * dim.weight;
    } else {
      stt += score * dim.weight;
    }
  }
  return Math.min(100, Math.max(0, stt));
}

/**
 * Valida que os pesos das dimensões somam 1.0 (tolerância ±0.001).
 * Chamado em testes e no startup como sanity check.
 */
export function validateDimensionWeights(): boolean {
  const total = DIMENSIONS_LIST.reduce((s, d) => s + d.weight, 0);
  return Math.abs(total - 1.0) < 0.001;
}

// ─── Estatísticas ──────────────────────────────────────────────────────────────

export const INDICATORS_STATS = {
  totalDimensions: DIMENSIONS_LIST.length,
  totalObjectsOfStudy: DIMENSIONS_LIST.reduce((s, d) => s + d.objectsOfStudy.length, 0),
  totalIndicators: getAllIndicators().length,
  totalSources: Object.keys(SOURCE_IDS).length,
  byDimension: Object.fromEntries(
    DIMENSIONS_LIST.map((d) => [d.id, getIndicatorsByDimension(d.id).length])
  ),
};
