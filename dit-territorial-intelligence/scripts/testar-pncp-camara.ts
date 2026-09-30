/**
 * Roda os agentes src-pncp (D5), src-pncp-obras (D3) e src-camara-proposicoes (D6)
 * e imprime os sinais classificados pela dimensão de cada um.
 *
 *   ./node_modules/.bin/tsx scripts/testar-pncp-camara.ts            (os dois municípios de teste)
 *   ./node_modules/.bin/tsx scripts/testar-pncp-camara.ts 3304904    (um código IBGE)
 *
 * Antes da rede, roda checagens offline da conferência de nome/UF na ementa e
 * das regras de impacto. Sem banco, sem LLM, sem chave: só APIs abertas.
 */
import assert from "node:assert/strict";
import { SrcPncp, SrcPncpObras, impactoVolume, impactoDispensa, impactoObra, indicadorDeObra, ehObra } from "../server/agents/sources/d5/src-pncp";
import { SrcCamaraProposicoes, conferirEmenta, impactoVisibilidade } from "../server/agents/sources/d6/src-camara-proposicoes";
import { DimGovernanca } from "../server/agents/dimensions/dim-governanca";
import { DimInfraestrutura } from "../server/agents/dimensions/dim-infraestrutura";
import { DimReputacao } from "../server/agents/dimensions/dim-reputacao";
import type { Territory } from "../drizzle/schema";

function checagensOffline() {
  // Nome como palavra inteira, com UF.
  assert.deepEqual(conferirEmenta("Denomina viaduto em São Gonçalo/RJ.", "São Gonçalo", "RJ", true), { vale: true, ufConfirmada: true });
  // Outro município com o nome do nosso como prefixo.
  assert.equal(conferirEmenta("Repasse ao Município de São Gonçalo do Amarante, Estado do Ceará.", "São Gonçalo", "RJ", true).vale, false);
  // Homônimo de outra UF.
  assert.equal(conferirEmenta("Título a Caiçara do Norte (RN).", "Caiçara do Norte", "CE", true).vale, false);
  assert.equal(conferirEmenta("Obra no Município de São Gonçalo, Estado do Rio Grande do Norte.", "São Gonçalo", "RJ", true).vale, false);
  // Homônimo sem UF na ementa não vale; não homônimo vale sem UF.
  assert.equal(conferirEmenta("Audiência sobre a BR em São Gonçalo.", "São Gonçalo", "RJ", true).vale, false);
  assert.deepEqual(conferirEmenta("Título de capital ao Município de Cabo Frio.", "Cabo Frio", "RJ", false), { vale: true, ufConfirmada: false });
  // UF em qualquer ponto da ementa confirma.
  assert.deepEqual(conferirEmenta("Rádio FM em São Gonçalo, no Estado do Rio de Janeiro.", "São Gonçalo", "RJ", true), { vale: true, ufConfirmada: true });

  assert.equal(impactoVolume(0, 10_000), 0.6);
  assert.equal(impactoVolume(1, 100_000), 0.5);
  assert.equal(impactoVolume(30, 6_000), 0.15);
  assert.equal(impactoDispensa(0.9, 20), 0.65);
  assert.equal(impactoDispensa(0.9, 5), 0.2);
  assert.equal(impactoObra(12_000_000), 0.75);
  assert.equal(impactoObra(100_000), 0);
  assert.equal(impactoVisibilidade(0), 0.15);
  assert.equal(impactoVisibilidade(12), 0.6);
  assert.equal(ehObra("Contratação de empresa para pavimentação de vias"), true);
  assert.equal(ehObra("Aquisição de medicamentos"), false);
  assert.equal(indicadorDeObra("Obra de esgotamento sanitário"), "3.1.1.1");
  assert.equal(indicadorDeObra("Construção de escola municipal"), "3.1.3.1");
  console.log("checagens offline: ok");
}

const ALVOS: Array<[string, string, string]> = [
  ["3304904", "São Gonçalo", "RJ"],
  ["2401859", "Caiçara do Norte", "RN"],
];

async function main() {
  checagensOffline();
  const arg = process.argv[2];
  const alvos = arg ? [[arg, `IBGE ${arg}`, ""] as [string, string, string]] : ALVOS;
  const agentes = [
    { ag: new SrcPncp(), dim: new DimGovernanca() },
    { ag: new SrcPncpObras(), dim: new DimInfraestrutura() },
    { ag: new SrcCamaraProposicoes(), dim: new DimReputacao() },
  ];

  for (const [ibge, nome, uf] of alvos) {
    const territorio = {
      id: 0,
      slug: nome.toLowerCase().replace(/\s+/g, "-"),
      name: nome,
      state: uf,
      contextData: { ibgeId: Number(ibge), ibgeMunicipios: [ibge], uf },
    } as unknown as Territory;

    for (const { ag, dim } of agentes) {
      const t0 = Date.now();
      const sinais = await ag.collect(territorio, {});
      console.log(`\n=== ${nome}/${uf} (IBGE ${ibge}) · ${ag.id} (${ag.dimension}) · ${sinais.length} sinais · ${Date.now() - t0} ms ===`);
      for (const s of sinais) {
        const c = dim.classify(s);
        console.log(`- ${s.title}`);
        console.log(`    rawValue=${s.rawValue} ${s.unit ?? ""} | impacto=${c?.impactScore} (${c?.impactLevel}) | indicador=${c?.indicatorCode}`);
        console.log(`    url=${s.url}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
