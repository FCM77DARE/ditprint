/**
 * Catálogo de modelos por PAPEL — um lugar só para decidir quem pensa o quê.
 *
 * O QUE ESTAVA ERRADO
 *
 * A camada de LLM estava espalhada em quatro modelos fixos e três clientes
 * HTTP diferentes:
 *
 *   _core/llm.ts        gpt-4o-mini, direto na OpenAI — usado por 6 pontos,
 *                       entre eles a VERIFICAÇÃO DO STT, que é a chamada mais
 *                       consequente do sistema. O modelo mais fraco no
 *                       trabalho mais importante.
 *   ditLanding.ts       openai/gpt-4o pelo OpenRouter (relatório),
 *                       claude-3-5-haiku-20241022 direto na Anthropic,
 *                       gpt-4o-mini direto na OpenAI.
 *
 * Todos de 2024, escolhidos em momentos diferentes, sem ninguém comparando
 * preço nem qualidade, e sem nenhum registro de quanto cada um custou.
 *
 * O QUE ISTO FAZ
 *
 * Declara PAPÉIS, não modelos. Quem chama diz o que precisa ("escrever o
 * relatório", "verificar um sinal") e o catálogo decide com quê. Trocar de
 * modelo vira uma linha aqui, não uma caçada por string em seis arquivos.
 *
 * Preços conferidos no catálogo ao vivo do OpenRouter em 24/09/2026
 * (`https://openrouter.ai/api/v1/models`). Estão aqui para a contabilidade de
 * custo — o DIT precisa saber quanto custa ler um território, e estimativa não
 * responde isso.
 */

export type LlmRole =
  /** Executive Note — é o produto que o cliente lê. Qualidade acima de tudo. */
  | "relatorio"
  /** Verificação do STT determinístico. Julgamento sobre número. */
  | "stt"
  /** Verificação de sinal — volume alto, tarefa estreita, roda em lote. */
  | "verificador"
  /** Extração estruturada (entidades, campos). Mecânico. */
  | "extracao";

export interface ModelSpec {
  /** id no OpenRouter */
  id: string;
  /** US$ por milhão de tokens de entrada */
  inUsdPerM: number;
  /** US$ por milhão de tokens de saída */
  outUsdPerM: number;
  contextK: number;
  /** Por que este modelo neste papel */
  porque: string;
}

export interface RoleConfig {
  primary: ModelSpec;
  /** Tentados em ordem quando o primário falha (429, 5xx, indisponível) */
  fallbacks: ModelSpec[];
  maxTokens: number;
  temperature: number;
  /**
   * Raciocínio escondido. Medido em 24/09: o gpt-5-mini gastou 901 tokens de
   * raciocínio para devolver uma frase de 140 caracteres — pagos como saída.
   * Em tarefa estreita (verificar, extrair), isso é custo sem ganho.
   */
  reasoning?: { effort: "minimal" | "low" | "medium" | "high" };
}

// ─── Modelos ─────────────────────────────────────────────────────────────────

const SONNET_5: ModelSpec = {
  id: "anthropic/claude-sonnet-5",
  inUsdPerM: 2.0,
  outUsdPerM: 10.0,
  contextK: 1000,
  porque:
    "Mais barato que o gpt-4o que estava no código (US$ 2,50 de entrada) e " +
    "muito melhor em texto analítico longo em português. Contexto de 1M cabe " +
    "o histórico inteiro de um território sem cortar.",
};

const OPUS_4_5: ModelSpec = {
  id: "anthropic/claude-opus-4.5",
  inUsdPerM: 5.0,
  outUsdPerM: 25.0,
  contextK: 200,
  porque: "Reserva para quando o relatório precisar de leitura mais fina.",
};

const GPT_5: ModelSpec = {
  id: "openai/gpt-5",
  inUsdPerM: 1.25,
  outUsdPerM: 10.0,
  contextK: 400,
  porque: "Fallback de fornecedor diferente — se a Anthropic cair, o DIT não para.",
};

const GPT_5_MINI: ModelSpec = {
  id: "openai/gpt-5-mini",
  inUsdPerM: 0.25,
  outUsdPerM: 2.0,
  contextK: 400,
  porque:
    "Oito vezes mais barato que o Sonnet na entrada. Suficiente para tarefa " +
    "estreita e verificável (isto é evidência? fala deste município?), que é " +
    "exatamente o trabalho do verificador.",
};

const GEMINI_FLASH: ModelSpec = {
  id: "google/gemini-2.5-flash",
  inUsdPerM: 0.3,
  outUsdPerM: 2.5,
  contextK: 1048,
  porque: "Fallback do verificador, de outro fornecedor e preço equivalente.",
};

// ─── Papéis ──────────────────────────────────────────────────────────────────

export const ROLES: Record<LlmRole, RoleConfig> = {
  relatorio: {
    primary: SONNET_5,
    fallbacks: [GPT_5, OPUS_4_5],
    // Medido: o relatório de Macaé saiu com 5.600 e 8.192 tokens (este
    // cortado). Teto com folga — cortar no meio é pior que pagar a sobra.
    maxTokens: 12000,
    temperature: 0,
  },
  /**
   * O STT sai determinístico e o LLM confere. Estava em gpt-4o-mini — o
   * modelo mais fraco do sistema conferindo o número que vira o produto.
   */
  stt: {
    primary: SONNET_5,
    fallbacks: [GPT_5],
    // Medido: 3.680 e 4.096 (este cortado, e voltou vazio).
    maxTokens: 6000,
    temperature: 0,
  },
  verificador: {
    primary: GPT_5_MINI,
    fallbacks: [GEMINI_FLASH],
    maxTokens: 2048,
    temperature: 0,
    reasoning: { effort: "minimal" },
  },
  extracao: {
    primary: GPT_5_MINI,
    fallbacks: [GEMINI_FLASH],
    maxTokens: 4096,
    temperature: 0,
    reasoning: { effort: "minimal" },
  },
};

/** Permite sobrescrever por env sem deploy: DIT_MODEL_RELATORIO=... */
export function modeloDoPapel(role: LlmRole): ModelSpec {
  const override = process.env[`DIT_MODEL_${role.toUpperCase()}`];
  if (override && override.trim().length > 0) {
    const conhecido = TODOS_MODELOS.find((m) => m.id === override.trim());
    if (conhecido) return conhecido;
    // Modelo fora do catálogo: aceita, mas sem preço não há contabilidade.
    return {
      id: override.trim(),
      inUsdPerM: 0,
      outUsdPerM: 0,
      contextK: 0,
      porque: "definido por env, preço desconhecido",
    };
  }
  return ROLES[role].primary;
}

export const TODOS_MODELOS: ModelSpec[] = [
  SONNET_5,
  OPUS_4_5,
  GPT_5,
  GPT_5_MINI,
  GEMINI_FLASH,
];

/** Custo em US$ de uma chamada, a partir do uso real devolvido pelo provedor. */
export function custoUsd(spec: ModelSpec, inTokens: number, outTokens: number): number {
  return (inTokens / 1e6) * spec.inUsdPerM + (outTokens / 1e6) * spec.outUsdPerM;
}
