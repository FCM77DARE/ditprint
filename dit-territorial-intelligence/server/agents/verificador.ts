/**
 * Verificador de sinais — o que separa "fala deste território" de "passou
 * perto".
 *
 * POR QUE EXISTE
 *
 * A única verificação que os agentes tinham era `matchesTerritory`, que
 * aceitava um sinal se ele citasse o município OU a UF, com comparação por
 * substring. Medido na leitura de Macaé em 24/09/2026: dos 194 sinais não
 * estruturais, 77 (40%) NÃO citavam Macaé — entraram por mencionar "RJ" ou
 * "Rio de Janeiro". "Angra dos Reis tem alerta máximo para deslizamentos"
 * contou como tensão socioambiental de Macaé; 64 notícias acadêmicas sobre o
 * estado contaram como evidência resolutiva e baixaram o STT dela. E por
 * substring, "Magé" casava com "imagem".
 *
 * Todos os defeitos graves achados na auditoria foram falhas de verificação:
 * Fogo Cruzado atribuindo o estado ao município, rua virando território,
 * lembrete contando como evidência, homônimo em outro estado. Este módulo é
 * a camada que faltava entre coletar e pontuar.
 *
 * COMO FUNCIONA — do mais barato para o mais caro
 *
 *   1. REGRAS (todo sinal, custo zero). Procedência já é conferida em
 *      base-source. Aqui: o território aparece como PALAVRA INTEIRA; citar só
 *      a UF não basta; data dentro da janela; mesmo fato em vários veículos
 *      conta uma vez.
 *   2. HOMÔNIMO → LOTE. Nome que existe em mais de uma UF ("Eldorado",
 *      "Lajeado") e aparece sem a UF é ambíguo. Vai para o papel
 *      "verificador" em lote, uma chamada por dimensão, com pergunta de
 *      sim/não — que é exatamente o que a metodologia já previa ("ambíguo:
 *      LLM em batch, nunca em tempo real").
 *   3. RELATÓRIO. Todo número escrito no relatório tem que existir nos dados
 *      que o sustentam. Número sem lastro é marcado na procedência.
 */

import type { Territory } from "../../drizzle/schema";
import type { RawSignal } from "./types";
import { logger } from "../_core/logger";

const log = logger.child({ module: "verificador" });

// ─── Utilitários ─────────────────────────────────────────────────────────────

