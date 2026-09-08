/**
 * Carga nacional da camada estrutural.
 *
 *   pnpm structural:load
 *
 * Baixa o catálogo de indicadores oficiais para os 5.570 municípios do Brasil
 * e grava em DATA_DIR/structural/municipios.json.
 *
 * Roda uma vez por mês. Não é coleta de sinal — é a base que fica parada
 * embaixo do STT. Depois disso, consultar um território não custa requisição
 * nenhuma: o dado já está em disco.
 *
 * Em produção (Railway), DATA_DIR aponta para o volume /data, então a carga
 * sobrevive a deploy.
 */

import "dotenv/config";
import { loadNationalStructuralData, getStructuralStatus } from "../server/structural/store";
import { STRUCTURAL_CATALOG, DERIVED_CATALOG } from "../server/structural/catalog";

async function main() {
  const started = Date.now();

  console.log("");
  console.log("  DIT · carga estrutural nacional");
  console.log("  ────────────────────────────────────────────────────────");
  console.log(`  indicadores coletados : ${STRUCTURAL_CATALOG.length}`);
  console.log(`  indicadores derivados : ${DERIVED_CATALOG.length}`);
  console.log(`  destino               : ${process.env.DATA_DIR ?? "./data"}/structural`);
  console.log("");

  const store = await loadNationalStructuralData();

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const status = await getStructuralStatus();

  console.log("");
  console.log("  ────────────────────────────────────────────────────────");
  console.log(`  municípios com dado   : ${store.municipalityCount.toLocaleString("pt-BR")}`);
  console.log(`  indicadores por município (máx): ${store.indicatorCount}`);
  console.log(`  tempo                 : ${elapsed}s`);
  console.log(`  gerado em             : ${store.generatedAt}`);
  console.log("");

  // Amostra de conferência — Macaé/RJ, território de tese da PRINT.
  const { getStructuralForMunicipality } = await import("../server/structural/store");
  const macae = await getStructuralForMunicipality(3302403);
  const keys = Object.keys(macae);
  if (keys.length > 0) {
    console.log("  amostra — Macaé/RJ (3302403):");
    for (const k of keys) {
      const v = macae[k];
      console.log(`    ${k.padEnd(24)} ${String(v.value).padStart(14)} ${v.unit}  (${v.period})`);
    }
  } else {
    console.log("  ATENÇÃO: amostra de Macaé veio vazia — conferir a carga.");
  }
  console.log("");

  if (!status.available || store.municipalityCount < 5000) {
    console.error("  FALHA: carga incompleta. Esperado ~5.570 municípios.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Carga estrutural falhou:", err);
  process.exit(1);
});
