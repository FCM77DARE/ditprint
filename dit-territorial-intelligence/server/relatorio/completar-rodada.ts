/**
 * Completa uma rodada local com as etapas do /analyze que o script local
 * (scripts/dit-completo-local.ts) não gravava.
 *
 * O /analyze devolve, além do texto do relatório: `leitura` (Tensão, Confiança e
 * faixa), `resolution` e `territoryGeo` (código IBGE, coordenadas), `dataIntegrity`
 * (procedência e cobertura por fonte), camada estratégica (recursos, setores,
 * pontos, casos) e os sinais verificados com data e link. O dump antigo só tinha
 * o texto, os scores e a lista de fontes.
 *
 * Tudo aqui é gratuito: lê o store de sinais em disco, calcula a leitura com o
 * código puro, consulta IBGE/Nominatim/Overpass (abertos) e roda a camada
 * estratégica, que não usa LLM nem busca paga. Nada chama SerpAPI nem modelo.
 *
 * `DATA_DIR` precisa estar definido ANTES de importar este módulo.
 */

import { lerSinaisDoTerritorio } from "./ler-sinais";
import { consolidateSttFromHistory } from "../stt/consolidator";
import { leituraDeConsolidado } from "../stt/leitura";
import { runStrategicLayer } from "../strategic/runner";
import type { SinalDoStore } from "./montar-dados";

export interface MunicipioIbge {
  id: number;
  nome: string;
  uf: string;
  ufNome?: string;
  mesorregiao?: string;
  microrregiao?: string;
  regiao?: string;
}

export interface RodadaBruta {
  relatorio: Record<string, any>;
  coverageScore?: number;
  cobertura?: number;
  coverageDetail?: Record<string, any>;
  sourceBreakdown?: Array<Record<string, any>>;
  historico?: Record<string, any> | null;
  semLastro?: string[];
  /** Quando a rodada é ao vivo, o resultado do orquestrador traz a leitura pronta. */
  leituraViva?: unknown;
  coletadoEm?: string;
  /** Prompt enviado ao LLM nesta rodada: lista os sinais que o texto de fato viu. */
  prompt?: string;
}

