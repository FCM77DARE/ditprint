import { getDb } from "../db";
import { signals, indexHistory, territories } from "../../drizzle/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { logger } from "../_core/logger";
import { invokeLLM } from "../_core/llm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const log = logger.child({ module: "reporter-agent" });

interface SourceInfo {
  id: string;
  name: string;
  dimension: string;
}

export class ReporterAgent {
  private readonly ALL_SOURCES: SourceInfo[] = [
    // D1
    { id: "src-inmet", name: "INMET (Meteorologia)", dimension: "D1" },
    { id: "src-cptec-inpe", name: "CPTEC/INPE (Previsão de Tempo)", dimension: "D1" },
    { id: "src-ibge-mapbiomas", name: "MapBiomas (Uso da Terra)", dimension: "D1" },
    { id: "src-cnuc", name: "ICMBio/CNUC (Unidades de Conservação)", dimension: "D1" },
    { id: "src-inea", name: "INEA (Licenciamento/Alertas RJ)", dimension: "D1" },
    { id: "src-cemaden", name: "CEMADEN (Alertas de Desastres)", dimension: "D1" },
    { id: "src-fiocruz-clima", name: "Fiocruz (Saúde e Clima)", dimension: "D1" },
    { id: "src-inpe-deter", name: "INPE DETER (Desmatamento)", dimension: "D1" },
    { id: "src-ibama", name: "IBAMA (Fiscalização/Embargos)", dimension: "D1" },
    { id: "src-mp-ambiental", name: "Ministério Público (Ações Ambientais)", dimension: "D1" },
    // D2
    { id: "src-ibge-censo", name: "IBGE Censo (Demografia)", dimension: "D2" },
    { id: "src-ibge-renda", name: "IBGE Rendimento (Socioeconomia)", dimension: "D2" },
    { id: "src-pnud-atlas", name: "PNUD (Atlas de Desenv. Humano)", dimension: "D2" },
    { id: "src-ipeadata", name: "IPEADATA (Indicadores Macroeconômicos)", dimension: "D2" },
    // D3
    { id: "src-snis-sinasa", name: "SNIS (Saneamento Básico)", dimension: "D3" },
    { id: "src-datasus", name: "DATASUS (Saúde Pública)", dimension: "D3" },
    { id: "src-inep", name: "INEP (Educação)", dimension: "D3" },
    { id: "src-mapa-empresas", name: "Mapa de Empresas (Dinâmica Econômica)", dimension: "D3" },
    { id: "src-antt-portos", name: "ANTT/Portos (Logística)", dimension: "D3" },
    { id: "src-sinir", name: "SINIR (Resíduos Sólidos)", dimension: "D3" },
    // D4
    { id: "src-plano-diretor", name: "Plano Diretor (Uso do Solo)", dimension: "D4" },
    { id: "src-judiciario", name: "Tribunais de Justiça (Litígios)", dimension: "D4" },
    { id: "src-fogo-cruzado", name: "Fogo Cruzado (Violência Armada)", dimension: "D4" },
    { id: "src-geni-uff", name: "GENI/UFF (Segurança Pública)", dimension: "D4" },
    { id: "src-isp-ssp", name: "ISP/SSP (Estatísticas Criminais)", dimension: "D4" },
    { id: "src-funai-iphan", name: "FUNAI/IPHAN (Territórios Especiais)", dimension: "D4" },
    // D5
    { id: "src-querido-diario", name: "Querido Diário (Diários Oficiais)", dimension: "D5" },
    { id: "src-conselhos", name: "Conselhos Municipais (Participação)", dimension: "D5" },
    { id: "src-audiencias", name: "Audiências Públicas", dimension: "D5" },
    // D6
    { id: "src-google-news", name: "Google News (Imprensa)", dimension: "D6" },
    { id: "src-google-trends", name: "Google Trends (Interesse Digital)", dimension: "D6" },
    { id: "src-universidades", name: "Universidades (Trabalhos Científicos)", dimension: "D6" },
    { id: "src-google-rss", name: "Monitoramento de Tópicos (RSS)", dimension: "D6" },
    // D7
    { id: "src-google-news", name: "Google News (Imprensa)", dimension: "D7" },
    { id: "src-universidades", name: "Universidades (Trabalhos Científicos)", dimension: "D7" }
  ];

