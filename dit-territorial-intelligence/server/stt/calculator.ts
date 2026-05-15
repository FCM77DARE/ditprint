/**
 * STT Calculator — Engine de Cálculo do Score de Tensão Territorial
 *
 * Responsabilidades:
 *   1. Recebe os scores das 6 dimensões (já calculados pelos dimension agents)
 *   2. Carrega as premissas por dimensão (server/premises/dN.md)
 *   3. Invoca o LLM UMA VEZ por território por dia com contexto completo
 *   4. Verifica a consistência do output LLM: recalcula Σ Di×Wi e valida ±0.5
 *   5. Clamp 0-100 em todos os scores
 *   6. Retorna SttCalculatorOutput com rationale e flags de verificação
 *
 * O LLM gera a nota executiva e confirma/refina os dimension scores.
 * A fórmula STT é calculada deterministicamente; o LLM não pode sobrescrever
 * a matemática — apenas a narrativa executiva.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { invokeLLM } from "../_core/llm";
import { calculateSTT, DIMENSIONS_LIST } from "../indicators";
import type { DimensionId } from "../indicators";
import type { SttCalculatorInput, SttCalculatorOutput } from "./types";
import { logger } from "../_core/logger";

const log = logger.child({ module: "stt-calculator" });

const PREMISES_DIR = join(import.meta.dirname ?? __dirname, "..", "premises");

// ─── Dimension weight map (same as indicators.ts) ─────────────────────────────
const DIM_WEIGHTS: Record<DimensionId, number> = {
  D1: 0.22, D2: 0.15, D3: 0.15, D4: 0.22, D5: 0.15, D6: 0.11,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate the final STT for a territory using the 6-dimension scores and LLM rationale.
 *
 * This is called once per territory per day by the Orchestrator after all
 * dimension agents have completed their runs.
 */
export async function calculateSttWithLLM(
  input: SttCalculatorInput
): Promise<SttCalculatorOutput> {
  const { territory, period, previousScores, dimensionScores } = input;

  // Build score map from dimension agent results
  const agentScores = buildScoreMap(dimensionScores);

  // Deterministic STT (this is authoritative — LLM cannot override)
  const deterministicStt = clampScore(calculateSTT(agentScores));

  log.info(
    { territory: territory.slug, period, deterministicStt, agentScores },
    "STT determinístico calculado"
  );

  // Load premises for context-aware rationale
  const premises = await loadPremises();

  // Build LLM prompt
  const prompt = buildPrompt(territory, period, agentScores, deterministicStt, previousScores, dimensionScores, premises);

  // Invoke LLM (1 call per territory per day)
  let llmOutput: LLMOutput | null = null;
  try {
    llmOutput = await callLLM(prompt, territory.slug);
  } catch (err) {
    log.warn({ err, territory: territory.slug }, "LLM call failed — using deterministic scores only");
  }

  // ─── Post-verification ────────────────────────────────────────────────────
  // Recalculate Σ Di×Wi from LLM's stated dimension scores.
  // If discrepancy > 0.5, we use our deterministic scores and flag the inconsistency.

  let finalScores = agentScores;
  let llmVerificationPassed = false;
  let llmDiscrepancy = 0;
  let executiveNote = "";
  let activatedDimension: DimensionId | "GERAL" = findActivatedDimension(agentScores, previousScores);

  if (llmOutput) {
    const llmScores: Record<DimensionId, number> = {
      D1: clampScore(llmOutput.d1Score),
      D2: clampScore(llmOutput.d2Score),
      D3: clampScore(llmOutput.d3Score),
      D4: clampScore(llmOutput.d4Score),
      D5: clampScore(llmOutput.d5Score),
      D6: clampScore(llmOutput.d6Score),
    };

    const llmRecalculatedStt = calculateSTT(llmScores);
    llmDiscrepancy = Math.abs(llmRecalculatedStt - clampScore(llmOutput.calculatedStt));

    if (llmDiscrepancy <= 0.5) {
      // LLM is internally consistent — accept its dimension refinements
      llmVerificationPassed = true;
      // Blend: use deterministic formula but allow LLM to refine dimension scores
      // within ±5 points of agent scores (prevents hallucinated outliers)
      for (const id of Object.keys(agentScores) as DimensionId[]) {
        const llmVal = llmScores[id];
        const agentVal = agentScores[id];
        if (Math.abs(llmVal - agentVal) <= 5) {
          finalScores[id] = llmVal;
        } else {
          log.warn(
            { dimension: id, agentScore: agentVal, llmScore: llmVal },
            "LLM dimension score outside ±5 bound — using agent score"
          );
        }
      }
    } else {
      log.warn(
        { llmDiscrepancy, llmStt: llmOutput.calculatedStt, recalculated: llmRecalculatedStt },
        "LLM STT verification failed — discrepancy exceeds ±0.5"
      );
    }

    executiveNote = llmOutput.executiveNote ?? "";
    if (llmOutput.activatedDimension && isValidDimension(llmOutput.activatedDimension)) {
      activatedDimension = llmOutput.activatedDimension as DimensionId;
    }
  }

  // Final deterministic STT using (possibly LLM-refined) dimension scores
  const finalStt = clampScore(calculateSTT(finalScores));

  // Deltas
  const prev = previousScores;
  const delta = (now: number, before: number | undefined | null) =>
    parseFloat((now - (before ?? now)).toFixed(1));

  const scenario = determineScenario(finalStt, prev?.stt ?? finalStt);

  log.info(
    {
      territory: territory.slug,
      period,
      finalStt,
      llmVerificationPassed,
      llmDiscrepancy,
      scenario,
    },
    "STT calculation complete"
  );

  return {
    stt: finalStt,
    d1Score: clampScore(finalScores.D1),
    d2Score: clampScore(finalScores.D2),
    d3Score: clampScore(finalScores.D3),
    d4Score: clampScore(finalScores.D4),
    d5Score: clampScore(finalScores.D5),
    d6Score: clampScore(finalScores.D6),
    sttDelta: delta(finalStt, prev?.stt),
    d1Delta: delta(clampScore(finalScores.D1), prev?.d1),
    d2Delta: delta(clampScore(finalScores.D2), prev?.d2),
    d3Delta: delta(clampScore(finalScores.D3), prev?.d3),
    d4Delta: delta(clampScore(finalScores.D4), prev?.d4),
    d5Delta: delta(clampScore(finalScores.D5), prev?.d5),
    d6Delta: delta(clampScore(finalScores.D6), prev?.d6),
    activatedDimension,
    scenario,
    executiveNote,
    llmVerificationPassed,
    llmDiscrepancy,
  };
}

