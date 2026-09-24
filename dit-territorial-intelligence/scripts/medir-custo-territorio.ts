/**
 * Mede quanto custa LER um território e quanto custa ACOMPANHÁ-LO por dia.
 *
 *   railway run --service dit-api npx tsx scripts/medir-custo-territorio.ts "Macaé, RJ"
 *
 * Roda a malha inteira e o relatório de verdade, com as chaves de produção,
 * gravando tudo em disco LOCAL (DATA_DIR é trocado antes de qualquer módulo
 * carregar). Nada em produção é tocado.
 *
 * O que sai medido, não estimado:
 *   · tokens reais de cada chamada de LLM, por papel e modelo;
 *   · quantas buscas pagas a leitura DEMANDA (pagas + barradas pela cota).
 *
 * Acompanhamento diário = a verificação do STT (roda todo dia) + as buscas
 * amortizadas: com a janela encaixada no mês, a mesma busca é servida do
 * cache por 30 dias, então o território paga o conjunto de buscas uma vez
 * por mês, não por dia.
 */
import { join } from "node:path";

process.env.DATA_DIR = join(process.cwd(), "data");
process.env.NODE_ENV = "development";
// Sem banco: a medição não grava nada em lugar nenhum além do livro de custo
// local. O dotenv não sobrescreve variável já definida, mesmo vazia.
process.env.DATABASE_URL = "";

const consulta = process.argv[2] ?? "Macaé, RJ";
const USD_BRL = Number(process.env.USD_BRL ?? "5.4");
const USD_BUSCA = 0.015;

// Preços antigos, para comparar com o que estava no código antes do gateway.
const ANTES: Record<string, { in: number; out: number; nome: string }> = {
  relatorio: { in: 2.5, out: 10, nome: "openai/gpt-4o" },
  stt: { in: 0.15, out: 0.6, nome: "gpt-4o-mini" },
  extracao: { in: 0.15, out: 0.6, nome: "gpt-4o-mini" },
  verificador: { in: 0.15, out: 0.6, nome: "gpt-4o-mini" },
};

async function main() {
  const { orchestrator } = await import("../server/agents/orchestrator");
  const { comCustoDoTerritorio, resumoPorExecucao } = await import("../server/_core/cost-ledger");
  const { buildReportPrompt, callLLM } = await import("../server/routes/ditLanding");

  const [nome, uf] = consulta.split(",").map((v) => v.trim());
  const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
  const muns = (await res.json()) as Array<{ id: number; nome: string; microrregiao?: { mesorregiao?: { UF?: { sigla?: string; nome?: string } } } }>;
  const m = muns.find((x) => x.nome === nome && x.microrregiao?.mesorregiao?.UF?.sigla === uf);
  if (!m) throw new Error(`não achei ${consulta} na malha`);

  const slug = `medicao-${m.id}`;
  const territory = {
    id: 0,
    slug,
    name: m.nome,
    state: uf,
    region: null,
    active: true,
    onboardingStatus: "ready" as const,
    createdAt: new Date(),
    contextData: {
      ibgeMunicipios: [String(m.id)],
      ibgeId: String(m.id),
      uf,
      stateName: m.microrregiao?.mesorregiao?.UF?.nome,
      municipiosNomes: [m.nome],
    },
  };

  console.log(`\n  medindo a leitura de ${consulta} (IBGE ${m.id}) — malha inteira + relatório\n`);
  const t0 = Date.now();

  await comCustoDoTerritorio(slug, "leitura", async () => {
    const r = await orchestrator.run(territory as never);
    const prompt = buildReportPrompt(
      m.nome,
      `${m.nome}, ${uf}`,
      Math.round(r.stt),
      r.dimensions,
      r.alerts.length,
      r.totalSignals,
      { state: uf }
    );
    await callLLM(prompt);
    console.log(`  cobertura ${Math.round((r.coverageScore ?? 0) * 100)}% · ${r.totalSignals} sinais · STT ${Math.round(r.stt)}`);
  });

  const seg = ((Date.now() - t0) / 1000).toFixed(0);
  const [e] = (await resumoPorExecucao(5)).filter((x) => x.territorio === slug);
  if (!e) throw new Error("nenhum evento de custo registrado");

  const buscas = e.buscasPagas + e.buscasBloqueadas;
  const buscaUsdLeitura = buscas * USD_BUSCA;

  console.log(`  tempo: ${seg}s\n`);
  console.log("  LLM, por papel (uso real devolvido pelo OpenRouter)");
  let antesTotal = 0;
  for (const [papel, v] of Object.entries(e.porPapel)) {
    console.log(`    ${papel.padEnd(10)} ${v.modelo.padEnd(28)} ${v.chamadas}x  US$ ${v.usd.toFixed(4)}`);
  }
  // estimativa do antes: mesma proporção de tokens por papel não está no
  // resumo agregado, então usamos o total de tokens no preço do relatório antigo
  antesTotal =
    (e.tokensEntrada / 1e6) * ANTES.relatorio.in + (e.tokensSaida / 1e6) * ANTES.relatorio.out;

  const sttUsd = e.porPapel.stt?.usd ?? 0;
  const relUsd = e.porPapel.relatorio?.usd ?? 0;

  const leituraUsd = e.llmUsd + buscaUsdLeitura;
  const diaUsd = sttUsd + (buscas * USD_BUSCA) / 30;
  const mesUsd = diaUsd * 30;

  console.log(`\n  tokens: ${e.tokensEntrada.toLocaleString("pt-BR")} entrada · ${e.tokensSaida.toLocaleString("pt-BR")} saída`);
  console.log(`  buscas demandadas: ${buscas} (${e.buscasPagas} pagas, ${e.buscasBloqueadas} barradas pela cota, ${e.buscasDoCache} do cache)`);
  console.log("\n  ─────────────────────────────────────────────────────────────");
  console.log(`  LEITURA de 1 território       US$ ${leituraUsd.toFixed(3)}   R$ ${(leituraUsd * USD_BRL).toFixed(2)}`);
  console.log(`    LLM                         US$ ${e.llmUsd.toFixed(3)}`);
  console.log(`    busca (plano Developer)     US$ ${buscaUsdLeitura.toFixed(3)}`);
  console.log(`  ACOMPANHAMENTO por dia        US$ ${diaUsd.toFixed(3)}   R$ ${(diaUsd * USD_BRL).toFixed(2)}`);
  console.log(`    verificação diária do STT   US$ ${sttUsd.toFixed(3)}`);
  console.log(`    busca amortizada no mês     US$ ${((buscas * USD_BUSCA) / 30).toFixed(3)}`);
  console.log(`  ACOMPANHAMENTO por mês        US$ ${mesUsd.toFixed(2)}   R$ ${(mesUsd * USD_BRL).toFixed(2)}`);
  console.log("  ─────────────────────────────────────────────────────────────");
  console.log(`  relatório só                  US$ ${relUsd.toFixed(4)}`);
  console.log(`  mesmos tokens a preço gpt-4o  US$ ${antesTotal.toFixed(4)} (referência do que estava no código)\n`);

  // saída em JSON para o relatório
  console.log("JSON:" + JSON.stringify({ consulta, ibge: m.id, seg: Number(seg), ...e, buscas, leituraUsd, diaUsd, mesUsd, sttUsd, relUsd, USD_BRL }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