  async generateSourcesSection(territoryId: number, period: string): Promise<string> {
    const db = await getDb();
    if (!db) return "";

    const [year, month] = period.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const collectedSignals = await db
      .select()
      .from(signals)
      .where(
        and(
          eq(signals.territoryId, territoryId),
          gte(signals.publishedAt, startDate),
          lte(signals.publishedAt, endDate)
        )
      );

    const signalsBySource: Record<string, typeof collectedSignals> = {};
    for (const s of collectedSignals) {
      const src = s.source || "src-google-rss";
      if (!signalsBySource[src]) signalsBySource[src] = [];
      signalsBySource[src].push(s);
    }

    let markdown = "\n## 4. Metodologia e Inteligência Conectada\n\n";
    markdown += "O Diagnóstico de Inteligência Territorial (DIT) é gerado através do monitoramento contínuo de uma rede de fontes governamentais, acadêmicas e de imprensa. Abaixo, detalhamos o status das fontes para este ciclo:\n\n";

    const dimensions = ["D1", "D2", "D3", "D4", "D5", "D6", "D7"];
    const dimNames: Record<string, string> = {
      D1: "Socioambiental", D2: "Socioeconômica", D3: "Infraestrutura",
      D4: "Dinâmica Territorial", D5: "Governança", D6: "Reputação",
      D7: "Recursos Naturais e Potencial"
    };

    for (const dim of dimensions) {
      const dimSources = this.ALL_SOURCES.filter(s => s.dimension === dim);
      markdown += `### Dimensão ${dim}: ${dimNames[dim]}\n`;
      markdown += "| Fonte | Status | Sinais | Exemplos Capturados |\n";
      markdown += "| :--- | :--- | :--- | :--- |\n";

      for (const src of dimSources) {
        const signals = signalsBySource[src.id] || [];
        const status = signals.length > 0 ? "**Ativa**" : "Monitorada (Estável)";
        const count = signals.length;
        
        let examples = "-";
        if (signals.length > 0) {
          const topExamples = signals
            .sort((a, b) => (b.llmImpactScore || 0) - (a.llmImpactScore || 0))
            .slice(0, 2);
          examples = topExamples.map(e => `"${e.title.substring(0, 40)}${e.title.length > 40 ? '...' : ''}"`).join("<br>");
        }

        markdown += `| ${src.name} | ${status} | ${count} | ${examples} |\n`;
      }
      markdown += "\n";
    }

    return markdown;
  }

