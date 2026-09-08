/**
 * Score estrutural por dimensão — o território pontuando pelo que ele é.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * O modelo "Complexidade Residual" parte de 100 e subtrai conforme sinais
 * resolutivos chegam. A intenção é certa (sem dado = território desconhecido =
 * complexo até prova em contrário), mas com cobertura baixa em todo lugar o
 * efeito é aritmético e inescapável: o STT vira função da nossa própria
 * cobertura. Em produção, 28 dos 31 territórios estavam em "escalada", Macaé
 * marcava 97 com 5 sinais e Salvador aparecia menos complexa que um município
 * de 2.104 habitantes — porque Salvador tinha mais notícia indexada.
 *
 * A CORREÇÃO
 *
 * A camada estrutural sabe, para os 5.570 municípios, coisas que não dependem
 * de coleta: quanta gente vive ali, quanto o município produz por habitante,
 * quão espalhado ou adensado é o território. Essas são as variáveis em que
 * territórios de fato diferem entre si.
 *
 * Aqui elas viram score de dimensão por PERCENTIL NACIONAL — a posição do
 * município na distribuição do país. Sem faixa arbitrária, sem número que
 * alguém escolheu: um município é de baixa renda em relação aos outros 5.569,
 * e isso é verificável.
 *
 * O score de sinal continua existindo e continua entrando — mas como
 * modulador do que a estrutura já diz, não mais como a base inteira.
 */

import type { DimensionId } from "../indicators";
import { getStructuralForMunicipality, type StructuralValue } from "./store";
import { logger } from "../_core/logger";

const log = logger.child({ module: "structural-scoring" });

export interface StructuralDimensionScore {
  /** Complexidade estrutural 0–100 na escala do DIT (maior = mais complexo) */
  score: number;
  /** Confiança 0–1 — quantos indicadores da dimensão existem para este município */
  confidence: number;
  /** Frase auditável do porquê, para relatório e para o painel */
  rationale: string;
  /** Indicadores que sustentaram o score, com percentil nacional */
  basis: Array<{ key: string; label: string; value: number; unit: string; pct: number }>;
}

export type StructuralScores = Partial<Record<DimensionId, StructuralDimensionScore>>;

/** Percentil (0–1) → complexidade (0–100) onde valor ALTO é MENOS complexo. */
function invertedPct(pct: number): number {
  return Math.round((1 - pct) * 100);
}

/**
 * Complexidade em U: os dois extremos da distribuição são operacionalmente
 * difíceis, o meio é o mais simples.
 *
 * Vale para densidade demográfica, e a afirmação é territorial, não
 * estatística: município muito rarefeito custa logística, cobertura de serviço
 * e alcance; município muito adensado custa pressão urbana, conflito de uso e
 * passivo de infraestrutura. Quem opera no meio da distribuição enfrenta
 * menos dos dois.
 */
function uShapedPct(pct: number): number {
  const distanceFromMedian = Math.abs(pct - 0.5) * 2; // 0 no meio, 1 nos extremos
  return Math.round(distanceFromMedian * 100);
}

function pick(
  indicators: Record<string, StructuralValue>,
  key: string
): { v: StructuralValue; pct: number } | null {
  const v = indicators[key];
  if (!v || typeof v.pct !== "number") return null;
  return { v, pct: v.pct };
}

/**
 * Scores estruturais das dimensões que a camada cobre hoje (D2 e D3).
 *
 * Dimensão sem indicador estrutural não recebe entrada nenhuma — segue
 * inteiramente pelo modelo de sinal. Silêncio aqui é silêncio de verdade, não
 * um 50 disfarçado de neutro.
 */
