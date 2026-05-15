import { getDb } from '../server/db';
import { signals, territories } from '../drizzle/schema';
import { and, eq, like, or, ne } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) return;

  const all = await db.select().from(territories);
  
  for (const t of all) {
    if (t.slug.includes('macae') || t.slug.includes('cabiunas')) continue;

    console.log(`Limpando sinais irrelevantes de "Santana" em ${t.slug}...`);

    await db.delete(signals).where(
      and(
        eq(signals.territoryId, t.id),
        or(
          like(signals.title, '%Santana%'),
          like(signals.summary, '%Santana%')
        )
      )
    );
  }

  console.log(`✅ Cleanup global concluído.`);
  process.exit(0);
}
run();
