/**
 * src-camara-proposicoes · Visibilidade política nacional do município (D6)
 *
 * Fonte OFICIAL e GRATUITA, sem chave: Câmara dos Deputados, Dados Abertos.
 *   https://dadosabertos.camara.leg.br/api/v2/proposicoes
 *   parâmetros: keywords (todas as palavras), dataApresentacaoInicio (AAAA-MM-DD),
 *   itens (máximo 100), pagina, ordem, ordenarPor.
 *   Doc: https://dadosabertos.camara.leg.br/swagger/api.html
 *
 * Conta as proposições (PL, PDL, PEC, requerimentos) apresentadas nos últimos
 * 12 meses cuja EMENTA cita o município pelo nome. Quando um deputado legisla
 * sobre a cidade (título honorífico, obra, radiodifusão, repasse), o território
 * existe na agenda política nacional: é visibilidade.
 *
 * A busca da API é por palavras soltas, então cada resultado é conferido na
 * ementa: nome como palavra inteira, sem ser parte de outro município
 * ("São Gonçalo do Amarante" não vale como "São Gonçalo") e, se o nome for
 * homônimo de município de outra UF, só vale com a UF do território confirmada
 * na própria ementa.
 *
 * Sem LLM. Impacto por regra determinística (ver `impactoVisibilidade`).
 * Falha de rede não derruba a malha. Fonte que respondeu com ZERO proposições
 * conta como evidência (território ausente da agenda legislativa federal).
 *
 * PROVISÓRIO: as faixas de contagem do impacto são convenção de trabalho, ainda
 * não auditadas pela escola de reputação.
 */

