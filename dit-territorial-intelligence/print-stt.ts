import { getDb } from './server/db';
import { sttScores, territories } from './drizzle/schema';
import { eq, inArray } from 'drizzle-orm';

async function run() {
  const db = await getDb();
  const slugs = ['alagoinhas', 'catu', 'candeias'];
  const terrs = await db.select().from(territories).where(inArray(territories.slug, slugs));
  
  for (const t of terrs) {
    const score = await db.select().from(sttScores).where(eq(sttScores.territoryId, t.id)).limit(1).then(r => r[0]);
    if(score) {
      console.log('\n=============================================');
      console.log(`MUNICÍPIO: ${t.name.toUpperCase()}`);
      console.log('=============================================');
      console.log(`STT FINAL: ${score.stt}`);
      console.log(`CENÁRIO:   ${score.scenario?.toUpperCase()}`);
      console.log('---------------------------------------------');
      console.log(`[D1] Socioambiental: ${score.d1Score}`);
      console.log(`[D2] Socioeconômico: ${score.d2Score}`);
      console.log(`[D3] Infraestrutura: ${score.d3Score}`);
      console.log(`[D4] Dinâmica Territ.: ${score.d4Score}`);
      console.log(`[D5] Governança:     ${score.d5Score}`);
      console.log(`[D6] Reputação:      ${score.d6Score}`);
      console.log('---------------------------------------------');
      console.log('NOTA EXECUTIVA:');
      console.log(score.executiveNote);
    }
  }
  process.exit(0);
}
run();
