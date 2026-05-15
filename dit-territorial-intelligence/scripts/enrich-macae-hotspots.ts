import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

const MACAE_HOTSPOTS = [
  "Ilha de Santana",
  "Parque Nacional da Restinga de Jurubatiba",
  "APA do Arquipélago de Santana",
  "Praia do Pecado",
  "Lagoa de Imboassica",
  "Terminal de Cabiúnas (TECA)",
  "Porto de Macaé"
];

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const targets = ['macae', 'cabiunas'];

  for (const slug of targets) {
    const territory = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1).then(r=>r[0]);
    if (!territory) continue;

    let contextData = territory.contextData;
    if (typeof contextData === 'string') {
      try {
        contextData = JSON.parse(contextData);
      } catch (e) {
        contextData = {};
      }
    }
    
    // Expandir queries
    const currentQueries = new Set((contextData as any).rssQueries || []);
    MACAE_HOTSPOTS.forEach(h => {
      currentQueries.add(h);
      currentQueries.add(`${h} crime`);
      currentQueries.add(`${h} ambiental`);
      currentQueries.add(`${h} poluição`);
    });

    (contextData as any).rssQueries = Array.from(currentQueries);
    (contextData as any).environmentalHotspots = MACAE_HOTSPOTS;

    await db.update(territories)
      .set({ contextData })
      .where(eq(territories.id, territory.id));

    console.log(`✅ Contexto de ${slug} atualizado com hotspots críticos: ${MACAE_HOTSPOTS.join(", ")}`);
  }

  process.exit(0);
}

run().catch(console.error);
