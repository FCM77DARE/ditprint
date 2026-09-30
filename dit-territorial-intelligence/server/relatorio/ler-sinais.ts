/**
 * Lê o arquivo de sinais de um território SEM cortar pela janela de 24 meses.
 *
 * `readSignalsInWindow` descarta por data de publicação, e indicador estrutural
 * (população do Censo 2022, salário do CEMPRE 2021, PIB 2023) leva a data do
 * período de referência: sai da janela mesmo valendo até a próxima divulgação.
 * O relatório precisa deles com fonte e ano, então lê o jsonl inteiro.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SinalDoStore } from "./montar-dados";

export function lerSinaisDoTerritorio(slug: string): SinalDoStore[] {
  const dir = join(process.env.DATA_DIR || join(process.cwd(), "data"), "signals");
  const arquivo = join(dir, `${slug.replace(/[^a-z0-9-]/gi, "_").toLowerCase()}.jsonl`);
  if (!existsSync(arquivo)) return [];
  const out: SinalDoStore[] = [];
  for (const linha of readFileSync(arquivo, "utf8").split("\n")) {
    if (!linha.trim()) continue;
    try {
      out.push(JSON.parse(linha) as SinalDoStore);
    } catch {
      /* linha corrompida: ignora */
    }
  }
  return out;
}