// ─── LLM interaction ──────────────────────────────────────────────────────────

interface LLMOutput {
  d1Score: number;
  d2Score: number;
  d3Score: number;
  d4Score: number;
  d5Score: number;
  d6Score: number;
  calculatedStt: number;
  activatedDimension: string;
  executiveNote: string;
}

async function callLLM(prompt: string, territorySlug: string): Promise<LLMOutput> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system" as const,
        content:
          "Você é o sistema de IA da Print Territorial Intelligence™. " +
          "Calcule e valide o STT com rigor metodológico PRINT. " +
          "Responda sempre em JSON válido, sem texto fora do JSON.",
      },
      { role: "user" as const, content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "stt_calculation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            d1Score: { type: "number" },
            d2Score: { type: "number" },
            d3Score: { type: "number" },
            d4Score: { type: "number" },
            d5Score: { type: "number" },
            d6Score: { type: "number" },
            calculatedStt: { type: "number" },
            activatedDimension: { type: "string" },
            executiveNote: { type: "string" },
          },
          required: [
            "d1Score", "d2Score", "d3Score", "d4Score", "d5Score", "d6Score",
            "calculatedStt", "activatedDimension", "executiveNote",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) throw new Error(`LLM returned empty response for ${territorySlug}`);
  const content = typeof raw === "string" ? raw : JSON.stringify(raw);
  return JSON.parse(content) as LLMOutput;
}

// ─── Prompt construction ──────────────────────────────────────────────────────

