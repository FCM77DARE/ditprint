/**
 * Central de agentes: emissor de eventos para o painel 3D (andar-jarvis).
 *
 * Fire-and-forget. Sem CENTRAL_URL ou CENTRAL_TOKEN vira no-op. Nunca lança,
 * nunca é aguardado no caminho quente, no máximo um console.warn por processo.
 *
 * REGRA DURA: `tarefa` e `licao` são rótulos GENÉRICOS do tipo de trabalho
 * ("leitura territorial"). Nunca nome de marca, pessoa, município, empresa ou
 * texto de prompt. A PRINT tem cliente político.
 */

const PROJETO = "p_dit";

export type StatusCentral = "comecou" | "progresso" | "entregou" | "erro" | "aprendeu";

export type EventoCentral = {
  status: StatusCentral;
  agente?: string;
  fonte?: string;
  rotulo?: string;
  tarefa?: string;
  run_id?: string;
  para?: string;
  licao?: string;
  custo_usd?: number;
  modelo?: string;
};

let avisou = false;

export function emitirCentral(ev: EventoCentral): void {
  try {
    const url = process.env.CENTRAL_URL;
    const token = process.env.CENTRAL_TOKEN;
    if (!url || !token) return;
    const corpo = {
      ...ev,
      tarefa: ev.tarefa ? ev.tarefa.slice(0, 80) : undefined,
      id: globalThis.crypto?.randomUUID?.(),
      ts: new Date().toISOString(),
      projeto: PROJETO,
      runtime: "railway",
    };
    void fetch(`${url.replace(/\/+$/, "")}/v1/eventos`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(1500),
    }).catch(falhou);
  } catch (e) {
    falhou(e);
  }
}

function falhou(_e?: unknown): void {
  if (avisou) return;
  avisou = true;
  console.warn("[central] evento não enviado (seguindo sem painel)");
}

/** Nome do arquivo que chamou (primeiro frame fora deste módulo e do `pular`). */
export function arquivoChamador(pular: string[] = []): string | undefined {
  try {
    const linhas = (new Error().stack ?? "").split("\n").slice(1);
    for (const l of linhas) {
      const m = l.match(/([\w.-]+\.(?:ts|js|mjs|cjs))(?:\?[^:]*)?:\d+:\d+/);
      if (!m) continue;
      const nome = m[1];
      if (nome === "central.ts" || nome === "central.js" || pular.includes(nome)) continue;
      if (l.includes("node_modules") || l.includes("node:")) continue;
      return nome;
    }
  } catch {
    /* sem fonte */
  }
  return undefined;
}

/** Classe curta do erro, sem mensagem nem stack (que podem trazer dado de cliente). */
export function classeDoErro(e: unknown): string {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  if (/timeout|timed out|aborted/i.test(msg)) return "timeout no provedor";
  if (/\b429\b|rate/i.test(msg)) return "limite de taxa no provedor";
  if (/\b40[123]\b|unauthori|forbidden|credit/i.test(msg)) return "acesso ou saldo no provedor";
  if (/\b5\d\d\b/.test(msg)) return "falha do provedor";
  if (/json|parse/i.test(msg)) return "resposta fora do formato";
  if (/fetch failed|ECONN|ENOTFOUND|network/i.test(msg)) return "falha de rede";
  return "falha na execução";
}

/**
 * Envolve uma execução de agente: comecou → entregou | erro. Devolve o mesmo
 * resultado e relança o mesmo erro (o comportamento do chamador não muda).
 */
export async function comCentral<T>(
  info: { agente?: string; fonte?: string; tarefa: string; para?: string; run_id?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const base = { agente: info.agente, fonte: info.fonte, run_id: info.run_id, tarefa: info.tarefa };
  emitirCentral({ ...base, status: "comecou" });
  try {
    const r = await fn();
    emitirCentral({ ...base, status: "entregou", para: info.para });
    return r;
  } catch (e) {
    emitirCentral({ ...base, status: "erro", tarefa: classeDoErro(e) });
    throw e;
  }
}
