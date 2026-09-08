/**
 * Localidades curadas — o que a resolução automática não tem como acertar.
 *
 * POR QUE ISTO EXISTE
 *
 * A resolução de localidade cai no Nominatim quando o nome não é município
 * nem distrito do IBGE. O Nominatim responde por proximidade textual, e para
 * nome de lugar pequeno isso erra de um jeito que parece certo:
 *
 *   "Cabiúnas"        → "Fazenda Cabiúnas", em Cambuci/RJ
 *                       (a que interessa é o terminal da Petrobras, em Macaé)
 *   "Porto de Maricá" → "Rua Edson de Almeida Porto Antiga"
 *   "Rua das Flores"  → "Rua XV de Novembro", em Curitiba/PR
 *
 * Os dois últimos o filtro de tipo já recusa. O primeiro não tem como: é um
 * lugar de verdade, com o nome certo, no município errado. Nenhuma heurística
 * de texto resolve isso — só saber de qual Cabiúnas estamos falando.
 *
 * Então as localidades que a PRINT de fato monitora ficam declaradas aqui, com
 * o município e o código IBGE conferidos na malha. É consultado ANTES do
 * Nominatim, é determinístico e é auditável: dá para ler a linha e conferir.
 *
 * COMO ACRESCENTAR
 *
 * Uma entrada por localidade, com o código IBGE do município pai conferido em
 * servicodados.ibge.gov.br/api/v1/localidades/municipios/{id}. Nunca por
 * memória — código errado aqui atribui o território errado ao cliente, e o
 * relatório sai coerente e falso.
 */

export interface LocalidadeCurada {
  /** Nome canônico exibido */
  nome: string;
  /** Município pai */
  municipio: string;
  /** Código IBGE do município pai */
  ibgeId: number;
  /** UF */
  uf: string;
  /** Formas como as pessoas escrevem, já normalizadas (minúsculas, sem acento) */
  aliases: string[];
  /** Por que este lugar está no radar — aparece no log, não no relatório */
  nota: string;
}

export const LOCALIDADES_CURADAS: LocalidadeCurada[] = [
  {
    nome: "Cabiúnas",
    municipio: "Macaé",
    ibgeId: 3302403,
    uf: "RJ",
    aliases: ["cabiunas", "cabiunas macae", "terminal cabiunas", "tecab"],
    nota: "Terminal de Cabiúnas (TECAB), Petrobras — polo de Macaé",
  },
  {
    nome: "Suruí",
    municipio: "Magé",
    ibgeId: 3302502,
    uf: "RJ",
    aliases: ["surui", "surui mage", "suruí mage"],
    nota: "Distrito de Magé, na Baía de Guanabara",
  },
  {
    nome: "Itaipuaçu",
    municipio: "Maricá",
    ibgeId: 3302700,
    uf: "RJ",
    aliases: ["itaipuacu", "itaipuacu marica", "porto itaipuacu"],
    nota: "Distrito de Maricá",
  },
  {
    nome: "Porto de Maricá",
    municipio: "Maricá",
    ibgeId: 3302700,
    uf: "RJ",
    aliases: ["porto de marica", "porto marica"],
    nota: "Projeto portuário de Maricá — Nominatim devolvia rua com 'Porto' no nome",
  },
  {
    nome: "Secretário",
    municipio: "Petrópolis",
    ibgeId: 3303906,
    uf: "RJ",
    aliases: ["secretario", "secretario petropolis", "secretario petropolis rj"],
    nota: "Distrito de Petrópolis",
  },
  {
    nome: "Jardim Ana Clara",
    municipio: "Duque de Caxias",
    ibgeId: 3301702,
    uf: "RJ",
    aliases: [
      "jardim ana clara",
      "jardim ana clara caxias",
      "jardim ana clara duque de caxias",
    ],
    nota: "Território com DIT já gerado no repo (DIT_JardimAnaClara_MAIO2026)",
  },
];

/**
 * Índice alias → localidade, montado uma vez.
 */
const PORTALIAS = new Map<string, LocalidadeCurada>();
for (const l of LOCALIDADES_CURADAS) {
  for (const a of l.aliases) PORTALIAS.set(a, l);
  PORTALIAS.set(l.nome.toLowerCase(), l);
}

/**
 * Reduz a chave ao essencial antes de comparar.
 *
 * A normalização de quem chama tira acento e apóstrofo, mas mantém vírgula e
 * hífen — e "Secretário, Petrópolis" chegava como "secretario, petropolis",
 * que não batia com o alias "secretario petropolis". Pontuação não distingue
 * lugar nenhum, então sai aqui.
 */
function chave(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PORTALIAS_CHAVE = new Map<string, LocalidadeCurada>();
for (const [k, v] of Array.from(PORTALIAS.entries())) {
  PORTALIAS_CHAVE.set(chave(k), v);
}

/**
 * Procura uma localidade curada pelo nome já normalizado (minúsculas, sem
 * acento, sem apóstrofo). Devolve null quando não é um lugar declarado aqui —
 * e aí a resolução segue o caminho normal.
 */
export function buscarLocalidadeCurada(normalizado: string): LocalidadeCurada | null {
  return PORTALIAS_CHAVE.get(chave(normalizado)) ?? null;
}
