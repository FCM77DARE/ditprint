import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

const GLOBAL_HOTSPOTS: Record<string, string[]> = {
  'baia-guanabara': ["Canal do Fundão", "Estação de Tratamento de Alegria (ETE)", "Ilha do Governador - Área Industrial", "Porto do Rio"],
  'jardim-ana-clara-caxias': ["Lixão de Gramacho (Entorno)", "Rio Sarapuí", "Refinaria Duque de Caxias (REDUC)"],
  'teles-pires': ["UHE Teles Pires", "Rio Paranaíta", "Áreas de Garimpo Ilegal"],
  'corredor-mineral': ["Mina de Alegria", "Barragem de Rejeitos", "Ferrovia Vitória-Minas (EFVM)"],
  'itambi': ["Comperj (Polo Gaslub Itaboraí)", "Rio Aldeia"],
  'mage': ["APA de Guapi-Mirim", "Rio Inhomirim"]
};

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const list = await db.select().from(territories);

  for (const territory of list) {
    if (!territory.slug) continue;
    
    const hotspots = GLOBAL_HOTSPOTS[territory.slug] || [];
    if (hotspots.length === 0 && !territory.slug.includes('macae') && !territory.slug.includes('cabiunas')) {
       console.log(`⚠️ Nenhum hotspot predefinido para ${territory.slug}. Mantendo original.`);
       continue;
    }

    let contextData = territory.contextData;
    if (typeof contextData === 'string') contextData = JSON.parse(contextData);
    contextData = contextData || {};

    // Se já tiver hotspots (ex: Macaé), não sobrescreve a menos que queira expandir
    if (hotspots.length > 0) {
      (contextData as any).environmentalHotspots = hotspots;
      (contextData as any).rssQueries = Array.from(new Set([...((contextData as any).rssQueries || []), ...hotspots]));
    }

    await db.update(territories)
      .set({ contextData })
      .where(eq(territories.id, territory.id));

    console.log(`✅ Contexto de ${territory.slug} atualizado com hotspots: ${hotspots.join(", ")}`);
  }

  process.exit(0);
}

run().catch(console.error);
