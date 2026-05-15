import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';

async function list() {
  const db = await getDb();
  if (!db) {
    console.error("DB unavailable");
    process.exit(1);
  }
  const all = await db.select().from(territories);
  console.log(JSON.stringify(all, null, 2));
  process.exit(0);
}

list().catch(console.error);
