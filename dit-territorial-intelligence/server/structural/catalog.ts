/**
 * Catálogo da camada estrutural — indicadores oficiais por município.
 *
 * A malha do DIT tinha um problema de natureza: uma notícia sobre saneamento e
 * o índice de atendimento do SNIS entravam pelo mesmo cano, como "sinais"
 * equivalentes. Daí a fragilidade — o STT acabava medindo quanta notícia o
 * Google devolveu, não como o território é.
 *
 * A camada estrutural separa as duas naturezas:
 *
 *   ESTRUTURAL (aqui)   indicador oficial, muda por ano, vale para os 5.570
 *                       municípios, baixado UMA vez por mês em lote e guardado
 *                       em disco. Custo marginal por território consultado: 0.
 *
 *   SINAL (agentes)     notícia, diário oficial, alerta, ocorrência. Muda todo
 *                       dia, é o que alimenta ticker e alerta, e é o único
 *                       lugar onde busca paga se justifica.
 *
 * O truque que torna isso viável é `localidades=N6[all]`: a API v3 do IBGE
 * devolve TODOS os municípios do país em uma requisição — 5.570 séries,
 * ~690 KB, ~1s. Um indicador nacional custa uma chamada, não 5.570.
 *
 * Para acrescentar indicador: uma entrada aqui e rodar `pnpm structural:load`.
 * Nada mais precisa mudar.
 */

export type StructuralPolarity = "neutral" | "vulnerability" | "capacity";

export interface StructuralIndicator {
  /** Chave curta usada no store e no sinal emitido */
  key: string;
  /** Nome exibido */
  label: string;
  /** Dimensão PRINT que este indicador alimenta */
  dimension: "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
  /** Código do indicador na planilha PRINT, quando houver */
  indicatorCode?: string;
  /** Agregado SIDRA/IBGE */
  agregado: number;
  /** Variável dentro do agregado */
  variavel: number;
  /** Período (ano). "-1" pede o último disponível à API. */
  periodo: string;
  /**
   * Filtro de classificação do SIDRA, quando o agregado é cruzado por sexo,
   * idade ou situação. Usar sempre as categorias "Total" — o DIT quer o
   * agregado do município, não o recorte.
   * Ex: "287[100362]|2[6794]|2661[32776]" (idade/sexo/localização = Total)
   */
  classificacao?: string;
  /** Unidade, como o IBGE declara */
  unit: string;
  /**
   * O que um valor ALTO significa para leitura territorial:
   *   vulnerability — quanto maior, mais frágil o território
   *   capacity      — quanto maior, mais estrutura instalada
   *   neutral       — descreve, não qualifica (população, área)
   */
  polarity: StructuralPolarity;
  /** Fonte legível, aparece na procedência do sinal */
  source: string;
}

/**
 * Conjunto inicial — todos verificados contra a API em 08/09/2026, todos com
 * nível N6 (município) e todos respondendo a `N6[all]`.
 *
 * Deliberadamente pequeno e inequívoco. Indicador estrutural que exige
 * classificação por categoria (esgotamento sanitário do Censo 2022, faixas de
 * rendimento) entra depois, com a classificação declarada — dado ambíguo em
 * relatório de cliente vale menos que dado ausente.
 */
