import { getDb } from '../server/db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  console.log("Convertendo coluna 'source' de ENUM para VARCHAR...");
  
  try {
    await db.execute(sql`ALTER TABLE signals MODIFY COLUMN source VARCHAR(100) NOT NULL`);
    console.log("✅ Coluna atualizada!");
  } catch (err) {
    console.error("❌ Falha ao atualizar coluna:", err);
  }

  process.exit(0);
}

run().catch(console.error);
