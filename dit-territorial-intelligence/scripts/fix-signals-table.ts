import { getDb } from '../server/db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  console.log("Corrigindo estrutura da tabela 'signals'...");
  
  try {
    await db.execute(sql`ALTER TABLE signals 
      MODIFY COLUMN source VARCHAR(100) NOT NULL,
      MODIFY COLUMN curatedAt TIMESTAMP NULL DEFAULT NULL`);
    console.log("✅ Tabela corrigida e atualizada!");
  } catch (err) {
    console.error("❌ Falha crítica na atualização:", err);
  }

  process.exit(0);
}

run().catch(console.error);
