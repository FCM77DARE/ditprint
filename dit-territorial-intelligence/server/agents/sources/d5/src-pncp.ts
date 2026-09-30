/**
 * src-pncp · Contratações públicas do município (D5 Governança, e D3 por obra)
 *
 * Fonte OFICIAL e GRATUITA, sem chave: PNCP, Portal Nacional de Contratações
 * Públicas (Lei 14.133/2021). API aberta de consulta:
 *   https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao
 *   parâmetros: dataInicial, dataFinal (AAAAMMDD), codigoModalidadeContratacao
 *   (OBRIGATÓRIO, uma modalidade por chamada), codigoMunicipioIbge, pagina,
 *   tamanhoPagina (máximo 50).
 *   Doc: https://pncp.gov.br/api/consulta/swagger-ui/index.html
 *
 * O filtro codigoMunicipioIbge é o município da UNIDADE compradora, então
 * traz também órgãos federais e estaduais sediados na cidade (Marinha, Receita,
 * Justiça). Só entra o que tem esfera M (órgão municipal): é isso que mede a
 * capacidade de execução da prefeitura.
 *
 * Dois agentes saem deste arquivo, com a mesma coleta (cache compartilhado):
 *   SrcPncp       (D5) volume, valor, 3 maiores, peso de dispensa/inexigibilidade
 *   SrcPncpObras  (D3) obras e infraestrutura de grande valor (movimento territorial)
 *
 * Sem LLM. Impacto por regra determinística (ver cada função `impacto*`).
 * Falha de rede, timeout ou limite de requisições (HTTP 429) NÃO derruba a
 * malha: o agente devolve só o que conseguiu medir. Fonte que respondeu e
 * trouxe ZERO contratações conta como evidência (município sem compra
 * publicada); fonte que falhou não afirma nada.
 *
 * PROVISÓRIO: todos os limiares abaixo (contratações por 10 mil habitantes,
 * peso de dispensa, valor de obra grande) são convenção de trabalho, ainda não
 * auditados pela escola de governança. Não vêm de lei nem de norma técnica.
 */