import axios from "axios";
import { BaseSourceAgent } from "../../base-source";
import type { ClassifiedSignal, CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import { identidadeMunicipio, ibgeIdsDoTerritorio } from "../ibge-municipio";

const BASE = "https://dadosabertos.camara.leg.br/api/v2/proposicoes";
const TIMEOUT_MS = 15_000;
const ITENS = 100; // máximo da API
const MAX_PAGINAS = 5;
const MAX_MUNICIPIOS = 3;
const JANELA_DIAS = 365;
const IND_VISIBILIDADE = "6.1.3.1"; // matérias com alcance regional/nacional sobre o território

const NOME_UF: Record<string, string> = {
  AC: "acre", AL: "alagoas", AP: "amapa", AM: "amazonas", BA: "bahia", CE: "ceara",
  DF: "distrito federal", ES: "espirito santo", GO: "goias", MA: "maranhao",
  MT: "mato grosso", MS: "mato grosso do sul", MG: "minas gerais", PA: "para",
  PB: "paraiba", PR: "parana", PE: "pernambuco", PI: "piaui", RJ: "rio de janeiro",
  RN: "rio grande do norte", RS: "rio grande do sul", RO: "rondonia", RR: "roraima",
  SC: "santa catarina", SP: "sao paulo", SE: "sergipe", TO: "tocantins",
};

export interface Proposicao {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
  dataApresentacao: Date | null;
  url: string;
}

// ─── Conferência do nome na ementa ───────────────────────────────────────────

/** Minúsculas sem acento, preservando o comprimento (índices batem com o original). */
function dobrar(s: string): string {
  let out = "";
  for (const ch of s) out += ch.normalize("NFD")[0].toLowerCase();
  return out;
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Palavras que, depois de "do/da/de", NÃO formam outro município. */
const NAO_E_TOPONIMO = /^(estado|municipio|distrito|territorio|bairro|governo|poder|brasil|sul|norte|leste|oeste)\b/;

export type ResultadoConferencia = { vale: false } | { vale: true; ufConfirmada: boolean };

/**
 * Confere se a ementa cita MESMO o município (nome + UF do território).
 * `homonimo`: o nome existe em mais de uma UF. Nesse caso exige UF confirmada.
 */
export function conferirEmenta(ementa: string, nome: string, uf: string, homonimo: boolean): ResultadoConferencia {
  const f = dobrar(ementa);
  const alvo = dobrar(nome);
  const re = new RegExp(`(^|[^a-z0-9])(${escapar(alvo)})(?![a-z0-9])`, "g");
  const nomeUf = NOME_UF[uf.toUpperCase()] ?? "";
  const outrasUf = Object.entries(NOME_UF).filter(([s]) => s !== uf.toUpperCase());

  let m: RegExpExecArray | null;
  while ((m = re.exec(f)) !== null) {
    const ini = m.index + m[1].length;
    const fim = ini + alvo.length;
    const resto = f.slice(fim);

    // Continuação de outro município: "São Gonçalo do Amarante", "Santa Luzia do Norte".
    const cont = resto.match(/^\s+(do|da|de|dos|das)\s+/);
    if (cont) {
      const depois = f.slice(fim + cont[0].length);
      const eMaiuscula = /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(ementa[fim + cont[0].length] ?? "");
      if (eMaiuscula && !NAO_E_TOPONIMO.test(depois)) {
        continue;
      }
    }

    // UF logo depois do nome: "/RJ", "(RJ)", "- RJ", ", RJ", ", no Estado do Rio de Janeiro".
    const janela = resto.slice(0, 60);
    const janelaOriginal = ementa.slice(fim, fim + 60);
    const sigla = janelaOriginal.match(/^\s*[\/(\-,]\s*([A-Z]{2})\b/);
    if (sigla) {
      if (sigla[1] === uf.toUpperCase()) return { vale: true, ufConfirmada: true };
      continue;
    }
    if (nomeUf && new RegExp(`\\b${escapar(nomeUf)}\\b`).test(janela)) return { vale: true, ufConfirmada: true };
    if (outrasUf.some(([, n]) => new RegExp(`estado d[aeo]s? ${escapar(n)}\\b`).test(janela))) {
      continue;
    }

    // Nome inteiro, sem UF ao lado. UF do território em qualquer ponto da ementa também confirma.
    const ufNaEmenta =
      (nomeUf && new RegExp(`\\b${escapar(nomeUf)}\\b`).test(f)) || new RegExp(`[\\/(]${uf.toUpperCase()}\\b`).test(ementa);
    if (ufNaEmenta) return { vale: true, ufConfirmada: true };
    if (homonimo) {
      continue;
    }
    return { vale: true, ufConfirmada: false };
  }
  return { vale: false };
}

// ─── Homônimos (lista oficial de municípios do IBGE, carregada sob demanda) ──

let homonimos: { ate: number; nomes: Map<string, number> } | null = null;

/** Quantas UFs têm município com este nome. null = lista indisponível (rede). */
async function ufsComNome(nome: string, signal?: AbortSignal): Promise<number | null> {
  if (!homonimos || homonimos.ate < Date.now()) {
    try {
      const res = await axios.get("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome", {
        signal,
        timeout: 25_000,
        headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200 || !Array.isArray(res.data)) return null;
      const nomes = new Map<string, number>();
      for (const m of res.data as Array<{ nome?: string }>) {
        if (!m.nome) continue;
        const k = dobrar(m.nome);
        nomes.set(k, (nomes.get(k) ?? 0) + 1);
      }
      homonimos = { ate: Date.now() + 24 * 60 * 60 * 1000, nomes };
    } catch {
      return null;
    }
  }
  return homonimos.nomes.get(dobrar(nome)) ?? 0;
}

// ─── Regra de impacto (determinística, sem LLM) ──────────────────────────────

/**
 * Proposições que citam o município em 12 meses. Nenhuma = 0,15 (território
 * fora da agenda legislativa federal; é evidência de baixa visibilidade, não
 * de risco). 1 ou 2 = 0,3; de 3 a 9 = 0,45; 10 ou mais = 0,6 (município
 * recorrente no Congresso).
 */
export function impactoVisibilidade(n: number): number {
  if (n === 0) return 0.15;
  if (n <= 2) return 0.3;
  if (n <= 9) return 0.45;
  return 0.6;
}

function nivel(score: number): ClassifiedSignal["impactLevel"] {
  if (score >= 0.7) return "high";
  if (score >= 0.3) return "medium";
  if (score > 0.1) return "low";
  return "negligible";
}

/** Sinais desta fonte chegam com indicador e impacto prontos (metadata). */
export function classificarCamara(signal: RawSignal): ClassifiedSignal | null {
  if (signal.sourceAgentId !== "src-camara-proposicoes") return null;
  const m = signal.metadata ?? {};
  const impactScore = typeof m.impactScore === "number" ? m.impactScore : 0.3;
  const indicatorCode = typeof m.indicatorCode === "string" ? m.indicatorCode : IND_VISIBILIDADE;
  return {
    ...signal,
    indicatorCode,
    impactScore,
    impactLevel: nivel(impactScore),
    confidence: 0.9, // ementa oficial da proposição, conferida por nome e UF
    triggersAlert: false, // visibilidade não é alerta
  };
}

// ─── Consulta ─────────────────────────────────────────────────────────────────

export function urlProposicoes(nome: string, desde: string, pagina = 1): string {
  return `${BASE}?keywords=${encodeURIComponent(nome)}&dataApresentacaoInicio=${desde}&itens=${ITENS}&pagina=${pagina}&ordem=DESC&ordenarPor=id`;
}

export const urlProposicao = (id: number) => `https://www.camara.leg.br/propostas-legislativas/${id}`;

interface Bruto {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
  dataApresentacao?: string;
}

/** Devolve as proposições brutas (todas as páginas) ou null se a API não respondeu. */
async function buscar(nome: string, desde: string, signal?: AbortSignal): Promise<Bruto[] | null> {
  const todos: Bruto[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    try {
      const res = await axios.get(urlProposicoes(nome, desde, pagina), {
        signal,
        timeout: TIMEOUT_MS,
        headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200) return pagina === 1 ? null : todos;
      const dados = (res.data as { dados?: Bruto[] } | undefined)?.dados;
      if (!Array.isArray(dados)) return pagina === 1 ? null : todos;
      todos.push(...dados);
      if (dados.length < ITENS) break;
    } catch {
      return pagina === 1 ? null : todos;
    }
  }
  return todos;
}

export class SrcCamaraProposicoes extends BaseSourceAgent {
  readonly id = "src-camara-proposicoes";
  readonly dimension = "D6";
  readonly name = "Câmara dos Deputados - Proposições que citam o município";

  protected async fetchSignals(territory: Territory, options: CollectOptions): Promise<RawSignal[]> {
    const ids = ibgeIdsDoTerritorio(territory.contextData).slice(0, MAX_MUNICIPIOS);
    const signals: RawSignal[] = [];
    for (const ibge of ids) {
      try {
        signals.push(...(await this.coletarMunicipio(ibge, territory, ids.length > 1, options)));
      } catch (err) {
        this.log.debug({ err: (err as Error).message, ibge }, "Câmara falhou para o município");
      }
    }
    return signals;
  }

  private async coletarMunicipio(
    ibge: string,
    territory: Territory,
    composto: boolean,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    // O nome e a UF vêm do código IBGE (não do nome do território, que pode ser um recorte).
    const ident = await identidadeMunicipio(ibge, options.signal);
    if (!ident) return []; // sem nome oficial não há busca confiável
    const nome = ident.nome;
    const rotulo = composto ? `${nome} (${ident.uf})` : territory.name;

    const desde = new Date(Date.now() - JANELA_DIAS * 86_400_000).toISOString().slice(0, 10);
    const brutos = await buscar(nome, desde, options.signal);
    if (brutos === null) return []; // API fora do ar não prova ausência

    // Homônimo: só se precisar (alguma ementa sem UF). Lista indisponível = tratar como homônimo.
    let homonimo: boolean | null = null;
    const confirmadas: Proposicao[] = [];
    let descartadas = 0;
    for (const b of brutos) {
      let r = conferirEmenta(b.ementa ?? "", nome, ident.uf, false);
      if (r.vale && !r.ufConfirmada) {
        if (homonimo === null) {
          const n = await ufsComNome(nome, options.signal);
          homonimo = n === null ? true : n > 1;
        }
        if (homonimo) r = conferirEmenta(b.ementa ?? "", nome, ident.uf, true);
      }
      if (!r.vale) {
        descartadas++;
        continue;
      }
      const data = b.dataApresentacao ? new Date(`${b.dataApresentacao}:00-03:00`) : null;
      confirmadas.push({
        id: b.id,
        siglaTipo: b.siglaTipo,
        numero: b.numero,
        ano: b.ano,
        ementa: (b.ementa ?? "").replace(/\s+/g, " ").trim(),
        dataApresentacao: data && Number.isFinite(data.getTime()) ? data : null,
        url: urlProposicao(b.id),
      });
    }

    const n = confirmadas.length;
    const porTipo: Record<string, number> = {};
    for (const p of confirmadas) porTipo[p.siglaTipo] = (porTipo[p.siglaTipo] ?? 0) + 1;
    const tiposTxt = Object.entries(porTipo).map(([t, q]) => `${q} ${t}`).join(", ");
    const consulta = urlProposicoes(nome, desde);
    const agora = new Date();
    const score = impactoVisibilidade(n);

    const out: RawSignal[] = [
      {
        title:
          n === 0
            ? `Câmara dos Deputados · ${rotulo}: nenhuma proposição cita o município nos últimos 12 meses`
            : `Câmara dos Deputados · ${rotulo}: ${n} proposição(ões) citam o município nos últimos 12 meses`,
        summary:
          n === 0
            ? `A API de Dados Abertos da Câmara respondeu e não há proposição apresentada desde ${desde} com "${nome}" (${ident.uf}) na ementa. ` +
              `O território não aparece na agenda legislativa federal do período.`
            : `Proposições apresentadas desde ${desde} com "${nome}" (${ident.uf}) na ementa: ${tiposTxt}. ` +
              `Município citado em projeto de parlamentar federal tem visibilidade política nacional.`,
        url: consulta,
        sourceAgentId: this.id,
        publishedAt: agora,
        rawValue: n,
        unit: "proposições",
        metadata: {
          source: "camara-proposicoes",
          indicador: "proposicoes_citando_municipio",
          ibgeId: ibge,
          uf: ident.uf,
          janelaDias: JANELA_DIAS,
          porTipo,
          descartadasPorNomeOuUf: descartadas,
          indicatorCode: IND_VISIBILIDADE,
          impactScore: score,
        },
      },
    ];

    // As 3 mais recentes, cada uma com ementa e link.
    const recentes = [...confirmadas].sort((a, b) => b.id - a.id).slice(0, 3);
    for (const p of recentes) {
      out.push({
        title: `Câmara dos Deputados · ${rotulo}: ${p.siglaTipo} ${p.numero}/${p.ano}, ${p.ementa.slice(0, 120)}`,
        summary: `${p.siglaTipo} ${p.numero}/${p.ano}: ${p.ementa}`,
        url: p.url,
        sourceAgentId: this.id,
        publishedAt: p.dataApresentacao ?? agora,
        metadata: {
          source: "camara-proposicoes",
          indicador: "proposicao_citando_municipio",
          ibgeId: ibge,
          siglaTipo: p.siglaTipo,
          indicatorCode: IND_VISIBILIDADE,
          impactScore: 0.3,
        },
      });
    }
    return out;
  }
}
