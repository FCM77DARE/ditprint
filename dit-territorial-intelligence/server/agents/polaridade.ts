/**
 * Polaridade por CONTEÚDO: heurística determinística, sem LLM.
 *
 * O PROBLEMA
 *
 * Hoje a polaridade do sinal vem da FONTE (consolidator.ts, signalPolarity):
 * tudo de src-ibama é "tensionante", tudo de src-querido-diario é
 * "resolutivo". Uma notícia de "Prefeitura inaugura hospital" vinda de uma fonte
 * tensionante soma tensão; "incêndio atinge mata" vinda de fonte resolutiva
 * abaixa a dimensão. A polaridade precisa olhar o que o sinal DIZ.
 *
 * O QUE ESTE MÓDULO FAZ
 *
 * Conta palavras de fato negativo e positivo em pt-BR no título e no resumo.
 * Negação e redução ("sem mortes", "queda de desmatamento") invertem o termo
 * que vem logo depois. Empate ou ausência de palavra é neutro.
 *
 * ESTADO: pronto e DESLIGADO. `polaridadeConteudoAtiva()` só devolve true com
 * DIT_POLARIDADE_CONTEUDO=true. Nada em produção chama este módulo ainda;
 * onde plugar está em docs/redesign/02-logica-agentes.md.
 *
 * Puro: sem IO. A única leitura de ambiente é a flag, em função à parte.
 */

export type PolaridadeConteudo = "tensionante" | "resolutiva" | "neutra";

/** Vocabulário do consolidator.ts (signalPolarity). */
export type PolaridadeConsolidador = "resolutive" | "tensioning" | "neutral";

export interface ResultadoPolaridade {
  polaridade: PolaridadeConteudo;
  /** Termos de fato negativo que valeram como negativo. */
  negativos: string[];
  /** Termos de fato positivo que valeram como positivo (inclui negativos negados). */
  positivos: string[];
  /** Termos cuja polaridade foi invertida por negação ou redução. */
  invertidos: string[];
}

// Padrões casam o TOKEN inteiro, já sem acento e em minúsculas.
const NEGATIVOS = [
  "incendi(?:o|os)", "queimadas?", "desmatamentos?", "deslizamentos?", "enchentes?",
  "inundac(?:ao|oes)", "alagamentos?", "secas?", "estiagens?", "rompimentos?",
  "vazamentos?", "contaminac(?:ao|oes)", "poluic(?:ao|oes)", "derramamentos?",
  "acidentes?", "mortes?", "mortos?", "morreu", "morreram", "vitimas?", "feridos?",
  "desabrigad[oa]s", "desalojad[oa]s", "assassinat(?:o|os)", "homicidios?",
  "roubos?", "tiroteios?", "violencia", "crimes?", "trafico", "milicias?",
  "conflitos?", "invasao", "invasoes", "grilagem", "embargos?", "multas?",
  "autuac(?:ao|oes)", "autuad[oa]s", "interdic(?:ao|oes)", "irregularidades?",
  "denuncias?", "investigac(?:ao|oes)", "corrupcao", "fraudes?", "desvios?",
  "improbidade", "prejuizos?", "crise", "colapso", "escassez", "desemprego",
  "demissoes", "fechamento", "paralisac(?:ao|oes)", "paralisad[oa]s", "greves?",
  "protestos?", "bloqueios?", "surtos?", "epidemias?", "dengue", "deficit",
  "abandono", "precari[oa]s?", "sucateamento", "atrasos?", "suspensao",
  "ameacas?", "alertas?", "tragedias?", "destruicao", "erosao",
];

const POSITIVOS = [
  "inaugur(?:a|ou|am|aram|acao|ado|ada|ados|adas)", "investimentos?",
  "investe", "investiu", "aprovad[oa]s?", "aprova", "aprovou", "aprovacao",
  "ampliac(?:ao|oes)", "amplia", "ampliou", "ampliad[oa]s?", "melhorias?",
  "melhora", "melhorou", "melhorad[oa]s?", "empregos?", "contratac(?:ao|oes)",
  "crescimento", "expansao", "conquista", "conquistou", "premiad[oa]s?",
  "premio", "concluid[oa]s?", "conclusao", "entregues?", "entrega",
  "liberad[oa]s?", "convenios?", "parcerias?", "acordos?", "regularizac(?:ao|oes)",
  "restaurac(?:ao|oes)", "recuperac(?:ao|oes)", "preservac(?:ao|oes)",
  "revitalizac(?:ao|oes)", "avanco", "avancos", "beneficia", "beneficiou",
];

// Negação ou redução: invertem o termo que aparece até JANELA tokens depois.
const NEGADORES = new Set([
  "sem", "nao", "nenhum", "nenhuma", "nem", "zero", "reducao", "reduz", "reduziu",
  "queda", "diminuicao", "diminui", "diminuiu", "combate", "combatem", "fim",
  "evita", "evitou", "contem", "conteve",
]);
const JANELA = 4;

const compila = (padroes: string[]) => padroes.map((p) => ({ p, re: new RegExp(`^(?:${p})$`) }));
const RE_NEG = compila(NEGATIVOS);
const RE_POS = compila(POSITIVOS);

function normaliza(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function classificarPolaridadePorConteudo(texto: string | null | undefined): ResultadoPolaridade {
  const tokens = normaliza(texto ?? "");
  const negativos: string[] = [];
  const positivos: string[] = [];
  const invertidos: string[] = [];

  tokens.forEach((tok, i) => {
    const ehNeg = RE_NEG.some((x) => x.re.test(tok));
    const ehPos = !ehNeg && RE_POS.some((x) => x.re.test(tok));
    if (!ehNeg && !ehPos) return;

    const inicio = Math.max(0, i - JANELA);
    const negado = tokens.slice(inicio, i).some((t) => NEGADORES.has(t));
    if (negado) invertidos.push(tok);

    const comoNegativo = negado ? ehPos : ehNeg;
    (comoNegativo ? negativos : positivos).push(tok);
  });

  let polaridade: PolaridadeConteudo = "neutra";
  if (negativos.length > positivos.length) polaridade = "tensionante";
  else if (positivos.length > negativos.length) polaridade = "resolutiva";

  return { polaridade, negativos, positivos, invertidos };
}

/** Liga só com a string exata "true". Ausente ou qualquer outro valor: desligada. */
export function polaridadeConteudoAtiva(): boolean {
  return process.env.DIT_POLARIDADE_CONTEUDO === "true";
}

/**
 * Ponto de plug para o consolidator: com a flag desligada devolve a polaridade
 * da fonte intacta; ligada, o conteúdo decide, e conteúdo neutro cai na fonte.
 */
export function polaridadeDoSinal(
  texto: string | null | undefined,
  polaridadeDaFonte: PolaridadeConsolidador
): PolaridadeConsolidador {
  if (!polaridadeConteudoAtiva()) return polaridadeDaFonte;
  const { polaridade } = classificarPolaridadePorConteudo(texto);
  if (polaridade === "tensionante") return "tensioning";
  if (polaridade === "resolutiva") return "resolutive";
  return polaridadeDaFonte;
}
