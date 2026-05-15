import { getDb } from '../server/db';
import { signals, territories } from '../drizzle/schema';
import { and, eq, like, notLike, or } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  if (!db) return;

  const territory = await db.select().from(territories).where(eq(territories.slug, 'baia-guanabara')).limit(1).then(r=>r[0]);
  if (!territory) return;

  console.log(`Limpando sinais irrelevantes de "Santana" em Baía de Guanabara...`);

  // Deletar sinais que citam Santana do Ipanema ou Feira de Santana
  const res = await db.delete(signals).where(
    and(
      eq(signals.territoryId, territory.id),
      or(
        like(signals.title, '%Santana do Ipanema%'),
        like(signals.title, '%Feira de Santana%'),
        like(signals.title, '%Santana de Parnaíba%')
      )
    )
  );

  console.log(`✅ Sinais limpos.`);
  process.exit(0);
}
run();
