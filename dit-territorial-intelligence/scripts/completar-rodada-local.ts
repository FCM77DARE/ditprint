/**
 * Completa, SEM custo, o dump de uma rodada local já feita por
 * scripts/dit-completo-local.ts com as etapas que o /analyze produz e o dump
 * antigo não tinha (leitura Tensão/Confiança, identidade IBGE e coordenadas,
 * procedência, camada estratégica, sinais verificados com data e link).
 *
 *   npx tsx scripts/completar-rodada-local.ts <pasta-do-projeto> <base> "<Município, UF>"
 *   ex.: npx tsx scripts/completar-rodada-local.ts C:/Projetos/dit-print/dit-territorial-intelligence sao-goncalo "São Gonçalo, RJ"
 *
 * Lê <pasta>/saidas-locais/<base>.json (+ .log para as buscas barradas), usa o
 * store de sinais de <pasta>/data e grava <pasta>/saidas-locais/<base>.completo.json.
 * Não chama SerpAPI nem modelo de linguagem.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const pasta = resolve(process.argv[2] ?? process.cwd());
const base = process.argv[3];
const consulta = process.argv[4];
if (!base || !consulta) {
  console.error('uso: tsx scripts/completar-rodada-local.ts <pasta> <base> "<Município, UF>"');
  process.exit(1);
}
process.env.DATA_DIR = join(pasta, "data");
process.env.NODE_ENV = "development";
process.env.DATABASE_URL = "";
// O env.ts exige um JWT_SECRET para carregar; este script não autentica nada.
process.env.JWT_SECRET ??= "local-sem-uso-local-sem-uso-local-sem-uso";

async function main() {
  const { completarRodada } = await import("../server/relatorio/completar-rodada");
  const dump = JSON.parse(readFileSync(join(pasta, "saidas-locais", `${base}.json`), "utf8"));
  const logPath = join(pasta, "saidas-locais", `${base}.log`);
  const log = existsSync(logPath) ? readFileSync(logPath, "utf8").replace(/\u001b\[[0-9;]*m/g, "") : "";
  const custo = (() => {
    const l = log.split(/\r?\n/).find((x) => x.startsWith("JSON:"));
    return l ? JSON.parse(l.slice(5)) : null;
  })();

  const [nome, uf] = consulta.split(",").map((v) => v.trim());
  const malha = (await (await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")).json()) as any[];
  const m = malha.find((x) => x.nome === nome && x.microrregiao?.mesorregiao?.UF?.sigla === uf);
  if (!m) throw new Error(`não achei ${consulta} na malha do IBGE`);
  const UF = m.microrregiao.mesorregiao.UF;

  const { analyze, sinais } = await completarRodada(
    {
      relatorio: dump.relatorio,
      cobertura: dump.cobertura,
      coverageDetail: dump.coverageDetail,
      sourceBreakdown: dump.sourceBreakdown,
      historico: dump.historico,
      semLastro: dump.semLastro,
      prompt: dump.prompt,
      coletadoEm: custo?.em ?? dump.historico?.newestSignalAt,
    },
    {
      id: m.id,
      nome: m.nome,
      uf,
      ufNome: UF.nome,
      mesorregiao: m.microrregiao.mesorregiao.nome,
      microrregiao: m.microrregiao.nome,
      regiao: UF.regiao?.nome,
    }
  );
  const saida = join(pasta, "saidas-locais", `${base}.completo.json`);
  writeFileSync(
    saida,
    JSON.stringify({ analyze, sinais, buscasBarradas: custo?.buscasBloqueadas ?? null, ibge: m.id }, null, 2),
    "utf8"
  );
  console.log(`gravado ${saida}`);
  console.log(
    `  leitura: tensão ${analyze.leitura?.tensao} · confiança ${analyze.leitura?.confianca}% · faixa ${analyze.leitura?.faixa?.min} a ${analyze.leitura?.faixa?.max}`
  );
  console.log(
    `  sinais no store: ${sinais.length} · recursos ${analyze.resources?.length ?? 0} · setores ${analyze.sectors?.length ?? 0} · pontos ${analyze.hotspots?.length ?? 0} · casos ${analyze.strategicCases?.length ?? 0}`
  );
  console.log(`  coordenadas: ${analyze.territoryGeo ? JSON.stringify(analyze.territoryGeo.centroid) : "não obtidas"}`);
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