export function dobrar(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['‘’ʼ`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function temPalavra(texto: string, alvo: string): boolean {
  if (!alvo) return false;
  return (` ${texto} `).includes(` ${alvo} `);
}

const NOME_UF: Record<string, string> = {
  AC: "acre", AL: "alagoas", AP: "amapa", AM: "amazonas", BA: "bahia", CE: "ceara",
  DF: "distrito federal", ES: "espirito santo", GO: "goias", MA: "maranhao",
  MT: "mato grosso", MS: "mato grosso do sul", MG: "minas gerais", PA: "para",
  PB: "paraiba", PR: "parana", PE: "pernambuco", PI: "piaui", RJ: "rio de janeiro",
  RN: "rio grande do norte", RS: "rio grande do sul", RO: "rondonia", RR: "roraima",
  SC: "santa catarina", SP: "sao paulo", SE: "sergipe", TO: "tocantins",
};

/**
 * Fontes cuja consulta já vem amarrada ao território por código (IBGE,
 * território do Querido Diário, município do Fogo Cruzado). O vínculo
 * geográfico delas é estrutural, não textual — conferir texto aqui só
 * reprovaria dado certo.
 */
const FONTES_ANCORADAS = new Set([
  "src-estrutural-d2",
  "src-estrutural-d3",
  "src-estrutural-d4",
  "src-querido-diario",
  "src-fogo-cruzado",
  "src-aneel-siga",
  "src-datasus",
  "src-datasus-real",
  "src-ibge-censo",
  "src-ibge-renda",
  "src-ibge-habitacao",
  "src-inep-ideb",
  "src-snis",
  "src-inmet",
  "src-ipeadata",
]);

// ─── Homônimos ───────────────────────────────────────────────────────────────

let homonimos: Set<string> | null = null;

/**
 * Nomes de município que existem em mais de uma UF, a partir da camada
 * estrutural (que guarda "Nome - UF" dos 5.570). Carregado uma vez.
 */
async function carregarHomonimos(): Promise<Set<string>> {
  if (homonimos) return homonimos;
  try {
    const { listarNomesMunicipios } = await import("../structural/store");
    const nomes = await listarNomesMunicipios();
    const ufsPorNome = new Map<string, Set<string>>();
    for (const n of nomes) {
      const m = n.match(/^(.*) - ([A-Z]{2})$/);
      if (!m) continue;
      const k = dobrar(m[1]);
      const set = ufsPorNome.get(k) ?? new Set<string>();
      set.add(m[2]);
      ufsPorNome.set(k, set);
    }
    homonimos = new Set(
      Array.from(ufsPorNome.entries())
        .filter(([, ufs]) => ufs.size > 1)
        .map(([k]) => k)
    );
    log.info({ homonimos: homonimos.size }, "Tabela de homônimos carregada");
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Sem tabela de homônimos — seguindo sem ela");
    homonimos = new Set();
  }
  return homonimos;
}

// ─── Nível 1: regras ─────────────────────────────────────────────────────────

export type MotivoRejeicao =
  | "nao_cita_o_territorio"
  | "cita_so_a_uf"
  | "fora_da_janela"
  | "duplicado";

export interface ResultadoVerificacao {
  aprovados: RawSignal[];
  ambiguos: RawSignal[];
  rejeitados: Array<{ sinal: RawSignal; motivo: MotivoRejeicao }>;
}

interface AlvoGeo {
  nomes: string[];
  uf: string;
  nomeUf: string;
}

function alvoDoTerritorio(territory: Territory): AlvoGeo {
  const ctx = (territory.contextData ?? {}) as Record<string, unknown>;
  const lista = Array.isArray(ctx.municipiosNomes) ? (ctx.municipiosNomes as unknown[]).map(String) : [];
  const uf = String(ctx.uf ?? territory.state ?? "").toUpperCase();
  // Nome do território + municípios do recorte (composto) ou município pai
  // (localidade: Cabiúnas vale como Cabiúnas ou como Macaé).
  const nomes = Array.from(new Set([territory.name, ...lista].map(dobrar).filter((n) => n.length >= 3)));
  return { nomes, uf, nomeUf: NOME_UF[uf] ?? "" };
}

export async function verificarSinais(
  territory: Territory,
  sinais: RawSignal[],
  janelaMeses = 24
): Promise<ResultadoVerificacao> {
  const hom = await carregarHomonimos();
  const alvo = alvoDoTerritorio(territory);
  const agora = Date.now();
  const inicioJanela = agora - janelaMeses * 30 * 24 * 60 * 60 * 1000;
  const vistos = new Set<string>();

  const out: ResultadoVerificacao = { aprovados: [], ambiguos: [], rejeitados: [] };

  for (const s of sinais) {
    // Janela temporal — sinal do futuro ou de antes da janela não entra.
    // Fonte ancorada fica fora: usina da ANEEL em operação desde 2005 é fato
    // de hoje, não notícia velha. A primeira versão reprovava por data.
    const ts = s.publishedAt ? new Date(s.publishedAt).getTime() : NaN;
    const estrutural =
      (s.metadata as Record<string, unknown> | undefined)?.structural === true ||
      FONTES_ANCORADAS.has(s.sourceAgentId);
    if (!estrutural && Number.isFinite(ts) && (ts > agora + 86_400_000 || ts < inicioJanela)) {
      out.rejeitados.push({ sinal: s, motivo: "fora_da_janela" });
      continue;
    }

    // Mesmo fato em vários veículos: título normalizado sem o sufixo " - veículo".
    const chave = dobrar((s.title ?? "").replace(/\s[-|–]\s[^-|–]+$/, "")).slice(0, 90);
    if (chave.length > 20) {
      if (vistos.has(chave)) {
        out.rejeitados.push({ sinal: s, motivo: "duplicado" });
        continue;
      }
      vistos.add(chave);
    }

    if (FONTES_ANCORADAS.has(s.sourceAgentId)) {
      out.aprovados.push(s);
      continue;
    }

    const texto = dobrar(`${s.title ?? ""} ${s.summary ?? ""}`);
    const nomeCitado = alvo.nomes.find((n) => temPalavra(texto, n));

    if (!nomeCitado) {
      const citaUf =
        (alvo.nomeUf && temPalavra(texto, alvo.nomeUf)) ||
        (alvo.uf && temPalavra(texto, alvo.uf.toLowerCase()));
      out.rejeitados.push({ sinal: s, motivo: citaUf ? "cita_so_a_uf" : "nao_cita_o_territorio" });
      continue;
    }

    // Homônimo sem a UF junto: pode ser o outro Eldorado.
    if (hom.has(nomeCitado)) {
      const citaUf =
        (alvo.nomeUf && temPalavra(texto, alvo.nomeUf)) ||
        (alvo.uf && temPalavra(texto, alvo.uf.toLowerCase()));
      if (!citaUf) {
        out.ambiguos.push(s);
        continue;
      }
    }

    out.aprovados.push(s);
  }

  return out;
}

// ─── Nível 2: lote para o ambíguo ────────────────────────────────────────────

const MAX_LOTE = 40;

/**
 * Pergunta ao papel "verificador", numa chamada só, quais dos ambíguos falam
 * mesmo do território. Barato (gpt-5-mini, raciocínio mínimo) e desligável
 * por env (DIT_VERIFICADOR_LLM=false). Na dúvida — falha de chamada, resposta
 * ilegível —, o ambíguo NÃO entra: sinal duvidoso fora vale mais que sinal
 * errado dentro.
 */
export async function resolverAmbiguos(
  territory: Territory,
  ambiguos: RawSignal[]
): Promise<RawSignal[]> {
  if (ambiguos.length === 0) return [];
  if (String(process.env.DIT_VERIFICADOR_LLM ?? "true").toLowerCase() === "false") return [];

  const lote = ambiguos.slice(0, MAX_LOTE);
  const ctx = (territory.contextData ?? {}) as Record<string, unknown>;
  const uf = String(ctx.uf ?? territory.state ?? "");
  const lista = lote
    .map((s, i) => `${i}. ${(s.title ?? "").slice(0, 160)} — ${(s.summary ?? "").slice(0, 200)}`)
    .join("\n");

  try {
    const { invokeJson } = await import("../_core/llm");
    const r = await invokeJson<{ sim?: number[] }>({
      role: "verificador",
      messages: [
        {
          role: "system",
          content:
            "Você confere se notícias falam de um município específico. Existe mais de um " +
            "município com este nome no Brasil. Responda só JSON: {\"sim\": [índices]} com " +
            "os itens que claramente falam do município indicado. Na dúvida, não inclua.",
        },
        {
          role: "user",
          content: `Município: ${territory.name} (${uf})\n\nItens:\n${lista}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const idx = new Set((r.sim ?? []).filter((n) => Number.isInteger(n) && n >= 0 && n < lote.length));
    const aprovados = lote.filter((_, i) => idx.has(i));
    log.info(
      { territorio: territory.slug, ambiguos: ambiguos.length, avaliados: lote.length, aprovados: aprovados.length },
      "Ambíguos resolvidos em lote"
    );
    return aprovados;
  } catch (err) {
    log.warn({ err: (err as Error).message, territorio: territory.slug }, "Lote de ambíguos falhou — nenhum entra");
    return [];
  }
}

// ─── Nível 3: o relatório ────────────────────────────────────────────────────

/**
 * Números do relatório que não aparecem nos dados que o sustentam.
 *
 * O prompt proíbe inventar dado. Este é o conferente dessa regra: extrai todo
 * número com peso (dois dígitos ou mais, porcentagem, valor) do texto do
 * relatório e procura cada um no material de entrada. O que não tiver lastro
 * sai marcado na procedência — o analista que publica vê antes do cliente.
 *
 * Não reprova o relatório sozinho: ano, STT e número de dimensão aparecem no
 * próprio prompt e passam. O que sobra é o que precisa de olho humano.
 */
export function conferirNumerosDoRelatorio(relatorio: unknown, fonte: string): string[] {
  const texto = JSON.stringify(relatorio ?? {});
  const fonteNorm = fonte.replace(/\./g, "").replace(/,/g, ".");
  const achados = new Set<string>();
  const re = /(?<![\w.])(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s?(%|mil|milhões|bilhões|km²|hab)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const bruto = m[1];
    const limpo = bruto.replace(/\./g, "").replace(",", ".");
    const n = Number(limpo);
    if (!Number.isFinite(n)) continue;
    // Pequeno demais para ser afirmação (D1, 3 riscos, 2 parágrafos) ou ano.
    if (n < 10 && !m[2]) continue;
    if (n >= 1990 && n <= 2035 && !m[2]) continue;
    if (!fonteNorm.includes(limpo) && !fonte.includes(bruto)) {
      achados.add(`${bruto}${m[2] ? " " + m[2] : ""}`);
    }
  }
  return Array.from(achados).slice(0, 30);
}
