/**
 * Agente de Recursos Territoriais
 *
 * Avalia presença de recursos naturais, minerais, energéticos, hídricos,
 * florestais e ambientais no território. Combina:
 *   • Mapeamento determinístico por estado/região (conhecimento BR consolidado)
 *   • Match por nome de município (overrides locais)
 *
 * Não usa LLM. Mantém custo zero e resposta sub-100ms.
 */

import type { Resource, TerritoryStrategicContext } from "./types";

// ─── PERFIL DE RECURSOS POR UF ────────────────────────────────────────────────
// Cada UF tem um "baseline" de recursos disponíveis no estado.
// Pode ser refinado por município via OVERRIDES.

const UF_RESOURCE_PROFILE: Record<string, Resource[]> = {
  MG: [
    { category: "minerais", name: "Minério de Ferro", abundance: "abundante",
      notes: "Quadrilátero Ferrífero — maior produção nacional", sources: ["ANM", "IBRAM"] },
    { category: "minerais", name: "Nióbio", abundance: "abundante",
      notes: "CBMM Araxá detém ~80% da produção mundial", sources: ["CBMM", "MME"] },
    { category: "minerais", name: "Terras Raras", abundance: "presente",
      notes: "Complexos carbonatíticos (Araxá, Tapira)", sources: ["MME", "SIGMINE-ANM"] },
    { category: "energeticos", name: "Hidroeletricidade", abundance: "abundante",
      notes: "Bacia do Rio Grande, Paranaíba, São Francisco", sources: ["ANEEL"] },
    { category: "agricolas", name: "Café", abundance: "abundante",
      notes: "Sul de Minas — maior produção nacional", sources: ["IBGE PAM", "CONAB"] },
  ],
  GO: [
    { category: "minerais", name: "Nióbio", abundance: "abundante",
      notes: "Catalão — complexos carbonatíticos", sources: ["ANM"] },
    { category: "minerais", name: "Terras Raras Pesadas", abundance: "abundante",
      notes: "Serra Verde (Minaçu) — única produtora comercial fora da China", sources: ["MME"] },
    { category: "agricolas", name: "Soja / Milho", abundance: "abundante",
      notes: "Cerrado — fronteira agrícola consolidada", sources: ["CONAB"] },
    { category: "energeticos", name: "Energia Solar", abundance: "presente",
      notes: "Alto índice de irradiação no Cerrado", sources: ["ANEEL", "INPE"] },
  ],
  AM: [
    { category: "florestais", name: "Floresta Amazônica", abundance: "abundante",
      notes: "Maior bioma florestal contínuo do planeta", sources: ["INPE", "SFB"] },
    { category: "hidricos", name: "Bacia Amazônica", abundance: "abundante",
      notes: "Maior reserva de água doce do mundo", sources: ["ANA"] },
    { category: "minerais", name: "Estanho / Tântalo / Nióbio", abundance: "presente",
      notes: "Distrito de Pitinga (Presidente Figueiredo)", sources: ["ANM"] },
    { category: "ambientais", name: "Biodiversidade Amazônica", abundance: "abundante",
      notes: "Hotspot mundial de biodiversidade", sources: ["ICMBio", "MMA"] },
  ],
  BA: [
    { category: "energeticos", name: "Energia Eólica", abundance: "abundante",
      notes: "Sertão da Bahia — maior parque eólico do BR", sources: ["ANEEL"] },
    { category: "energeticos", name: "Energia Solar", abundance: "abundante",
      notes: "Vale do São Francisco — alta irradiação", sources: ["ANEEL"] },
    { category: "minerais", name: "Urânio", abundance: "presente",
      notes: "INB Caetité — única operação de urânio do BR", sources: ["INB", "CNEN"] },
    { category: "agricolas", name: "Soja / Algodão (MATOPIBA)", abundance: "abundante",
      notes: "Oeste baiano — fronteira agrícola", sources: ["CONAB"] },
  ],
  CE: [
    { category: "energeticos", name: "Energia Eólica Offshore", abundance: "abundante",
      notes: "Litoral CE — projetos pioneiros de offshore", sources: ["ANEEL", "EPE"] },
    { category: "energeticos", name: "Energia Solar", abundance: "abundante",
      notes: "Sertão CE — alta irradiação", sources: ["ANEEL"] },
    { category: "energeticos", name: "Hidrogênio Verde", abundance: "presente",
      notes: "Hub Pecém — projetos âncora", sources: ["EPE", "CPCE"] },
  ],
  SP: [
    { category: "agricolas", name: "Cana-de-açúcar", abundance: "abundante",
      notes: "Maior produção nacional", sources: ["CONAB"] },
    { category: "energeticos", name: "Etanol / Bioenergia", abundance: "abundante",
      notes: "Polo sucroenergético consolidado", sources: ["ÚNICA"] },
  ],
  RS: [
    { category: "agricolas", name: "Soja / Arroz", abundance: "abundante", notes: "Fronteira sul", sources: ["CONAB"] },
    { category: "energeticos", name: "Energia Eólica", abundance: "presente",
      notes: "Litoral Sul gaúcho", sources: ["ANEEL"] },
  ],
  PA: [
    { category: "minerais", name: "Minério de Ferro", abundance: "abundante",
      notes: "Carajás — maior mina a céu aberto do mundo", sources: ["ANM", "Vale"] },
    { category: "minerais", name: "Cobre / Ouro / Bauxita", abundance: "abundante",
      notes: "Província Mineral de Carajás", sources: ["ANM"] },
    { category: "florestais", name: "Floresta Amazônica", abundance: "abundante",
      notes: "Bioma amazônico", sources: ["INPE"] },
  ],
  MT: [
    { category: "agricolas", name: "Soja / Milho / Algodão", abundance: "abundante",
      notes: "Maior produtor nacional de soja", sources: ["CONAB"] },
  ],
  MS: [
    { category: "agricolas", name: "Soja / Pecuária", abundance: "abundante",
      notes: "Cerrado e Pantanal", sources: ["CONAB"] },
    { category: "ambientais", name: "Pantanal", abundance: "abundante",
      notes: "Maior planície alagada do mundo", sources: ["ICMBio"] },
  ],
};

// ─── OVERRIDES POR MUNICÍPIO ──────────────────────────────────────────────────

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
};

function normalizeKey(name: string, state: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${state}`;
}

export async function collectResources(
  ctx: TerritoryStrategicContext
): Promise<Resource[]> {
  const base = UF_RESOURCE_PROFILE[ctx.state] ?? [];
  const key = normalizeKey(ctx.name, ctx.state);
  const overrides = MUNICIPALITY_OVERRIDES[key] ?? [];

  // Merge: overrides ganham prioridade sobre baseline com mesmo nome
  const merged = new Map<string, Resource>();
  for (const r of base) merged.set(r.name, r);
  for (const r of overrides) merged.set(r.name, r);

  return Array.from(merged.values());
}
