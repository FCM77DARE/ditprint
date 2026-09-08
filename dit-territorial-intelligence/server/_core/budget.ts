/**
 * Orçamento operacional — teto de gasto no código, não na conta do cartão.
 *
 * O PROBLEMA
 *
 * `POST /api/dit/analyze` aceitava qualquer território, com rate limit só por
 * IP e cache só por (território + dia). Não havia teto global. Duzentas
 * pessoas testando duzentos municípios diferentes no dia do lançamento =
 * ~4.800 buscas SerpAPI e ~200 chamadas de LLM em 24 horas, o que estoura
 * qualquer plano.
 *
 * E o modo de falha era o pior possível: a cota da busca acabava em silêncio,
 * os agentes voltavam vazios, o LLM escrevia mesmo assim e a pessoa recebia um
 * relatório bonito e sem base. Nada aparecia como erro.
 *
 * O QUE ISTO FAZ
 *
 * Um contador único, persistido em disco (sobrevive a restart e a deploy, via
 * volume da Railway), com teto diário e mensal por recurso. Estourou, a
 * operação é recusada com motivo explícito — e quem chamou trata como
 * indisponibilidade, não emite diagnóstico pela metade.
 *
 * Os tetos são conservadores de propósito. É mais barato dizer "volte amanhã"
 * do que descobrir a conta no fim do mês, e muito mais barato do que entregar
 * relatório sem dado para um decisor que confere.
 */

import { promises as fs, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger";

const log = logger.child({ module: "budget" });

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const BUDGET_FILE = join(DATA_DIR, "budget.json");

export type BudgetResource = "llm_report" | "serpapi" | "analyze";

interface ResourceLimits {
  daily: number;
  monthly: number;
  /** Custo unitário estimado em USD, só para o painel */
  unitCostUsd: number;
}

/**
 * Tetos padrão, dimensionados para o lançamento de 20 territórios curados.
 * Todos sobrescrevíveis por env sem deploy.
 */
const LIMITS: Record<BudgetResource, ResourceLimits> = {
  // Relatório completo do DIT. ~5k tokens in / ~3,5k out em gpt-4o ≈ US$ 0,05.
  llm_report: {
    daily: Number(process.env.BUDGET_LLM_DAILY ?? "60"),
    monthly: Number(process.env.BUDGET_LLM_MONTHLY ?? "900"),
    unitCostUsd: 0.05,
  },
  // Busca paga. O serpapi-quota.ts também tem teto próprio; este é o global.
  serpapi: {
    daily: Number(process.env.BUDGET_SERPAPI_DAILY ?? "160"),
    monthly: Number(process.env.BUDGET_SERPAPI_MONTHLY ?? "4800"),
    unitCostUsd: 0.015,
  },
  // Análises completas disparadas (coleta + LLM). Teto de segurança do topo.
  analyze: {
    daily: Number(process.env.BUDGET_ANALYZE_DAILY ?? "80"),
    monthly: Number(process.env.BUDGET_ANALYZE_MONTHLY ?? "1200"),
    unitCostUsd: 0.4,
  },
};

interface BudgetState {
  month: string;
  monthly: Partial<Record<BudgetResource, number>>;
  daily: Record<string, Partial<Record<BudgetResource, number>>>;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function monthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

let cache: BudgetState | null = null;

async function readState(): Promise<BudgetState> {
  if (cache && cache.month === monthStr()) return cache;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(BUDGET_FILE, "utf8");
    const state = JSON.parse(raw) as BudgetState;
    cache = state.month === monthStr() ? state : { month: monthStr(), monthly: {}, daily: {} };
  } catch {
    cache = { month: monthStr(), monthly: {}, daily: {} };
  }
  return cache;
}

async function writeState(state: BudgetState): Promise<void> {
  cache = state;
  try {
    await fs.writeFile(BUDGET_FILE, JSON.stringify(state), "utf8");
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Falha ao gravar orçamento");
  }
}

export interface BudgetDecision {
  ok: boolean;
  reason?: string;
  resource: BudgetResource;
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
}

/**
 * Pergunta se cabe mais uma operação deste recurso. NÃO consome —
 * chame `consume()` depois que a operação de fato aconteceu.
 */
export async function canSpend(resource: BudgetResource): Promise<BudgetDecision> {
  const state = await readState();
  const limits = LIMITS[resource];
  const today = todayStr();
  const dailyUsed = state.daily[today]?.[resource] ?? 0;
  const monthlyUsed = state.monthly[resource] ?? 0;

  const base = {
    resource,
    dailyUsed,
    dailyLimit: limits.daily,
    monthlyUsed,
    monthlyLimit: limits.monthly,
  };

  if (monthlyUsed >= limits.monthly) {
    return { ...base, ok: false, reason: `teto mensal de ${limits.monthly} atingido` };
  }
  if (dailyUsed >= limits.daily) {
    return { ...base, ok: false, reason: `teto diário de ${limits.daily} atingido` };
  }
  return { ...base, ok: true };
}

/** Registra o consumo de uma unidade do recurso. */
export async function consume(resource: BudgetResource, units = 1): Promise<void> {
  const state = await readState();
  const today = todayStr();
  state.monthly[resource] = (state.monthly[resource] ?? 0) + units;
  (state.daily[today] ??= {})[resource] = (state.daily[today][resource] ?? 0) + units;

  // Poda dias com mais de 40 dias
  const cutoff = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const d of Object.keys(state.daily)) {
    if (d < cutoff) delete state.daily[d];
  }

  await writeState(state);
}

/** Estado do orçamento para painel e para a rota de saúde. */
export async function getBudgetStatus(): Promise<{
  month: string;
  date: string;
  resources: Array<
    BudgetDecision & { unitCostUsd: number; estimatedMonthlyCostUsd: number }
  >;
  estimatedMonthTotalUsd: number;
}> {
  const state = await readState();
  const today = todayStr();
  const resources = (Object.keys(LIMITS) as BudgetResource[]).map((resource) => {
    const limits = LIMITS[resource];
    const dailyUsed = state.daily[today]?.[resource] ?? 0;
    const monthlyUsed = state.monthly[resource] ?? 0;
    return {
      resource,
      ok: monthlyUsed < limits.monthly && dailyUsed < limits.daily,
      dailyUsed,
      dailyLimit: limits.daily,
      monthlyUsed,
      monthlyLimit: limits.monthly,
      unitCostUsd: limits.unitCostUsd,
      estimatedMonthlyCostUsd: Math.round(monthlyUsed * limits.unitCostUsd * 100) / 100,
    };
  });

  return {
    month: state.month,
    date: today,
    resources,
    estimatedMonthTotalUsd:
      Math.round(resources.reduce((a, r) => a + r.estimatedMonthlyCostUsd, 0) * 100) / 100,
  };
}
