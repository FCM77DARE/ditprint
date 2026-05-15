import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { orchestrator } from '../server/agents/orchestrator';
import { reporterAgent } from '../server/agents/reporterAgent';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

function generate24MonthsPeriods() {
  const periods = [];
  const now = new Date();
  
  // Retroceder 24 meses do mês atual
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

async function run() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Uso: npx tsx scripts/backfill-single-territory.ts <slug>");
    process.exit(1);
  }

  const logFile = path.join(process.cwd(), `backfill-${slug}.log`);
  fs.writeFileSync(logFile, `Iniciando backfill para ${slug} em ${new Date().toISOString()}\n`);
  
  const log = (msg: string) => {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
  };

  const db = await getDb();
  if (!db) {
    log("DB indisponível");
    process.exit(1);
  }

  const territory = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1).then(r=>r[0]);
  if (!territory) {
    log(`Território ${slug} não encontrado.`);
    process.exit(1);
  }

  const periods = generate24MonthsPeriods();
  log(`Processando ${periods.length} meses retroativos para ${slug}...`);

  for (const p of periods) {
    log(`[${slug}] >>> Coletando dados para ${p.period}...`);
    try {
      const res = await orchestrator.run(territory, {
        period: p.period,
        dateStart: p.dateStart,
        dateEnd: p.dateEnd
      });
      log(`[${slug}]     STT: ${res.stt.toFixed(2)} | Cenário: ${res.scenario}`);

      // Gerar relatório PREMIUM para este mês
      log(`[${slug}]     Gerando relatório PREMIUM...`);
      const report = await reporterAgent.generatePremiumReport(territory.id, p.period);
      
      const reportsDir = path.join(process.cwd(), 'reports', slug);
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
      
      const fileName = `DIT_${slug.toUpperCase()}_${p.period.replace('-', '_')}.md`;
      fs.writeFileSync(path.join(reportsDir, fileName), report);
      log(`[${slug}]     ✅ Relatório salvo em reports/${slug}/${fileName}`);
    } catch (err: any) {
      log(`[${slug}]     Erro em ${p.period}: ${err?.message || err}`);
    }
  }

  log(`\n✅ Backfill de 24 meses concluído para ${slug}!`);
  process.exit(0);
}

run().catch(console.error);
