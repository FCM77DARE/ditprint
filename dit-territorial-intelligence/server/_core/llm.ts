import { ENV } from "./env";
import { ROLES, modeloDoPapel, custoUsd, type LlmRole, type ModelSpec } from "./models";
import { registrarCusto } from "./cost-ledger";
import { logger } from "./logger";

const llmLog = logger.child({ module: "llm" });

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  /**
   * Para que serve esta chamada. Decide o modelo (ver models.ts) e aparece na
   * contabilidade de custo. Sem papel declarado, cai em "extracao" — o mais
   * barato —, e isso é de propósito: quem precisa de modelo bom declara.
   */
  role?: LlmRole;
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://api.openai.com/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Erros que justificam tentar o próximo modelo da lista. */
function vaiParaFallback(status: number): boolean {
  return status === 429 || status === 408 || status >= 500 || status === 404;
}

/**
 * Chamada única ao LLM, sempre pelo OpenRouter.
 *
 * Antes, este ponto falava direto com a OpenAI em gpt-4o-mini, e o
 * relatório da landing tinha três clientes próprios (OpenRouter, Anthropic,
 * OpenAI). Agora é um caminho só: o papel escolhe o modelo, a lista de
 * fallback atravessa fornecedores (Anthropic cai, OpenAI assume) e todo uso
 * real volta para o livro de custo com o território a que pertence.
 *
 * A assinatura é a mesma de antes — os seis pontos que já chamavam
 * `invokeLLM` continuam funcionando, só ganham `role`.
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (apiKey.length < 20) {
    throw new Error("OPENROUTER_API_KEY não configurada — o DIT não chama LLM fora do OpenRouter");
  }

  const role: LlmRole = params.role ?? "extracao";
  const cfg = ROLES[role];
  const primario = modeloDoPapel(role);
  const candidatos: ModelSpec[] = [primario, ...cfg.fallbacks.filter((m) => m.id !== primario.id)];

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const base: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
    max_tokens: params.maxTokens ?? params.max_tokens ?? cfg.maxTokens,
    temperature: cfg.temperature,
    // Pede ao OpenRouter o custo real da chamada junto com o uso.
    usage: { include: true },
  };
  if (cfg.reasoning) base.reasoning = cfg.reasoning;
  if (tools && tools.length > 0) base.tools = tools;
  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) base.tool_choice = normalizedToolChoice;
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });
  if (normalizedResponseFormat) base.response_format = normalizedResponseFormat;

  let ultimoErro = "";
  for (const modelo of candidatos) {
    const inicio = Date.now();
    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://dit-api-production.up.railway.app",
          "X-Title": "DIT PRINT",
        },
        body: JSON.stringify({ ...base, model: modelo.id }),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (err) {
      ultimoErro = `${modelo.id}: ${(err as Error).message}`;
      llmLog.warn({ papel: role, modelo: modelo.id, err: ultimoErro }, "Falha de rede no LLM — tentando o próximo");
      continue;
    }

    if (!response.ok) {
      const texto = await response.text().catch(() => "");
      ultimoErro = `${modelo.id}: HTTP ${response.status} ${texto.slice(0, 200)}`;
      if (vaiParaFallback(response.status)) {
        llmLog.warn({ papel: role, modelo: modelo.id, status: response.status }, "Modelo indisponível — tentando o próximo");
        continue;
      }
      throw new Error(`LLM recusou a chamada: ${ultimoErro}`);
    }

    const result = (await response.json()) as InvokeResult & {
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    };

    const inTok = result.usage?.prompt_tokens ?? 0;
    const outTok = result.usage?.completion_tokens ?? 0;
    // Custo devolvido pelo OpenRouter é o que vale; o calculado pelo catálogo
    // é a rede de segurança quando o provedor não informa.
    const usd =
      typeof result.usage?.cost === "number" && result.usage.cost > 0
        ? result.usage.cost
        : custoUsd(modelo, inTok, outTok);

    await registrarCusto({
      recurso: "llm",
      papel: role,
      modelo: modelo.id,
      inTokens: inTok,
      outTokens: outTok,
      usd,
    });

    llmLog.info(
      { papel: role, modelo: modelo.id, inTok, outTok, usd: Math.round(usd * 10000) / 10000, ms: Date.now() - inicio },
      "LLM respondeu"
    );

    // Resposta cortada pelo teto de tokens não é resposta: é JSON pela metade
    // ou texto que termina no meio da frase. Antes ninguém olhava isso — o
    // chamador recebia o pedaço, o JSON.parse quebrava longe daqui e a causa
    // se perdia. Aqui fica registrado com o começo e o fim do que veio.
    const escolha = result.choices?.[0] as { finish_reason?: string } | undefined;
    if (escolha?.finish_reason === "length") {
      const t = textoDaResposta(result);
      llmLog.warn(
        {
          papel: role,
          modelo: modelo.id,
          outTok,
          chars: t.length,
          inicio: t.slice(0, 400),
          fim: t.slice(-300),
          temToolCalls: !!result.choices?.[0]?.message?.tool_calls?.length,
        },
        "Resposta do LLM cortada pelo teto de tokens"
      );
    }
    return result;
  }

  throw new Error(`Todos os modelos do papel "${role}" falharam. Último erro: ${ultimoErro}`);
}

/**
 * Texto da resposta, venha como string ou como lista de blocos.
 */
