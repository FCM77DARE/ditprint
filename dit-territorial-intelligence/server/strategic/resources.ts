/**
 * Agente de Recursos Territoriais
 *
 * Avalia presença de recursos naturais, minerais, energéticos, hídricos,
 * florestais e ambientais NO TERRITÓRIO ESPECÍFICO (não no estado inteiro).
 *
 * Hierarquia de lookup:
 *   1. Override por município (slug-UF)            ← mais específico
 *   2. Perfil por mesorregião IBGE (UF/mesoregion) ← granularidade ideal
 *   3. Perfil por UF — APENAS recursos genuinamente estaduais
 *      (ex: "produção majoritária do estado é X"). NUNCA recursos
 *      que dependem de sub-região geográfica (ex: NÃO usar perfil
 *      "BA sertão" pra município do litoral sul).
 *   4. Lista vazia + nota informativa quando não há mapeamento.
 *
 * Bug corrigido (feedback equipe 2026-05): antes, pesquisar Cairu (Sul
 * Baiano, litoral) retornava recursos de Caetité (urânio, sertão) e
 * Vale São Francisco — completamente fora da realidade geográfica.
 *
 * Não usa LLM. Mantém custo zero e resposta sub-100ms.
 */

import type { Resource, TerritoryStrategicContext } from "./types";

// ─── PERFIL POR MESORREGIÃO ────────────────────────────────────────────────────
// Chave: `${UF}|${mesorregião normalizada}` — uso lookup pela função keyMeso().
// Cada mesorregião lista APENAS recursos que de fato existem ALI.

