import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { SrcUniversidades } from '../server/agents/sources/d6/src-universidades';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  const t = await db.select().from(territories).where(eq(territories.slug, 'alagoinhas')).limit(1).then(r=>r[0]);
  
  if (!t) {
    console.error("Território não encontrado");
    process.exit(1);
  }

  const agent = new SrcUniversidades();
  console.log(`\nIniciando teste para: ${t.name}`);
  console.log(`Buscando artigos no Semantic Scholar...\n`);

  const signals = await agent.collect(t, {
    period: '2026-05',
    dateStart: '05/01/2026',
    dateEnd: '05/12/2026'
  });

  console.log(`Encontrados ${signals.length} artigos científicos.`);
  
  signals.forEach((s, i) => {
    console.log(`\n[${i+1}] ${s.title}`);
    console.log(`URL: ${s.url}`);
    console.log(`Resumo: ${s.summary?.substring(0, 150)}...`);
  });

  process.exit(0);
}

run().catch(console.error);
