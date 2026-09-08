/**
 * Migração de slugs para a chave canônica do IBGE — execução manual.
 *
 *   pnpm slugs:migrate         (relatório, não altera nada)
 *   pnpm slugs:migrate --apply (executa)
 *
 * A lógica vive em server/stt/slug-migration.ts porque o boot do servidor
 * também a chama — em produção os dados estão no volume da Railway, onde
 * este script não alcança.
 */

import "dotenv/config";
import { migrateCanonicalSlugs } from "../server/stt/slug-migration";

migrateCanonicalSlugs({
  apply: process.argv.includes("--apply"),
  log: (line) => console.log(line),
}).catch((err) => {
  console.error("Migração falhou:", err);
  process.exit(1);
});
