/**
 * GET /api/dit/lendo-agora (SSE, público).
 *
 * O que o Marco está lendo agora: as manchetes reais que as fontes devolvem
 * enquanto as pessoas pesquisam territórios e enquanto a coleta diária roda.
 * Era o feed da landing antiga ("o processamento ao vivo das últimas
 * localidades pesquisadas"), fechado em 30/09 por expor o alerta inteiro.
 * Volta só com o que já é público: manchete, território, fonte, data e dimensão.
 * Sem resumo, sem impacto, sem nota, sem dado de assinante.
 */

import type { Request, Response } from "express";
import { promises as fs } from "fs";
import { join } from "path";

export interface ItemLendoAgora {
  territorio: string;
  slug: string;
  dimensao: string;
  manchete: string;
  fonte: string | null;
  data: string | null; // ISO da notícia
  lidoEm: string; // ISO de quando o Marco leu
}

const LIMITE = 60;
const buffer: ItemLendoAgora[] = [];
const clientes = new Map<string, (linha: string) => void>();
let semeado = false;

function fonteDe(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}


/** Só notícia entra no feed: título prefixado por fonte ("CNES · ...") é registro interno. */
const PREFIXO_FONTE = /^[^\s].{0,40}?\s·\s/;
const SISTEMA = /fora do escopo|sem cobertura|sem dado|cota|indispon|previs[aã]o do tempo|hor[oó]scopo|loteria|jingle|playlist/i;

/** Manchete que só cita ano já passado (vídeo antigo republicado) não é notícia de agora. */
function velha(t: string): boolean {
  const ano = new Date().getFullYear();
  const anos = (t.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
  return anos.length > 0 && anos.every((a) => a < ano - 1);
}

/** Manchete e veículo: o Google News devolve "Título - Veículo". */
function separar(titulo: string, url?: string | null): { manchete: string; fonte: string | null } | null {
  const t = titulo.trim();
  if (PREFIXO_FONTE.test(t) || SISTEMA.test(t) || velha(t)) return null;
  const host = fonteDe(url);
  const m = / - ([^-]{2,40})$/.exec(t);
  if (m && (!host || host === "news.google.com")) return { manchete: t.slice(0, m.index).trim().slice(0, 220), fonte: m[1].trim() };
  if (!host) return null;
  return { manchete: t.slice(0, 220), fonte: host };
}

function chave(i: Pick<ItemLendoAgora, "slug" | "manchete">) {
  return `${i.slug}|${i.manchete.trim().toLowerCase()}`;
}

/** Recebe um sinal do motor; guarda e transmite só a parte pública. */
export function publicarLendoAgora(p: {
  territoryName?: string;
  territorySlug?: string;
  signalTitle?: string;
  signalUrl?: string;
  dimension?: string;
  publishedAt?: string | Date;
}): void {
  if (!p.signalTitle || !p.territorySlug || p.territorySlug === "system") return;
  const sep = separar(p.signalTitle, p.signalUrl);
  if (!sep) return;
  const item: ItemLendoAgora = {
    territorio: p.territoryName ?? p.territorySlug,
    slug: p.territorySlug,
    dimensao: p.dimension ?? "GERAL",
    manchete: sep.manchete,
    fonte: sep.fonte,
    data: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
    lidoEm: new Date().toISOString(),
  };
  const k = chave(item);
  const ja = buffer.findIndex((b) => chave(b) === k);
  if (ja >= 0) buffer.splice(ja, 1);
  buffer.unshift(item);
  if (buffer.length > LIMITE) buffer.length = LIMITE;
  const linha = `data: ${JSON.stringify(item)}\n\n`;
  for (const [id, escrever] of Array.from(clientes.entries())) {
    try {
      escrever(linha);
    } catch {
      clientes.delete(id);
    }
  }
}

/**
 * Depois de um reinício o buffer em memória some. Semeia com as manchetes
 * guardadas nos últimos 7 dias no store de sinais (mesmo DATA_DIR do motor),
 * para a tela nunca abrir vazia quando já houve leitura.
 */
async function semear(): Promise<void> {
  if (semeado) return;
  semeado = true;
  const dir = join(process.env.DATA_DIR || join(process.cwd(), "data"), "signals");
  let arquivos: string[] = [];
  try {
    arquivos = (await fs.readdir(dir)).filter((f) => f.endsWith(".jsonl"));
  } catch {
    return;
  }
  const corte = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const achados: ItemLendoAgora[] = [];
  for (const f of arquivos) {
    const slug = f.replace(/\.jsonl$/, "");
    try {
      const st = await fs.stat(join(dir, f));
      if (st.mtimeMs < corte) continue;
      const linhas = (await fs.readFile(join(dir, f), "utf8")).split("\n").filter(Boolean).slice(-200);
      for (const l of linhas) {
        try {
          const s = JSON.parse(l) as { source?: string; title?: string; url?: string; dimension?: string; publishedAt?: string; storedAt?: string; structural?: boolean };
          if (!s.title || s.structural || (s.source ?? "").startsWith("src-estrutural")) continue;
          if (s.storedAt && new Date(s.storedAt).getTime() < corte) continue;
          const sep = separar(s.title, s.url);
          if (!sep) continue;
          achados.push({
            territorio: slug,
            slug,
            dimensao: s.dimension ?? "GERAL",
            manchete: sep.manchete,
            fonte: sep.fonte,
            data: s.publishedAt ?? null,
            lidoEm: s.storedAt ?? new Date(st.mtimeMs).toISOString(),
          });
        } catch {
          /* linha quebrada */
        }
      }
    } catch {
      /* arquivo ilegível */
    }
  }
  // Nome legível pelo código IBGE do slug canônico.
  try {
    const { getMunicipalityName } = await import("../structural/store");
    for (const a of achados) {
      const m = /-(\d{7})$/.exec(a.slug);
      if (m) {
        const n = await getMunicipalityName(m[1]);
        if (n && n !== m[1]) a.territorio = n;
      }
    }
  } catch {
    /* sem camada estrutural: fica o slug */
  }
  achados.sort((a, b) => b.lidoEm.localeCompare(a.lidoEm));
  for (const a of achados.slice(0, LIMITE).reverse()) {
    if (!buffer.some((b) => chave(b) === chave(a))) buffer.push(a);
  }
  buffer.sort((a, b) => b.lidoEm.localeCompare(a.lidoEm));
  if (buffer.length > LIMITE) buffer.length = LIMITE;
}

export async function lendoAgoraHandler(req: Request, res: Response): Promise<void> {
  await semear();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  // Replay: as mais recentes, da mais antiga para a mais nova, para o cliente empilhar no topo.
  for (const item of [...buffer].slice(0, 20).reverse()) res.write(`data: ${JSON.stringify(item)}\n\n`);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  clientes.set(id, (l) => res.write(l));
  const batida = setInterval(() => {
    try {
      res.write(": batida\n\n");
    } catch {
      /* conexão caiu */
    }
  }, 15000);
  req.on("close", () => {
    clearInterval(batida);
    clientes.delete(id);
  });
}

/** Só para teste. */
export function _zerarLendoAgora(): void {
  buffer.length = 0;
  clientes.clear();
  semeado = true;
}
export function _bufferLendoAgora(): ItemLendoAgora[] {
  return [...buffer];
}
