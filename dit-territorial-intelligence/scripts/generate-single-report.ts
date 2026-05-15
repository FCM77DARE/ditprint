import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { ReporterAgent } from '../server/agents/reporterAgent';
const reporterAgent = new ReporterAgent();
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const slug = process.argv[2] || 'baia-guanabara';
  const period = process.argv[3] || '2026-05';
  const db = await getDb();
  if (!db) return;

  const t = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1).then(r=>r[0]);
  if (!t) return;

  console.log(`Gerando DIT Premium ÚNICO para ${t.name} (${period})...`);
  const report = await reporterAgent.generatePremiumReport(t.id, period);
  
  const filePath = path.join(process.cwd(), `DIT_${slug.toUpperCase()}_FINAL_VERIFICATION.md`);
  fs.writeFileSync(filePath, report);
  console.log(`✅ Relatório gerado com sucesso: ${filePath}`);
  process.exit(0);
}
run();
