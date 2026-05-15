import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { orchestrator } from '../server/agents/orchestrator';
import * as dotenv from 'dotenv';
dotenv.config();

const arg = process.argv[2];
if (!arg) {
  console.error("Uso: npx tsx scripts/backfill-history.ts <slug_do_municipio>");
  process.exit(1);
}

// Retrocedendo 4 meses: Janeiro a Abril 2026
const periods = [
  { period: "2026-01", dateStart: "01/01/2026", dateEnd: "01/31/2026" },
  { period: "2026-02", dateStart: "02/01/2026", dateEnd: "02/28/2026" },
  { period: "2026-03", dateStart: "03/01/2026", dateEnd: "03/31/2026" },
  { period: "2026-04", dateStart: "04/01/2026", dateEnd: "04/30/2026" }
];

async function run() {
  const db = await getDb();
  
  const t = await db.select().from(territories).where(eq(territories.slug, arg)).limit(1).then(r => r[0]);
  if (!t) {
    console.error(`Território não encontrado: ${arg}`);
    process.exit(1);
  }

  console.log(`========================================================`);
  console.log(` INICIANDO BACKFILL HISTÓRICO: ${t.name.toUpperCase()}`);
  console.log(`========================================================\n`);

  for (const p of periods) {
    console.log(`>>> Processando Período: ${p.period} (${p.dateStart} a ${p.dateEnd})`);
    
    // Roda o orquestrador com a máquina do tempo
    const res = await orchestrator.run(t, {
      period: p.period,
      dateStart: p.dateStart,
      dateEnd: p.dateEnd
    });

    console.log(`    STT Calculado: ${res.stt}`);
    console.log(`    Sinais Coletados: ${res.totalSignals}`);
    console.log(`    Dimensões Ativadas:`);
    for (const [dim, result] of Object.entries(res.dimensions)) {
      if (result.score > 0) {
        console.log(`      - ${dim}: ${result.score}`);
      }
    }
    console.log(`--------------------------------------------------------\n`);
  }

  console.log(`BACKFILL CONCLUÍDO COM SUCESSO! A memória territorial foi gravada.`);
  process.exit(0);
}

run().catch(console.error);
