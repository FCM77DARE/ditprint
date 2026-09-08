/**
 * Perfil estrutural dos territórios candidatos ao Radar de lançamento.
 *
 *   pnpm territorios:perfil
 *
 * Junta o que já existe em produção com a camada estrutural nacional, para a
 * curadoria dos 20 ser feita olhando dado e não memória. Não decide nada —
 * só põe lado a lado o que o IBGE mede sobre cada lugar.
 */
import "dotenv/config";
import { getStructuralForMunicipality } from "../server/structural/store";
import { getStructuralScores } from "../server/structural/scoring";

interface Candidato {
  nome: string;
  uf: string;
  tese: string;
}

/** Territórios com DIT já gerado, mais os do eixo de tese da PRINT. */
const CANDIDATOS: Candidato[] = [
  { nome: "Macaé",            uf: "RJ", tese: "petróleo · bacia de Campos" },
  { nome: "Rio das Ostras",   uf: "RJ", tese: "petróleo · expansão urbana" },
  { nome: "Itaguaí",          uf: "RJ", tese: "porto · logística" },
  { nome: "Maricá",           uf: "RJ", tese: "royalties · projeto portuário" },
  { nome: "Magé",             uf: "RJ", tese: "Baía de Guanabara · saneamento" },
  { nome: "Niterói",          uf: "RJ", tese: "renda alta · pressão urbana" },
  { nome: "Duque de Caxias",  uf: "RJ", tese: "refino · vulnerabilidade" },
  { nome: "Petrópolis",       uf: "RJ", tese: "risco geológico · turismo" },
  { nome: "Paraty",           uf: "RJ", tese: "APA · turismo · tradicionais" },
  { nome: "Nova Friburgo",    uf: "RJ", tese: "risco geológico" },
  { nome: "Belford Roxo",     uf: "RJ", tese: "baixada · vulnerabilidade" },
  { nome: "Camaçari",         uf: "BA", tese: "polo petroquímico" },
  { nome: "Dias d'Ávila",     uf: "BA", tese: "polo de Camaçari" },
  { nome: "Candeias",         uf: "BA", tese: "refino · RLAM" },
  { nome: "Catu",             uf: "BA", tese: "petróleo onshore" },
  { nome: "Mata de São João", uf: "BA", tese: "litoral · turismo" },
  { nome: "Salvador",         uf: "BA", tese: "capital · escala" },
  { nome: "Santo Amaro",      uf: "BA", tese: "passivo ambiental · chumbo" },
  { nome: "Alagoinhas",       uf: "BA", tese: "DIT já gerado" },
  { nome: "Senhor do Bonfim", uf: "BA", tese: "mineração" },
  { nome: "Rodelas",          uf: "BA", tese: "hidrelétrica · reassentamento" },
  { nome: "Porto Seguro",     uf: "BA", tese: "turismo · tradicionais" },
  { nome: "Galinhos",         uf: "RN", tese: "eólica · município pequeno" },
  { nome: "Trairi",           uf: "CE", tese: "eólica · litoral" },
  { nome: "Caarapó",          uf: "MS", tese: "agro · terra indígena" },
  { nome: "Dourados",         uf: "MS", tese: "agro · terra indígena" },
  { nome: "Altamira",         uf: "PA", tese: "Belo Monte · Amazônia" },
  { nome: "Eldorado",         uf: "SP", tese: "Vale do Ribeira · quilombolas" },
];

/**
 * Resolve nome+UF para código IBGE contra a malha, em tempo de execução.
 *
 * A primeira versão trazia o código digitado à mão e um deles estava errado:
 * 2910776 é Feira da Mata, não Dias d'Ávila (2910057). A tabela saiu com
 * 5.631 habitantes onde deveria ter ~85 mil, e a linha parecia perfeitamente
 * plausível. Código de município não se escreve de memória.
 */
async function resolverIbge(): Promise<Map<string, number>> {
  const res = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
    { headers: { "User-Agent": "DIT-PRINT/1.0" }, signal: AbortSignal.timeout(60000) }
  );
  const municipios = (await res.json()) as Array<{
    id: number;
    nome: string;
    microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
  }>;

  const norm = (v: string) =>
    v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

  const mapa = new Map<string, number>();
  for (const c of CANDIDATOS) {
    const hits = municipios.filter(
      (m) => norm(m.nome) === norm(c.nome) && m.microrregiao?.mesorregiao?.UF?.sigla === c.uf
    );
    if (hits.length === 1) {
      mapa.set(`${c.nome}/${c.uf}`, hits[0].id);
    } else {
      console.log(`  AMBIGUO/AUSENTE  ${c.nome}/${c.uf} — ${hits.length} correspondências`);
    }
  }
  return mapa;
}

function fmt(v: number | undefined, casas = 0): string {
  if (v === undefined) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

async function main() {
  const codigos = await resolverIbge();
  const linhas: Array<{ c: Candidato; ibgeId: number; pop: number; sal: number; d2: number; d3: number; d4: number; base: number }> = [];

  for (const c of CANDIDATOS) {
    const ibgeId = codigos.get(`${c.nome}/${c.uf}`);
    if (!ibgeId) continue;
    const ind = await getStructuralForMunicipality(ibgeId);
    const st = await getStructuralScores(ibgeId);
    if (Object.keys(ind).length === 0) {
      console.log(`  SEM DADO  ${c.nome}/${c.uf} (ibge ${ibgeId})`);
      continue;
    }
    const d2 = st.D2?.score ?? 0;
    const d3 = st.D3?.score ?? 0;
    const d4 = st.D4?.score ?? 0;
    // Base estrutural do STT: só as dimensões que a camada cobre hoje,
    // renormalizadas pelos pesos PRINT (D2 .15 + D3 .15 + D4 .22 = .52).
    const base = (d2 * 0.15 + d3 * 0.15 + d4 * 0.22) / 0.52;
    linhas.push({
      c,
      ibgeId,
      pop: ind.populacao_residente?.value ?? 0,
      sal: ind.salario_medio_mensal?.value ?? 0,
      d2, d3, d4, base,
    });
  }

  linhas.sort((a, b) => b.base - a.base);

  console.log("");
  console.log("  Perfil estrutural dos candidatos ao Radar");
  console.log("  ───────────────────────────────────────────────────────────────────────────────────");
  console.log("  município              população   salário   D2   D3   D4   base   tese");
  console.log("");
  for (const l of linhas) {
    console.log(
      "  %s %s %s %s %s %s %s   %s",
      `${l.c.nome}/${l.c.uf}`.padEnd(21),
      fmt(l.pop).padStart(10),
      ("R$ " + fmt(l.sal)).padStart(10),
      String(l.d2).padStart(4),
      String(l.d3).padStart(4),
      String(l.d4).padStart(4),
      l.base.toFixed(0).padStart(5),
      l.c.tese
    );
  }
  console.log("");
  console.log("  base = complexidade estrutural nas dimensões que a camada cobre (D2, D3, D4),");
  console.log("         renormalizada. Não é o STT: falta a camada de sinal e as dimensões D1, D5 e D6.");
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
