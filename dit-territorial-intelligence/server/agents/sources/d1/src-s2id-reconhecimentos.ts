/**
 * src-s2id-reconhecimentos — S2iD · reconhecimento federal de desastres
 *
 * Fonte: Portal de Dados Abertos do MIDR (Ministério da Integração e do
 * Desenvolvimento Regional), conjunto "Sistema Integrado de Informações sobre
 * Desastres (S2ID) - Dados Informados", CSV nacional 1991 a 2025 (~86 MB), uma
 * linha por ocorrência, com código IBGE do município, tipologia COBRADE e
 * `Status` = "Reconhecido" (reconhecimento federal de situação de emergência ou
 * calamidade pública) ou "Registro" (ocorrência informada, sem reconhecimento):
 *   https://dadosabertos.mdr.gov.br/dataset/s2id_sedec
 *   (recurso 1c8aac93-f874-4f07-9405-86a0398dadd6, caminho /download)
 *
 * ATENÇÃO AO LINK: o WAF do portal recusa qualquer caminho terminado em
 * ".csv" minúsculo (até no navegador). A URL sem o nome do arquivo, terminando
 * em /download, responde normalmente. É o que este agente usa.
 *
 * COMO FUNCIONA
 *  - Baixa o CSV uma vez, reduz a índice por município e cacheia 30 dias.
 *  - Janela: ocorrências com data do evento nos últimos 5 anos. A base consolidada
 *    termina na data da última ocorrência; ela vai no resumo para o leitor saber.
 *
 * REGRA DE IMPACTO (determinística, sem LLM)
 *  - Nenhum reconhecimento federal em 5 anos: 0,10. Se houve ocorrência só
 *    registrada, sem reconhecimento: 0,20. Ambos abaixo do corte de 0,30 do
 *    score e contam como evidência resolutiva de baixa tensão.
 *  - Com reconhecimento: 0,35 + 0,10 por reconhecimento (máx. 4), +0,10 se o
 *    último foi há menos de 24 meses. Teto 0,85. Com 3 reconhecimentos
 *    recentes ou 4 no total passa de 0,70 e dispara alerta.
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

export const URL_S2ID_CSV =
  "https://dadosabertos.mdr.gov.br/dataset/1aabd419-5677-4fa2-a0e3-a1a3e1a42234/resource/1c8aac93-f874-4f07-9405-86a0398dadd6/download";
const URL_CONJUNTO = "https://dadosabertos.mdr.gov.br/dataset/s2id_sedec";

/** Ocorrência reduzida: [data do evento ISO, código COBRADE, reconhecido 0|1, mortos] */
type Ocorrencia = [string, string, 0 | 1, number];
interface IndiceS2id {
  porMunicipio: Record<string, Ocorrencia[]>;
  /** código COBRADE → descrição da tipologia */
  tipologias: Record<string, string>;
  /** "nome normalizado|UF" → código IBGE */
  nomes: Record<string, string>;
  totalLinhas: number;
  /** data da última ocorrência da base (ISO) */
  baseAte: string;
}

export async function construirIndiceS2id(): Promise<IndiceEmDisco<IndiceS2id>> {
  const arquivo = join(OFICIAL_DIR, "s2id-danos-informados.csv");
  await baixarParaArquivo(URL_S2ID_CSV, arquivo);

  const dados: IndiceS2id = { porMunicipio: {}, tipologias: {}, nomes: {}, totalLinhas: 0, baseAte: "" };
  let col: Record<string, number> | null = null;
  // O arquivo do MIDR vem em Windows-1252.
  for await (const r of lerCsv(arquivo, "windows-1252")) {
    if (!col) {
      col = {};
      r.forEach((nome, i) => (col![nome.trim()] = i));
      for (const k of ["Cod_IBGE_Mun", "Data_Evento", "Cod_Cobrade", "Status", "Nome_Municipio", "Sigla_UF"]) {
        if (col[k] === undefined) throw new Error(`CSV do S2iD sem a coluna ${k}: layout mudou`);
      }
      continue;
    }
    dados.totalLinhas++;
    const cod = (r[col.Cod_IBGE_Mun] ?? "").trim();
    if (!/^\d{7}$/.test(cod)) continue;
    const data = lerData(r[col.Data_Evento] ?? "");
    if (!data) continue;
    const iso = data.toISOString().slice(0, 10);
    if (iso > dados.baseAte) dados.baseAte = iso;
    const cobrade = (r[col.Cod_Cobrade] ?? "").trim();
    const status = (r[col.Status] ?? "").trim();
    const mortos = parseInt((r[col["DH_MORTOS"]] ?? "0").trim(), 10) || 0;
    if (cobrade && !dados.tipologias[cobrade]) dados.tipologias[cobrade] = (r[col.descricao_tipologia] ?? "").trim();
    (dados.porMunicipio[cod] ??= []).push([iso, cobrade, status === "Reconhecido" ? 1 : 0, mortos]);
    const nome = (r[col.Nome_Municipio] ?? "").trim();
    const uf = (r[col.Sigla_UF] ?? "").trim();
    if (nome && uf) dados.nomes[`${dobrar(nome)}|${uf}`] = cod;
  }
  if (dados.totalLinhas === 0) throw new Error("CSV do S2iD vazio");
  return { geradoEm: new Date().toISOString(), fonteUrl: URL_S2ID_CSV, dados };
}