const MESO_RESOURCE_PROFILE: Record<string, Resource[]> = {
  // ── BAHIA ───────────────────────────────────────────────────────────────────
  "BA|metropolitana-de-salvador": [
    { category: "energeticos", name: "Polo Petroquímico de Camaçari", abundance: "abundante",
      notes: "Maior complexo petroquímico integrado da América do Sul",
      sources: ["COFIC", "Braskem"] },
    { category: "energeticos", name: "Refino de Petróleo (RLAM)", abundance: "abundante",
      notes: "Refinaria Mataripe — capacidade ~330 mil bpd",
      sources: ["Acelen", "ANP"] },
    { category: "hidricos", name: "Baía de Todos-os-Santos", abundance: "abundante",
      notes: "Maior baía navegável do Brasil; pesca, turismo, logística portuária",
      sources: ["ANA", "Marinha"] },
    { category: "ambientais", name: "Manguezais e APA Joanes-Ipitanga", abundance: "presente",
      notes: "Áreas de proteção em zona de pressão urbana intensa",
      sources: ["INEMA", "ICMBio"] },
  ],
  "BA|sul-baiano": [
    { category: "ambientais", name: "Mata Atlântica Costeira", abundance: "abundante",
      notes: "Remanescentes de Mata Atlântica + APA Pratigi, Tinharé-Boipeba",
      sources: ["INEMA", "SOS Mata Atlântica"] },
    { category: "hidricos", name: "Estuários e Manguezais", abundance: "abundante",
      notes: "Sistema estuarino do Baixo Sul — berçário pesqueiro de relevância nacional",
      sources: ["ICMBio", "ANA"] },
    { category: "agricolas", name: "Cacau (Cabruca)", abundance: "abundante",
      notes: "Sistema agroflorestal histórico Ilhéus/Itabuna — IG protegida",
      sources: ["CEPLAC", "IBGE PAM"] },
    { category: "agricolas", name: "Pesca Artesanal e Mariscagem", abundance: "abundante",
      notes: "Cadeia extrativista costeira (Cairu, Valença, Camamu)",
      sources: ["MPA", "MAPA"] },
  ],
  "BA|extremo-oeste-baiano": [
    { category: "agricolas", name: "Soja / Algodão / Milho (MATOPIBA)", abundance: "abundante",
      notes: "Última fronteira agrícola consolidada do Brasil — Luís Eduardo Magalhães",
      sources: ["CONAB", "AIBA"] },
    { category: "hidricos", name: "Aquífero Urucuia", abundance: "abundante",
      notes: "Principal reserva hídrica subterrânea do oeste — uso intensivo em irrigação",
      sources: ["ANA", "CPRM"] },
  ],
  "BA|vale-sao-franciscano-da-bahia": [
    { category: "energeticos", name: "Energia Solar e Eólica", abundance: "abundante",
      notes: "Maior densidade de parques renováveis do BR — Caetité, Pindaí, Guanambi",
      sources: ["ANEEL", "EPE"] },
    { category: "minerais", name: "Urânio (INB Caetité)", abundance: "presente",
      notes: "Única operação comercial de urânio do BR",
      sources: ["INB", "CNEN"] },
    { category: "agricolas", name: "Fruticultura Irrigada", abundance: "abundante",
      notes: "Polo Juazeiro-Petrolina — manga, uva, banana de exportação",
      sources: ["CODEVASF", "CONAB"] },
  ],
  "BA|centro-norte-baiano": [
    { category: "minerais", name: "Mineração de Pequeno Porte (ouro/cromo)", abundance: "presente",
      notes: "Senhor do Bonfim, Jacobina — histórico de garimpo e produção formal",
      sources: ["ANM", "SIGMINE"] },
    { category: "ambientais", name: "Caatinga e Chapada Diamantina (extremo sul)", abundance: "presente",
      notes: "Transição caatinga-mata seca; vegetação adaptada à semiaridez",
      sources: ["ICMBio", "INEMA"] },
    { category: "ambientais", name: "Tradição Cultural — Capital do Forró", abundance: "abundante",
      notes: "Senhor do Bonfim é reconhecida como uma das capitais baianas do forró; festas juninas figuram entre as maiores do Nordeste",
      sources: ["IPHAN", "Setur-BA"] },
  ],
  "BA|nordeste-baiano": [
    { category: "energeticos", name: "Energia Eólica (Litoral)", abundance: "presente",
      notes: "Parques offshore e onshore — Esplanada, Conde",
      sources: ["ANEEL"] },
    { category: "ambientais", name: "Litoral Norte / Praia do Forte", abundance: "abundante",
      notes: "Reserva Sapiranga, Projeto Tamar — Mata de São João, Camaçari",
      sources: ["ICMBio", "Projeto Tamar"] },
  ],
  "BA|centro-sul-baiano": [
    { category: "ambientais", name: "Chapada Diamantina", abundance: "abundante",
      notes: "Parque Nacional, cavernas, garimpo histórico de diamantes",
      sources: ["ICMBio"] },
    { category: "hidricos", name: "Cabeceiras do Paraguaçu", abundance: "abundante",
      notes: "Nascentes que abastecem a Região Metropolitana de Salvador",
      sources: ["ANA"] },
  ],

  // ── RIO GRANDE DO NORTE ─────────────────────────────────────────────────────
  "RN|leste-potiguar": [
    { category: "energeticos", name: "Energia Eólica (Litoral Norte)", abundance: "abundante",
      notes: "Litoral norte do RN concentra os maiores parques eólicos onshore do Brasil — São Miguel do Gostoso, Rio do Fogo (Arizona I/II — Iberdrola/Força Eólica), Pedra Grande, João Câmara",
      sources: ["ANEEL", "EPE", "ABEEólica"] },
    { category: "agricolas", name: "Pesca Artesanal e Mariscagem", abundance: "abundante",
      notes: "Comunidades pesqueiras tradicionais ao longo do litoral leste — peixe, lagosta, marisco, camarão",
      sources: ["MPA", "MAPA", "EMATER-RN"] },
    { category: "ambientais", name: "Recifes / Parrachos de Coral", abundance: "abundante",
      notes: "Parrachos de Maracajaú, Rio do Fogo e Caraúbas — sistemas recifais de relevância internacional para biodiversidade marinha do Atlântico Sul",
      sources: ["ICMBio", "MMA", "IDEMA"] },
    { category: "ambientais", name: "Turismo Costeiro", abundance: "abundante",
      notes: "Eixo Natal–Pipa–São Miguel do Gostoso — destino consolidado de turismo de natureza, sol e mar; kitesurf de classe mundial",
      sources: ["EMPROTUR", "Setur-RN"] },
    { category: "ambientais", name: "Mata Atlântica Costeira e Restingas", abundance: "presente",
      notes: "Remanescentes de Mata Atlântica em pequenos enclaves litorâneos + ecossistemas de restinga e dunas vegetadas; pressão de expansão imobiliária e eólica",
      sources: ["SOS Mata Atlântica", "ICMBio", "IDEMA"] },
  ],

  // ── MINAS GERAIS ────────────────────────────────────────────────────────────
  "MG|metropolitana-de-belo-horizonte": [
    { category: "minerais", name: "Minério de Ferro (Quadrilátero Ferrífero)", abundance: "abundante",
      notes: "Núcleo histórico da produção brasileira de minério",
      sources: ["ANM", "IBRAM"] },
  ],
  "MG|triangulo-mineiro/alto-paranaiba": [
    { category: "minerais", name: "Nióbio / Terras Raras", abundance: "abundante",
      notes: "Araxá/Tapira — complexos carbonatíticos CBMM",
      sources: ["CBMM", "MME"] },
  ],
  "MG|sul/sudoeste-de-minas": [
    { category: "agricolas", name: "Café Arábica", abundance: "abundante",
      notes: "Maior região cafeicultora do mundo",
      sources: ["CONAB", "ABIC"] },
  ],

  // ── RIO DE JANEIRO ──────────────────────────────────────────────────────────
  "RJ|norte-fluminense": [
    { category: "energeticos", name: "Petróleo / Gás (Bacia de Campos)", abundance: "abundante",
      notes: "Macaé/Campos — capital nacional do petróleo offshore",
      sources: ["ANP", "Petrobras"] },
  ],
};

