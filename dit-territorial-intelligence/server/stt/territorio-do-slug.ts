/**
 * Reconstrói o território inteiro a partir do slug canônico.
 *
 * POR QUE EXISTE
 *
 * A coleta diária (scheduler) não tem banco em produção: ela lê a lista de
 * territórios do disco e só tem o SLUG. Até aqui ela batizava o território
 * com o próprio slug, trocando hífen por espaço — "belford roxo 3300456" — e
 * mandava contextData vazio.
 *
 * Com o verificador ligado, isso zerava o acompanhamento: nenhuma notícia
 * escreve "belford roxo 3300456", então 100% dos sinais caíam como "não cita
 * o território" (visto em produção em 24/09/2026: 18 de 18). E sem código
 * IBGE no contexto, a camada estrutural também não respondia. O território
 * ficava no Radar sem ser lido.
 *
 * O slug canônico já carrega tudo o que falta: o código IBGE do município e,
 * quando é distrito ou localidade, o nome do lugar. Composto é reconhecido
 * pelo slug fixo. O nome do município vem da camada estrutural, que guarda os
 * 5.570 nomes como o IBGE escreve.
 */

import { getMunicipalityName, listarCodigosENomes } from "../structural/store";
import { buscarCompostoPorSlug } from "../routes/territorios-compostos";
import { buscarLocalidadeCurada } from "../routes/localidades-curadas";

export interface TerritorioReconstruido {
  name: string;
  state: string | null;
  contextData: Record<string, unknown> | null;
}

function dobrar(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function separar(nomeIbge: string): { nome: string; uf: string } {
  const m = nomeIbge.match(/^(.*) - ([A-Z]{2})$/);
  return m ? { nome: m[1], uf: m[2] } : { nome: nomeIbge, uf: "" };
}

export async function territorioDoSlug(slug: string): Promise<TerritorioReconstruido | null> {
  // Composto: slug fixo, membros resolvidos por nome+UF contra a malha.
  const composto = buscarCompostoPorSlug(slug);
  if (composto) {
    const indice = await indiceNomeParaCodigo();
    const ids: string[] = [];
    const membros: string[] = [];
    for (const mb of composto.membros) {
      const id = indice.get(`${dobrar(mb.nome)}|${mb.uf}`);
      if (id) {
        ids.push(id);
        membros.push(mb.nome);
      }
    }
    if (ids.length === 0) return null;
    return {
      name: composto.nome,
      state: composto.uf,
      contextData: {
        ibgeMunicipios: ids,
        ibgeId: ids[0],
        uf: composto.uf,
        municipiosNomes: membros,
        composite: true,
        compositeSlug: composto.slug,
      },
    };
  }

  // Canônico: município-CÓDIGO[-localidade]
  const m = slug.match(/^(.+?)-(\d{7})(?:-(.+))?$/);
  if (!m) return null;
  const ibgeId = m[2];
  const nomeIbge = await getMunicipalityName(ibgeId);
  if (!nomeIbge || nomeIbge === ibgeId) return null;
  const { nome: municipio, uf } = separar(nomeIbge);

  let nome = municipio;
  if (m[3]) {
    const curada = buscarLocalidadeCurada(m[3].replace(/-/g, " "));
    nome = curada?.nome ?? m[3].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return {
    name: nome,
    state: uf || null,
    contextData: {
      ibgeMunicipios: [ibgeId],
      ibgeId,
      uf,
      // Localidade vale pelo próprio nome (territory.name) ou pelo do
      // município pai — o verificador aceita os dois.
      municipiosNomes: [municipio],
    },
  };
}

let indiceCache: Map<string, string> | null = null;

/** nome dobrado|UF → código IBGE, a partir dos nomes guardados no store. */
async function indiceNomeParaCodigo(): Promise<Map<string, string>> {
  if (indiceCache) return indiceCache;
  const pares = await listarCodigosENomes();
  indiceCache = new Map();
  for (const [codigo, nomeIbge] of pares) {
    const { nome, uf } = separar(nomeIbge);
    indiceCache.set(`${dobrar(nome)}|${uf}`, codigo);
  }
  return indiceCache;
}
