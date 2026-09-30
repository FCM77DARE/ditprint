/**
 * Seed de QA local: dois territorios de TESTE com rascunho do motor, sem chamar nenhuma API paga.
 * Uso: npx tsx scripts/seed-qa-local.ts   (recusa rodar em producao)
 * Os dados sao obviamente ficticios ("Teste QA") e servem para exercitar o portao de publicacao.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { territories } from "../drizzle/schema";
import { registrarRascunho } from "../server/publicacao";
import type { Leitura } from "../shared/leitura";

if (process.env.NODE_ENV === "production") throw new Error("Seed de QA nao roda em producao.");

const NOMES = ["Economia", "Infraestrutura", "Institucional", "Segurança", "Social", "Território"];

function leitura(tensao: number, confianca: number): Leitura {
  return {
    tensao,
    confianca,
    faixa: { min: Math.max(0, tensao - 8), max: Math.min(100, tensao + 8) },
    dimensoes: NOMES.map((nome, i) => ({
      id: `D${i + 1}`,
      nome,
      score: Math.max(0, Math.min(100, tensao + (i - 2) * 4)),
      peso: [0.2, 0.2, 0.15, 0.15, 0.15, 0.15][i],
      medida: true,
      fonte: "sinal" as const,
    })),
  };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Sem banco.");
  const alvos = [
    { slug: "teste-qa-publicado", name: "Teste QA Publicado", stt: 42, conf: 78 },
    { slug: "teste-qa-rascunho", name: "Teste QA Rascunho", stt: 63, conf: 71 },
  ];
  for (const a of alvos) {
    await db.insert(territories).values({ slug: a.slug, name: a.name, state: "RJ", region: "Teste", active: true }).onDuplicateKeyUpdate({ set: { name: a.name } });
    const [t] = await db.select().from(territories).where(eq(territories.slug, a.slug)).limit(1);
    const period = new Date().toISOString().slice(0, 7);
    await registrarRascunho({
      slug: a.slug, territoryId: t.id, nome: a.name, estado: "RJ", regiao: "Teste", period, stt: a.stt,
      dims: { d1: a.stt, d2: a.stt - 4, d3: a.stt + 4, d4: a.stt - 8, d5: a.stt + 8, d6: a.stt, d7: null },
      activatedIndex: "D1", notaExecutiva: "Nota de teste de QA. Sem valor analítico.", leitura: leitura(a.stt, a.conf), nSinais: 12,
    });
    console.log("ok", a.slug, t.id);
  }
  process.exit(0);
}
main();
