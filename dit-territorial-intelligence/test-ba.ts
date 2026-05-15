import { getDb } from './server/db';
import { territories, sttScores } from './drizzle/schema';
import { eq } from 'drizzle-orm';
import { orchestrator } from './server/agents/orchestrator';
import * as dotenv from 'dotenv';
dotenv.config();

const cidades = [
  { name: 'Alagoinhas', slug: 'alagoinhas', desc: 'Município baiano com forte polo de bebidas.', ibge: '2900702', stateId: '29' },
  { name: 'Catu', slug: 'catu', desc: 'Município baiano na região metropolitana de Salvador, histórico de exploração de petróleo.', ibge: '2907509', stateId: '29' },
  { name: 'Candeias', slug: 'candeias', desc: 'Município baiano com forte presença industrial, refinaria e porto.', ibge: '2906501', stateId: '29' }
];

async function run() {
  const db = await getDb();
  
  for (const c of cidades) {
    let t = await db.select().from(territories).where(eq(territories.slug, c.slug)).limit(1).then(r => r[0]);
    
    if(!t) {
      console.log(`Criando território: ${c.name}`);
      await db.insert(territories).values({
        name: c.name,
        slug: c.slug,
        description: c.desc,
        boundaries: {},
        status: 'active',
        contextData: {
          ibgeMunicipios: [c.ibge],
          rssQueries: [c.name, `Prefeitura de ${c.name}`],
          fogoCruzadoStateId: c.stateId
        }
      });
      t = await db.select().from(territories).where(eq(territories.slug, c.slug)).limit(1).then(r => r[0]);
    }
    
    console.log(`\n=============================================`);
    console.log(`Executando orquestrador para: ${t.name}`);
    console.log(`=============================================`);
    const res = await orchestrator.run(t);
    
    console.log(`STT Final (${c.name}): ${res.stt}`);
    console.log(`Sinais Coletados: ${res.totalSignals}`);
    console.log(`Cenário: ${res.scenario}`);
    
    const dbScores = await db.select().from(sttScores).where(eq(sttScores.territoryId, t.id)).limit(1).then(r => r[0]);
    console.log(`\n--- NOTA EXECUTIVA ---`);
    console.log(dbScores?.executiveNote || "Nenhuma nota gerada.");
  }
  process.exit(0);
}

run().catch(console.error);
