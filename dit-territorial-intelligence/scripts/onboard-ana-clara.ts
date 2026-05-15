import { getDb } from '../server/db';
import { territories } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { invokeLLM } from '../server/_core/llm';
import { spawn } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const db = await getDb();
  const name = "Jardim Ana Clara";
  const region = "Duque de Caxias, RJ";
  const slug = "jardim-ana-clara-caxias";

  console.log(`\n--- Iniciando Onboarding DIT PRINT: ${name} (${region}) ---`);

  // 1. Criar o território no DB
  await db.insert(territories).values({
    name,
    slug,
    region,
    type: "bairro",
    onboardingStatus: "ready", // Forçando ready para disparar o backfill
    active: true
  });

  const newTerritory = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1).then(r=>r[0]);
  if (!newTerritory) throw new Error("Falha ao criar território");

  console.log(`ID Criado: ${newTerritory.id}`);

  // 2. Gerar Contexto via LLM (Simulando o Territory Wizard do Router)
  const llmPrompt = `Gere o contexto territorial para o bairro ${name} em ${region}. 
  Foque em vulnerabilidades sociais, infraestrutura urbana, presença de facções ou conflitos territoriais, 
  e aspectos ambientais específicos da Baixada Fluminense. 
  Responda APENAS com JSON no formato { historicalBackground: string, institutionalActors: string, searchQueries: string[] }.`;

  const llmResponse = await invokeLLM({
    messages: [{ role: "user", content: llmPrompt }],
    response_format: { type: "json_object" }
  });

  const contextData = JSON.parse(llmResponse.choices[0].message.content || "{}");
  
  // Incluir queries de busca específicas
  contextData.rssQueries = [
    `${name} Duque de Caxias`,
    `"Jardim Ana Clara" Caxias`,
    `violência Jardim Ana Clara Duque de Caxias`,
    `obras Jardim Ana Clara Caxias`
  ];

  await db.update(territories)
    .set({ contextData })
    .where(eq(territories.id, newTerritory.id));

  console.log(`Contexto LLM gerado e salvo.`);

  // 3. Disparar Backfill de 24 Meses (Regra Automática)
  console.log(`Disparando Backfill de 24 meses em background...`);
  const scriptPath = path.join(process.cwd(), "scripts", "backfill-single-territory.ts");
  const child = spawn("npx", ["tsx", scriptPath, slug], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd()
  });
  child.unref();

  console.log(`\n✅ Onboarding Concluído!`);
  console.log(`Acesse: http://localhost:4001/dashboard/dit/${slug}`);
  process.exit(0);
}

run().catch(console.error);