function buildPrompt(
  territory: SttCalculatorInput["territory"],
  period: string,
  agentScores: Record<DimensionId, number>,
  deterministicStt: number,
  previousScores: SttCalculatorInput["previousScores"],
  dimensionScores: SttCalculatorInput["dimensionScores"],
  premises: Partial<Record<DimensionId, string>>
): string {
  const ctx = territory.contextData;
  const prevStt = previousScores?.stt ?? deterministicStt;
  const variation = deterministicStt - prevStt;
  const variationStr = variation > 0 ? `+${variation.toFixed(1)}` : variation.toFixed(1);

  // Top signals per dimension
  const signalsSummary = dimensionScores.map((d) => {
    const topSignals = d.topSignals
      .filter((s) => s.impactScore >= 0.3)
      .slice(0, 3)
      .map((s) => `  • [${s.indicatorCode}] ${s.title} (impacto: ${s.impactScore.toFixed(2)})`)
      .join("\n");
    return `${d.id} (score agente: ${d.score.toFixed(1)}):\n${topSignals || "  Nenhum sinal relevante."}`;
  }).join("\n\n");

  // Premises snippets (first 400 chars each to keep prompt manageable)
  const premisesSnippet = DIMENSIONS_LIST.map((dim) => {
    const text = premises[dim.id as DimensionId] ?? "";
    return `${dim.id} — ${dim.name}:\n${text.slice(0, 400).trim()}`;
  }).join("\n\n---\n\n");

  // Historical context
  const history = ctx?.keyEvents?.slice(-5)
    .map((e) => `  ${e.period}: STT ${e.stt} | ${e.activatedIndex} | ${e.scenario} — ${e.note}`)
    .join("\n") ?? "  Sem histórico disponível.";

  return `Você é o analista de inteligência territorial da Print Territorial Intelligence™.

=== TERRITÓRIO: ${territory.name} (${territory.slug}) ===
Período: ${period}
STT anterior: ${prevStt.toFixed(1)} | STT calculado pelos agentes: ${deterministicStt.toFixed(1)} (${variationStr})
Contexto: ${ctx?.llmContext ?? "Sem contexto adicional."}

=== SCORES DOS AGENTES DIMENSIONAIS (calculados deterministicamente) ===
D1 Socioambiental (peso 0.22):   ${agentScores.D1.toFixed(1)}
D2 Socioeconômica (peso 0.15):   ${agentScores.D2.toFixed(1)}
D3 Infraestrutura (peso 0.15):   ${agentScores.D3.toFixed(1)}
D4 Dinâmica Territ. (peso 0.22): ${agentScores.D4.toFixed(1)}
D5 Governança (peso 0.15):       ${agentScores.D5.toFixed(1)}
D6 Reputação (peso 0.11):        ${agentScores.D6.toFixed(1)}
STT DETERMINÍSTICO:              ${deterministicStt.toFixed(1)}

=== SINAIS COLETADOS POR DIMENSÃO ===
${signalsSummary}

=== HISTÓRICO RECENTE ===
${history}

=== METODOLOGIA PRINT (resumo) ===
${premisesSnippet}

=== TAREFA ===
1. Revise os scores dimensionais se houver evidência concreta nos sinais (ajuste máx. ±5 pontos).
   REGRA CRÍTICA: seu calculatedStt = Σ(Di × Wi) deve estar dentro de ±0.5 do seu próprio cálculo.
   Fórmula: STT = (D1×0.22) + (D2×0.15) + (D3×0.15) + (D4×0.22) + (D5×0.15) + (D6×0.11)

2. Identifique a dimensão mais ativada no período (D1–D6).

3. Escreva uma nota executiva de 3-5 frases para tomadores de decisão C-level.
   Seja específico: cite os eventos concretos que moveram os scores.
   Tom: analítico, não alarmista; foque em implicações para operação e investimento.

Responda SOMENTE com o JSON no schema especificado.`;
}

// ─── Premise loader ───────────────────────────────────────────────────────────

async function loadPremises(): Promise<Partial<Record<DimensionId, string>>> {
  const premises: Partial<Record<DimensionId, string>> = {};
  for (const dim of DIMENSIONS_LIST) {
    try {
      const file = join(PREMISES_DIR, `${dim.id.toLowerCase()}.md`);
      const content = await readFile(file, "utf-8");
      premises[dim.id as DimensionId] = content;
    } catch {
      // Premise file missing — skip gracefully
    }
  }
  return premises;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildScoreMap(
  dimensionScores: SttCalculatorInput["dimensionScores"]
): Record<DimensionId, number> {
  const map: Record<DimensionId, number> = { D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0 };
  for (const d of dimensionScores) {
    map[d.id] = clampScore(d.score);
  }
  return map;
}

function clampScore(v: number): number {
  return Math.min(100, Math.max(0, Number(v) || 0));
}

function determineScenario(
  stt: number,
  prevStt: number
): "estabilidade" | "pressao" | "escalada" {
  const delta = stt - prevStt;
  if (delta > 3) return "escalada";
  if (delta > 0.5 || stt >= 70) return "pressao";
  return "estabilidade";
}

function findActivatedDimension(
  scores: Record<DimensionId, number>,
  prev: SttCalculatorInput["previousScores"]
): DimensionId | "GERAL" {
  let maxDelta = 0;
  let activated: DimensionId | "GERAL" = "GERAL";

  for (const [id, score] of Object.entries(scores) as [DimensionId, number][]) {
    const prevKey = `${id.toLowerCase().replace("d", "d")}` as keyof typeof prev;
    const prevScore = prev ? (prev[prevKey as keyof typeof prev] as number | undefined) ?? score : score;
    const delta = Math.abs(score - prevScore);
    if (delta > maxDelta) {
      maxDelta = delta;
      activated = id;
    }
  }

  return activated;
}

function isValidDimension(val: string): boolean {
  return ["D1", "D2", "D3", "D4", "D5", "D6"].includes(val);
}