async function geoDoMunicipio(nome: string, uf: string) {
  try {
    const q = encodeURIComponent(`${nome}, ${uf}, Brasil`);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=br`, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Marco-PRINT/1.0 (relatorio-territorial)" },
    });
    if (!r.ok) return null;
    const h = ((await r.json()) as Array<{ lat: string; lon: string; boundingbox?: string[] }>)[0];
    if (!h) return null;
    const lat = parseFloat(h.lat);
    const lng = parseFloat(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    let bbox: [number, number, number, number] = [lng - 0.25, lat - 0.25, lng + 0.25, lat + 0.25];
    if (h.boundingbox?.length === 4) {
      const [s, n, w, e] = h.boundingbox.map(parseFloat);
      if ([s, n, w, e].every(Number.isFinite)) bbox = [w, s, e, n];
    }
    return { centroid: { lat, lng }, bbox };
  } catch {
    return null;
  }
}

/**
 * O store acumula rodadas; o texto do relatório foi escrito sobre UMA. Quando o
 * prompt daquela rodada traz um sinal da mesma fonte e do mesmo assunto (mesmo
 * prefixo antes dos dois pontos) com outro valor, o do store é de outra coleta
 * (ex.: CNES contou 20 numa coleta e 1.470 na outra) e sai, para o número da
 * tabela nunca contradizer o texto. O sinal que o texto viu entra no lugar.
 */
export function reconciliarComRodada(sinais: SinalDoStore[], prompt: string | undefined, coletadoEm: string): SinalDoStore[] {
  if (!prompt) return sinais;
  const vivos: SinalDoStore[] = [];
  let dim = "";
  for (const linha of prompt.split("\n")) {
    const d = linha.match(/^D(\d)\s/);
    if (d) dim = `D${d[1]}`;
    const m = linha.match(/^\s*\[(src-[\w-]+)\]\s+\(imp:([\d.]+)\)\s+(.+)$/);
    if (m && dim) {
      vivos.push({ source: m[1], dimension: dim, impact: Number(m[2]), publishedAt: coletadoEm, title: m[3].trim(), metadata: { verificado: true } });
    }
  }
  const prefixo = (t: string) => (t.includes(":") ? t.slice(0, t.lastIndexOf(":")) : t);
  const out = sinais.filter((x) => {
    if (x.structural || /google-news|universidades/.test(x.source)) return true;
    const p = prefixo(x.title);
    return !vivos.some((v) => v.source === x.source && prefixo(v.title) === p && v.title !== x.title);
  });
  const chaves = new Set(out.map((x) => `${x.source}|${x.title}`));
  for (const v of vivos) {
    if (/google-news|universidades/.test(v.source) || chaves.has(`${v.source}|${v.title}`)) continue;
    if (sinais.some((x) => x.source === v.source && prefixo(x.title) === prefixo(v.title) && x.title !== v.title)) out.push(v);
  }
  return out;
}

export async function completarRodada(bruta: RodadaBruta, m: MunicipioIbge) {
  const slug = `medicao-${m.id}`;
  const sinais: SinalDoStore[] = reconciliarComRodada(
    lerSinaisDoTerritorio(slug),
    bruta.prompt,
    bruta.coletadoEm ?? new Date().toISOString()
  );

  const consolidado = await consolidateSttFromHistory(0, slug, m.id);
  const leitura =
    (bruta.leituraViva as ReturnType<typeof leituraDeConsolidado> | undefined) ??
    (consolidado ? leituraDeConsolidado(consolidado) : null);

  const geo = await geoDoMunicipio(m.nome, m.uf);
  const scores = consolidado?.dimensions ?? {};
  let estrategica: Awaited<ReturnType<typeof runStrategicLayer>> | null = null;
  try {
    estrategica = await runStrategicLayer(
      {
        name: m.nome,
        state: m.uf,
        stateName: m.ufNome ?? "",
        region: m.regiao ?? "",
        mesoregion: m.mesorregiao ?? "",
        microregion: m.microrregiao ?? "",
        ibgeId: m.id,
        centroid: geo?.centroid,
        bbox: geo?.bbox,
      },
      scores as never
    );
  } catch (err) {
    console.warn("  camada estratégica falhou, segue sem ela:", (err as Error).message);
  }

  const det = bruta.coverageDetail ?? {};
  const analyze = {
    ...bruta.relatorio,
    resolution: {
      kind: "municipio",
      name: m.nome,
      municipality: m.nome,
      state: m.uf,
      region: m.regiao ?? null,
      mesoregion: m.mesorregiao ?? null,
      microregion: m.microrregiao ?? null,
      ibgeId: m.id,
    },
    territoryGeo: geo,
    coverageScore: bruta.coverageScore ?? bruta.cobertura ?? null,
    coverageDetail: det,
    leitura,
    dataIntegrity: {
      basis: "coletado",
      slug,
      ibgeId: m.id,
      coverageScore: bruta.coverageScore ?? bruta.cobertura ?? null,
      sourcesConsulted: det.totalSources ?? null,
      sourcesWithSignals: det.sourcesWithSignals ?? null,
      sourceBreakdown: bruta.sourceBreakdown ?? null,
      signalsInWindow: bruta.historico?.signalsInWindow ?? null,
      windowMonths: bruta.historico?.windowMonths ?? null,
      collectedAt: bruta.coletadoEm ?? bruta.historico?.newestSignalAt ?? new Date().toISOString(),
      afirmacoesSemLastro: bruta.semLastro ?? [],
    },
    ...(estrategica
      ? {
          sectors: estrategica.sectors,
          resources: estrategica.resources,
          hotspots: estrategica.hotspots,
          strategicCases: estrategica.strategicCases,
        }
      : {}),
  };
  return { analyze, sinais };
}
