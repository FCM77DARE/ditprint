/**
 * Portal do assinante (B2 mínimo): quem é o assinante, de quais territórios,
 * e o token de acesso assinado.
 *
 * Fluxo sem serviço de e-mail (RESEND_API_KEY não existe hoje):
 *   1. A pessoa pede acesso em `portal.solicitarAcesso(email)`. A resposta é
 *      sempre a mesma, exista ou não o e-mail (não revela quem é assinante), e
 *      NUNCA devolve o link. O pedido fica registrado para a mesa.
 *   2. O operador vê o pedido em `dashboard.assinantes.list` e gera o link em
 *      `dashboard.assinantes.gerarLink`, que devolve o link ao OPERADOR. Com a
 *      chave de e-mail presente, o mesmo caminho também envia ao assinante.
 *   3. O assinante abre o link; `portal.sessao({ token })` valida, grava o
 *      cookie httpOnly e devolve os territórios dele.
 *
 * Token: JWT HS256, 7 dias, `type: "assinante"`. A chave é derivada do
 * JWT_SECRET com um rótulo próprio, então um token de assinante nunca vale como
 * token de operador (e o verificador do operador também confere `type`).
 * `tokenVersion` no registro do assinante permite revogar todos os links já
 * emitidos.
 *
 * Persistência: coleções `assinantes` e `portal-solicitacoes` (MySQL se houver,
 * senão JSON em DATA_DIR).
 */

import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookies } from "cookie";
import { colecao } from "./_core/colecao";

export const PORTAL_COOKIE = "dit_portal_token";
export const PORTAL_TOKEN_HEADER = "x-dit-portal-token";
export const TOKEN_DIAS = 7;

export interface Assinante {
  email: string;
  nome: string | null;
  /** Slugs dos territórios do contrato. */
  territorios: string[];
  tokenVersion: number;
  criadoEm: string;
  atualizadoEm: string;
  ultimoAcesso: string | null;
}

export interface Solicitacao {
  email: string;
  em: string;
  /** O e-mail é de um assinante cadastrado? (só a mesa vê; a resposta pública não diz). */
  conhecido: boolean;
  atendida: boolean;
}

export interface SessaoPortal {
  email: string;
  nome: string | null;
  territorios: string[];
  /** ISO. */
  expiraEm: string;
}

const assinantes = colecao<Assinante>("assinantes");
const solicitacoes = colecao<Solicitacao>("portal-solicitacoes");

export const normalizarEmail = (e: string) => e.trim().toLowerCase();

export function normalizarTerritorios(lista: string[]): string[] {
  return Array.from(new Set(lista.map((s) => s.trim().toLowerCase()).filter(Boolean)));
}

// ─── Assinantes ──────────────────────────────────────────────────────────────

export async function obterAssinante(email: string): Promise<Assinante | null> {
  return assinantes.obter(normalizarEmail(email));
}

export async function listarAssinantes(): Promise<Assinante[]> {
  return (await assinantes.listar()).sort((a, b) => a.email.localeCompare(b.email));
}

export async function salvarAssinante(
  entrada: { email: string; nome?: string | null; territorios: string[]; revogarLinks?: boolean },
  agora: Date = new Date()
): Promise<Assinante> {
  const email = normalizarEmail(entrada.email);
  const atual = await assinantes.obter(email);
  const iso = agora.toISOString();
  const a: Assinante = {
    email,
    nome: entrada.nome !== undefined ? entrada.nome : atual?.nome ?? null,
    territorios: normalizarTerritorios(entrada.territorios),
    tokenVersion: (atual?.tokenVersion ?? 1) + (entrada.revogarLinks ? 1 : 0),
    criadoEm: atual?.criadoEm ?? iso,
    atualizadoEm: iso,
    ultimoAcesso: atual?.ultimoAcesso ?? null,
  };
  await assinantes.gravar(email, a);
  return a;
}

// ─── Solicitações de acesso ──────────────────────────────────────────────────

const JANELA_SOLICITACAO_MS = 10 * 60 * 1000;

/**
 * Registra o pedido de acesso. Pedidos repetidos do mesmo e-mail em 10 minutos
 * não geram novo registro (quem insiste não enche a mesa).
 */
export async function registrarSolicitacao(email: string, agora: Date = new Date()): Promise<void> {
  const chave = normalizarEmail(email);
  const atual = await solicitacoes.obter(chave);
  if (atual && !atual.atendida && agora.getTime() - new Date(atual.em).getTime() < JANELA_SOLICITACAO_MS) return;
  await solicitacoes.gravar(chave, {
    email: chave,
    em: agora.toISOString(),
    conhecido: (await obterAssinante(chave)) !== null,
    atendida: false,
  });
}

export async function solicitacoesPendentes(): Promise<Solicitacao[]> {
  return (await solicitacoes.listar()).filter((s) => !s.atendida).sort((a, b) => b.em.localeCompare(a.em));
}

