import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const slug = process.argv[2];
  const db = await getDb();
  if (!db) return;
  const t = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1).then(r=>r[0]);
  console.log(JSON.stringify(t?.contextData, null, 2));
  process.exit(0);
}
run();
