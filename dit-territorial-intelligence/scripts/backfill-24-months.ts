import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq, inArray } from 'drizzle-orm';
import { orchestrator } from '../server/agents/orchestrator';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Script de Backfill - 24 Meses (Maio 2024 a Abril 2026)
 * Gera a base histórica completa para alimentar o Command Center DIT PRINT.
 */

function generate24MonthsPeriods() {
  const periods = [];
  const startYear = 2024;
  const startMonth = 5; // Maio 2024

  for (let i = 0; i < 24; i++) {
    let year = startYear + Math.floor((startMonth + i - 1) / 12);
    let month = ((startMonth + i - 1) % 12) + 1;
    
    const periodStr = `${year}-${month.toString().padStart(2, '0')}`;
    
    // Determinar o último dia do mês
    const lastDay = new Date(year, month, 0).getDate();
    
    periods.push({
      period: periodStr,
      dateStart: `${month.toString().padStart(2, '0')}/01/${year}`,
      dateEnd: `${month.toString().padStart(2, '0')}/${lastDay.toString().padStart(2, '0')}/${year}`
    });
  }
  return periods;
}

const targetSlugs = ['alagoinhas', 'catu', 'candeias', 'itambi', 'mage'];

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB indisponível");

  const periods = generate24MonthsPeriods();
  console.log(`\nIniciando Backfill de 24 meses para ${targetSlugs.length} territórios...`);
  console.log(`Períodos gerados: ${periods[0].period} até ${periods[periods.length-1].period}\n`);

  for (const slug of targetSlugs) {
    const territory = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1).then(r=>r[0]);
    if (!territory) {
      console.log(`Território ${slug} não encontrado. Pulando.`);
      continue;
    }

    console.log(`========================================================`);
    console.log(` PROCESSANDO BACKFILL: ${territory.name.toUpperCase()}`);
    console.log(`========================================================`);

    for (const p of periods) {
      console.log(`>>> Coletando dados para ${p.period}...`);
      try {
        const res = await orchestrator.run(territory, {
          period: p.period,
          dateStart: p.dateStart,
          dateEnd: p.dateEnd
        });
        console.log(`    STT Calculado: ${res.stt.toFixed(2)} | Cenário: ${res.scenario}`);
      } catch (err) {
        console.error(`    Erro ao processar ${p.period} para ${territory.name}:`, err);
      }
    }
  }
  
  console.log(`\n✅ Backfill de 24 meses concluído com sucesso!`);
  process.exit(0);
}

run().catch(console.error);