  /**
   * Gera o relatório DIT PREMIUM completo e profundo.
   */
  async generatePremiumReport(territoryId: number, period: string): Promise<string> {
    const db = await getDb();
    if (!db) return "Erro: Banco de dados indisponível.";

    const [territory] = await db.select().from(territories).where(eq(territories.id, territoryId)).limit(1);
    if (!territory) return "Erro: Território não encontrado.";

    const [history] = await db
      .select()
      .from(indexHistory)
      .where(and(eq(indexHistory.territoryId, territoryId), eq(indexHistory.period, period)))
      .limit(1);

    if (!history) return "Erro: Dados históricos não encontrados para este período.";

    // Buscar sinais
    const [year, month] = period.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const relevantSignals = await db
      .select()
      .from(signals)
      .where(and(
        eq(signals.territoryId, territoryId),
        gte(signals.publishedAt, startDate),
        lte(signals.publishedAt, endDate)
      ))
      .orderBy(desc(signals.llmImpactScore));

    // Passo 1: Sintetizar Sinais por Dimensão (para não estourar tokens e manter profundidade)
    const signalsSummary = this._synthesizeSignals(relevantSignals);

    // Passo 2: Buscar Geotags e Entidades Específicas
    const entitiesPrompt = `Abaixo estão os títulos de ${relevantSignals.length} sinais coletados em ${territory.name}. 
Identifique e extraia: 
1. Nomes de bairros, ruas ou áreas específicas citadas.
2. Nomes de empresas, órgãos ou grupos de pressão citados.
Responda apenas em JSON: { locations: string[], entities: string[] }.

SINAIS:
${relevantSignals.slice(0, 100).map(s => s.title).join("\n")}`;

    const entitiesResponse = await invokeLLM({
      messages: [{ role: "user", content: entitiesPrompt }],
      response_format: { type: "json_object" }
    });
    const entitiesData = JSON.parse(entitiesResponse.choices[0].message.content || "{}");

    const premises = await this._loadPremises();

    // ─── PRIORIZAÇÃO DE HOTSPOTS MANDATÓRIOS ─────────────────────────────────
    const contextData = (territory.contextData as any) || {};
    const hotspots = contextData.environmentalHotspots || [];
    
    // Buscar sinais que citam os hotspots (mesmo que tenham score baixo)
    const hotspotSignals = relevantSignals.filter(s => 
      hotspots.some((h: string) => 
        s.title.toLowerCase().includes(h.toLowerCase()) || 
        (s.summary && s.summary.toLowerCase().includes(h.toLowerCase()))
      )
    );
    const prompt = `Você é o Estrategista-Chefe da Print Territorial Intelligence™.
Gere um DIT (Diagnóstico de Inteligência Territorial) PROFUNDO e CIRÚRGICO para ${territory.name.toUpperCase()}.
ESTE TERRITÓRIO É ${territory.name.toUpperCase()} (ESTADO: ${territory.contextData && (territory.contextData as any).estado ? (territory.contextData as any).estado : 'RJ'}).
NÃO CONFUNDA COM OUTROS TERRITÓRIOS. NÃO MENCIONE MACAÉ, CABIÚNAS OU SANTANA.

${hotspots.length > 0 ? `HOTSPOTS DE MONITORAMENTO ESPECÍFICO:
${hotspots.join(", ")}

SINAIS IDENTIFICADOS PARA ESTES HOTSPOTS:
${hotspotSignals.length > 0 
  ? hotspotSignals.map(s => `- [${s.source}] ${s.title}: ${s.summary}`).join("\n") 
  : `AVISO: Nenhum sinal direto capturado pela rede para estes hotspots específicos este mês. Analise a conformidade geral.`
}` : ""}

CONTEXTO GEOGRÁFICO/ENTIDADES:
- Locais: ${entitiesData.locations?.join(", ") || "Área urbana geral"}
- Instituições: ${entitiesData.entities?.join(", ") || "Não especificados"}

PERÍODO: ${period} | STT: ${history.stt}
SÍNTESE DE INTELIGÊNCIA GERAL:
${signalsSummary}

TAREFA:
1. ${hotspots.length > 0 ? `No item "2. HOTSPOTS", você DEVE analisar obrigatoriamente a situação de ${hotspots.join(" e ")}.` : "Identifique os principais Hotspots e Entidades sob pressão no item 2."}
2. Use um tom de inteligência militar: fatos, riscos e ações.
3. Se houver sinais de vulnerabilidade ambiental nos hotspots, reporte como "Risco de Conflito".

ESTRUTURA OBRIGATÓRIA:
# DIT PREMIUM - ${territory.name.toUpperCase()}
## Ciclo de Inteligência: ${period}

### 1. ALERTA ESTRATÉGICO (BOTTOM LINE)
### 2. HOTSPOTS E ENTIDADES SOB PRESSÃO
(Divida em "Zonas de Pressão/Risco" e "Zonas de Potencial" como Data Centers, Terras Raras ou Renováveis)
${hotspots.length > 0 
  ? `(Analise obrigatoriamente: ${hotspots.join(", ")})` 
  : "(Analise aqui as principais entidades e locais sob pressão identificados nos sinais)"
}
### 3. ANÁLISE DE IMPACTO DIMENSIONAL
### 4. PLANO DE AÇÃO OPERACIONAL
---
`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Consultor de inteligência militar/estratégica. Estilo conciso, denso em fatos e orientado a ação." },
        { role: "user", content: prompt },
      ],
    });

    const reportContent = response.choices?.[0]?.message?.content || "";
    const sourcesSection = await this.generateSourcesSection(territoryId, period);

    return reportContent + "\n\n" + sourcesSection + "\n---\n*Confidencial - Gerado pela Inteligência DIT PRINT*\n";
  }

  private _synthesizeSignals(signals: any[]): string {
    const dims: Record<string, string[]> = { D1: [], D2: [], D3: [], D4: [], D5: [], D6: [], D7: [] };
    signals.forEach(s => {
      if (dims[s.relatedIndex]) dims[s.relatedIndex].push(s.title);
    });

    let summary = "";
    for (const [dim, titles] of Object.entries(dims)) {
      if (titles.length > 0) {
        summary += `${dim}: ${titles.slice(0, 15).join(" | ")}\n`;
      }
    }
    return summary;
  }

  private async _loadPremises(): Promise<string> {
    const premisesDir = join(process.cwd(), "server", "premises");
    const dims = ["d1", "d2", "d3", "d4", "d5", "d6"];
    let content = "";
    for (const d of dims) {
      try {
        const text = await readFile(join(premisesDir, `${d}.md`), "utf-8");
        content += `\n--- PREMISSAS ${d.toUpperCase()} ---\n${text.slice(0, 300)}...\n`;
      } catch (e) { /* ignore */ }
    }
    return content;
  }
}

export const reporterAgent = new ReporterAgent();
