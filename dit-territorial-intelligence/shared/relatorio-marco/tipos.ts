/**
 * Contrato do Diagnóstico completo (relatório Marco). Uma única forma de dado
 * alimenta duas saídas com a MESMA marcação: a rota React
 * /diagnostico/relatorio/:slug e o gerador estático de HTML.
 */

export type FonteDaDimensao = "estrutural" | "sinal" | "ambos" | "nenhuma";

export interface SinalRel {
  titulo: string;
  /** Nome legível da fonte. */
  fonte: string;
  fonteId: string;
  /** AAAA-MM-DD, quando o sinal tem data de fato. */
  data: string | null;
  /** Período de referência de indicador estrutural (ex.: "2022"). */
  periodo: string | null;
  url: string | null;
  /** Procedência textual quando não há link (dataset, endpoint, período). */
  procedencia: string | null;
  impacto: number;
  estrutural: boolean;
  tipo: "oficial" | "imprensa";
}

export interface FonteNaoMedida {
  id: string;
  nome: string;
  /** "busca" quando a fonte depende de busca aberta paga. */
  tipo: "oficial" | "imprensa" | "busca";
}

export interface DimensaoRel {
  id: string;
  nome: string;
  /** 0 a 1. */
  peso: number;
  /** 0 a 100, ou null quando não medida. Nunca preenchido com 100. */
  score: number | null;
  medida: boolean;
  fonte: FonteDaDimensao;
  /** Uma frase com o dado que sustenta o julgamento (do relatório). */
  resumo: string;
  /** Parágrafo de leitura (do relatório). */
  leitura: string;
  sustentam: SinalRel[];
  totalSinais: number;
  naoMedido: FonteNaoMedida[];
  fontesConsultadas: number;
}

export interface FonteRel {
  id: string;
  nome: string;
  dimensao: string | null;
  sinais: number;
  rejeitados: number;
  status: "respondeu" | "vazia";
  tipo: "oficial" | "imprensa" | "busca";
}

export interface SinalChaveRel {
  fonte: string;
  dimensao: string;
  texto: string;
  impacto: number;
}

export interface RecomendacaoRel {
  momento: "entrar" | "operar" | "responder";
  titulo: string;
  texto: string;
  urgencia: string;
}

export interface RecursoRel {
  categoria: string;
  nome: string;
  abundancia: string;
  nota: string;
  fontes: string[];
}

export interface SetorRel {
  nome: string;
  maturidade: string;
  insight: string;
  sinais: string[];
}

export interface PontoRel {
  tipo: string;
  categoria: string;
  nome: string;
  descricao: string;
  fonte: string;
  lat: number | null;
  lng: number | null;
  /** Quantas ocorrências iguais foram agrupadas nesta linha. */
  quantidade: number;
}

export interface CasoRel {
  titulo: string;
  relevancia: string;
  tese: string;
  evidencias: string[];
  potencial: string | null;
  riscos: string[];
  fontes: string[];
}

export interface IndicadorRel {
  rotulo: string;
  valor: string;
  fonte: string;
  ano: string | null;
}

export interface DadosRelatorio {
  versao: 1;
  /** ISO da geração do relatório. */
  geradoEm: string;
  territorio: {
    nome: string;
    uf: string;
    slug: string;
    ibge: string | null;
    regiao: string | null;
    mesorregiao: string | null;
    microrregiao: string | null;
    lat: number | null;
    lng: number | null;
  };
  leitura: {
    tensao: number | null;
    /** 0 a 100. */
    confianca: number;
    faixa: { min: number; max: number };
  };
  coleta: {
    coletadoEm: string | null;
    fontesConsultadas: number | null;
    fontesComSinal: number | null;
    fontesVazias: number | null;
    fontesComErro: number | null;
    /** 0 a 1. */
    cobertura: number | null;
    sinaisNaJanela: number | null;
    janelaMeses: number | null;
    buscasBarradas: number | null;
  };
  sintese: string[];
  mudou: {
    anterior: { data: string; valor: number } | null;
    semana: Array<{ fato: string; fonte: string; data: string; url: string | null }>;
  };
  decide: Array<{ titulo: string; texto: string; urgencia: string }>;
  identidade: {
    localizacao: string;
    conhecidoPor: string;
    problema: string;
    forcas: string[];
    fragilidades: string[];
    indicadores: IndicadorRel[];
  };
  dimensoes: DimensaoRel[];
  sinaisChave: SinalChaveRel[];
  previsao: { horizonte: string; texto: string; riscos: string[]; oportunidades: string };
  recomendacoes: RecomendacaoRel[];
  estrategica: {
    recursos: RecursoRel[];
    setores: SetorRel[];
    pontos: PontoRel[];
    casos: CasoRel[];
  };
  fontes: FonteRel[];
  semLastro: string[];
}
