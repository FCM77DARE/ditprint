/**
 * Conferência da recalibração do STT.
 *
 * Roda o score estrutural para um conjunto de municípios de escalas muito
 * diferentes e mostra o que o STT passa a dizer quando a coleta é a MESMA
 * (simulada como score de sinal constante). Se o número continuar igual para
 * todos, a recalibração não funcionou.
 */
import "dotenv/config";
import { getStructuralScores, blendDimensionScore } from "../server/structural/scoring";

const DIM_WEIGHTS: Record<string, number> = {
  D1: 0.22, D2: 0.15, D3: 0.15, D4: 0.22, D5: 0.15, D6: 0.11, D7: 0,
};

const AMOSTRA: Array<[string, number]> = [
  ["Salvador/BA", 2927408],
  ["Niterói/RJ", 3303302],
  ["Macaé/RJ", 3302403],
  ["Camaçari/BA", 2905701],
  ["Itaguaí/RJ", 3302007],
  ["Paraty/RJ", 3303807],
  ["Magé/RJ", 3302601],
  ["Galinhos/RN", 2404101],
  ["Trairi/CE", 2313500],
  ["Caarapó/MS", 5002100],
  ["São Gabriel da Cachoeira/AM", 1303809],
  ["Altamira/PA", 1500602],
];

// Score de sinal FIXO para todos — isola o efeito da camada estrutural.
const SINAL_FIXO = 88;

async function main() {
  console.log("");
  console.log("  Recalibração do STT — mesma coleta para todos (sinal fixo = %d)", SINAL_FIXO);
  console.log("  ──────────────────────────────────────────────────────────────────");
  console.log("  município          STT_antes  STT_agora   D2    D3    D4   base estrutural");
  console.log("");

  const linhas: Array<{ nome: string; antes: number; agora: number }> = [];

  for (const [nome, ibgeId] of AMOSTRA) {
    const st = await getStructuralScores(ibgeId);

    const dims: Record<string, number> = {
      D1: SINAL_FIXO, D2: SINAL_FIXO, D3: SINAL_FIXO,
      D4: SINAL_FIXO, D5: SINAL_FIXO, D6: SINAL_FIXO, D7: SINAL_FIXO,
    };
    const antes = Object.keys(DIM_WEIGHTS)
      .reduce((acc, id) => acc + dims[id] * DIM_WEIGHTS[id], 0);

    for (const id of Object.keys(st)) {
      dims[id] = blendDimensionScore(SINAL_FIXO, st[id as "D2" | "D3" | "D4"]);
    }
    const agora = Object.keys(DIM_WEIGHTS)
      .reduce((acc, id) => acc + dims[id] * DIM_WEIGHTS[id], 0);

    linhas.push({ nome, antes, agora });

    const basis = Object.entries(st)
      .map(([d, v]) => `${d}=${v!.score}`)
      .join(" ");

    console.log(
      "  %s %s %s  %s %s %s   %s",
      nome.padEnd(17),
      antes.toFixed(1).padStart(8),
      agora.toFixed(1).padStart(9),
      String(dims.D2).padStart(5),
      String(dims.D3).padStart(5),
      String(dims.D4).padStart(5),
      basis || "(sem estrutura)"
    );
  }

  const antes = linhas.map((l) => l.antes);
  const agora = linhas.map((l) => l.agora);
  const amp = (a: number[]) => Math.max(...a) - Math.min(...a);

  console.log("");
  console.log("  amplitude ANTES : %s pontos", amp(antes).toFixed(1));
  console.log("  amplitude AGORA : %s pontos", amp(agora).toFixed(1));
  console.log("");

  // Conferência de sanidade: capital com renda mediana tem que sair diferente
  // de município de 2 mil habitantes no extremo rarefeito.
  const salvador = linhas.find((l) => l.nome.startsWith("Salvador"))!;
  const galinhos = linhas.find((l) => l.nome.startsWith("Galinhos"))!;
  console.log(
    "  Salvador vs Galinhos: %s → %s (antes eram idênticos)",
    salvador.antes.toFixed(1) + " / " + galinhos.antes.toFixed(1),
    salvador.agora.toFixed(1) + " / " + galinhos.agora.toFixed(1)
  );
  console.log("");

  if (amp(agora) < 5) {
    console.error("  FALHA: STT continua sem discriminar (amplitude < 5 pontos).");
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
