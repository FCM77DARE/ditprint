import { getDb } from '../server/db';
import { territories, indexHistory } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { orchestrator } from '../server/agents/orchestrator';
import { reporterAgent } from '../server/agents/reporterAgent';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const targets = [
  { slug: 'macae', name: 'Macaé' },
  { slug: 'cabiunas', name: 'Cabiúnas' }
];

const period = "2026-05";
const dateStart = "05/01/2026";
const dateEnd = "05/31/2026";

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  for (const target of targets) {
    console.log(`\n========================================================`);
    console.log(` RE-PROCESSANDO INTELIGÊNCIA PROFUNDA: ${target.name.toUpperCase()}`);
    console.log(`========================================================`);

    const territory = await db.select().from(territories).where(eq(territories.slug, target.slug)).limit(1).then(r=>r[0]);
    if (!territory) {
      console.error(`Território ${target.slug} não encontrado.`);
      continue;
    }

    // 1. Rodar Orchestrator novamente para processar novas fontes (INEA, ICMBio, etc.)
    console.log(`>>> Coletando sinais profundos para ${period}...`);
    await orchestrator.run(territory, {
      period,
      dateStart,
      dateEnd
    });

    // 2. Gerar Relatório PREMIUM
    console.log(`>>> Gerando Relatório PREMIUM via ReporterAgent...`);
    const premiumReport = await reporterAgent.generatePremiumReport(territory.id, period);

    const filePath = path.join(process.cwd(), `DIT_${target.slug.toUpperCase()}_MAIO_2026.md`);
    fs.writeFileSync(filePath, premiumReport);
    console.log(`✅ Relatório PREMIUM gerado: ${filePath}`);
  }

  process.exit(0);
}

run().catch(console.error);
