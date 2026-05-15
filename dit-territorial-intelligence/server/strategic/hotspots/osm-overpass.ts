/**
 * Hotspot Agent — OpenStreetMap Overpass API
 *
 * Coleta POIs georreferenciados DENTRO do território (município).
 * Tangibiliza locais com lat/lng reais:
 *   • Hospitais, escolas, indústrias → infraestrutura (S5, D3)
 *   • Áreas industriais → potencial produtivo (S2)
 *   • Áreas protegidas, florestas → ativos ambientais (S4, D1)
 *   • Estações de telecomunicação → conectividade (S5)
 *
 * Fonte: https://overpass-api.de/api/interpreter (público, sem chave)
 */

import { logger } from "../../_core/logger";
import type { Hotspot, TerritoryStrategicContext } from "../types";

const log = logger.child({ module: "hotspots.osm" });

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/** Categorias OSM mapeadas para hotspots PRINT. */
const HOTSPOT_QUERIES: Array<{
  type: Hotspot["type"];
  category: string;
  dimension?: Hotspot["dimension"];
  impact: number;
  query: string;
}> = [
  {
    type: "potencial",
    category: "infra-saúde",
    dimension: "D3",
    impact: 0.55,
    query: `node["amenity"~"hospital|clinic"]`,
  },
  {
    type: "potencial",
    category: "infra-educação",
    dimension: "D3",
    impact: 0.50,
    query: `node["amenity"~"university|college"]`,
  },
  {
    type: "potencial",
    category: "infra-industrial",
    dimension: "D3",
    impact: 0.65,
    query: `way["landuse"="industrial"]`,
  },
  {
    type: "potencial",
    category: "transporte-aéreo",
    dimension: "D3",
    impact: 0.75,
    query: `node["aeroway"="aerodrome"]`,
  },
  {
    type: "potencial",
    category: "transporte-portuário",
    dimension: "D3",
    impact: 0.80,
    query: `way["industrial"="port"]; node["harbour"="yes"]`,
  },
  {
    type: "potencial",
    category: "energia",
    dimension: "D3",
    impact: 0.70,
    query: `node["power"~"plant|generator|substation"]; way["power"~"plant|substation"]`,
  },
  {
    type: "potencial",
    category: "telecom",
    dimension: "D3",
    impact: 0.60,
    query: `node["telecom"~"data_center|exchange"]; node["man_made"="tower"]["tower:type"="communication"]`,
  },
  {
    type: "potencial",
    category: "ativo-ambiental",
    dimension: "D1",
    impact: 0.55,
    query: `way["boundary"="protected_area"]; relation["boundary"="protected_area"]`,
  },
  {
    type: "risco",
    category: "mineração",
    dimension: "D1",
    impact: 0.70,
    query: `way["landuse"="quarry"]; node["industrial"="mine"]`,
  },
];

function buildOverpassQuery(bbox: [number, number, number, number]): string {
  // bbox Overpass = (south, west, north, east)
  const [west, south, east, north] = bbox;
  const blocks = HOTSPOT_QUERIES.map(q => {
    return q.query
      .split(";")
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => `${s}(${south},${west},${north},${east});`)
      .join("\n");
  }).join("\n");
  return `[out:json][timeout:25];
(
${blocks}
);
out center 80;`;
}

function classifyElement(element: OverpassElement): {
  cfg: typeof HOTSPOT_QUERIES[number];
  name: string;
} | null {
  const tags = element.tags ?? {};

  // Match tag categories to find the appropriate config
  if (tags.amenity === "hospital" || tags.amenity === "clinic") {
    return { cfg: HOTSPOT_QUERIES[0], name: tags.name || "Unidade de Saúde" };
  }
  if (tags.amenity === "university" || tags.amenity === "college") {
    return { cfg: HOTSPOT_QUERIES[1], name: tags.name || "Instituição de Ensino" };
  }
  if (tags.landuse === "industrial") {
    return { cfg: HOTSPOT_QUERIES[2], name: tags.name || "Área Industrial" };
  }
  if (tags.aeroway === "aerodrome") {
    return { cfg: HOTSPOT_QUERIES[3], name: tags.name || "Aeroporto" };
  }
  if (tags.industrial === "port" || tags.harbour === "yes") {
    return { cfg: HOTSPOT_QUERIES[4], name: tags.name || "Porto" };
  }
  if (tags.power === "plant" || tags.power === "substation" || tags.power === "generator") {
    return { cfg: HOTSPOT_QUERIES[5], name: tags.name || `Energia (${tags.power})` };
  }
  if (tags.telecom === "data_center" || tags.telecom === "exchange") {
    return { cfg: HOTSPOT_QUERIES[6], name: tags.name || "Telecom / Data Center" };
  }
  if (tags.man_made === "tower" && tags["tower:type"] === "communication") {
    return { cfg: HOTSPOT_QUERIES[6], name: tags.name || "Torre de Telecom" };
  }
  if (tags.boundary === "protected_area") {
    return {
      cfg: HOTSPOT_QUERIES[7],
      name: tags.name || `Área Protegida ${tags.protection_title || ""}`.trim(),
    };
  }
  if (tags.landuse === "quarry" || tags.industrial === "mine") {
    return { cfg: HOTSPOT_QUERIES[8], name: tags.name || "Mineração / Pedreira" };
  }
  return null;
}

/**
 * Resolve bbox aproximado a partir do centróide se não vier no contexto.
 * Brasil: ~0.1° ≈ 11km. Município típico ≈ 0.2-0.5°.
 */
function ensureBbox(ctx: TerritoryStrategicContext): [number, number, number, number] | null {
  if (ctx.bbox) return ctx.bbox;
  if (ctx.centroid) {
    const { lat, lng } = ctx.centroid;
    const d = 0.25; // ~28km
    return [lng - d, lat - d, lng + d, lat + d];
  }
  return null;
}

export async function collectOsmHotspots(
  ctx: TerritoryStrategicContext
): Promise<Hotspot[]> {
  const bbox = ensureBbox(ctx);
  if (!bbox) {
    log.warn({ territory: ctx.name }, "OSM: sem bbox/centroid, pulando coleta");
    return [];
  }

  try {
    const query = buildOverpassQuery(bbox);
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      log.warn({ status: res.status, territory: ctx.name }, "OSM Overpass failed");
      return [];
    }

    const data = (await res.json()) as OverpassResponse;
    const hotspots: Hotspot[] = [];

    for (const el of data.elements ?? []) {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (typeof lat !== "number" || typeof lon !== "number") continue;

      const match = classifyElement(el);
      if (!match) continue;

      hotspots.push({
        type: match.cfg.type,
        category: match.cfg.category,
        name: match.name.slice(0, 80),
        lat,
        lng: lon,
        description: `${match.cfg.category} — ${match.name}`.slice(0, 200),
        source: "OpenStreetMap Overpass",
        impact: match.cfg.impact,
        dimension: match.cfg.dimension,
      });
    }

    log.info(
      { territory: ctx.name, total: hotspots.length },
      "OSM hotspots coletados"
    );
    return hotspots.slice(0, 60); // cap a 60 hotspots
  } catch (err) {
    log.warn({ err: (err as Error).message, territory: ctx.name }, "OSM Overpass error");
    return [];
  }
}
