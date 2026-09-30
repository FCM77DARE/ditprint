/**
 * src-siconfi · Capacidade fiscal e institucional do município (D5 Governança)
 *
 * Fonte OFICIAL e GRATUITA, sem chave: Siconfi / Tesouro Nacional, API aberta
 *   https://apidatalake.tesouro.gov.br/ords/siconfi/tt/
 *
 * Endpoints usados (todos GET, id_ente = código IBGE de 7 dígitos):
 *  1) dca              DCA-Anexo I-C, receita orçada/realizada por conta.
 *                      Dá receita corrente, transferências correntes, receita
 *                      tributária própria e a população do exercício.
 *  2) rgf              RGF-Anexo 01, despesa total com pessoal sobre a RCL e os
 *                      limites (alerta, prudencial, máximo) da LRF.
 *  3) extrato_entregas situação de entrega das declarações (DCA, RREO, RGF).
 *
 * Sem LLM. Impacto por regra determinística (ver cada função `impacto*`).
 * Falha de rede, timeout ou resposta vazia da API NÃO derruba a malha: o
 * agente devolve só o que conseguiu medir, e nunca inventa valor.
 *
 * Por que D5 precisava disso: a dimensão dependia de busca aberta (SerpAPI,
 * cota zerada). Este agente dá evidência oficial e conferível (cada sinal
 * carrega o link da consulta, o valor bruto, a unidade e o exercício).
 *
 * PROVISÓRIO: os limiares de dependência de transferências e de autonomia
 * tributária abaixo são convenção de trabalho, ainda não auditados pela
 * escola de governança. Os limites de pessoal vêm da própria LRF (arts. 20,
 * 22 e 59) e são lidos da resposta do RGF.
 */

