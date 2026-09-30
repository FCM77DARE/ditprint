/**
 * Leads do formulário público (B6).
 *
 * `POST /api/dit/lead` grava aqui; a mesa lê por `dashboard.leads.list` e move
 * o funil por `dashboard.leads.updateStatus`. Persistência pela coleção
 * `leads` (MySQL se houver, senão DATA_DIR/leads.json).
 *
 * Privacidade: não guarda IP nem user agent. Só o que a pessoa digitou.
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import { colecao } from "./_core/colecao";
import { emailHabilitado, enviarEmail } from "./_core/email-gancho";

export const MOMENTOS = ["entrar", "operar", "responder"] as const;
export const STATUS_LEAD = ["novo", "em_contato", "proposta", "ganho", "perdido"] as const;
export type MomentoLead = (typeof MOMENTOS)[number];
export type StatusLead = (typeof STATUS_LEAD)[number];

const texto = (max: number) => z.string().trim().max(max);
const opcional = (max: number) =>
  texto(max).optional().transform((v) => (v ? v : undefined));

/**
 * Aceita `territory` (campo antigo do formulário da landing) como sinônimo de
 * `territorio`, para o formulário atual continuar funcionando.
 */
export const leadEntradaSchema = z
  .object({
    nome: opcional(120),
    empresa: opcional(160),
    email: z.string().trim().toLowerCase().max(320).email(),
    territorio: opcional(120),
    territory: opcional(120),
    momento: z.enum(MOMENTOS).optional(),
    decisao: opcional(500),
    observacao: opcional(2000),
  })
  .transform(({ territory, territorio, ...resto }) => ({ ...resto, territorio: territorio ?? territory }));

export type LeadEntrada = z.infer<typeof leadEntradaSchema>;

export interface Lead {
  id: string;
  nome: string | null;
  empresa: string | null;
  email: string;
  territorio: string | null;
  momento: MomentoLead | null;
  decisao: string | null;
  observacao: string | null;
  status: StatusLead;
  notaInterna: string | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Quantas vezes a mesma pessoa reenviou o mesmo pedido. */
  reenvios: number;
  confirmacaoEnviada: boolean;
}

const leads = colecao<Lead>("leads");

/** Mesmo e-mail + território + momento = mesmo lead (idempotente). */
export function idDoLead(e: Pick<LeadEntrada, "email" | "territorio" | "momento">): string {
  const base = [e.email, (e.territorio ?? "").toLowerCase(), e.momento ?? ""].join("|");
  return createHash("sha256").update(base).digest("hex").slice(0, 16);
}

export async function registrarLead(
  entrada: LeadEntrada,
  agora: Date = new Date()
): Promise<{ lead: Lead; novo: boolean }> {
  const id = idDoLead(entrada);
  const existente = await leads.obter(id);
  const iso = agora.toISOString();
  const lead: Lead = existente
    ? {
        ...existente,
        nome: entrada.nome ?? existente.nome,
        empresa: entrada.empresa ?? existente.empresa,
        decisao: entrada.decisao ?? existente.decisao,
        observacao: entrada.observacao ?? existente.observacao,
        atualizadoEm: iso,
        reenvios: existente.reenvios + 1,
      }
    : {
        id,
        nome: entrada.nome ?? null,
        empresa: entrada.empresa ?? null,
        email: entrada.email,
        territorio: entrada.territorio ?? null,
        momento: entrada.momento ?? null,
        decisao: entrada.decisao ?? null,
        observacao: entrada.observacao ?? null,
        status: "novo",
        notaInterna: null,
        criadoEm: iso,
        atualizadoEm: iso,
        reenvios: 0,
        confirmacaoEnviada: false,
      };
  await leads.gravar(id, lead);
  return { lead, novo: !existente };
}

/**
 * Gancho: confirma por e-mail só se RESEND_API_KEY existir e se ainda não
 * confirmou. Sem a chave não faz nada. Nunca lança.
 */
export async function confirmarPorEmailSeHouverChave(lead: Lead): Promise<boolean> {
  if (!emailHabilitado() || lead.confirmacaoEnviada) return false;
  const r = await enviarEmail({
    para: lead.email,
    assunto: "Recebemos o seu pedido ao DIT",
    texto:
      `Olá${lead.nome ? `, ${lead.nome}` : ""}.\n\n` +
      `Recebemos o seu pedido${lead.territorio ? ` sobre ${lead.territorio}` : ""}. ` +
      `Um analista da PRINT responde em até um dia útil.\n\nPRINT Comunicação`,
  });
  if (r.enviado) await leads.gravar(lead.id, { ...lead, confirmacaoEnviada: true });
  return r.enviado;
}

export async function listarLeads(filtro: { status?: StatusLead } = {}): Promise<Lead[]> {
  const todos = await leads.listar();
  return todos
    .filter((l) => !filtro.status || l.status === filtro.status)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function atualizarStatusLead(
  id: string,
  status: StatusLead,
  notaInterna: string | undefined,
  agora: Date = new Date()
): Promise<Lead | null> {
  const l = await leads.obter(id);
  if (!l) return null;
  const novo: Lead = {
    ...l,
    status,
    notaInterna: notaInterna !== undefined ? notaInterna : l.notaInterna,
    atualizadoEm: agora.toISOString(),
  };
  await leads.gravar(id, novo);
  return novo;
}
