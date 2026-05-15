import { getDb } from '../server/db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  console.log("Atualizando ENUM de fontes no MySQL...");
  
  try {
    await db.execute(sql`ALTER TABLE signals MODIFY COLUMN source ENUM(
      'newsapi', 'dou', 'ibama', 'ibama-embargo', 'ibama-auto-infracao', 
      'ibge-censo', 'ibge-rendimento', 'inpe-deter', 'inpe-prodes', 
      'ana-hidroweb', 'ana-outorgas', 'querido-diario', 'google-rss', 
      'manual', 'inea', 'icmbio', 'universidades'
    ) NOT NULL`);
    console.log("✅ ENUM atualizado com sucesso!");
  } catch (err) {
    console.error("❌ Falha ao atualizar ENUM:", err);
  }

  process.exit(0);
}

run().catch(console.error);
