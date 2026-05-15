import { getDb } from '../server/db';
import { signals, territories } from '../drizzle/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const slug = process.argv[2];
  const period = process.argv[3];
  
  const territory = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1).then(r=>r[0]);
  if (!territory) throw new Error("Territory not found");

  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const res = await db.select().from(signals).where(and(
    eq(signals.territoryId, territory.id),
    gte(signals.publishedAt, start),
    lte(signals.publishedAt, end)
  ));

  console.log(`Encontrados ${res.length} sinais para ${slug} em ${period}`);
  const bySource: Record<string, number> = {};
  res.forEach(s => {
    bySource[s.source] = (bySource[s.source] || 0) + 1;
  });
  console.log('Por fonte:', bySource);
  process.exit(0);
}

run().catch(console.error);
