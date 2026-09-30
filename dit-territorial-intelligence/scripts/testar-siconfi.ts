/**
 * Roda só o agente src-siconfi (D5) e imprime os sinais.
 *
 *   ./node_modules/.bin/tsx scripts/testar-siconfi.ts            (os dois municípios de teste)
 *   ./node_modules/.bin/tsx scripts/testar-siconfi.ts 3304904    (um código IBGE)
 *
 * Sem banco, sem LLM: só a API aberta do Tesouro Nacional.
 */
import { SrcSiconfi } from "../server/agents/sources/d5/src-siconfi";
import { DimGovernanca } from "../server/agents/dimensions/dim-governanca";
import type { Territory } from "../drizzle/schema";

const ALVOS: Array<[string, string, string]> = [
  ["3304904", "São Gonçalo", "RJ"],
  ["2401859", "Caiçara do Norte", "RN"],
];

async function main() {
  const arg = process.argv[2];
  const alvos = arg ? [[arg, `IBGE ${arg}`, ""] as [string, string, string]] : ALVOS;
  const agente = new SrcSiconfi();
  const dim = new DimGovernanca();

  for (const [ibge, nome, uf] of alvos) {
    const territorio = {
      id: 0,
      slug: nome.toLowerCase().replace(/\s+/g, "-"),
      name: nome,
      state: uf,
      contextData: { ibgeId: Number(ibge), ibgeMunicipios: [ibge], uf },
    } as unknown as Territory;

    const t0 = Date.now();
    const sinais = await agente.collect(territorio, {});
    console.log(`\n=== ${nome}/${uf} (IBGE ${ibge}) · ${sinais.length} sinais · ${Date.now() - t0} ms ===`);
    for (const s of sinais) {
      const c = dim.classify(s);
      console.log(`- ${s.title}`);
      console.log(`    rawValue=${s.rawValue} ${s.unit} | impacto=${c?.impactScore} (${c?.impactLevel}) | indicador=${c?.indicatorCode} | exercício=${(s.metadata as any)?.exercicio}`);
      console.log(`    url=${s.url}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