import axios from "axios";
import { BaseSourceAgent } from "../../base-source";
import type { ClassifiedSignal, CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import { identidadeMunicipio, ibgeIdsDoTerritorio } from "../ibge-municipio";

const BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
const TIMEOUT_MS = 12_000;
/** O agente é cortado em 30 s pela BaseSourceAgent; para antes, devolvendo o parcial. */
const ORCAMENTO_MS = 22_000;
/** O PNCP limita requisições (429). Poucas chamadas em paralelo e uma nova tentativa. */
const PARALELO = 3;
const ESPERA_429_MS = 2_000;
const JANELA_DIAS = 90;
const TAMANHO_PAGINA = 50; // máximo aceito pela API
const MAX_PAGINAS_POR_MODALIDADE = 6;
const MAX_MUNICIPIOS = 3;

/** Modalidades do PNCP (manual das APIs de consulta). Ordem: as mais comuns primeiro. */
const MODALIDADES: Array<{ id: number; nome: string }> = [
  { id: 6, nome: "Pregão eletrônico" },
  { id: 8, nome: "Dispensa" },
  { id: 9, nome: "Inexigibilidade" },
  { id: 7, nome: "Pregão presencial" },
  { id: 4, nome: "Concorrência eletrônica" },
  { id: 5, nome: "Concorrência presencial" },
  { id: 12, nome: "Credenciamento" },
  { id: 1, nome: "Leilão eletrônico" },
  { id: 2, nome: "Diálogo competitivo" },
  { id: 3, nome: "Concurso" },
  { id: 10, nome: "Manifestação de interesse" },
  { id: 11, nome: "Pré-qualificação" },
  { id: 13, nome: "Leilão presencial" },
];
const MOD_DIRETA = new Set([8, 9]); // dispensa e inexigibilidade: contratação sem disputa

/** Códigos de indicador (server/indicators.ts). */
const IND_CAPACIDADE = "5.1.1"; // capacidade institucional
const IND_INFLUENCIA_NEGATIVA = "5.3.2"; // descumprimento/fragilidade do poder público
const IND_SANEAMENTO = "3.1.1.1";
const IND_SAUDE = "3.1.2.1";
const IND_EDUCACAO = "3.1.3.1";
const IND_HABITACAO = "3.1.4.1";
const IND_VIARIO = "3.3.2.1"; // acesso a rodovias e malha viária (obra geral cai aqui)

export interface Contratacao {
  id: string; // numeroControlePNCP
  cnpj: string;
  ano: number;
  sequencial: number;
  orgao: string;
  objeto: string;
  valor: number; // valorTotalEstimado; 0 quando sigiloso ou ausente
  modalidadeId: number;
  modalidadeNome: string;
  publicadoEm: Date | null;
  url: string;
}

export interface ColetaPncp {
  ibge: string;
  dataInicial: string;
  dataFinal: string;
  itens: Contratacao[];
  /** Modalidades cuja consulta não respondeu (rede, timeout, 429). */
  falhas: number[];
  /** Modalidades que passaram do teto de páginas: contagem e soma são "ao menos". */
  truncadas: number[];
  /** URL da consulta da modalidade com mais registros, como prova do número. */
  urlPrincipal: string;
  consultas: number;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

function dobrar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function aaaammdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export function urlConsulta(ibge: string, modalidade: number, ini: string, fim: string, pagina: number): string {
  return (
    `${BASE}?dataInicial=${ini}&dataFinal=${fim}&codigoModalidadeContratacao=${modalidade}` +
    `&codigoMunicipioIbge=${ibge}&pagina=${pagina}&tamanhoPagina=${TAMANHO_PAGINA}`
  );
}

export function urlCompra(cnpj: string, ano: number, sequencial: number): string {
  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`;
}

type Resposta = { tipo: "ok"; corpo: any } | { tipo: "vazio" } | { tipo: "falha" };

/** GET tolerante: 204 (nenhum registro) é resposta válida; 429 tenta de novo uma vez. */
async function pegar(url: string, signal: AbortSignal | undefined, limite: number): Promise<Resposta> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    if (Date.now() > limite) return { tipo: "falha" };
    try {
      const res = await axios.get(url, {
        signal,
        timeout: TIMEOUT_MS,
        headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
        validateStatus: (s) => s < 500,
      });
      if (res.status === 204) return { tipo: "vazio" };
      if (res.status === 429) {
        await espera(ESPERA_429_MS);
        continue;
      }
      if (res.status !== 200 || typeof res.data !== "object" || res.data === null) return { tipo: "falha" };
      return { tipo: "ok", corpo: res.data };
    } catch {
      return { tipo: "falha" }; // timeout, DNS, abort: a malha segue sem este dado
    }
  }
  return { tipo: "falha" };
}

/** Converte um registro da API. Devolve null se não for órgão municipal do IBGE pedido. */
export function lerContratacao(r: any, ibge: string): Contratacao | null {
  if (r?.orgaoEntidade?.esferaId !== "M") return null;
  if (String(r?.unidadeOrgao?.codigoIbge ?? "") !== ibge) return null;
  const cnpj = String(r?.orgaoEntidade?.cnpj ?? "");
  const ano = Number(r?.anoCompra);
  const sequencial = Number(r?.sequencialCompra);
  if (!cnpj || !Number.isFinite(ano) || !Number.isFinite(sequencial)) return null;
  const valor = Number(r?.valorTotalEstimado);
  const data = r?.dataPublicacaoPncp ? new Date(`${r.dataPublicacaoPncp}Z`) : null;
  return {
    id: String(r?.numeroControlePNCP ?? `${cnpj}-${ano}-${sequencial}`),
    cnpj,
    ano,
    sequencial,
    orgao: String(r?.orgaoEntidade?.razaoSocial ?? ""),
    objeto: String(r?.objetoCompra ?? "").replace(/\s+/g, " ").trim(),
    valor: Number.isFinite(valor) && valor > 0 ? valor : 0,
    modalidadeId: Number(r?.modalidadeId),
    modalidadeNome: String(r?.modalidadeNome ?? ""),
    publicadoEm: data && Number.isFinite(data.getTime()) ? data : null,
    url: urlCompra(cnpj, ano, sequencial),
  };
}

// ─── Coleta compartilhada (D5 e D3 usam a mesma, com cache) ──────────────────

const CACHE_OK_MS = 6 * 60 * 60 * 1000;
const CACHE_FALHA_MS = 10 * 60 * 1000;
const cache = new Map<string, { ate: number; p: Promise<ColetaPncp> }>();

export function coletarPncp(ibge: string, signal?: AbortSignal, agora = new Date()): Promise<ColetaPncp> {
  const fim = aaaammdd(agora);
  const ini = aaaammdd(new Date(agora.getTime() - JANELA_DIAS * 86_400_000));
  const chave = `${ibge}|${ini}|${fim}`;
  const hit = cache.get(chave);
  if (hit && hit.ate > Date.now()) return hit.p;
  const p = executarColeta(ibge, ini, fim, signal);
  cache.set(chave, { ate: Date.now() + CACHE_FALHA_MS, p });
  p.then((c) => {
    if (c.falhas.length === 0) cache.set(chave, { ate: Date.now() + CACHE_OK_MS, p });
  });
  return p;
}

async function executarColeta(ibge: string, ini: string, fim: string, signal?: AbortSignal): Promise<ColetaPncp> {
  const limite = Date.now() + ORCAMENTO_MS;
  const itens = new Map<string, Contratacao>();
  const falhas: number[] = [];
  const truncadas: number[] = [];
  let consultas = 0;
  let principal = { total: -1, url: urlConsulta(ibge, 6, ini, fim, 1) };

  async function modalidade(id: number) {
    for (let pagina = 1; pagina <= MAX_PAGINAS_POR_MODALIDADE; pagina++) {
      const url = urlConsulta(ibge, id, ini, fim, pagina);
      consultas++;
      const r = await pegar(url, signal, limite);
      if (r.tipo === "falha") {
        falhas.push(id);
        return;
      }
      if (r.tipo === "vazio") return;
      const dados: any[] = Array.isArray(r.corpo.data) ? r.corpo.data : [];
      const total = Number(r.corpo.totalRegistros) || 0;
      if (pagina === 1 && total > principal.total) principal = { total, url };
      for (const d of dados) {
        const c = lerContratacao(d, ibge);
        if (c) itens.set(c.id, c);
      }
      const totalPaginas = Number(r.corpo.totalPaginas) || 1;
      if (pagina >= totalPaginas) return;
      if (pagina === MAX_PAGINAS_POR_MODALIDADE) truncadas.push(id);
    }
  }

  const fila = MODALIDADES.map((m) => m.id);
  const operarios = Array.from({ length: PARALELO }, async () => {
    for (let id = fila.shift(); id !== undefined; id = fila.shift()) await modalidade(id);
  });
  await Promise.all(operarios);

  return {
    ibge,
    dataInicial: ini,
    dataFinal: fim,
    itens: Array.from(itens.values()),
    falhas,
    truncadas,
    urlPrincipal: principal.url,
    consultas,
  };
}

// ─── Regras de impacto (determinísticas, sem LLM) ─────────────────────────────

/**
 * Volume de contratações publicadas em 90 dias. A prefeitura é obrigada a
 * publicar no PNCP (Lei 14.133); publicar pouco sugere pouca execução ou
 * pouca transparência. Compara por habitante (contratações por 10 mil hab.):
 * zero = 0,6 (município sem nenhuma compra publicada); abaixo de 2 = 0,5;
 * abaixo de 5 = 0,3; acima disso 0,15. Sem população conhecida, faixas
 * absolutas: menos de 10 = 0,4; menos de 30 = 0,25; senão 0,15.
 */
export function impactoVolume(n: number, populacao: number): number {
  if (n === 0) return 0.6;
  if (populacao > 0) {
    const taxa = (n / populacao) * 10_000;
    if (taxa < 2) return 0.5;
    if (taxa < 5) return 0.3;
    return 0.15;
  }
  if (n < 10) return 0.4;
  if (n < 30) return 0.25;
  return 0.15;
}

/**
 * Peso da contratação sem disputa (dispensa + inexigibilidade) sobre o total de
 * contratações. Só pontua com amostra de 10 ou mais; abaixo disso é ruído.
 * Acima de 80% = 0,65 (quase tudo sem concorrência); acima de 60% = 0,5;
 * senão 0,2.
 */
export function impactoDispensa(share: number, n: number): number {
  if (n < 10) return 0.2;
  if (share > 0.8) return 0.65;
  if (share > 0.6) return 0.5;
  return 0.2;
}

/**
 * Obra de grande valor = movimento territorial. Estimado de R$ 10 milhões ou
 * mais = 0,75; de R$ 1 milhão a R$ 10 milhões = 0,5; de R$ 300 mil a R$ 1
 * milhão = 0,3. Abaixo de R$ 300 mil não é obra relevante para o território.
 */
export function impactoObra(valor: number): number {
  if (valor >= 10_000_000) return 0.75;
  if (valor >= 1_000_000) return 0.5;
  if (valor >= 300_000) return 0.3;
  return 0;
}

const VALOR_MINIMO_OBRA = 300_000;

const RE_OBRA =
  /\b(obras?|construcao|reforma|ampliacao|pavimentacao|drenagem|saneamento|esgot\w*|engenharia|urbaniza\w*|recapeamento|galeria|contencao|terraplenagem)\b/;

/** Indicador de D3 conforme o objeto (ordem importa: o primeiro que casar vence). */
export function indicadorDeObra(objeto: string): string {
  const t = dobrar(objeto);
  if (/\b(saneamento|esgot\w*|agua|abastecimento|drenagem)\b/.test(t)) return IND_SANEAMENTO;
  if (/\b(habitac\w*|moradia\w*|residencial\w*|casas? populares?)\b/.test(t)) return IND_HABITACAO;
  if (/\b(escola\w*|creche\w*|educacao|colegio)\b/.test(t)) return IND_EDUCACAO;
  if (/\b(ubs|hospital\w*|saude|upa|posto de saude|policlinica)\b/.test(t)) return IND_SAUDE;
  return IND_VIARIO;
}

export function ehObra(objeto: string): boolean {
  return RE_OBRA.test(dobrar(objeto));
}

function nivel(score: number): ClassifiedSignal["impactLevel"] {
  if (score >= 0.7) return "high";
  if (score >= 0.3) return "medium";
  if (score > 0.1) return "low";
  return "negligible";
}

/**
 * Classificação dos sinais do PNCP. Chegam com indicador e impacto decididos
 * pelas regras acima (em metadata). Devolve null se o sinal não for do PNCP.
 */
export function classificarPncp(signal: RawSignal): ClassifiedSignal | null {
  if (signal.sourceAgentId !== "src-pncp" && signal.sourceAgentId !== "src-pncp-obras") return null;
  const m = signal.metadata ?? {};
  const impactScore = typeof m.impactScore === "number" ? m.impactScore : 0.2;
  const indicatorCode = typeof m.indicatorCode === "string" ? m.indicatorCode : IND_CAPACIDADE;
  return {
    ...signal,
    indicatorCode,
    impactScore,
    impactLevel: nivel(impactScore),
    confidence: 0.9, // dado oficial publicado pelo próprio órgão contratante
    triggersAlert: impactScore >= 0.7,
  };
}

// ─── Agentes ──────────────────────────────────────────────────────────────────

export interface Alvo {
  ibge: string;
  nome: string;
  sufixo: string;
  populacao: number;
}

async function alvos(territory: Territory, signal?: AbortSignal): Promise<Alvo[]> {
  const ids = ibgeIdsDoTerritorio(territory.contextData).slice(0, MAX_MUNICIPIOS);
  const composto = ids.length > 1;
  const out: Alvo[] = [];
  for (const ibge of ids) {
    const id = await identidadeMunicipio(ibge, signal);
    out.push({
      ibge,
      nome: composto ? id?.nome || ibge : territory.name,
      sufixo: composto ? ` (IBGE ${ibge})` : "",
      populacao: id?.populacao ?? 0,
    });
  }
  return out;
}

export class SrcPncp extends BaseSourceAgent {
  readonly id = "src-pncp";
  readonly dimension = "D5";
  readonly name = "PNCP - Contratações Públicas (Capacidade de Execução)";

  protected async fetchSignals(territory: Territory, options: CollectOptions): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    for (const alvo of await alvos(territory, options.signal)) {
      try {
        const coleta = await coletarPncp(alvo.ibge, options.signal);
        signals.push(...this.sinais(alvo, coleta));
      } catch (err) {
        this.log.debug({ err: (err as Error).message, ibge: alvo.ibge }, "PNCP falhou para o município");
      }
    }
    return signals;
  }

  sinais(alvo: Alvo, c: ColetaPncp): RawSignal[] {
    const out: RawSignal[] = [];
    const n = c.itens.length;
    const conclusiva = c.falhas.length === 0; // todas as modalidades responderam
    // Sem resposta completa e sem nenhum item, não há o que afirmar.
    if (!conclusiva && n === 0) return out;

    const aoMenos = !conclusiva || c.truncadas.length > 0;
    const soma = c.itens.reduce((a, i) => a + i.valor, 0);
    const nome = alvo.nome + alvo.sufixo;
    const periodo = `${c.dataInicial.slice(6)}/${c.dataInicial.slice(4, 6)}/${c.dataInicial.slice(0, 4)} a ${c.dataFinal.slice(6)}/${c.dataFinal.slice(4, 6)}/${c.dataFinal.slice(0, 4)}`;
    const agora = new Date();
    const parcialTxt = aoMenos ? " Contagem parcial (ao menos): parte das consultas não respondeu ou passou do teto de páginas." : "";

    // 1) Volume e valor.
    const taxa = alvo.populacao > 0 ? (n / alvo.populacao) * 10_000 : null;
    out.push({
      title:
        n === 0
          ? `PNCP · ${nome}: nenhuma contratação municipal publicada em ${JANELA_DIAS} dias`
          : `PNCP · ${nome}: ${aoMenos ? "ao menos " : ""}${n} contratações municipais publicadas em ${JANELA_DIAS} dias, ${brl(soma)} estimados`,
      summary:
        `Consulta ao Portal Nacional de Contratações Públicas (${periodo}): ${n} contratações de órgãos municipais, ` +
        `valor total estimado de ${brl(soma)}` +
        (taxa !== null ? `, ${num1(taxa)} por 10 mil habitantes` : "") +
        `. A Lei 14.133 obriga a prefeitura a publicar suas contratações no PNCP; o volume mede a atividade de execução do poder público.` +
        parcialTxt,
      url: c.urlPrincipal,
      sourceAgentId: this.id,
      publishedAt: agora,
      rawValue: n,
      unit: "contratações",
      metadata: {
        source: "pncp-contratacoes",
        indicador: "volume_contratacoes",
        ibgeId: alvo.ibge,
        janelaDias: JANELA_DIAS,
        valorTotalEstimado: Math.round(soma),
        porDezMilHab: taxa === null ? null : Math.round(taxa * 10) / 10,
        parcial: aoMenos,
        modalidadesSemResposta: c.falhas,
        indicatorCode: IND_CAPACIDADE,
        impactScore: impactoVolume(n, alvo.populacao),
      },
    });

    if (n === 0) return out;

    // 2) As 3 maiores por valor, cada uma com objeto e link.
    const maiores = [...c.itens].filter((i) => i.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 3);
    maiores.forEach((i, pos) => {
      out.push({
        title: `PNCP · ${nome}: ${pos + 1}ª maior contratação em ${JANELA_DIAS} dias, ${brl(i.valor)} (${i.modalidadeNome}), ${i.objeto.slice(0, 110)}`,
        summary:
          `${i.orgao} publicou no PNCP a contratação "${i.objeto}" por ${i.modalidadeNome}, valor estimado de ${brl(i.valor)}. ` +
          `É a ${pos + 1}ª maior entre as ${n} contratações municipais do período.`,
        url: i.url,
        sourceAgentId: this.id,
        publishedAt: i.publicadoEm ?? agora,
        rawValue: Math.round(i.valor),
        unit: "R$",
        metadata: {
          source: "pncp-contratacoes",
          indicador: "maiores_contratacoes",
          ibgeId: alvo.ibge,
          posicao: pos + 1,
          modalidade: i.modalidadeNome,
          orgao: i.orgao,
          numeroControlePNCP: i.id,
          indicatorCode: IND_CAPACIDADE,
          impactScore: 0.2, // informativo: o peso vem do volume e da dispensa
        },
      });
    });

    // 3) Peso da contratação sem disputa (só com todas as modalidades lidas).
    if (conclusiva) {
      const diretas = c.itens.filter((i) => MOD_DIRETA.has(i.modalidadeId));
      const share = diretas.length / n;
      const valorDireto = diretas.reduce((a, i) => a + i.valor, 0);
      const score = impactoDispensa(share, n);
      out.push({
        title: `PNCP · ${nome}: ${num1(share * 100)}% das contratações em ${JANELA_DIAS} dias foram dispensa ou inexigibilidade (${diretas.length} de ${n})`,
        summary:
          `Das ${n} contratações municipais publicadas no PNCP (${periodo}), ${diretas.length} foram por dispensa ou inexigibilidade ` +
          `(${brl(valorDireto)} estimados), sem disputa entre fornecedores. ` +
          (n < 10 ? "Amostra pequena (menos de 10 contratações), sem peso de alerta." : "Proporção alta sinaliza atenção de controle, não irregularidade por si só."),
        url: c.urlPrincipal,
        sourceAgentId: this.id,
        publishedAt: agora,
        rawValue: Math.round(share * 1000) / 10,
        unit: "% sem disputa",
        metadata: {
          source: "pncp-contratacoes",
          indicador: "peso_dispensa_inexigibilidade",
          ibgeId: alvo.ibge,
          dispensaInexigibilidade: diretas.length,
          totalContratacoes: n,
          valorSemDisputa: Math.round(valorDireto),
          indicatorCode: score >= 0.5 ? IND_INFLUENCIA_NEGATIVA : IND_CAPACIDADE,
          impactScore: score,
        },
      });
    }
    return out;
  }
}

/** Mesma coleta do SrcPncp, lida pela ótica de D3: obra e infraestrutura contratadas. */
export class SrcPncpObras extends BaseSourceAgent {
  readonly id = "src-pncp-obras";
  readonly dimension = "D3";
  readonly name = "PNCP - Obras e Infraestrutura Contratadas";

  protected async fetchSignals(territory: Territory, options: CollectOptions): Promise<RawSignal[]> {
    const signals: RawSignal[] = [];
    for (const alvo of await alvos(territory, options.signal)) {
      try {
        const coleta = await coletarPncp(alvo.ibge, options.signal);
        signals.push(...this.sinais(alvo, coleta));
      } catch (err) {
        this.log.debug({ err: (err as Error).message, ibge: alvo.ibge }, "PNCP obras falhou para o município");
      }
    }
    return signals;
  }

  sinais(alvo: Alvo, c: ColetaPncp): RawSignal[] {
    const conclusiva = c.falhas.length === 0;
    const obras = c.itens.filter((i) => ehObra(i.objeto) && i.valor >= VALOR_MINIMO_OBRA).sort((a, b) => b.valor - a.valor);
    // Falha parcial sem nenhuma obra achada não prova ausência.
    if (obras.length === 0 && !conclusiva) return [];
    const nome = alvo.nome + alvo.sufixo;
    const agora = new Date();

    if (obras.length === 0) {
      return [
        {
          title: `PNCP · ${nome}: nenhuma obra ou infraestrutura acima de ${brl(VALOR_MINIMO_OBRA)} contratada em ${JANELA_DIAS} dias`,
          summary:
            `O PNCP respondeu a todas as modalidades e não há contratação municipal de obra ou infraestrutura de valor relevante ` +
            `(mínimo ${brl(VALOR_MINIMO_OBRA)}) nos últimos ${JANELA_DIAS} dias, entre ${c.itens.length} contratações do município.`,
          url: c.urlPrincipal,
          sourceAgentId: this.id,
          publishedAt: agora,
          rawValue: 0,
          unit: "obras",
          metadata: {
            source: "pncp-obras",
            indicador: "obras_contratadas",
            ibgeId: alvo.ibge,
            totalContratacoes: c.itens.length,
            indicatorCode: IND_VIARIO,
            impactScore: 0.1,
          },
        },
      ];
    }

    return obras.slice(0, 3).map((o, pos) => ({
      title: `PNCP · ${nome}: obra de ${brl(o.valor)} contratada (${o.modalidadeNome}), ${o.objeto.slice(0, 120)}`,
      summary:
        `${o.orgao} publicou no PNCP a contratação "${o.objeto}" por ${o.modalidadeNome}, valor estimado de ${brl(o.valor)}. ` +
        `Obra de grande valor indica intervenção física prevista no território (${obras.length} obra(s) acima de ${brl(VALOR_MINIMO_OBRA)} em ${JANELA_DIAS} dias).`,
      url: o.url,
      sourceAgentId: this.id,
      publishedAt: o.publicadoEm ?? agora,
      rawValue: Math.round(o.valor),
      unit: "R$",
      metadata: {
        source: "pncp-obras",
        indicador: "obras_contratadas",
        ibgeId: alvo.ibge,
        posicao: pos + 1,
        totalObras: obras.length,
        modalidade: o.modalidadeNome,
        orgao: o.orgao,
        numeroControlePNCP: o.id,
        indicatorCode: indicadorDeObra(o.objeto),
        impactScore: impactoObra(o.valor),
      },
    }));
  }
}
