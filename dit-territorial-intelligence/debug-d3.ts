import { getDb } from './server/db';
import { territories } from './drizzle/schema';
import { eq } from 'drizzle-orm';
import { DimInfraestrutura } from './server/agents/dimensions/dim-infraestrutura';
import * as dotenv from 'dotenv';
dotenv.config();

async function debug() {
  const db = await getDb();
  const t = await db.select().from(territories).where(eq(territories.slug, 'alagoinhas')).limit(1).then(r => r[0]);
  if (!t) return;

  const dim = new DimInfraestrutura();
  // We need to access private sources, but we can just run the collect part
  console.log("--- DEBUG D3 RAW SIGNALS ---");
  for (const source of dim.sources) {
    console.log(`\nSource: ${source.id}`);
    const signals = await source.collect(t, {});
    console.log(`Found ${signals.length} signals`);
    for (const s of signals) {
      console.log(` - [${s.title}]`);
    }
  }
}

debug().catch(console.error);