export const STRUCTURAL_CATALOG: StructuralIndicator[] = [
  {
    key: "populacao_residente",
    label: "População residente",
    dimension: "D2",
    indicatorCode: "2.1.1.1",
    agregado: 4709,
    variavel: 93,
    periodo: "2022",
    unit: "pessoas",
    polarity: "neutral",
    source: "IBGE · Censo Demográfico 2022",
  },
  {
    key: "populacao_estimada",
    label: "População estimada",
    dimension: "D2",
    agregado: 6579,
    variavel: 9324,
    periodo: "-1",
    unit: "pessoas",
    polarity: "neutral",
    source: "IBGE · Estimativas de População",
  },
  {
    key: "area_km2",
    label: "Área da unidade territorial",
    dimension: "D3",
    agregado: 4714,
    variavel: 6318,
    periodo: "2022",
    unit: "km²",
    polarity: "neutral",
    source: "IBGE · Censo Demográfico 2022",
  },
  {
    key: "densidade_demografica",
    label: "Densidade demográfica",
    dimension: "D3",
    indicatorCode: "3.1.1.1",
    agregado: 4714,
    variavel: 614,
    periodo: "2022",
    unit: "hab/km²",
    polarity: "neutral",
    source: "IBGE · Censo Demográfico 2022",
  },
  {
    key: "salario_medio_mensal",
    label: "Salário médio mensal do trabalho formal",
    dimension: "D2",
    indicatorCode: "2.1.2.1",
    agregado: 1685,
    variavel: 10143,
    periodo: "-1",
    unit: "R$",
    polarity: "capacity",
    source: "IBGE · CEMPRE (Cadastro Central de Empresas)",
  },
  {
    key: "pessoal_assalariado",
    label: "Pessoal ocupado assalariado",
    dimension: "D2",
    indicatorCode: "2.1.3.1",
    agregado: 1685,
    variavel: 708,
    periodo: "-1",
    unit: "pessoas",
    polarity: "capacity",
    source: "IBGE · CEMPRE (Cadastro Central de Empresas)",
  },
  {
    key: "populacao_indigena",
    label: "População indígena residente",
    dimension: "D4",
    indicatorCode: "4.3.1.1",
    agregado: 8175,
    variavel: 350,
    periodo: "2022",
    classificacao: "287[100362]|2[6794]|2661[32776]",
    unit: "pessoas",
    polarity: "vulnerability",
    source: "IBGE · Censo Demográfico 2022",
  },
  {
    key: "pib_corrente",
    label: "Produto Interno Bruto a preços correntes",
    dimension: "D2",
    indicatorCode: "2.2.1.1",
    agregado: 5938,
    variavel: 37,
    periodo: "-1",
    unit: "mil reais",
    polarity: "capacity",
    source: "IBGE · PIB dos Municípios",
  },
];

/** Indicadores derivados, calculados a partir dos coletados acima. */
export interface DerivedIndicator {
  key: string;
  label: string;
  dimension: "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
  unit: string;
  polarity: StructuralPolarity;
  source: string;
  compute: (m: Record<string, number>) => number | null;
}

export const DERIVED_CATALOG: DerivedIndicator[] = [
  {
    key: "taxa_assalariamento",
    label: "Vínculos formais por 100 habitantes",
    dimension: "D2",
    unit: "por 100 hab",
    polarity: "capacity",
    source: "IBGE · CEMPRE ÷ Censo 2022",
    compute: (m) => {
      const vinculos = m.pessoal_assalariado;
      const pop = m.populacao_residente ?? m.populacao_estimada;
      if (!vinculos || !pop) return null;
      return Math.round((vinculos / pop) * 100 * 10) / 10;
    },
  },
  {
    key: "presenca_indigena_por_mil",
    label: "População indígena por mil habitantes",
    dimension: "D4",
    unit: "por mil hab",
    polarity: "vulnerability",
    source: "IBGE · Censo 2022 (indígena ÷ população residente)",
    compute: (m) => {
      const ind = m.populacao_indigena;
      const pop = m.populacao_residente ?? m.populacao_estimada;
      if (ind === undefined || !pop) return null;
      return Math.round((ind / pop) * 1000 * 10) / 10;
    },
  },
  {
    key: "pib_per_capita",
    label: "PIB per capita",
    dimension: "D2",
    unit: "R$/hab",
    polarity: "capacity",
    source: "IBGE · PIB dos Municípios ÷ Censo 2022",
    compute: (m) => {
      const pib = m.pib_corrente;
      const pop = m.populacao_residente ?? m.populacao_estimada;
      if (!pib || !pop) return null;
      // PIB vem em mil reais
      return Math.round((pib * 1000) / pop);
    },
  },
];

export function catalogByDimension(dimension: string): StructuralIndicator[] {
  return STRUCTURAL_CATALOG.filter((i) => i.dimension === dimension);
}

export function derivedByDimension(dimension: string): DerivedIndicator[] {
  return DERIVED_CATALOG.filter((i) => i.dimension === dimension);
}
