/**
 * Carrega o Radar de lançamento.
 *
 *   pnpm radar:carregar              (relatório, não coleta nada)
 *   pnpm radar:carregar --apply      (dispara a coleta dos 20)
 *   pnpm radar:carregar --apply --api=https://...  (contra produção)
 *
 * Dispara `POST /api/dit/analyze` para cada território do Radar, em série e
 * com pausa entre eles. Em série de propósito: cada análise roda a malha
 * inteira e consome orçamento, e disparar 20 em paralelo estoura o teto
 * diário no primeiro minuto — que é exatamente o que o teto existe para
 * impedir.
 *
 * O que a coleta devolve importa e é reportado:
 *   ok                       DIT emitido
 *   cobertura_insuficiente   território entrou na fila, sem diagnóstico
 *   sob_demanda              não está no Radar (não deveria acontecer aqui)
 *   orcamento_esgotado       teto do dia batido — o resto fica para amanhã
 *
 * Depois desta carga, o scheduler diário assume: um ponto por território por
 * dia. É a série que sustenta a promessa do momento Operar.
 */

import "dotenv/config";
import { RADAR_LANCAMENTO, consultaCompleta } from "../server/routes/radar-lancamento";

const APPLY = process.argv.includes("--apply");
const API =
  process.argv.find((a) => a.startsWith("--api="))?.slice("--api=".length) ??
  `http://localhost:${process.env.PORT ?? 3000}`;

const PAUSA_MS = Number(process.env.RADAR_PAUSA_MS ?? "3000");

interface Resultado {
  territorio: string;
  http: number;
  status: string;
  detalhe: string;
}

async function analisar(consulta: string): Promise<Resultado> {
  try {
    const res = await fetch(`${API}/api/dit/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ territory: consulta }),
      signal: AbortSignal.timeout(180000),
    });
    const body = (await res.json()) as Record<string, unknown>;

    if (res.status === 200 && !body.status) {
      const cov = typeof body.coverageScore === "number" ? body.coverageScore : null;
      return {
        territorio: consulta,
        http: 200,
        status: "ok",
        detalhe: `STT ${body.stt ?? "?"}${cov !== null ? ` · cobertura ${Math.round(cov * 100)}%` : ""}`,
      };
    }

    const status = String(body.status ?? body.error ?? "?");
    const cov = typeof body.coverageScore === "number" ? body.coverageScore : null;
    return {
      territorio: consulta,
      http: res.status,
      status,
      detalhe: cov !== null ? `cobertura ${Math.round(cov * 100)}%` : String(body.detail ?? "").slice(0, 60),
    };
  } catch (err) {
    return {
      territorio: consulta,
      http: 0,
      status: "erro",
      detalhe: (err as Error).message.slice(0, 60),
    };
  }
}

async function main() {
  console.log("");
  console.log(`  Radar de lançamento — ${RADAR_LANCAMENTO.length} territórios`);
  console.log(`  API: ${API}`);
  console.log(`  modo: ${APPLY ? "COLETANDO" : "SIMULAÇÃO (use --apply)"}`);
  console.log("  ──────────────────────────────────────────────────────────────────");
  console.log("");

  if (!APPLY) {
    for (const t of RADAR_LANCAMENTO) {
      console.log(
        "  %s %s  %s  %s",
        t.eixo === "tese" ? "TESE " : "CONTR",
        consultaCompleta(t).padEnd(26),
        String(t.baseObservada ?? "—").padStart(4),
        t.tese
      );
    }
    console.log("");
    console.log("  Nada foi coletado. Rode com --apply.");
    console.log("");
    return;
  }

  const resultados: Resultado[] = [];

  for (const t of RADAR_LANCAMENTO) {
    const consulta = consultaCompleta(t);
    process.stdout.write(`  ${consulta.padEnd(26)} … `);
    const r = await analisar(consulta);
    resultados.push(r);
    console.log(`${r.status.padEnd(24)} ${r.detalhe}`);

    if (r.status === "orcamento_esgotado") {
      console.log("");
      console.log("  Teto de orçamento atingido — o restante fica para o próximo ciclo.");
      break;
    }

    await new Promise((r2) => setTimeout(r2, PAUSA_MS));
  }

  const por = (s: string) => resultados.filter((r) => r.status === s).length;
  console.log("");
  console.log("  ──────────────────────────────────────────────────────────────────");
  console.log(`  DIT emitido            : ${por("ok")}`);
  console.log(`  cobertura insuficiente : ${por("cobertura_insuficiente")}`);
  console.log(`  erro / indisponível    : ${resultados.length - por("ok") - por("cobertura_insuficiente")}`);
  console.log(`  não processados        : ${RADAR_LANCAMENTO.length - resultados.length}`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
