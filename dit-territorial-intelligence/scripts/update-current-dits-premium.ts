import { getDb } from '../server/db';
import { territories, indexHistory } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { reporterAgent } from '../server/agents/reporterAgent';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const period = "2026-05";

async function run() {
  const db = await getDb();
  if (!db) return;

  const list = await db.select().from(territories);
  console.log(`Gerando DITs Premium para ${list.length} territórios (Período: ${period})...`);

  for (const t of list) {
    if (!t.slug) continue;

    console.log(`-> Processando ${t.name}...`);
    try {
      // Verificar se existe pontuação para este período
      const [history] = await db.select().from(indexHistory)
        .where(and(eq(indexHistory.territoryId, t.id), eq(indexHistory.period, period)))
        .limit(1);

      if (!history) {
        console.warn(`   ⚠️ Sem dados de STT para ${t.name} em ${period}. Pulando...`);
        continue;
      }

      const report = await reporterAgent.generatePremiumReport(t.id, period);
      const filePath = path.join(process.cwd(), `DIT_${t.slug.toUpperCase()}_${period.replace('-', '_')}.md`);
      fs.writeFileSync(filePath, report);
      console.log(`   ✅ Relatório gerado: ${filePath}`);
    } catch (err) {
      console.error(`   ❌ Erro em ${t.name}:`, err);
    }
  }

  process.exit(0);
}

run().catch(console.error);
