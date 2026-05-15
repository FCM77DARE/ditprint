import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) return;
  const list = await db.select().from(territories);
  console.log(`Territórios encontrados: ${list.length}`);
  list.forEach(t => {
    console.log(`- ${t.name} (${t.slug}) | Status: ${t.onboardingStatus}`);
  });
  process.exit(0);
}
run();