/** Regra de impacto documentada no cabeçalho. Exposta para teste. */
export function impactoReconhecimentos(reconhecidos: number, ultimoHaMenosDe24Meses: boolean, soRegistros: boolean): number {
  if (reconhecidos === 0) return soRegistros ? 0.2 : 0.1;
  const v = 0.35 + 0.1 * Math.min(reconhecidos, 4) + (ultimoHaMenosDe24Meses ? 0.1 : 0);
  return Math.min(0.85, Math.round(v * 100) / 100);
}

export class SrcS2idReconhecimentos extends BaseSourceAgent {
  readonly id: SourceId = "src-s2id-reconhecimentos";
  readonly dimension: DimensionId = "D1";
  readonly name = "S2iD · Reconhecimento federal de desastres (Defesa Civil Nacional)";

  protected async fetchSignals(territory: Territory, options: CollectOptions): Promise<RawSignal[]> {
    const pronto = await obterIndice("s2id-reconhecimentos", construirIndiceS2id);
    if (!pronto) {
      this.log.info({ territory: territory.slug }, "Índice do S2iD ainda em construção; sem sinal nesta coleta");
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

    const corte5a = mesesAtras(60);
    const corte24m = mesesAtras(24);
    const janela = (dados.porMunicipio[cod] ?? []).filter(([iso]) => Date.parse(iso) >= corte5a);
    const reconhecidos = janela.filter((o) => o[2] === 1);
    const registrosSemReconhecimento = janela.length - reconhecidos.length;
    const mortos = reconhecidos.reduce((s, o) => s + o[3], 0);

    const porTipo = new Map<string, number>();
    for (const o of reconhecidos) {
      const tipo = dados.tipologias[o[1]] || `COBRADE ${o[1]}`;
      porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
    }
    const tiposOrdenados = Array.from(porTipo.entries()).sort((a, b) => b[1] - a[1]);
    const ultimo = reconhecidos.map((o) => o[0]).sort().pop() ?? null;
    const ultimoRecente = ultimo !== null && Date.parse(ultimo) >= corte24m;

    const impacto = impactoReconhecimentos(reconhecidos.length, ultimoRecente, registrosSemReconhecimento > 0);
    const baseAte = fmtData(dados.baseAte);
    const consulta = `MIDR/S2iD dados abertos · Cod_IBGE_Mun=${cod} · Status=Reconhecido · 5 anos · base até ${baseAte}${defasado ? " (defasada)" : ""}`;

    let title: string;
    let summary: string;
    if (reconhecidos.length === 0) {
      title = `S2iD · Nenhum reconhecimento federal de desastre em ${territory.name} nos últimos 5 anos`;
      summary =
        `A base oficial de desastres da Defesa Civil Nacional (S2iD, consolidada até ${baseAte}) não traz reconhecimento federal ` +
        `de situação de emergência ou calamidade pública para o município nos últimos 5 anos` +
        (registrosSemReconhecimento > 0
          ? `; há ${registrosSemReconhecimento} ocorrência${registrosSemReconhecimento > 1 ? "s" : ""} informada${registrosSemReconhecimento > 1 ? "s" : ""} sem reconhecimento.`
          : ".");
    } else {
      title = `S2iD · ${reconhecidos.length} reconhecimento${reconhecidos.length > 1 ? "s" : ""} ${reconhecidos.length > 1 ? "federais" : "federal"} de desastre em ${territory.name} nos últimos 5 anos`;
      summary =
        `Defesa Civil Nacional (S2iD, consolidada até ${baseAte}): ${reconhecidos.length} reconhecimento${reconhecidos.length > 1 ? "s" : ""} ${reconhecidos.length > 1 ? "federais" : "federal"} ` +
        `de situação de emergência ou calamidade pública em 5 anos. Tipos mais frequentes: ` +
        `${tiposOrdenados.slice(0, 3).map(([t, n]) => `${n} ${t}`).join("; ")}. ` +
        `Último em ${fmtData(ultimo!)}` +
        (mortos > 0 ? `; ${mortos} morte${mortos > 1 ? "s" : ""} informada${mortos > 1 ? "s" : ""}` : "") +
        ".";
    }

    return [
      {
        title,
        summary,
        // Fragmento com mês e município: ver nota equivalente em src-ibama-embargos.
        url: `${URL_CONJUNTO}#${new Date().toISOString().slice(0, 7)}-${cod}`,
        provenance: consulta,
        sourceAgentId: this.id,
        publishedAt: new Date(),
        rawValue: reconhecidos.length,
        unit: "reconhecimentos (5 anos)",
        impactHint: impacto,
        metadata: {
          evidenciaOficial: true,
          ibgeId: cod,
          reconhecimentos5Anos: reconhecidos.length,
          registrosSemReconhecimento5Anos: registrosSemReconhecimento,
          ultimoReconhecimento: ultimo,
          tiposMaisFrequentes: tiposOrdenados.slice(0, 5).map(([tipo, n]) => ({ tipo, n })),
          mortosInformados: mortos,
          baseAte: dados.baseAte,
          baseGeradaEm: indice.geradoEm,
          baseDefasada: defasado,
          endpoint: URL_S2ID_CSV,
          source: "mdr-s2id-dados-informados",
        },
      },
    ];
  }
}
