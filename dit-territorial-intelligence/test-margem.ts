import { getDb } from './server/db';
import { territories } from './drizzle/schema';
import { eq } from 'drizzle-orm';
import { orchestrator } from './server/agents/orchestrator';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  let t = await db.select().from(territories).where(eq(territories.name, 'Alagoinhas')).limit(1).then(r => r[0]);
  
  if(!t) {
    console.log('Criando território: Alagoinhas');
    await db.insert(territories).values({
      name: 'Alagoinhas',
      slug: 'alagoinhas',
      description: 'Município baiano com importante polo industrial.',
      boundaries: {},
      status: 'active',
      contextData: {
        ibgeMunicipios: ['2900702'],
        rssQueries: ['Alagoinhas', 'Prefeitura de Alagoinhas'],
        fogoCruzadoStateId: '29'
      }
    });
    t = await db.select().from(territories).where(eq(territories.name, 'Alagoinhas')).limit(1).then(r => r[0]);
  }
  
  console.log('Executando orquestrador para:', t.name);
  const res = await orchestrator.run(t);
  
  console.log('\n=============================================');
  console.log('                 RESULTADOS                  ');
  console.log('=============================================');
  console.log('STT Final:', res.stt);
  console.log('Sinais Coletados:', res.totalSignals);
  console.log('Cenário:', res.scenario);
  console.log('\n--- NOTA EXECUTIVA (GERADA PELA OPENAI) ---');
  console.log(res.executiveNote);
  console.log('=============================================');
  
  process.exit(0);
}

run().catch(console.error);
