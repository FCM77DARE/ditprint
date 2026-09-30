/**
 * Gera o Diagnóstico completo (relatório Marco) em HTML autossuficiente a partir
 * do JSON completo de uma rodada (gerado por completar-rodada-local.ts ou por
 * dit-completo-local.ts). Mesma marcação da rota /diagnostico/relatorio/:slug:
 * ambos chamam shared/relatorio-marco/render.ts.
 *
 *   npx tsx scripts/gerar-relatorio-marco.ts <pasta-do-projeto> <base> [saida.html]
 *   ex.: npx tsx scripts/gerar-relatorio-marco.ts C:/Projetos/dit-print/dit-territorial-intelligence sao-goncalo
 *
 * Grava <pasta>/saidas-locais/Marco_<base>.html. Não chama rede nem modelo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { montarDados } from "../server/relatorio/montar-dados";
import { documentoHtml } from "../shared/relatorio-marco/render";

const pasta = resolve(process.argv[2] ?? process.cwd());
const base = process.argv[3];
if (!base) {
  console.error("uso: tsx scripts/gerar-relatorio-marco.ts <pasta> <base> [saida.html]");
  process.exit(1);
}
const completo = JSON.parse(readFileSync(join(pasta, "saidas-locais", `${base}.completo.json`), "utf8"));

const dados = montarDados({
  analyze: completo.analyze,
  sinais: completo.sinais,
  historico: completo.historico ?? [],
  buscasBarradas: completo.buscasBarradas ?? null,
});

// Logo original da PRINT, embutida (arquivos de client/public/brand).
const logo = (f: string) =>
  `data:image/png;base64,${readFileSync(join(import.meta.dirname, "..", "client", "public", "brand", f)).toString("base64")}`;
const html = documentoHtml(dados, { clara: logo("print-logo.png"), escura: logo("print-logo-white.png") });

const saida = process.argv[5] ?? join(pasta, "saidas-locais", `Marco_${base}.html`);
writeFileSync(saida, html, "utf8");
writeFileSync(join(pasta, "saidas-locais", `${base}.dados-relatorio.json`), JSON.stringify(dados, null, 2), "utf8");
const visivel = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "");
console.log(`gravado ${saida} (${Math.round(html.length / 1024)} KB)`);
console.log(
  `  ${dados.dimensoes.filter((d) => d.medida).length}/6 dimensões medidas · ${dados.dimensoes.reduce((a, d) => a + d.sustentam.length, 0)} sinais exibidos · travessões no HTML visível: ${(visivel.match(/[\u2014\u2013]/g) ?? []).length}`
);
