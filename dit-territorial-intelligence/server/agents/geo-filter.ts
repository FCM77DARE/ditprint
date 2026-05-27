/**
 * Helpers de filtro geográfico para queries de busca.
 *
 * Bug corrigido (feedback equipe 2026-05):
 *   - "Cairu" puro retornava cooperativa Cairu (RS) e outras homônimas
 *   - "Mata de São João" trazia matérias sobre "São João del Rei" (MG)
 *   - "Dias d'Ávila" não achava (apóstrofo + acento)
 *
 * Estratégia:
 *   1. enrichGeoQuery: força UF + "Brasil" em toda query, evita rebote
 *      em homônimos de outras regiões.
 *   2. matchesTerritory: validação pós-fetch — descarta resultados cujo
 *      texto não menciona o município ou o estado de forma plausível.
 *   3. nameVariants: gera variantes para grafias com apóstrofo/acento.
 */
import type { Territory } from "../../drizzle/schema";

/** Tabela UF → nome completo. Usado em queries pra desambiguação geográfica. */
const UF_TO_NAME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá",
  BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco",
  PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina",
  SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

export function stateName(state?: string | null): string {
  if (!state) return "";
  return UF_TO_NAME[state.toUpperCase()] ?? state;
}

/** Versão sem acentos + lowercase. Comparações de match são case/accent-insensitive. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`´]/g, "")
    .trim();
}

/**
 * Gera variantes ortográficas do nome do município para tentar em queries
 * (ex: "Dias d'Ávila" → ["Dias d'Ávila", "Dias dÁvila", "Dias d Avila", "Dias DAvila"]).
 */
export function nameVariants(name: string): string[] {
  const set = new Set<string>([name]);
  set.add(name.replace(/['’`´]/g, ""));      // sem apóstrofo
  set.add(name.replace(/['’`´]/g, " "));     // apóstrofo→espaço
  set.add(name.replace(/['’`´]/g, "'"));     // normaliza pra reto
  return Array.from(set);
}

/**
 * Enriquece uma query base com âncoras geográficas obrigatórias.
 * Ex: ("notícias", territory={name:"Cairu", state:"BA"})
 *      → 'notícias "Cairu" "Bahia" Brasil'
 *
 * Uso de aspas força o motor de busca a tratar como expressão literal,
 * reduzindo rebote em "Cairu Cooperativa RS".
 */
export function enrichGeoQuery(baseQuery: string, territory: Pick<Territory, "name" | "state">): string {
  const uf = stateName(territory.state);
  const parts = [
    baseQuery,
    `"${territory.name}"`,
  ];
  if (uf) parts.push(`"${uf}"`);
  parts.push("Brasil");
  return parts.join(" ");
}

/**
 * Validação pós-fetch: o resultado realmente fala do território?
 *
 * Aceita se QUALQUER uma destas é verdadeira:
 *   - menciona o nome do município (com tolerância a acento/apóstrofo)
 *   - menciona a UF (sigla ou nome completo)
 *
 * Rejeita se nada disso aparece → era homônimo / fragmento parcial.
 */
export function matchesTerritory(
  text: string | null | undefined,
  territory: Pick<Territory, "name" | "state">
): boolean {
  if (!text) return false;
  const folded = fold(text);
  const munNeedle = fold(territory.name);
  if (munNeedle && folded.includes(munNeedle)) return true;
  const uf = (territory.state ?? "").toUpperCase();
  if (uf) {
    // Sigla em borda de palavra OU nome completo da UF
    const ufNeedle = fold(stateName(territory.state));
    if (ufNeedle && folded.includes(ufNeedle)) return true;
    // Sigla como token isolado: " ba ", " ba.", " ba,", início/fim
    const sigla = uf.toLowerCase();
    const re = new RegExp(`(^|[\\s,./|()-])${sigla}([\\s,./|()-]|$)`);
    if (re.test(folded)) return true;
  }
  return false;
}
