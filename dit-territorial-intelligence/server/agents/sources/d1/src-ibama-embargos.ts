/**
 * src-ibama-embargos — IBAMA · Termos de Embargo (dado aberto oficial)
 *
 * Fonte: Dados Abertos do IBAMA, conjunto "Fiscalização - Termo de Embargo",
 * arquivo nacional CSV (~170 MB, atualizado pelo órgão):
 *   https://dadosabertos.ibama.gov.br/dados/SIFISC/termo_embargo/termo_embargo/termo_embargo.csv
 * Gratuito, sem chave. O link antigo do blob do Azure listado no CKAN responde
 * 404; este caminho é o que funciona (verificado em 30/09/2026).
 *
 * COMO FUNCIONA
 *  - Baixa o CSV uma vez, reduz a um índice por município (código IBGE) e grava
 *    em DATA_DIR/d1-oficial/ibama-embargos.json por 30 dias (ver oficial-util).
 *  - Só conta termo VÁLIDO: status "Lavrado" e não cancelado. Cancelado, excluído
 *    e substituído não são embargo em vigor nem fato novo.
 *  - Filtra pelo código IBGE (COD_MUNICIPIO); sem código, resolve nome + UF.
 *
 * REGRA DE IMPACTO (determinística, sem LLM)
 *  - Nenhum embargo válido no município: impacto 0,10. É medição de baixa tensão
 *    feita pela fonte oficial e conta como evidência resolutiva.
 *  - Só embargos antigos (nenhum nos últimos 24 meses): impacto 0,25. Fica abaixo
 *    do corte de 0,30 do score: informa, não tensiona.
 *  - Embargo recente (últimos 24 meses): 0,45 + 0,08 por embargo (máx. 5), e
 *    +0,10 se algum tiver menos de 6 meses (recência pesa mais), +0,10 se a área
 *    embargada recente somar 100 ha ou mais. Teto 0,85. Com 4 ou mais embargos
 *    recentes passa de 0,70 e dispara alerta.
 */

import { BaseSourceAgent } from "../../base-source";
import type { CollectOptions, RawSignal } from "../../types";
import type { Territory } from "../../../../drizzle/schema";
import type { DimensionId, SourceId } from "../../../indicators";
import { dobrar } from "../../verificador";
import {
  OFICIAL_DIR,
  baixarParaArquivo,
  fmtData,
  lerCsv,
  lerData,
  mesesAtras,
  obterIndice,
  resolverIbge,
  type IndiceEmDisco,
} from "./oficial-util";
import { join } from "node:path";

export const URL_EMBARGOS_CSV =
  "https://dadosabertos.ibama.gov.br/dados/SIFISC/termo_embargo/termo_embargo/termo_embargo.csv";
const URL_CONJUNTO = "https://dadosabertos.ibama.gov.br/dataset/fiscalizacao-termo-de-embargo";

/** Embargo reduzido: [data ISO AAAA-MM-DD ou "", área em ha, desembargado 0|1] */
type Embargo = [string, number, 0 | 1];
interface IndiceEmbargos {
  /** código IBGE 7 dígitos → embargos válidos */
  porMunicipio: Record<string, Embargo[]>;
  /** "nome normalizado|UF" → código IBGE (para território sem código) */
  nomes: Record<string, string>;
  totalLinhas: number;
  totalValidos: number;
}

