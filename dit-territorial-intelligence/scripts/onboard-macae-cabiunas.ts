import { getDb } from '../server/db';
import { territories, indexHistory, signals } from '../drizzle/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { orchestrator } from '../server/agents/orchestrator';
import { reporterAgent } from '../server/agents/reporterAgent';
import { invokeLLM } from '../server/_core/llm';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const newTerritories = [
  { slug: 'cabiunas', name: 'Cabiúnas', region: 'Macaé, RJ', type: 'bairro', state: 'RJ' }
];

const periods = [
  { period: "2026-01", dateStart: "01/01/2026", dateEnd: "01/31/2026" },
  { period: "2026-02", dateStart: "02/01/2026", dateEnd: "02/28/2026" },
  { period: "2026-03", dateStart: "03/01/2026", dateEnd: "03/31/2026" },
  { period: "2026-04", dateStart: "04/01/2026", dateEnd: "04/30/2026" },
  { period: "2026-05", dateStart: "05/01/2026", dateEnd: "05/31/2026" }
];

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  for (const tConfig of newTerritories) {
    console.log(`\n========================================================`);
    console.log(` PROCESSANDO ONBOARDING: ${tConfig.name.toUpperCase()}`);
    console.log(`========================================================`);

    // 1. Inserir território se não existir
    let territory = await db.select().from(territories).where(eq(territories.slug, tConfig.slug)).limit(1).then(r=>r[0]);
    
    if (!territory) {
      console.log(`Criando território ${tConfig.name}...`);
      await db.insert(territories).values({
        slug: tConfig.slug,
        name: tConfig.name,
        region: tConfig.region,
        type: tConfig.type,
        state: tConfig.state,
        active: true,
        onboardingStatus: "ready"
      });
      territory = await db.select().from(territories).where(eq(territories.slug, tConfig.slug)).limit(1).then(r=>r[0]);
    }

    if (!territory) throw new Error(`Falha ao criar/recuperar território ${tConfig.slug}`);

    // 2. Gerar Contexto via LLM
    console.log(`Gerando contexto estratégico via LLM...`);
    const llmPrompt = `Gere o contexto territorial para ${tConfig.name} (${tConfig.region}). 
    Foque em aspectos socioeconômicos (Petróleo e Gás), vulnerabilidades, infraestrutura e segurança.
    Para Cabiúnas, foque especificamente no Terminal de Cabiúnas (TECA) e impactos do polo de gás.
    Responda APENAS com JSON no formato { historicalBackground: string, institutionalActors: string, searchQueries: string[] }.`;

    const llmResponse = await invokeLLM({
      messages: [{ role: "user", content: llmPrompt }],
      response_format: { type: "json_object" }
    });

    const contextData = JSON.parse(llmResponse.choices[0].message.content || "{}");
    contextData.rssQueries = [
      tConfig.name,
      `${tConfig.name} Petrobras`,
      `${tConfig.name} segurança`,
      `${tConfig.name} infraestrutura`
    ];
    contextData.newsApiQueries = [tConfig.name];

    await db.update(territories)
      .set({ contextData })
      .where(eq(territories.id, territory.id));

    console.log(`Contexto LLM salvo.`);

    // 3. Rodar Orchestrator (Jan-Mai 2026)
    for (const p of periods) {
      console.log(`>>> Rodando DIT para ${p.period}...`);
      const res = await orchestrator.run(territory, {
        period: p.period,
        dateStart: p.dateStart,
        dateEnd: p.dateEnd
      });
      console.log(`    STT: ${res.stt.toFixed(2)} | Cenário: ${res.scenario}`);
    }

    // 4. Gerar Relatório Executivo Final (Maio 2026)
    console.log(`>>> Gerando Relatório Executivo Final (Maio/2026)...`);
    const [history] = await db
      .select()
      .from(indexHistory)
      .where(and(eq(indexHistory.territoryId, territory.id), eq(indexHistory.period, '2026-05')))
      .limit(1);

    if (history) {
      const start = new Date('2026-05-01');
      const end = new Date('2026-05-31');
      const relevantSignals = await db
        .select()
        .from(signals)
        .where(and(
          eq(signals.territoryId, territory.id),
          gte(signals.publishedAt, start),
          lte(signals.publishedAt, end),
          gte(signals.llmImpactScore, 0.4)
        ))
        .orderBy(desc(signals.llmImpactScore))
        .limit(15);

      const signalsList = relevantSignals
        .map((s) => `- [${s.relatedIndex}] ${s.title}${s.llmAnalysis ? ` -> ${s.llmAnalysis}` : ""}`)
        .join("\n");

      const reportPrompt = `Você é o estrategista chefe da Print Territorial Intelligence™.
      Gere um relatório executivo DIT PREMIUM em Markdown para ${territory.name}.
      
      PERÍODO: Maio / 2026
      STT ATUAL: ${history.stt}
      CENÁRIO: ${history.scenario}
      
      PONTUAÇÕES:
      D1: ${history.d1Score}, D2: ${history.d2Score}, D3: ${history.d3Score}, D4: ${history.d4Score}, D5: ${history.d5Score}, D6: ${history.d6Score}
      
      SINAIS:
      ${signalsList || 'Nenhum sinal crítico detectado.'}
      
      RATIONALE:
      ${history.llmRationale || ''}
      
      Estruture com: Síntese Executiva, Matriz de Tensão, Sinais de Alerta, Cenário Projetado e Recomendações.`;

      const reportResponse = await invokeLLM({
        messages: [
          { role: "system", content: "Consultor sênior de inteligência estratégica." },
          { role: "user", content: reportPrompt },
        ],
      });

      const content = reportResponse.choices?.[0]?.message?.content;
      if (content) {
        const sourcesSection = await reporterAgent.generateSourcesSection(territory.id, '2026-05');
        const finalContent = content.trim() + "\n\n" + sourcesSection + "\n---\n*Confidencial - Gerado pela Inteligência DIT PRINT*\n";
        
        const filePath = path.join(process.cwd(), `DIT_${territory.slug.toUpperCase()}_MAIO_2026.md`);
        fs.writeFileSync(filePath, finalContent);
        console.log(`Documento gerado: ${filePath}`);
      }
    }

    // 5. Disparar Backfill de 24 Meses em Background
    console.log(`Disparando Backfill de 24 meses em background para ${territory.slug}...`);
    const scriptPath = path.join(process.cwd(), "scripts", "backfill-single-territory.ts");
    const child = spawn("npx", ["tsx", scriptPath, territory.slug], {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
      shell: true
    });
    child.unref();
  }

  console.log(`\n✅ Onboarding e Execução Inicial Concluídos para Macaé e Cabiúnas!`);
  process.exit(0);
}

run().catch(console.error);