export async function marcarSolicitacaoAtendida(email: string): Promise<void> {
  const chave = normalizarEmail(email);
  const s = await solicitacoes.obter(chave);
  if (s && !s.atendida) await solicitacoes.gravar(chave, { ...s, atendida: true });
}

// ─── Token ───────────────────────────────────────────────────────────────────

function chaveDoToken(): Uint8Array {
  const segredo = process.env.JWT_SECRET ?? "";
  if (segredo.length < 32) throw new Error("JWT_SECRET ausente ou curto: não dá para assinar token do portal.");
  return createHmac("sha256", segredo).update("dit-portal-assinante-v1").digest();
}

export async function assinarToken(
  a: Pick<Assinante, "email" | "tokenVersion">,
  agora: Date = new Date()
): Promise<{ token: string; expiraEm: string }> {
  const iat = Math.floor(agora.getTime() / 1000);
  const exp = iat + TOKEN_DIAS * 24 * 60 * 60;
  const token = await new SignJWT({ type: "assinante", email: a.email, v: a.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(chaveDoToken());
  return { token, expiraEm: new Date(exp * 1000).toISOString() };
}

/** Verifica assinatura, tipo e validade. Não consulta o registro do assinante. */
export async function verificarToken(
  token: string,
  agora: Date = new Date()
): Promise<{ email: string; v: number; exp: number } | null> {
  try {
    const { payload } = await jwtVerify(token, chaveDoToken(), {
      algorithms: ["HS256"],
      currentDate: agora,
    });
    if (payload.type !== "assinante" || typeof payload.email !== "string") return null;
    return { email: payload.email, v: Number(payload.v ?? 0), exp: Number(payload.exp) };
  } catch {
    return null;
  }
}

/** Token válido E assinante ainda cadastrado E versão não revogada. */
export async function sessaoDoToken(token: string, agora: Date = new Date()): Promise<SessaoPortal | null> {
  const t = await verificarToken(token, agora);
  if (!t) return null;
  const a = await obterAssinante(t.email);
  if (!a || a.tokenVersion !== t.v) return null;
  return { email: a.email, nome: a.nome, territorios: a.territorios, expiraEm: new Date(t.exp * 1000).toISOString() };
}

export async function registrarAcesso(email: string, agora: Date = new Date()): Promise<void> {
  const a = await obterAssinante(email);
  if (a) await assinantes.gravar(a.email, { ...a, ultimoAcesso: agora.toISOString() });
}

/** `base` sem barra final. O caminho `/entrar` é o da tela de login da área do assinante. */
export function linkDeAcesso(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/entrar?token=${encodeURIComponent(token)}`;
}

// ─── Requisição → identidade ─────────────────────────────────────────────────

type ReqLike = {
  headers: Record<string, string | string[] | undefined>;
};

function cabecalho(req: ReqLike, nome: string): string | undefined {
  const v = req.headers[nome];
  return Array.isArray(v) ? v[0] : v;
}

/** Token do assinante: cabeçalho próprio, Authorization Bearer ou cookie. */
export function tokenDaRequisicao(req: ReqLike): string | null {
  const proprio = cabecalho(req, PORTAL_TOKEN_HEADER);
  if (proprio) return proprio.trim();
  const auth = cabecalho(req, "authorization");
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  const cookies = parseCookies(cabecalho(req, "cookie") ?? "");
  return cookies[PORTAL_COOKIE] ?? null;
}

export type IdentidadePortal =
  | { tipo: "operador"; email: string }
  | { tipo: "assinante"; email: string; territorios: string[] };

/**
 * Quem está chamando: operador (cookie do dashboard) ou assinante (token do
 * portal). Operador tem prioridade. Null = anônimo.
 */
export async function identidadeDaRequisicao(req: ReqLike): Promise<IdentidadePortal | null> {
  try {
    const cookies = parseCookies(cabecalho(req, "cookie") ?? "");
    const { DASHBOARD_JWT_COOKIE, verifyDashboardToken } = await import("./dashboardAuth");
    const brutoOperador = cookies[DASHBOARD_JWT_COOKIE];
    if (brutoOperador) {
      const op = await verifyDashboardToken(brutoOperador);
      if (op) return { tipo: "operador", email: op.email };
    }
  } catch {
    /* sem dashboardAuth carregável (testes): segue para o assinante */
  }
  const token = tokenDaRequisicao(req);
  if (!token) return null;
  const s = await sessaoDoToken(token);
  return s ? { tipo: "assinante", email: s.email, territorios: s.territorios } : null;
}

export function podeVerTerritorio(
  id: { tipo: "operador" | "assinante" | "aberto"; territorios: string[] | "*" },
  slug: string
): boolean {
  if (id.territorios === "*") return true;
  return id.territorios.includes(slug.toLowerCase());
}
