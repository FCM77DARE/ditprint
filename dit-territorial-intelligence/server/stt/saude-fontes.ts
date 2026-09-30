/**
 * Saúde das fontes persistida (B4).
 *
 * Antes: `orchestrator.getAgentHealth()` era memória do processo, então cada
 * deploy zerava o histórico e a mesa não sabia dizer "esta fonte está muda há
 * três dias". Agora cada rodada do orquestrador grava, por fonte: último
 * sucesso, último erro, última vez que trouxe sinal e contagem dos últimos 7
 * dias. Persistência pela coleção `saude-fontes` (MySQL se houver, senão
 * DATA_DIR/saude-fontes.json).
 *
 * A classificação separa o que é cota (SerpAPI esgotada, resolve com plano ou
 * janela) do que é defeito nosso (fonte oficial, código), porque as duas
 * filas de trabalho são diferentes.
 */

import { colecao } from "../_core/colecao";
import { logger } from "../_core/logger";

const log = logger.child({ module: "saude-fontes" });

export interface DiaFonte {
  rodadas: number;
  ok: number;
  erro: number;
  sinais: number;
}

export interface RegistroFonte {
  id: string;
  nome: string;
  dimensao: string | null;
  ultimaRodada: string | null;
  ultimoSucesso: string | null;
  ultimoErro: string | null;
  ultimoErroMsg: string | null;
  ultimoSinal: string | null;
  /** YYYY-MM-DD -> contagem. Guarda só os últimos 7 dias. */
  dias: Record<string, DiaFonte>;
}

export interface ObservacaoFonte {
  id: string;
  nome: string;
  dimensao: string | null;
  ok: boolean;
  erro?: string;
  sinais: number;
}

export type MotivoFonte = "cota_serpapi" | "defeito" | "ok";
export type EstadoFonte = "ok" | "muda" | "falhando";

/**
 * Fontes que consultam o SerpAPI (direto ou por serpapi-quota). Levantado do
 * código em 30/09/2026: todo agente em server/agents/sources que referencia
 * serpapi.com, SERPAPI_KEY ou serpapiCachedFetch.
 */
export const FONTES_SERPAPI: ReadonlySet<string> = new Set([
  "src-aneel-siga", "src-antt-portos", "src-audiencias", "src-cnuc", "src-cptec-inpe",
  "src-datasus", "src-datasus-real", "src-fiocruz-clima", "src-funai-iphan", "src-geni-uff",
  "src-google-trends", "src-ibama", "src-ibge-mapbiomas", "src-incra-sipra", "src-inea",
  "src-inep", "src-inep-ideb", "src-inpe-deter", "src-isp-ssp", "src-judiciario",
  "src-mapa-empresas", "src-mp-ambiental", "src-orcamento-participativo", "src-plano-diretor",
  "src-redes-sociais", "src-secretarias-ma", "src-sinir", "src-snis", "src-snis-sinasa",
  "src-unicamp-terr",
]);

const DIAS_GUARDADOS = 7;
const MS_DIA = 24 * 60 * 60 * 1000;

const vazioDia = (): DiaFonte => ({ rodadas: 0, ok: 0, erro: 0, sinais: 0 });

