import { getDb } from '../server/db';
import { territories, indexHistory, signals } from '../drizzle/schema';
import { eq, and, desc, inArray, gte, lte } from 'drizzle-orm';
import { invokeLLM } from '../server/_core/llm';
import * as fs from 'fs';
import * as path from 'path';

const slugs = ['alagoinhas', 'catu', 'candeias', 'itambi', 'mage', 'jardim-ana-clara-caxias'];
const period = '2026-05';

async function run() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  for (const slug of slugs) {
    console.log(`Gerando DIT para ${slug}...`);
    
    const territory = await db.select().from(territories).where(eq(territories.slug, slug)).limit(1).then(r=>r[0]);
    if (!territory) continue;

    const [history] = await db
      .select()
      .from(indexHistory)
      .where(and(eq(indexHistory.territoryId, territory.id), eq(indexHistory.period, period)))
      .limit(1);

    if (!history) {
      console.log(`Sem histórico para ${slug} em ${period}`);
      continue;
    }

    // Buscar sinais do mês
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

    const prompt = `Você é o estrategista chefe da Print Territorial Intelligence™.
    
    Gere o relatório executivo DIT (Diagnóstico de Inteligência Territorial) COMPLETO E PREMIUM em formato Markdown para venda aos clientes (CEOs, Diretores de Sustentabilidade, Investidores).
    Este é o produto final de alto valor agregado.
    
    TERRITÓRIO: ${territory.name}
    PERÍODO: ${period}
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
    ${signalsList}
    
    RATIONALE GERADO PELO MOTOR:
    ${history.llmRationale}
    
    INSTRUÇÕES DE FORMATAÇÃO:
    O documento deve ser extremamente profissional, persuasivo e profundo.
    
    ESTRUTURA OBRIGATÓRIA:
    # Diagnóstico de Inteligência Territorial (DIT) - ${territory.name}
    ## Ciclo de Monitoramento: Maio / 2026
    
    ### 1. Síntese Executiva (Executive Summary)
    (Visão de helicóptero do cenário atual e o que o STT de ${history.stt} significa na prática operacional).
    
    ### 2. Matriz de Tensão (As 6 Dimensões PRINT)
    (Analise os scores D1 a D6 fornecidos. Destaque quais estão pressionando o STT e quais estão amortecendo o risco).
    
    ### 3. Sinais de Alerta e Ruptura (Key Intelligence)
    (Selecione os 3 a 5 sinais mais críticos da lista fornecida e explique o IMPACTO deles para negócios/governos).
    
    ### 4. Cenário Projetado (Forecast)
    (Baseado no cenário atual de '${history.scenario}', o que esperar para o próximo trimestre? Quais riscos podem escalar?).
    
    ### 5. Recomendações Estratégicas (Action Plan)
    (3 diretrizes claras do que o cliente deve fazer AGORA para mitigar riscos ou capturar oportunidades).
    
    ---
    *Confidencial - Gerado pela Inteligência DIT PRINT*
    `;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Você é um consultor sênior de inteligência estratégica. Escreva de forma executiva, profunda e analítica. Sem fluff." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    if (content) {
      const filePath = path.join(process.cwd(), `DIT_${slug.toUpperCase()}_MAIO_2026.md`);
      fs.writeFileSync(filePath, content);
      console.log(`Documento gerado: ${filePath}`);
    }
  }
  process.exit(0);
}

run().catch(console.error);
