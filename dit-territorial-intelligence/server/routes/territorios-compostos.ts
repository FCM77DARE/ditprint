/**
 * Territórios compostos — recortes que não cabem em um município.
 *
 * POR QUE
 *
 * A Baía de Guanabara é o recorte mais forte da tese da PRINT e não é um
 * município: é uma bacia com orla em sete deles. Enquanto o modelo aceitava
 * só município, ela ficava no snapshot store como slug solto, sem código
 * IBGE, fora de qualquer série — e o STT dela não significava nada, porque
 * nenhuma fonte sabia a que território responder.
 *
 * COMO FUNCIONA
 *
 * Um composto declara seus municípios membros por nome e UF. Os códigos IBGE
 * são resolvidos contra a malha em tempo de execução, nunca digitados — foi
 * assim que 2910776 (Feira da Mata) entrou uma vez no lugar de Dias d'Ávila.
 *
 * O resto do motor já suportava isso sem saber: `contextData.ibgeMunicipios`
 * sempre foi uma lista, e os agentes de fonte leem dela. O composto só
 * preenche a lista inteira em vez de um item.
 *
 * O score estrutural é a média dos membros PONDERADA POR POPULAÇÃO. Sem o
 * peso, Guapimirim (60 mil) valeria o mesmo que o Rio (6,2 milhões) na
 * leitura da bacia, o que descreveria uma baía que não existe.
 *
 * COMO ACRESCENTAR
 *
 * Uma entrada com critério de recorte escrito. O critério importa mais que a
 * lista: quem for conferir daqui a um ano precisa saber por que estes
 * municípios e não outros.
 */

export interface MembroComposto {
  nome: string;
  uf: string;
}

export interface TerritorioComposto {
  /** Slug canônico — estável, não deriva de código IBGE porque não há um */
  slug: string;
  /** Nome exibido */
  nome: string;
  /** UF predominante, para rótulo e para as queries geográficas */
  uf: string;
  /** Região do IBGE */
  regiao: string;
  /**
   * Por que estes municípios e não outros. É a parte auditável do recorte —
   * a lista sem o critério é opinião.
   */
  criterio: string;
  membros: MembroComposto[];
}

export const TERRITORIOS_COMPOSTOS: TerritorioComposto[] = [
  {
    slug: "baia-de-guanabara",
    nome: "Baía de Guanabara",
    uf: "RJ",
    regiao: "Sudeste",
    criterio:
      "Municípios com orla na Baía de Guanabara. Critério operacional, não " +
      "hidrográfico: a região hidrográfica RH-V inclui municípios de cabeceira " +
      "sem contato com o espelho d'água, que respondem a outra dinâmica. Quem " +
      "opera na baía opera nestes sete.",
    membros: [
      { nome: "Rio de Janeiro", uf: "RJ" },
      { nome: "Niterói", uf: "RJ" },
      { nome: "São Gonçalo", uf: "RJ" },
      { nome: "Duque de Caxias", uf: "RJ" },
      { nome: "Magé", uf: "RJ" },
      { nome: "Guapimirim", uf: "RJ" },
      { nome: "Itaboraí", uf: "RJ" },
    ],
  },
];

const PORSLUG = new Map(TERRITORIOS_COMPOSTOS.map((t) => [t.slug, t]));

function chave(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PORNOME = new Map<string, TerritorioComposto>();
for (const t of TERRITORIOS_COMPOSTOS) {
  PORNOME.set(chave(t.nome), t);
  PORNOME.set(chave(t.slug), t);
  // "Baia de Guanabara" também é escrita como "Guanabara"
  PORNOME.set(chave(t.nome.replace(/^ba[ií]a d[eo]\s+/i, "")), t);
}

export function buscarCompostoPorNome(texto: string): TerritorioComposto | null {
  return PORNOME.get(chave(texto)) ?? null;
}

export function buscarCompostoPorSlug(slug: string): TerritorioComposto | null {
  return PORSLUG.get(slug) ?? null;
}

export function ehSlugComposto(slug: string): boolean {
  return PORSLUG.has(slug);
}