function numero(v: string): number {
  const n = parseFloat((v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Baixa o CSV nacional e reduz a índice por município. Demora minutos. */
export async function construirIndiceEmbargos(): Promise<IndiceEmDisco<IndiceEmbargos>> {
  const arquivo = join(OFICIAL_DIR, "ibama-embargos.csv");
  await baixarParaArquivo(URL_EMBARGOS_CSV, arquivo);

  const dados: IndiceEmbargos = { porMunicipio: {}, nomes: {}, totalLinhas: 0, totalValidos: 0 };
  let col: Record<string, number> | null = null;
  for await (const r of lerCsv(arquivo, "utf-8")) {
    if (!col) {
      col = {};
      r.forEach((nome, i) => (col![nome.trim()] = i));
      for (const k of ["COD_MUNICIPIO", "DAT_EMBARGO", "SIT_CANCELADO", "DES_STATUS_FORMULARIO"]) {
        if (col[k] === undefined) throw new Error(`CSV de embargos sem a coluna ${k}: layout mudou`);
      }
      continue;
    }
    dados.totalLinhas++;
    const status = (r[col.DES_STATUS_FORMULARIO] ?? "").trim();
    if (status !== "Lavrado" || (r[col.SIT_CANCELADO] ?? "").trim() === "S") continue;
    const cod = (r[col.COD_MUNICIPIO] ?? "").trim();
    if (!/^\d{7}$/.test(cod)) continue;
    const data = lerData(r[col.DAT_EMBARGO] ?? "");
    const desembargado = (r[col.SIT_DESEMBARGO] ?? "").trim() === "S" ? 1 : 0;
    (dados.porMunicipio[cod] ??= []).push([
      data ? data.toISOString().slice(0, 10) : "",
      Math.round(numero(r[col.QTD_AREA_EMBARGADA] ?? "") * 100) / 100,
      desembargado,
    ]);
    dados.totalValidos++;
    const nome = (r[col.MUNICIPIO] ?? "").trim();
    const uf = (r[col.UF] ?? "").trim();
    if (nome && uf) dados.nomes[`${dobrar(nome)}|${uf}`] = cod;
  }
  return { geradoEm: new Date().toISOString(), fonteUrl: URL_EMBARGOS_CSV, dados };
}

/** Regra de impacto documentada no cabeçalho. Exposta para teste. */
export function impactoEmbargos(recentes: number, recentesSeisMeses: number, areaRecenteHa: number, total: number): number {
  if (total === 0) return 0.1;
  if (recentes === 0) return 0.25;
  let v = 0.45 + 0.08 * Math.min(recentes, 5);
  if (recentesSeisMeses > 0) v += 0.1;
  if (areaRecenteHa >= 100) v += 0.1;
  return Math.min(0.85, Math.round(v * 100) / 100);
}

export class SrcIbamaEmbargos extends BaseSourceAgent {
  readonly id: SourceId = "src-ibama-embargos";
  readonly dimension: DimensionId = "D1";
  readonly name = "IBAMA · Termos de Embargo (dado aberto oficial)";

  protected async fetchSignals(territory: Territory, options: CollectOptions): Promise<RawSignal[]> {
    const pronto = await obterIndice("ibama-embargos", construirIndiceEmbargos);
    if (!pronto) {
      this.log.info({ territory: territory.slug }, "Índice de embargos do IBAMA ainda em construção; sem sinal nesta coleta");
      return [];
    }
    const { indice, defasado } = pronto;
    const dados = indice.dados;

    let cod = await resolverIbge(territory, options.signal);
    if (!cod) {
      const uf = String(((territory.contextData ?? {}) as Record<string, unknown>).uf ?? territory.state ?? "").toUpperCase();
      cod = dados.nomes[`${dobrar(territory.name)}|${uf}`] ?? null;
    }
    if (!cod) return [];

    const lista = dados.porMunicipio[cod] ?? [];
    const corte24 = mesesAtras(24);
    const corte6 = mesesAtras(6);
    let recentes = 0;
    let recentes6 = 0;
    let areaTotal = 0;
    let areaRecente = 0;
    let semData = 0;
    let ultimo: string | null = null;
    for (const [data, area] of lista) {
      areaTotal += area;
      if (!data) {
        semData++;
        continue;
      }
      if (!ultimo || data > ultimo) ultimo = data;
      const t = Date.parse(data);
      if (t >= corte24) {
        recentes++;
        areaRecente += area;
        if (t >= corte6) recentes6++;
      }
    }

    const total = lista.length;
    const impacto = impactoEmbargos(recentes, recentes6, areaRecente, total);
    const ha = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha`;
    const consulta = `IBAMA/dados abertos/termo_embargo.csv · COD_MUNICIPIO=${cod} · base de ${fmtData(indice.geradoEm)}${defasado ? " (defasada)" : ""}`;

    let title: string;
    let summary: string;
    if (total === 0) {
      title = `IBAMA · Nenhum embargo registrado em ${territory.name}`;
      summary =
        `A base oficial de Termos de Embargo do IBAMA (${dados.totalValidos.toLocaleString("pt-BR")} termos válidos no país) ` +
        `não tem nenhum embargo em vigor para o município. Consulta ao registro oficial, sem ocorrência: baixa tensão na fiscalização ambiental.`;
    } else if (recentes === 0) {
      title = `IBAMA · ${total} embargo${total > 1 ? "s" : ""} antigo${total > 1 ? "s" : ""} em ${territory.name}, nenhum nos últimos 24 meses`;
      summary =
        `Termos de Embargo do IBAMA no município: ${total} no total (${ha(areaTotal)} embargados)` +
        (ultimo ? `, o mais recente em ${fmtData(ultimo)}` : "") +
        `. Nenhum nos últimos 24 meses.`;
    } else {
      title = `IBAMA · ${recentes} embargo${recentes > 1 ? "s" : ""} ${recentes > 1 ? "ambientais" : "ambiental"} nos últimos 24 meses em ${territory.name}`;
      summary =
        `Termos de Embargo do IBAMA no município: ${recentes} nos últimos 24 meses (${ha(areaRecente)} embargados)` +
        `${recentes6 > 0 ? `, ${recentes6} nos últimos 6 meses` : ""}; ${total} no total (${ha(areaTotal)})` +
        (ultimo ? `; o mais recente em ${fmtData(ultimo)}` : "") +
        `. Fiscalização ambiental com embargo recente.`;
    }

    return [
      {
        title,
        summary,
        // Fragmento com mês e município: o armazenamento deduplica por URL, e a
        // contagem precisa ser renovada a cada mês em vez de congelar na primeira.
        url: `${URL_CONJUNTO}#${new Date().toISOString().slice(0, 7)}-${cod}`,
        provenance: consulta,
        sourceAgentId: this.id,
        // Data da consulta: o fato (ausência ou contagem) vale hoje. As datas dos
        // embargos ficam em metadata; o verificador trata a fonte como ancorada
        // e o histórico aplica o decaimento normal, então a contagem se renova.
        publishedAt: new Date(),
        rawValue: recentes,
        unit: "embargos (24 meses)",
        impactHint: impacto,
        metadata: {
          evidenciaOficial: true,
          ibgeId: cod,
          totalEmbargos: total,
          embargosUltimos24Meses: recentes,
          embargosUltimos6Meses: recentes6,
          areaEmbargadaTotalHa: Math.round(areaTotal * 10) / 10,
          areaEmbargadaUltimos24MesesHa: Math.round(areaRecente * 10) / 10,
          embargoMaisRecente: ultimo,
          embargosSemData: semData,
          baseGeradaEm: indice.geradoEm,
          baseDefasada: defasado,
          endpoint: URL_EMBARGOS_CSV,
          source: "ibama-dados-abertos-termo-embargo",
        },
      },
    ];
  }
}
