import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { orchestrator } from '../server/agents/orchestrator';
import { reporterAgent } from '../server/agents/reporterAgent';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

function generate24MonthsPeriods() {
  const periods = [];
  const now = new Date();
  for (let i = 24; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const periodStr = `${year}-${month.toString().padStart(2, '0')}`;
    const lastDay = new Date(year, month, 0).getDate();
    periods.push({
      period: periodStr,
      dateStart: `${month.toString().padStart(2, '0')}/01/${year}`,
      dateEnd: `${month.toString().padStart(2, '0')}/${lastDay.toString().padStart(2, '0')}/${year}`
    });
  }
  return periods;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const db = await getDb();
  if (!db) return;

  const list = await db.select().from(territories);
  const periods = generate24MonthsPeriods();

  console.log(`🚀 Iniciando Backfill Global SEQUENCIAL (${list.length} territórios x 24 meses)`);
  console.log(`Lógica: Processamento unitário com retry para evitar estouro de quota.`);

  for (const t of list) {
    if (!t.slug) continue;
    console.log(`\n📂 TERRITÓRIO: ${t.name.toUpperCase()}`);

    for (const p of periods) {
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;

      while (attempts < maxAttempts && !success) {
        try {
          console.log(`   [${p.period}] Coletando e Gerando DIT...`);
          
          // 1. Rodar Orquestrador (Cálculo STT)
          await orchestrator.run(t, {
            period: p.period,
            dateStart: p.dateStart,
            dateEnd: p.dateEnd
          });

          // 2. Gerar Relatório Premium
          const report = await reporterAgent.generatePremiumReport(t.id, p.period);
          
          const reportsDir = path.join(process.cwd(), 'reports', t.slug);
          if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
          
          const fileName = `DIT_${t.slug.toUpperCase()}_${p.period.replace('-', '_')}.md`;
          fs.writeFileSync(path.join(reportsDir, fileName), report);
          
          console.log(`   ✅ Concluído: ${p.period}`);
          success = true;
          await sleep(2000); // Delay entre meses para estabilidade
        } catch (err: any) {
          attempts++;
          if (err?.message?.includes('429') || err?.message?.includes('insufficient_quota')) {
            console.warn(`   ⚠️ Quota atingida. Tentativa ${attempts}/${maxAttempts}. Aguardando 30s...`);
            await sleep(30000);
          } else {
            console.error(`   ❌ Erro em ${p.period}: ${err.message}`);
            break; // Erro fatal no mês
          }
        }
      }
    }
  }

  console.log("\n🏁 Backfill Global Finalizado.");
  process.exit(0);
}

run().catch(console.error);
