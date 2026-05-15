import { getDb } from '../server/db';
import { territories, indexHistory, signals } from '../drizzle/schema';
import { eq, and, desc, inArray, gte, lte } from 'drizzle-orm';
import { orchestrator } from '../server/agents/orchestrator';
import { invokeLLM } from '../server/_core/llm';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const newCities = [
  { slug: 'itambi', name: 'Itambi', state: 'RJ' },
  { slug: 'mage', name: 'Magé', state: 'RJ' }
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

  for (const city of newCities) {
    console.log(`\n========================================================`);
    console.log(` PROCESSANDO: ${city.name.toUpperCase()}`);
    console.log(`========================================================`);

    // 1. Inserir território se não existir
    let territory = await db.select().from(territories).where(eq(territories.slug, city.slug)).limit(1).then(r=>r[0]);
    if (!territory) {
      console.log(`Criando território ${city.name}...`);
      await db.insert(territories).values({
        slug: city.slug,
        name: city.name,
        state: city.state,
        active: true,
        onboardingStatus: "ready",
        contextData: {
          rssQueries: [city.name, `${city.name} prefeitura`, `${city.name} meio ambiente`, `${city.name} infraestrutura`],
          newsApiQueries: [city.name]
        }
      });
      territory = await db.select().from(territories).where(eq(territories.slug, city.slug)).limit(1).then(r=>r[0]);
    }

    // 2. Rodar Orchestrator (Jan-Mai)
    for (const p of periods) {
      console.log(`>>> Rodando DIT para ${p.period}...`);
      const res = await orchestrator.run(territory!, {
        period: p.period,
        dateStart: p.dateStart,
        dateEnd: p.dateEnd
      });
      console.log(`    STT: ${res.stt}`);
    }

    // 3. Gerar Documento Final (Maio)
    console.log(`>>> Gerando Relatório Executivo Final...`);
    const [history] = await db
      .select()
      .from(indexHistory)
      .where(and(eq(indexHistory.territoryId, territory!.id), eq(indexHistory.period, '2026-05')))
      .limit(1);

    if (!history) continue;

    const start = new Date('2026-05-01');
    const end = new Date('2026-05-31');
    const relevantSignals = await db
      .select()
      .from(signals)
      .where(and(
        eq(signals.territoryId, territory!.id),
        gte(signals.publishedAt, start),
        lte(signals.publishedAt, end),
        gte(signals.llmImpactScore, 0.4)
      ))
      .orderBy(desc(signals.llmImpactScore))
      .limit(15);

    const signalsList = relevantSignals
      .map((s) => `- [${s.relatedIndex}] ${s.title}${s.llmAnalysis ? ` -> ${s.llmAnalysis}` : ""}`)
      .join("\n");

    const prompt = `Você é o estrategista chefe da Print Territorial Intelligence™.
    
    Gere o relatório executivo DIT (Diagnóstico de Inteligência Territorial) COMPLETO E PREMIUM em formato Markdown para venda aos clientes (CEOs, Diretores de Sustentabilidade, Investidores).
    Este é o produto final de alto valor agregado.
    
    TERRITÓRIO: ${territory!.name}
    PERÍODO: 2026-05
    STT ATUAL: ${history.stt}
    CENÁRIO: ${history.scenario}
    
    PONTUAÇÕES (Dimensões):
    - D1 (Socioambiental): ${history.d1Score}
    - D2 (Socioeconômica): ${history.d2Score}
    - D3 (Infraestrutura): ${history.d3Score}
    - D4 (Dinâmica): ${history.d4Score}
    - D5 (Governança): ${history.d5Score}
    - D6 (Reputação): ${history.d6Score}
    
    SINAIS CAPTURADOS (Alto Impacto):
    ${signalsList || 'Nenhum sinal crítico de alto impacto detectado neste ciclo.'}
    
    RATIONALE GERADO PELO MOTOR:
    ${history.llmRationale || 'Aguardando validação de cenário local.'}
    
    INSTRUÇÕES DE FORMATAÇÃO:
    O documento deve ser extremamente profissional, persuasivo e profundo.
    
    ESTRUTURA OBRIGATÓRIA:
    # Diagnóstico de Inteligência Territorial (DIT) - ${territory!.name}
    ## Ciclo de Monitoramento: Maio / 2026
    
    ### 1. Síntese Executiva (Executive Summary)
    (Visão de helicóptero do cenário atual e o que o STT de ${history.stt} significa na prática operacional).
    
    ### 2. Matriz de Tensão (As 6 Dimensões PRINT)
    (Analise os scores D1 a D6 fornecidos. Destaque quais estão pressionando o STT e quais estão amortecendo o risco).
    
    ### 3. Sinais de Alerta e Ruptura (Key Intelligence)
    (Selecione os 3 a 5 sinais mais críticos da lista fornecida e explique o IMPACTO deles para negócios/governos). Se não houver, explique a calmaria.
    
    ### 4. Cenário Projetado (Forecast)
    (Baseado no cenário atual de '${history.scenario}', o que esperar para o próximo trimestre? Quais riscos podem escalar?).
    
    ### 5. Recomendações Estratégicas (Action Plan)
    (3 diretrizes claras do que o cliente deve fazer AGORA para mitigar riscos ou capturar oportunidades).
    
    ---
    *Confidencial - Gerado pela Inteligência DIT PRINT*
    `;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Você é um consultor sênior de inteligência estratégica. Escreva de forma executiva, profunda e analítica." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (content) {
      const filePath = path.join(process.cwd(), `DIT_${city.slug.toUpperCase()}_MAIO_2026.md`);
      fs.writeFileSync(filePath, content);
      console.log(`Documento gerado: ${filePath}`);
    }
  }
  process.exit(0);
}

run().catch(console.error);
