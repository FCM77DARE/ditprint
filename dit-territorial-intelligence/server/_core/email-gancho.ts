/**
 * Gancho de e-mail. Só envia se RESEND_API_KEY existir; sem a chave devolve
 * `{ enviado: false, motivo: "sem_chave" }` e quem chamou segue (na mesa, o
 * operador recebe o link em vez de o assinante receber o e-mail).
 *
 * Nenhuma chamada paga acontece sem a chave. `enviar` aceita um `fetchImpl`
 * para os testes.
 */

import { logger } from "./logger";

const log = logger.child({ module: "email-gancho" });

export interface EmailParaEnviar {
  para: string;
  assunto: string;
  texto: string;
}

export type ResultadoEmail =
  | { enviado: true }
  | { enviado: false; motivo: "sem_chave" | "falha"; detalhe?: string };

export function emailHabilitado(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY && env.RESEND_API_KEY.trim());
}

export async function enviarEmail(
  e: EmailParaEnviar,
  opcoes: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {}
): Promise<ResultadoEmail> {
  const env = opcoes.env ?? process.env;
  if (!emailHabilitado(env)) return { enviado: false, motivo: "sem_chave" };
  const remetente = env.DIT_EMAIL_FROM || "DIT PRINT <dit@printrio.net>";
  try {
    const res = await (opcoes.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remetente, to: [e.para], subject: e.assunto, text: e.texto }),
    });
    if (!res.ok) {
      log.warn({ status: res.status }, "Resend recusou o envio");
      return { enviado: false, motivo: "falha", detalhe: `HTTP ${res.status}` };
    }
    return { enviado: true };
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Falha ao enviar e-mail");
    return { enviado: false, motivo: "falha", detalhe: (err as Error).message };
  }
}