import axios from "axios";
import { BaseSourceAgent } from "../../base-source";
import type { ClassifiedSignal, CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";

const BASE = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const TIMEOUT_MS = 15_000;
/** Recortes compostos (vários municípios): limita o custo de rede. */
const MAX_MUNICIPIOS = 5;
/** Quantos exercícios para trás procurar o último com DCA publicada. */
const EXERCICIOS_TENTADOS = 3;
/** Prazo legal da DCA do exercício anterior: 30 de abril. */
const PRAZO_DCA = { mes: 3, dia: 30 }; // abril, mês 0-indexado = 3

/** Códigos de indicador da D5 (server/indicators.ts) que estes sinais alimentam. */
const IND_CAPACIDADE = "5.1.1"; // capacidade institucional (PROVISÓRIO)
const IND_INFLUENCIA_NEGATIVA = "5.3.2"; // descumprimento documentado do poder público

interface ItemDca {
  instituicao?: string;
  coluna?: string;
  cod_conta?: string;
  valor?: number;
  populacao?: number;
}
interface ItemRgf {
  coluna?: string;
  cod_conta?: string;
  valor?: number;
}
interface ItemEntrega {
  instituicao?: string;
  entregavel?: string;
  periodo?: number;
  periodicidade?: string;
}

// ─── Cache curto (a mesma consulta é repetida por várias dimensões/rodadas) ───

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { ate: number; dados: unknown }>();

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T[] | null> {
  const hit = cache.get(url);
  if (hit && hit.ate > Date.now()) return hit.dados as T[];
  try {
    const res = await axios.get(url, {
      signal,
      timeout: TIMEOUT_MS,
      headers: { "User-Agent": "DIT-PRINT/1.0", Accept: "application/json" },
      validateStatus: (s) => s < 500,
    });
    if (res.status !== 200) return null;
    const items = (res.data as { items?: T[] } | undefined)?.items;
    if (!Array.isArray(items)) return null;
    cache.set(url, { ate: Date.now() + CACHE_TTL_MS, dados: items });
    return items;
  } catch {
    return null; // timeout, DNS, abort: a malha segue sem este dado
  }
}

// ─── Regras de impacto (determinísticas, sem LLM) ─────────────────────────────

/**
 * Dependência de transferências = transferências correntes ÷ receita corrente.
 * Acima de 85% o município praticamente não se sustenta com arrecadação
 * própria: qualquer corte de repasse vira crise de gestão. Alto (0,75) acima
 * de 85%; médio (0,5) entre 70% e 85%; abaixo disso baixo (0,2).
 */
export function impactoDependencia(pct: number): number {
  if (pct > 85) return 0.75;
  if (pct > 70) return 0.5;
  return 0.2;
}

/**
 * Autonomia tributária = receita tributária (impostos, taxas e contribuições
 * de melhoria) ÷ receita corrente. Abaixo de 5% a arrecadação própria é
 * residual: médio (0,5). Caso contrário é só informativo (0,2).
 */
export function impactoAutonomia(pctTributaria: number): number {
  return pctTributaria < 5 ? 0.5 : 0.2;
}

/**
 * Despesa total com pessoal sobre a RCL (LRF). Faixas da própria lei, lidas
 * do RGF: acima do limite prudencial (art. 22) ou do máximo (art. 20) = alto
 * (0,75 / 0,85); acima do limite de alerta (art. 59) = médio (0,5); abaixo =
 * baixo (0,2).
 */
export function impactoPessoal(
  pct: number,
  lim: { alerta: number; prudencial: number; maximo: number }
): number {
  if (pct >= lim.maximo) return 0.85;
  if (pct >= lim.prudencial) return 0.75;
  if (pct >= lim.alerta) return 0.5;
  return 0.2;
}

/**
 * Entrega de declarações. Município que não entrega a DCA depois do prazo
 * legal (30/abr do ano seguinte) = alto (0,8): sem dado oficial não há
 * prestação de contas nem controle social possível. DCA entregue mas RREO
 * (6 bimestres) ou RGF (2 semestres ou 3 quadrimestres) incompletos = médio
 * (0,5). Tudo entregue = baixo (0,1).
 */
export function impactoEntrega(e: { dca: boolean; prazoVencido: boolean; rreoOk: boolean; rgfOk: boolean }): number {
  if (!e.dca && e.prazoVencido) return 0.8;
  if (!e.dca) return 0.5;
  if (!e.rreoOk || !e.rgfOk) return 0.5;
  return 0.1;
}

function nivel(score: number): ClassifiedSignal["impactLevel"] {
  if (score >= 0.7) return "high";
  if (score >= 0.3) return "medium";
  if (score > 0.1) return "low";
  return "negligible";
}

/**
 * Classificação dos sinais do Siconfi. Eles já chegam com indicador e impacto
 * decididos pelas regras acima (em metadata), então a dimensão não precisa
 * casar palavra-chave no texto. Devolve null se o sinal não for do Siconfi.
 */
export function classificarSiconfi(signal: RawSignal): ClassifiedSignal | null {
  if (signal.sourceAgentId !== "src-siconfi") return null;
  const m = signal.metadata ?? {};
  const impactScore = typeof m.impactScore === "number" ? m.impactScore : 0.2;
  const indicatorCode = typeof m.indicatorCode === "string" ? m.indicatorCode : IND_CAPACIDADE;
  return {
    ...signal,
    indicatorCode,
    impactScore,
    impactLevel: nivel(impactScore),
    confidence: 0.9, // dado oficial declarado pelo próprio ente ao Tesouro
    triggersAlert: impactScore >= 0.7,
  };
}

// ─── Consultas ────────────────────────────────────────────────────────────────

export const urlDca = (ibge: string, ano: number) =>
  `${BASE}/dca?an_exercicio=${ano}&no_anexo=${encodeURIComponent("DCA-Anexo I-C")}&id_ente=${ibge}`;

export const urlRgf = (
  ibge: string,
  ano: number,
  periodicidade: "Q" | "S",
  periodo: number,
  tipo: "RGF" | "RGF Simplificado"
) =>
  `${BASE}/rgf?an_exercicio=${ano}&in_periodicidade=${periodicidade}&nr_periodo=${periodo}` +
  `&co_tipo_demonstrativo=${encodeURIComponent(tipo)}&no_anexo=${encodeURIComponent("RGF-Anexo 01")}&co_esfera=M&co_poder=E&id_ente=${ibge}`;

export const urlEntregas = (ibge: string, ano: number) => `${BASE}/extrato_entregas?id_ente=${ibge}&an_referencia=${ano}`;

interface DadosDca {
  ano: number;
  nome: string;
  populacao: number;
  receitaCorrente: number;
  transferenciasCorrentes: number;
  receitaTributaria: number;
  url: string;
}

/** Extrai as contas da DCA. Retorna null se não houver receita corrente. */
export function lerDca(items: ItemDca[], ano: number, url: string): DadosDca | null {
  // Uma DCA pode trazer prefeitura e outras instituições do ente (câmara,
  // RPPS). A conta do município é a da Prefeitura; sem ela, usa o que vier.
  const prefeitura = items.filter((i) => /^prefeitura/i.test(i.instituicao ?? ""));
  const base = prefeitura.length > 0 ? prefeitura : items;
  const realizada = base.filter((i) => i.coluna === "Receitas Brutas Realizadas");
  const conta = (cod: string) => realizada.find((i) => i.cod_conta === cod)?.valor;

  const receitaCorrente = conta("RO1.0.0.0.00.0.0");
  if (typeof receitaCorrente !== "number" || receitaCorrente <= 0) return null;
  const transf = conta("RO1.7.0.0.00.0.0") ?? 0;
  const trib = conta("RO1.1.0.0.00.0.0") ?? 0;
  const pop = base.find((i) => typeof i.populacao === "number")?.populacao ?? 0;
  const nomeBruto = (base[0]?.instituicao ?? "").replace(/^Prefeitura Municipal de /i, "").replace(/\s-\s[A-Z]{2}$/, "");
  return {
    ano,
    nome: nomeBruto,
    populacao: pop,
    receitaCorrente,
    transferenciasCorrentes: transf,
    receitaTributaria: trib,
    url,
  };
}

interface DadosRgf {
  ano: number;
  periodo: string;
  pct: number;
  lim: { alerta: number; prudencial: number; maximo: number };
  url: string;
}

/** Lê o % da despesa total com pessoal sobre a RCL e os limites da LRF. */
export function lerRgf(items: ItemRgf[], ano: number, periodo: string, url: string): DadosRgf | null {
  const pct = (cod: string) =>
    items.find((i) => i.cod_conta === cod && (i.coluna ?? "").startsWith("%"))?.valor;
  const dtp = pct("DespesaComPessoalTotal");
  if (typeof dtp !== "number") return null;
  // Se a API omitir os limites, valem os da LRF para Executivo municipal:
  // máximo 54% (art. 20, III, b), prudencial 95% dele, alerta 90% dele.
  return {
    ano,
    periodo,
    pct: dtp,
    lim: {
      alerta: pct("LimiteDeAlertaDespesaComPessoalTotal") ?? 48.6,
      prudencial: pct("LimitePrudencialDespesaComPessoalTotal") ?? 51.3,
      maximo: pct("LimiteMaximoDespesaComPessoalTotal") ?? 54,
    },
    url,
  };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// ─── Agente ───────────────────────────────────────────────────────────────────

export class SrcSiconfi extends BaseSourceAgent {
  readonly id = "src-siconfi";
  readonly dimension = "D5";
  readonly name = "Siconfi/Tesouro Nacional - Capacidade Fiscal";

  protected async fetchSignals(territory: Territory, options: CollectOptions): Promise<RawSignal[]> {
    const ibgeIds = this.getIbgeIds(territory).slice(0, MAX_MUNICIPIOS);
    if (ibgeIds.length === 0) return [];

    const signals: RawSignal[] = [];
    for (const ibge of ibgeIds) {
      try {
        signals.push(...(await this.coletarMunicipio(ibge, territory, ibgeIds.length > 1, options)));
      } catch (err) {
        // Um município com falha não derruba os outros do recorte.
        this.log.debug({ err: (err as Error).message, ibge }, "Siconfi falhou para o município");
      }
    }
    return signals;
  }

  private getIbgeIds(territory: Territory): string[] {
    const ctx = (territory.contextData ?? null) as Record<string, unknown> | null;
    if (!ctx) return [];
    const lista = ctx.ibgeMunicipios;
    if (Array.isArray(lista) && lista.length > 0) {
      return lista.map((v) => String(v)).filter((v) => /^\d{7}$/.test(v));
    }
    const direto = ctx.ibgeId ?? ctx.ibgeCode;
    const s = direto == null ? "" : String(direto);
    return /^\d{7}$/.test(s) ? [s] : [];
  }

  private async coletarMunicipio(
    ibge: string,
    territory: Territory,
    composto: boolean,
    options: CollectOptions
  ): Promise<RawSignal[]> {
    const anoAtual = new Date().getFullYear();
    const signals: RawSignal[] = [];

    // 1) Último exercício com DCA publicada (tenta ano-1, ano-2, ano-3).
    let dca: DadosDca | null = null;
    let dcaConsultaOk = false; // pelo menos uma consulta respondeu (mesmo vazia)
    for (let k = 1; k <= EXERCICIOS_TENTADOS && !dca; k++) {
      const ano = anoAtual - k;
      const url = urlDca(ibge, ano);
      const items = await getJson<ItemDca>(url, options.signal);
      if (items === null) continue;
      dcaConsultaOk = true;
      dca = lerDca(items, ano, url);
    }

    const nome = composto ? dca?.nome || ibge : territory.name;
    const sufixo = composto ? ` (IBGE ${ibge})` : "";

    if (dca) {
      const ano = dca.ano;
      const refData = new Date(Date.UTC(ano, 11, 31));
      const dep = (dca.transferenciasCorrentes / dca.receitaCorrente) * 100;
      const pctTrib = (dca.receitaTributaria / dca.receitaCorrente) * 100;

      signals.push({
        title: `Siconfi · ${nome}${sufixo}: dependência de transferências de ${num1(dep)}% da receita corrente em ${ano}`,
        summary:
          `Segundo a DCA ${ano} entregue ao Tesouro Nacional, as transferências correntes somaram ${brl(dca.transferenciasCorrentes)} ` +
          `de ${brl(dca.receitaCorrente)} de receita corrente (${num1(dep)}%). Quanto maior a parcela, menor a autonomia de gestão ` +
          `da prefeitura e mais exposta a execução orçamentária fica a repasses de outros entes.`,
        url: dca.url,
        sourceAgentId: this.id,
        publishedAt: refData,
        rawValue: Math.round(dep * 10) / 10,
        unit: "%",
        metadata: {
          structural: true,
          source: "siconfi-dca",
          indicador: "dependencia_transferencias",
          ibgeId: ibge,
          exercicio: ano,
          receitaCorrente: dca.receitaCorrente,
          transferenciasCorrentes: dca.transferenciasCorrentes,
          indicatorCode: IND_CAPACIDADE,
          impactScore: impactoDependencia(dep),
        },
      });

      if (dca.populacao > 0) {
        const perCapita = dca.receitaTributaria / dca.populacao;
        signals.push({
          title: `Siconfi · ${nome}${sufixo}: receita tributária própria de ${brl(perCapita)} por habitante em ${ano}`,
          summary:
            `A DCA ${ano} registra ${brl(dca.receitaTributaria)} em impostos, taxas e contribuições de melhoria ` +
            `para ${dca.populacao.toLocaleString("pt-BR")} habitantes, ${num1(pctTrib)}% da receita corrente. ` +
            `Mede a capacidade do município de arrecadar por conta própria, base da prestação de contas à população.`,
          url: dca.url,
          sourceAgentId: this.id,
          publishedAt: refData,
          rawValue: Math.round(perCapita * 100) / 100,
          unit: "R$/hab",
          metadata: {
            structural: true,
            source: "siconfi-dca",
            indicador: "receita_tributaria_per_capita",
            ibgeId: ibge,
            exercicio: ano,
            populacao: dca.populacao,
            receitaTributaria: dca.receitaTributaria,
            percentualDaReceitaCorrente: Math.round(pctTrib * 10) / 10,
            indicatorCode: IND_CAPACIDADE,
            impactScore: impactoAutonomia(pctTrib),
          },
        });
      }

      // 2) RGF do mesmo exercício: pessoal sobre RCL. Município com menos de
      // 50 mil habitantes pode optar por publicar por semestre, então tenta o
      // 3º quadrimestre e, se vazio, o 2º semestre.
      const rgf = await this.buscarRgf(ibge, ano, options);
      if (rgf) {
        const { pct, lim } = rgf;
        signals.push({
          title: `Siconfi · ${nome}${sufixo}: despesa com pessoal em ${num1(pct)}% da RCL (${rgf.periodo}/${rgf.ano}), limite prudencial ${num1(lim.prudencial)}%`,
          summary:
            `O Relatório de Gestão Fiscal do Executivo aponta despesa total com pessoal de ${num1(pct)}% da receita corrente líquida ajustada. ` +
            `Limites da LRF: alerta ${num1(lim.alerta)}%, prudencial ${num1(lim.prudencial)}%, máximo ${num1(lim.maximo)}%. ` +
            (pct >= lim.prudencial
              ? "O município está acima do limite prudencial, com restrições legais à contratação e à criação de despesa."
              : pct >= lim.alerta
                ? "O município está na faixa de alerta da LRF."
                : "O município está abaixo da faixa de alerta."),
          url: rgf.url,
          sourceAgentId: this.id,
          publishedAt: new Date(Date.UTC(rgf.ano, 11, 31)),
          rawValue: pct,
          unit: "% RCL",
          metadata: {
            structural: true,
            source: "siconfi-rgf",
            indicador: "despesa_pessoal_rcl",
            ibgeId: ibge,
            exercicio: rgf.ano,
            periodo: rgf.periodo,
            limiteAlerta: lim.alerta,
            limitePrudencial: lim.prudencial,
            limiteMaximo: lim.maximo,
            indicatorCode: pct >= lim.prudencial ? IND_INFLUENCIA_NEGATIVA : IND_CAPACIDADE,
            impactScore: impactoPessoal(pct, lim),
          },
        });
      }
    }

    // 3) Situação de entrega do último exercício encerrado. Só afirmamos
    // "não entregou" se a API respondeu (resposta vazia); erro de rede não é
    // evidência de omissão do município.
    const anoRef = anoAtual - 1;
    const urlE = urlEntregas(ibge, anoRef);
    const entregas = await getJson<ItemEntrega>(urlE, options.signal);
    if (entregas !== null && (entregas.length > 0 || dcaConsultaOk)) {
      const sinal = this.sinalEntrega(entregas, anoRef, anoAtual, ibge, nome + sufixo, urlE);
      if (sinal) signals.push(sinal);
    }

    return signals;
  }

  private async buscarRgf(ibge: string, ano: number, options: CollectOptions): Promise<DadosRgf | null> {
    // Município pequeno (abaixo de 50 mil habitantes) publica o RGF
    // Simplificado por semestre; os maiores, o RGF completo por quadrimestre.
    const tentativas: Array<["Q" | "S", number, string, "RGF" | "RGF Simplificado"]> = [
      ["Q", 3, "3º quadrimestre", "RGF"],
      ["S", 2, "2º semestre", "RGF Simplificado"],
      ["S", 2, "2º semestre", "RGF"],
    ];
    for (const [per, nr, rotulo, tipo] of tentativas) {
      const url = urlRgf(ibge, ano, per, nr, tipo);
      const items = await getJson<ItemRgf>(url, options.signal);
      if (!items) continue;
      const r = lerRgf(items, ano, rotulo, url);
      if (r) return r;
    }
    return null;
  }

  private sinalEntrega(
    entregas: ItemEntrega[],
    anoRef: number,
    anoAtual: number,
    ibge: string,
    nome: string,
    url: string
  ): RawSignal | null {
    // Só a Prefeitura: entregas da Câmara não dizem do Executivo.
    const pref = entregas.filter((e) => /^prefeitura/i.test(e.instituicao ?? ""));
    const distintos = (nomeEntregavel: RegExp) =>
      new Set(pref.filter((e) => nomeEntregavel.test(e.entregavel ?? "")).map((e) => `${e.entregavel}|${e.periodo}`)).size;

    // DCA do exercício de referência: o extrato de entregas é a prova. Antes
    // do prazo legal a ausência não é omissão.
    const dcaDoAnoRef = pref.some((e) => /DCA/i.test(e.entregavel ?? ""));
    const rreo = distintos(/Execu[cç][aã]o Or[cç]ament[aá]ria/i);
    const rgf = distintos(/Gest[aã]o Fiscal/i);
    const rreoOk = rreo >= 6;
    const rgfOk = rgf >= 2; // 2 semestres ou 3 quadrimestres (contam períodos distintos)
    const prazoVencido = new Date() > new Date(Date.UTC(anoRef + 1, PRAZO_DCA.mes, PRAZO_DCA.dia));
    const scoreFinal = impactoEntrega({ dca: dcaDoAnoRef, prazoVencido, rreoOk, rgfOk });
    const status = dcaDoAnoRef
      ? rreoOk && rgfOk
        ? "entregou DCA, RREO e RGF"
        : `entregou a DCA, mas com RREO ${rreo}/6 e RGF ${rgf} período(s) no Siconfi`
      : prazoVencido
        ? "não consta a DCA entregue, com o prazo legal de 30 de abril vencido"
        : "DCA ainda dentro do prazo legal";

    return {
      title: `Siconfi · ${nome}: declarações de ${anoRef} ao Tesouro, ${status}`,
      summary:
        `Extrato de entregas do Siconfi para ${anoRef}: DCA ${dcaDoAnoRef ? "entregue" : "não localizada"}, ` +
        `${rreo} de 6 bimestres do RREO e ${rgf} período(s) do RGF registrados para a prefeitura. ` +
        `Município que não entrega as declarações fiscais fica sem prestação de contas verificável (fragilidade institucional).`,
      url,
      sourceAgentId: this.id,
      publishedAt: new Date(Date.UTC(anoAtual, new Date().getUTCMonth(), new Date().getUTCDate())),
      rawValue: dcaDoAnoRef ? (rreoOk && rgfOk ? 1 : 0.5) : 0,
      unit: "entrega",
      metadata: {
        structural: true,
        source: "siconfi-extrato-entregas",
        indicador: "entrega_declaracoes",
        ibgeId: ibge,
        exercicio: anoRef,
        dcaEntregue: dcaDoAnoRef,
        rreoPeriodos: rreo,
        rgfPeriodos: rgf,
        prazoDcaVencido: prazoVencido,
        indicatorCode: scoreFinal >= 0.5 ? IND_INFLUENCIA_NEGATIVA : IND_CAPACIDADE,
        impactScore: scoreFinal,
      },
    };
  }
}