export async function getStructuralScores(
  ibgeId: number | string | null | undefined
): Promise<StructuralScores> {
  if (!ibgeId) return {};

  const indicators = await getStructuralForMunicipality(ibgeId);
  if (Object.keys(indicators).length === 0) return {};

  const out: StructuralScores = {};

  // ── D2 · Socioeconômica ───────────────────────────────────────────────────
  //
  // Eixo: o que chega à população, não o que o capital instalado produz.
  //
  // A primeira versão desta função usava PIB per capita como eixo único, e a
  // conferência contra a base nacional reprovou: Galinhos/RN, 2.104 habitantes
  // com parque eólico, sai com PIB per capita de R$ 78.741 — percentil alto,
  // logo "baixa complexidade socioeconômica". Macaé, pelo petróleo, também.
  // Ou seja, o indicador premiava exatamente o perfil de território que o DIT
  // existe para ler: município pequeno com ativo de capital intensivo, onde o
  // PIB é do ativo e não da população.
  //
  // Salário médio do trabalho formal (CEMPRE) mede renda que circula ali, e
  // vínculos formais por 100 habitantes mede quanto da população está dentro
  // do mercado formal. Os dois juntos separam "município rico" de "município
  // com uma instalação rica dentro". PIB per capita fica como terceiro termo,
  // com peso menor, medindo escala econômica.
  const salario = pick(indicators, "salario_medio_mensal");
  const assalariamento = pick(indicators, "taxa_assalariamento");
  const pibPc = pick(indicators, "pib_per_capita");

  if (salario || assalariamento || pibPc) {
    const termos: Array<{ score: number; peso: number }> = [];
    const basis: StructuralDimensionScore["basis"] = [];
    const reasons: string[] = [];

    if (salario) {
      termos.push({ score: invertedPct(salario.pct), peso: 0.45 });
      basis.push({
        key: "salario_medio_mensal",
        label: salario.v.label,
        value: salario.v.value,
        unit: salario.v.unit,
        pct: salario.pct,
      });
      reasons.push(
        `salário médio formal de R$ ${Math.round(salario.v.value).toLocaleString("pt-BR")} ` +
          `(percentil ${Math.round(salario.pct * 100)} do país)`
      );
    }

    if (assalariamento) {
      termos.push({ score: invertedPct(assalariamento.pct), peso: 0.35 });
      basis.push({
        key: "taxa_assalariamento",
        label: assalariamento.v.label,
        value: assalariamento.v.value,
        unit: assalariamento.v.unit,
        pct: assalariamento.pct,
      });
      reasons.push(
        `${assalariamento.v.value} vínculos formais por 100 habitantes ` +
          `(percentil ${Math.round(assalariamento.pct * 100)})`
      );
    }

    if (pibPc) {
      termos.push({ score: invertedPct(pibPc.pct), peso: 0.2 });
      basis.push({
        key: "pib_per_capita",
        label: pibPc.v.label,
        value: pibPc.v.value,
        unit: pibPc.v.unit,
        pct: pibPc.pct,
      });
      reasons.push(
        `PIB per capita de R$ ${Math.round(pibPc.v.value).toLocaleString("pt-BR")} ` +
          `(percentil ${Math.round(pibPc.pct * 100)})`
      );
    }

    const pesoTotal = termos.reduce((a, t) => a + t.peso, 0);
    const score = Math.round(
      termos.reduce((a, t) => a + t.score * t.peso, 0) / pesoTotal
    );

    out.D2 = {
      score,
      confidence: pesoTotal, // 1.0 com os três termos presentes
      rationale: reasons.join("; ") + ".",
      basis,
    };
  }

  // ── D3 · Infraestrutura e Serviços ────────────────────────────────────────
  // Eixo: forma de ocupação. Densidade em U (extremos custam), com a escala
  // populacional entrando como segundo termo — território grande em população
  // acumula demanda de serviço mesmo quando a densidade é confortável.
  const dens = pick(indicators, "densidade_demografica");
  const pop = pick(indicators, "populacao_residente") ?? pick(indicators, "populacao_estimada");
  if (dens || pop) {
    const parts: number[] = [];
    const basis: StructuralDimensionScore["basis"] = [];
    const reasons: string[] = [];

    if (dens) {
      parts.push(uShapedPct(dens.pct));
      basis.push({
        key: "densidade_demografica",
        label: dens.v.label,
        value: dens.v.value,
        unit: dens.v.unit,
        pct: dens.pct,
      });
      const extremo =
        dens.pct >= 0.85 ? "adensamento alto" : dens.pct <= 0.15 ? "território rarefeito" : "densidade intermediária";
      reasons.push(
        `densidade de ${dens.v.value.toLocaleString("pt-BR")} hab/km² ` +
          `(percentil ${Math.round(dens.pct * 100)} — ${extremo})`
      );
    }

    if (pop) {
      // População alta = mais demanda instalada = mais complexidade de serviço.
      parts.push(Math.round(pop.pct * 100));
      basis.push({
        key: pop.v.label.includes("estimada") ? "populacao_estimada" : "populacao_residente",
        label: pop.v.label,
        value: pop.v.value,
        unit: pop.v.unit,
        pct: pop.pct,
      });
      reasons.push(
        `população de ${Math.round(pop.v.value).toLocaleString("pt-BR")} ` +
          `(percentil ${Math.round(pop.pct * 100)})`
      );
    }

    out.D3 = {
      score: Math.round(parts.reduce((a, b) => a + b, 0) / parts.length),
      confidence: parts.length / 2,
      rationale: reasons.join("; ") + ".",
      basis,
    };
  }

  // ── D4 · Dinâmica Territorial ─────────────────────────────────────────────
  // Eixo: presença de população tradicional, que a metodologia PRINT já lista
  // como indicador da dimensão. Não é juízo sobre a população — é leitura de
  // complexidade operacional: onde há povo indígena residente há consulta
  // prévia, interlocução com FUNAI, sobreposição fundiária e prazo diferente.
  // Quem vai operar precisa saber disso antes, não depois.
  const indigena = pick(indicators, "presenca_indigena_por_mil");
  if (indigena) {
    // Distribuição muito concentrada em zero: a maioria dos municípios tem
    // presença baixa. O percentil resolve isso sozinho, sem faixa arbitrária.
    out.D4 = {
      score: Math.round(indigena.pct * 100),
      confidence: 1,
      rationale:
        `${indigena.v.value} pessoas indígenas por mil habitantes (Censo 2022), ` +
        `percentil ${Math.round(indigena.pct * 100)} do país.`,
      basis: [
        {
          key: "presenca_indigena_por_mil",
          label: indigena.v.label,
          value: indigena.v.value,
          unit: indigena.v.unit,
          pct: indigena.pct,
        },
      ],
    };
  }

  log.debug(
    { ibgeId, dimensoes: Object.keys(out) },
    "Score estrutural calculado"
  );

  return out;
}

/**
 * Peso da camada estrutural na composição final da dimensão.
 *
 * Alto de propósito: onde existe indicador oficial medido para o país inteiro,
 * ele é evidência melhor que a contagem de notícias que o Google devolveu
 * naquele dia. O sinal entra com o restante, e é ele que faz o score se mover
 * no dia a dia — que é exatamente o papel dele.
 */
export const STRUCTURAL_WEIGHT = 0.6;

/**
 * Combina o score estrutural com o score vindo dos sinais.
 *
 * Sem estrutura para a dimensão, devolve o score de sinal intacto — nenhuma
 * dimensão é inventada a partir de nada.
 */
export function blendDimensionScore(
  signalScore: number,
  structural: StructuralDimensionScore | undefined
): number {
  if (!structural) return signalScore;
  const w = STRUCTURAL_WEIGHT * Math.max(0, Math.min(1, structural.confidence));
  return Math.round((structural.score * w + signalScore * (1 - w)) * 10) / 10;
}
