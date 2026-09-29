/**
 * Conector de aprendizado (cópia tipada de C:/Users/felip/.central-agentes/aprendiz.mjs, mesmo contrato).
 *
 * - contexto(posto): texto curto (lacunas, colegas, formação) para prepender ao system prompt.
 *   Na máquina do Felipe lê a pasta central; no Railway lê aprendizado/contexto/<posto>.md do repo
 *   (copiado por `python aprender.py espelhar`). Sem arquivo, devolve "".
 * - registrar(posto, {...}): UMA vez por execução do agente. Local grava em eventos/<dia>.jsonl;
 *   no Railway imprime "[APRENDI] {json}" no stdout (o `aprender.py remotos` traz dos logs).
 *
 * Nunca levanta exceção. REGRA: `fez`, `erro` e `evidencia` são rótulos de trabalho, nunca texto de prompt.
 */
import fs from "node:fs";
import path from "node:path";

const CENTRAL = "C:/Users/felip/.central-agentes";
const local = () => !process.env.RAILWAY_ENVIRONMENT && fs.existsSync(CENTRAL);

export type Aprendizado = {
  ok?: boolean;
  fez?: string;
  erro?: string;
  aprendi?: string;
  tipo?: string;
  evidencia?: string;
  mural?: boolean;
};

// Produto que atende cliente lê só o contexto SANITIZADO do próprio repo (aprender.py espelhar), nunca o da
// central: o da central cita prospects e municípios, e dado de um cliente não entra no trabalho de outro.
export function contexto(posto: string, raizRepo: string = process.cwd()): string {
  try {
    for (const p of [path.join(raizRepo, "aprendizado", "contexto", `${posto}.md`)]) {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    }
  } catch {
    /* sem contexto */
  }
  return "";
}

/** Prepende o contexto do posto ao system prompt; sem contexto, devolve o prompt intacto. */
export function comContexto(posto: string, system: string): string {
  const c = contexto(posto);
  return c ? `${c}\n\n${system}` : system;
}

export function registrar(posto: string, { ok = true, fez, erro, aprendi, tipo, evidencia, mural }: Aprendizado = {}): void {
  // Teste automatizado não é trabalho do agente: não suja a rede com rodada de mock.
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  try {
    const e: Record<string, unknown> = { ts: new Date().toISOString().slice(0, 19), posto: String(posto), ok: !!ok };
    for (const [k, v] of Object.entries({ fez, erro, aprendi, tipo, evidencia })) if (v) e[k] = String(v).slice(0, 400);
    if (mural) e.mural = true;
    if (local()) {
      const dir = path.join(CENTRAL, "eventos");
      fs.mkdirSync(dir, { recursive: true });
      const hoje = new Date().toLocaleDateString("sv-SE");
      fs.appendFileSync(path.join(dir, `${hoje}.jsonl`), JSON.stringify(e) + "\n", "utf8");
    } else {
      console.log("[APRENDI] " + JSON.stringify(e));
    }
  } catch {
    /* nunca derruba o agente */
  }
}

export default { contexto, comContexto, registrar };
