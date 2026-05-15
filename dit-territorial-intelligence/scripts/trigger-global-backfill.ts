import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { spawn } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) return;

  const list = await db.select().from(territories);
  console.log(`Iniciando backfill global para ${list.length} territórios...`);

  for (const t of list) {
    if (!t.slug) continue;
    
    console.log(`-> Disparando background job para: ${t.name} (${t.slug})`);
    
    const scriptPath = path.join(process.cwd(), "scripts", "backfill-single-territory.ts");
    
    const child = spawn("npx", ["tsx", scriptPath, t.slug], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
      shell: true
    });
    
    child.unref();
  }

  console.log("\n✅ Todos os jobs foram disparados em background.");
  console.log("Você pode acompanhar o progresso pelos arquivos .log na raiz do projeto.");
  process.exit(0);
}

run().catch(console.error);