// ─── PERFIL POR UF (apenas recursos genuinamente STATE-WIDE) ──────────────────
// Aqui SÓ entram recursos que de fato existem ou impactam a UF inteira.
// Recursos sub-regionais ficam no MESO_RESOURCE_PROFILE acima.

const UF_RESOURCE_PROFILE: Record<string, Resource[]> = {
  AM: [
    { category: "florestais", name: "Floresta Amazônica", abundance: "abundante",
      notes: "Bioma dominante em todo o estado", sources: ["INPE", "SFB"] },
    { category: "hidricos", name: "Bacia Amazônica", abundance: "abundante",
      notes: "Maior reserva de água doce do mundo", sources: ["ANA"] },
  ],
  PA: [
    { category: "florestais", name: "Floresta Amazônica", abundance: "abundante",
      notes: "Bioma dominante", sources: ["INPE"] },
  ],
  MT: [
    { category: "agricolas", name: "Soja / Milho / Algodão", abundance: "abundante",
      notes: "Maior produtor nacional de soja", sources: ["CONAB"] },
  ],
  MS: [
    { category: "ambientais", name: "Pantanal", abundance: "abundante",
      notes: "Maior planície alagada do mundo (compartilhada com MT)", sources: ["ICMBio"] },
  ],
  // Demais UFs ficam intencionalmente sem perfil state-wide: o conteúdo
  // genérico anterior foi removido pra evitar "Cairu mostra urânio de Caetité".
};

// ─── OVERRIDES POR MUNICÍPIO (precisão cirúrgica) ─────────────────────────────

