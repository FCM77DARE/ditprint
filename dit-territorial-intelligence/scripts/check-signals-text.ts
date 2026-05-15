import { getDb } from '../server/db';
import { signals } from '../drizzle/schema';
import { like, and, eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) return;

  const query = process.argv[2] || 'Santana';
  console.log(`Buscando sinais contendo "${query}"...`);

  const results = await db.select().from(signals).where(like(signals.title, `%${query}%`));

  console.log(`Encontrados ${results.length} sinais.`);
  results.forEach(s => {
    console.log(`- [${s.source}] ${s.title} (Score: ${s.llmImpactScore})`);
  });

  process.exit(0);
}

run().catch(console.error);
