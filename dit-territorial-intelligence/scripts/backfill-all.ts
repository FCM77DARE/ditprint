import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { orchestrator } from '../server/agents/orchestrator';
import * as dotenv from 'dotenv';
dotenv.config();

const cities = ["alagoinhas", "catu", "candeias"];

const periods = [
  { period: "2026-01", dateStart: "01/01/2026", dateEnd: "01/31/2026" },
  { period: "2026-02", dateStart: "02/01/2026", dateEnd: "02/28/2026" },
  { period: "2026-03", dateStart: "03/01/2026", dateEnd: "03/31/2026" },
  { period: "2026-04", dateStart: "04/01/2026", dateEnd: "04/30/2026" }
];

async function run() {
  const db = await getDb();
  
  for (const slug of cities) {
    const t = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1).then(r => r[0]);
    if (!t) {
        console.log(`Território ${slug} não encontrado`);
        continue;
    }

    console.log(`\n========================================================`);
    console.log(` BACKFILL: ${t.name.toUpperCase()}`);
    console.log(`========================================================`);

    for (const p of periods) {
      console.log(`>>> ${p.period}...`);
      const res = await orchestrator.run(t, {
        period: p.period,
        dateStart: p.dateStart,
        dateEnd: p.dateEnd
      });
      console.log(`    STT: ${res.stt} | D1: ${res.dimensions.D1?.score} | D3: ${res.dimensions.D3?.score} | D6: ${res.dimensions.D6?.score}`);
    }
  }
  process.exit(0);
}

run().catch(console.error);