const MUNICIPALITY_OVERRIDES: Record<string, Resource[]> = {
  "araxa-MG": [
    { category: "minerais", name: "Terras Raras", abundance: "abundante",
      notes: "Complexo carbonatítico de Barreiro — TR + nióbio + fosfato",
      sources: ["CBMM", "MME"] },
  ],
  "minacu-GO": [
    { category: "minerais", name: "Terras Raras Pesadas", abundance: "abundante",
      notes: "Serra Verde Mining — disprósio, térbio (críticos para ímãs)",
      sources: ["MME", "Serra Verde Mining"] },
  ],
  "barueri-SP": [
    { category: "energeticos", name: "Infraestrutura de Energia", abundance: "abundante",
      notes: "Subestações dedicadas para data centers de Tamboré",
      sources: ["ENEL", "ABRINTEL"] },
  ],
  "fortaleza-CE": [
    { category: "energeticos", name: "Cabos Submarinos", abundance: "abundante",
      notes: "Pouso de ≥6 cabos submarinos (EllaLink, Monet, GlobeNet)",
      sources: ["TeleGeography"] },
  ],
  "cairu-BA": [
    { category: "ambientais", name: "Arquipélago de Tinharé-Boipeba", abundance: "abundante",
      notes: "APA Tinharé-Boipeba; Morro de São Paulo; turismo de natureza",
      sources: ["INEMA", "Setur-BA"] },
    { category: "hidricos", name: "Manguezais e Estuários", abundance: "abundante",
      notes: "Cadeia produtiva da mariscagem; berçário da pesca artesanal",
      sources: ["ICMBio"] },
  ],
  "dias-davila-BA": [
    { category: "energeticos", name: "Polo Petroquímico de Camaçari (adjacência)", abundance: "presente",
      notes: "Município conurbado ao maior complexo petroquímico do BR",
      sources: ["COFIC"] },
    { category: "hidricos", name: "Águas Termais", abundance: "presente",
      notes: "Bacia hidrotermal histórica (homônima ao nome do município)",
      sources: ["CPRM"] },
  ],
  "mata-de-sao-joao-BA": [
    { category: "ambientais", name: "Reserva Sapiranga e Praia do Forte", abundance: "abundante",
      notes: "Mata Atlântica preservada + Projeto Tamar (sede)",
      sources: ["ICMBio", "Projeto Tamar"] },
    { category: "agricolas", name: "Turismo Costeiro Estruturado", abundance: "abundante",
      notes: "Eixo Praia do Forte–Imbassaí — referência nacional em ecoturismo",
      sources: ["Setur-BA"] },
  ],
  "senhor-do-bonfim-BA": [
    { category: "ambientais", name: "Tradição Junina — Capital Baiana do Forró", abundance: "abundante",
      notes: "São João de Senhor do Bonfim é uma das maiores festas juninas do NE; reconhecimento de patrimônio cultural",
      sources: ["IPHAN", "Setur-BA"] },
    { category: "minerais", name: "Mineração de Ouro / Cromo", abundance: "presente",
      notes: "Histórico de garimpo e produção formal de pequeno porte",
      sources: ["ANM"] },
  ],
};

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function muniKey(name: string, state: string): string {
  return `${slugify(name)}-${state}`;
}

function mesoKey(state: string, mesoregion: string): string {
  if (!state || !mesoregion) return "";
  return `${state}|${slugify(mesoregion)}`;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

export async function collectResources(
  ctx: TerritoryStrategicContext
): Promise<Resource[]> {
  // 1. Override municipal — ganha sempre
  const muniOverrides = MUNICIPALITY_OVERRIDES[muniKey(ctx.name, ctx.state)] ?? [];

  // 2. Perfil mesorregional — onde temos dados, é a granularidade certa
  const mesoProfile = ctx.mesoregion
    ? MESO_RESOURCE_PROFILE[mesoKey(ctx.state, ctx.mesoregion)] ?? []
    : [];

  // 3. Perfil estadual — só recursos genuinamente state-wide
  const ufProfile = UF_RESOURCE_PROFILE[ctx.state] ?? [];

  // Merge: município > mesorregião > UF, deduplicado por nome.
  const merged = new Map<string, Resource>();
  for (const r of ufProfile) merged.set(r.name, r);
  for (const r of mesoProfile) merged.set(r.name, r);
  for (const r of muniOverrides) merged.set(r.name, r);

  const result = Array.from(merged.values());

  // Quando NÃO temos NADA mapeado, retornamos uma única nota explicativa
  // em vez de fingir conhecimento. Melhor honesto que enganador.
  if (result.length === 0) {
    return [
      {
        category: "ambientais",
        name: "Mapeamento regional em construção",
        abundance: "limitado",
        notes:
          `Recursos específicos para ${ctx.name}${ctx.mesoregion ? ` (${ctx.mesoregion})` : ""} ` +
          `ainda não estão na base curada do DIT. ` +
          `Em breve: consulta direta a SIGMINE (ANM), ANEEL, INMET e ICMBio por bounding box.`,
        sources: ["IBGE", "Base interna DIT"],
      },
    ];
  }

  return result;
}