export function textoDaResposta(r: InvokeResult): string {
  const c = r.choices?.[0]?.message?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((b) => (b.type === "text" ? b.text : "")).join("");
  return "";
}

// ─── JSON com verificação ────────────────────────────────────────────────────

/**
 * Conserta o que é defeito de forma, nunca de conteúdo: cerca de markdown,
 * texto antes/depois do objeto, vírgula sobrando antes de } ou ].
 *
 * Nasceu da primeira medição com o Sonnet 5: o relatório de Macaé veio com
 * uma vírgula sobrando na linha 125 de ~10 mil caracteres, e o JSON.parse
 * derrubava a leitura inteira por causa dela.
 */
export function repararJson(texto: string): string {
  let t = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const ini = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (ini > 0 || (fim >= 0 && fim < t.length - 1)) t = t.slice(Math.max(0, ini), fim + 1);
  return t.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Chama o LLM e devolve JSON válido — ou falha dizendo por quê.
 *
 * Duas camadas de verificação, da mais barata para a mais cara:
 *   1. conserto determinístico (repararJson) — custo zero;
 *   2. se ainda não parsear, o papel "verificador" (modelo barato) recebe o
 *      texto e devolve só a estrutura corrigida, com instrução explícita de
 *      não mudar nenhum valor. Custa centavos de centavo e evita refazer o
 *      relatório inteiro, que custa cem vezes mais.
 */
export async function invokeJson<T = unknown>(params: InvokeParams): Promise<T> {
  const r = await invokeLLM(params);
  const bruto = textoDaResposta(r);
  if (!bruto.trim()) throw new Error(`LLM devolveu resposta vazia (papel ${params.role ?? "extracao"})`);

  const tentativa1 = repararJson(bruto);
  try {
    return JSON.parse(tentativa1) as T;
  } catch (err1) {
    llmLog.warn(
      { papel: params.role, err: (err1 as Error).message, chars: bruto.length },
      "JSON inválido mesmo após conserto determinístico — acionando verificador"
    );
  }

  const conserto = await invokeLLM({
    role: "verificador",
    messages: [
      {
        role: "system",
        content:
          "Você corrige a SINTAXE de um JSON inválido. Devolva apenas o JSON corrigido. " +
          "É proibido alterar, resumir, traduzir, acrescentar ou remover qualquer valor, " +
          "chave ou item. Mexa só no necessário para o JSON ficar válido.",
      },
      { role: "user", content: bruto },
    ],
    maxTokens: Math.min(32000, Math.ceil(bruto.length / 2.5) + 500),
  });
  const tentativa2 = repararJson(textoDaResposta(conserto));
  try {
    return JSON.parse(tentativa2) as T;
  } catch (err2) {
    throw new Error(`JSON irrecuperável após verificador: ${(err2 as Error).message}`);
  }
}