function diaDe(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Puro: atualizar um registro com uma observação ─────────────────────────

export function aplicarObservacao(
  atual: RegistroFonte | null,
  obs: ObservacaoFonte,
  agora: Date
): RegistroFonte {
  const iso = agora.toISOString();
  const reg: RegistroFonte = atual
    ? { ...atual, dias: { ...atual.dias }, nome: obs.nome || atual.nome, dimensao: obs.dimensao ?? atual.dimensao }
    : {
        id: obs.id,
        nome: obs.nome,
        dimensao: obs.dimensao,
        ultimaRodada: null,
        ultimoSucesso: null,
        ultimoErro: null,
        ultimoErroMsg: null,
        ultimoSinal: null,
        dias: {},
      };
  const chave = diaDe(agora);
  const dia = { ...(reg.dias[chave] ?? vazioDia()) };
  dia.rodadas += 1;
  dia.sinais += Math.max(0, obs.sinais);
  reg.ultimaRodada = iso;
  if (obs.ok) {
    dia.ok += 1;
    reg.ultimoSucesso = iso;
  } else {
    dia.erro += 1;
    reg.ultimoErro = iso;
    reg.ultimoErroMsg = (obs.erro ?? "erro sem mensagem").slice(0, 300);
  }
  if (obs.sinais > 0) reg.ultimoSinal = iso;
  reg.dias[chave] = dia;

  const corte = diaDe(new Date(agora.getTime() - (DIAS_GUARDADOS - 1) * MS_DIA));
  for (const d of Object.keys(reg.dias)) if (d < corte) delete reg.dias[d];
  return reg;
}

export interface ContextoClassificacao {
  agora: Date;
  /** A cota do SerpAPI (diária, mensal ou orçamento global) está esgotada agora. */
  cotaSerpapiEsgotada: boolean;
  usaSerpapi?: (id: string) => boolean;
}

export interface FonteClassificada extends RegistroFonte {
  estado: EstadoFonte;
  motivo: MotivoFonte;
  sucessos7d: number;
  erros7d: number;
  sinais7d: number;
  rodadas7d: number;
  horasSemSinal: number | null;
}

const PADRAO_COTA = /serpapi|quota|cota|rate.?limit|limit.?exceeded|\b429\b/i;

/** Pura: estado e motivo de uma fonte, a partir do registro e do contexto. */
export function classificarFonte(reg: RegistroFonte, ctx: ContextoClassificacao): FonteClassificada {
  const usa = ctx.usaSerpapi ?? ((id: string) => FONTES_SERPAPI.has(id));
  const corte = diaDe(new Date(ctx.agora.getTime() - (DIAS_GUARDADOS - 1) * MS_DIA));
  let sucessos7d = 0, erros7d = 0, sinais7d = 0, rodadas7d = 0;
  for (const [d, v] of Object.entries(reg.dias)) {
    if (d < corte) continue;
    sucessos7d += v.ok;
    erros7d += v.erro;
    sinais7d += v.sinais;
    rodadas7d += v.rodadas;
  }
  const erroDepoisDoSucesso =
    reg.ultimoErro !== null && (reg.ultimoSucesso === null || reg.ultimoErro > reg.ultimoSucesso);
  const horasSemSinal = reg.ultimoSinal
    ? Math.max(0, Math.round(((ctx.agora.getTime() - new Date(reg.ultimoSinal).getTime()) / 3_600_000) * 10) / 10)
    : null;

  let estado: EstadoFonte = "ok";
  let motivo: MotivoFonte = "ok";
  if (erroDepoisDoSucesso) {
    estado = "falhando";
    motivo = usa(reg.id) && PADRAO_COTA.test(reg.ultimoErroMsg ?? "") ? "cota_serpapi" : "defeito";
  } else if (rodadas7d > 0 && sinais7d === 0) {
    estado = "muda";
    motivo = usa(reg.id) && ctx.cotaSerpapiEsgotada ? "cota_serpapi" : "defeito";
  }
  return { ...reg, estado, motivo, sucessos7d, erros7d, sinais7d, rodadas7d, horasSemSinal };
}

/**
 * Pura: transforma o antes/depois da saúde em memória do orquestrador numa
 * observação por fonte desta rodada. Erro = `errorCount` subiu durante a rodada.
 */
export function observacoesDaRodada(
  antes: Array<{ id: string; errorCount: number }>,
  depois: Array<{ id: string; errorCount: number; lastError: string | null }>,
  breakdown: Array<{ id: string; name: string; signals: number }>,
  dimensaoDe: (id: string) => string | null
): ObservacaoFonte[] {
  const errosAntes = new Map(antes.map((a) => [a.id, a.errorCount]));
  const nomes = new Map(breakdown.map((b) => [b.id, b.name]));
  const sinais = new Map<string, number>();
  for (const b of breakdown) sinais.set(b.id, (sinais.get(b.id) ?? 0) + b.signals);
  return depois.map((d) => {
    const falhou = d.errorCount > (errosAntes.get(d.id) ?? 0);
    return {
      id: d.id,
      nome: nomes.get(d.id) ?? d.id,
      dimensao: dimensaoDe(d.id),
      ok: !falhou,
      ...(falhou ? { erro: d.lastError ?? "erro sem mensagem" } : {}),
      sinais: sinais.get(d.id) ?? 0,
    };
  });
}

// ─── Persistência ────────────────────────────────────────────────────────────

const registros = colecao<RegistroFonte>("saude-fontes");

/** Grava a rodada. Nunca lança: a coleta não cai por causa da telemetria. */
export async function registrarRodadaDeFontes(obs: ObservacaoFonte[], agora: Date = new Date()): Promise<void> {
  try {
    const existentes = new Map((await registros.entradas()).map(([k, v]) => [k, v]));
    for (const o of obs) {
      await registros.gravar(o.id, aplicarObservacao(existentes.get(o.id) ?? null, o, agora));
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Saúde das fontes não gravada (não-fatal)");
  }
}

export async function lerSaudeDasFontes(ctx: ContextoClassificacao): Promise<FonteClassificada[]> {
  const ordem: Record<EstadoFonte, number> = { falhando: 0, muda: 1, ok: 2 };
  return (await registros.listar())
    .map((r) => classificarFonte(r, ctx))
    .sort((a, b) => ordem[a.estado] - ordem[b.estado] || a.id.localeCompare(b.id));
}
