/**
 * Teste avulso das fontes OFICIAIS de D1 (IBAMA embargos, S2iD, TerraBrasilis).
 *
 * Uso:  ./node_modules/.bin/tsx scripts/d1-oficial-local.ts [codigoIbge ...]
 * Sem argumento, roda São Gonçalo/RJ e Caiçara do Norte/RN.
 *
 * 1) Pré-aquece os índices nacionais (baixa os CSVs se o cache não existir ou
 *    estiver vencido). Em produção isso roda em segundo plano; aqui espera.
 * 2) Roda só os três agentes e imprime os sinais.
 * 3) Roda a dimensão D1 com só esses três e mostra a classificação, o impacto,
 *    sourcesOk e quem entrou na cobertura.
 */

import { DimSocioambiental } from "../server/agents/dimensions/dim-socioambiental";
import { SrcIbamaEmbargos, construirIndiceEmbargos } from "../server/agents/sources/d1/src-ibama-embargos";
import { SrcS2idReconhecimentos, construirIndiceS2id } from "../server/agents/sources/d1/src-s2id-reconhecimentos";
import { SrcTerrabrasilisProdes } from "../server/agents/sources/d1/src-terrabrasilis-prodes";
import { obterIndice, reconstruirIndice } from "../server/agents/sources/d1/oficial-util";

const ALVOS: Record<string, { nome: string; uf: string }> = {
  "3304904": { nome: "São Gonçalo", uf: "RJ" },
  "2401859": { nome: "Caiçara do Norte", uf: "RN" },
  // Controle da rota DETER (Amazônia), só com argumento explícito.
  "1500602": { nome: "Altamira", uf: "PA" },
};

function territorio(ibge: string) {
  const a = ALVOS[ibge] ?? { nome: `IBGE ${ibge}`, uf: "" };
  return {
    id: 0,
    slug: a.nome.toLowerCase().replace(/\s+/g, "-"),
    name: a.nome,
    region: null,
    state: a.uf,
    active: true,
    contextData: { ibgeId: ibge, uf: a.uf },
    onboardingStatus: "ready",
    createdAt: new Date(),
  } as any;
}

async function main() {
  const codigos = process.argv.slice(2).length ? process.argv.slice(2) : ["3304904", "2401859"];

  console.log("== Pré-aquecendo índices nacionais (pode levar alguns minutos na primeira vez)");
  for (const [nome, construir] of [
    ["ibama-embargos", construirIndiceEmbargos],
    ["s2id-reconhecimentos", construirIndiceS2id],
  ] as const) {
    const t0 = Date.now();
    const antes = await obterIndice(nome, construir as any);
    if (!antes) await reconstruirIndice(nome, construir as any);
    const depois = await obterIndice(nome, construir as any);
    console.log(`   ${nome}: ${depois ? `pronto (gerado em ${depois.indice.geradoEm})` : "FALHOU"} em ${Math.round((Date.now() - t0) / 1000)}s`);
  }

  for (const ibge of codigos) {
    const t = territorio(ibge);
    console.log(`\n==================== ${t.name}/${t.state} (${ibge}) ====================`);

    const terra = new SrcTerrabrasilisProdes();
    const fontes = [new SrcIbamaEmbargos(), new SrcS2idReconhecimentos(), terra];
    for (const f of fontes) {
      const t0 = Date.now();
      const sinais = await f.collect(t, {});
      console.log(`\n-- ${f.id} (${Date.now() - t0} ms): ${sinais.length} sinal(is)`);
      for (const s of sinais) {
        console.log(`   título:   ${s.title}`);
        console.log(`   resumo:   ${s.summary}`);
        console.log(`   url:      ${s.url}`);
        console.log(`   proced.:  ${s.provenance}`);
        console.log(`   valor:    ${s.rawValue} ${s.unit ?? ""} | impactHint ${s.impactHint}`);
      }
      if (f === terra) console.log(`   status TerraBrasilis: ${JSON.stringify(terra.statusUltimaColeta)}`);
    }

    // Pela dimensão: verificador, classificação, contagem de fontes.
    const dim = new DimSocioambiental();
    (dim as any).sources = [new SrcIbamaEmbargos(), new SrcS2idReconhecimentos(), new SrcTerrabrasilisProdes()];
    const r = await dim.run(t, {});
    console.log(`\n-- D1 só com as 3 fontes oficiais: score ${r.score} | sourcesOk ${r.sourcesOk} | sourcesError ${r.sourcesError}`);
    for (const s of r.signals) {
      console.log(`   [${s.indicatorCode}] impacto ${s.impactScore} (${s.impactLevel}) alerta=${s.triggersAlert} conf=${s.confidence} :: ${s.title}`);
    }
    const comSinal = new Set(r.signals.map((s) => s.sourceAgentId)).size;
    console.log(`   fontes com sinal na cobertura: ${comSinal} de ${r.sourcesOk}`);
    console.log(`   breakdown: ${JSON.stringify(r.sourceBreakdown)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
