/**
 * Conferência do território composto.
 *
 * Mostra o score de cada membro da Baía de Guanabara e o agregado ponderado
 * por população, para dar para conferir se o número do recorte faz sentido
 * diante dos números de quem o compõe.
 */
import "dotenv/config";
import { getStructuralScores, getStructuralScoresComposite } from "../server/structural/scoring";
import { getStructuralForMunicipality } from "../server/structural/store";
import { TERRITORIOS_COMPOSTOS } from "../server/routes/territorios-compostos";

async function main() {
  const res = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
    { headers: { "User-Agent": "DIT-PRINT/1.0" }, signal: AbortSignal.timeout(60000) }
  );
  const municipios = (await res.json()) as Array<{
    id: number; nome: string;
    microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
  }>;
  const norm = (v: string) =>
    v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

  for (const c of TERRITORIOS_COMPOSTOS) {
    console.log("");
    console.log(`  ${c.nome} (${c.uf})`);
    console.log(`  critério: ${c.criterio}`);
    console.log("  ──────────────────────────────────────────────────────────────");
    console.log("  membro                 população     D2    D3    D4");

    const ids: number[] = [];
    for (const m of c.membros) {
      const hit = municipios.find(
        (x) => norm(x.nome) === norm(m.nome) && x.microrregiao?.mesorregiao?.UF?.sigla === m.uf
      );
      if (!hit) { console.log(`  NAO RESOLVIDO ${m.nome}/${m.uf}`); continue; }
      ids.push(hit.id);
      const ind = await getStructuralForMunicipality(hit.id);
      const st = await getStructuralScores(hit.id);
      const pop = ind.populacao_residente?.value ?? 0;
      console.log(
        "  %s %s  %s  %s  %s",
        m.nome.padEnd(21),
        pop.toLocaleString("pt-BR").padStart(11),
        String(st.D2?.score ?? "—").padStart(4),
        String(st.D3?.score ?? "—").padStart(4),
        String(st.D4?.score ?? "—").padStart(4)
      );
    }

    const agg = await getStructuralScoresComposite(ids);
    console.log("  ──────────────────────────────────────────────────────────────");
    console.log(
      "  %s %s  %s  %s  %s",
      "AGREGADO (pond. pop.)".padEnd(21),
      "".padStart(11),
      String(agg.D2?.score ?? "—").padStart(4),
      String(agg.D3?.score ?? "—").padStart(4),
      String(agg.D4?.score ?? "—").padStart(4)
    );
    console.log("");
    for (const [dim, v] of Object.entries(agg)) {
      console.log(`  ${dim}: ${v.rationale} (confiança ${(v.confidence * 100).toFixed(0)}%)`);
    }
    console.log("");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
