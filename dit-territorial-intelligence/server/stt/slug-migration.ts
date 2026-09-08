/**
 * Migração de slugs para a chave canônica do IBGE.
 *
 * Chamado no boot do servidor (idempotente) e disponível como script:
 *   pnpm slugs:migrate         (relatório, não altera nada)
 *   pnpm slugs:migrate --apply (executa)
 *
 * O PROBLEMA
 *
 * O slug do território saía do texto que a pessoa digitou. Produção acumulou
 * o mesmo lugar sob nomes diferentes, cada um com metade da série histórica:
 *
 *   galinhos-rn        vs  galinhos-rio-grande-do-norte
 *   lajeado            vs  lajeado-rs
 *   surui              vs  surui-mage
 *
 * Como a promessa do momento Operar depende de série diária, história partida
 * ao meio não é detalhe de arrumação: é a promessa não se cumprindo.
 *
 * O QUE ISTO FAZ
 *
 * Resolve cada slug existente contra a malha municipal do IBGE, calcula o
 * slug canônico (município + código IBGE) e funde os diretórios que apontam
 * para o mesmo lugar — unindo os history.jsonl por data, sem perder ponto.
 *
 * Em conflito de data entre duas séries, vence o registro com mais sinais
 * coletados: é o que teve mais base atrás.
 */

import { promises as fs, existsSync } from "node:fs";
import { join } from "node:path";
import { buscarLocalidadeCurada } from "../routes/localidades-curadas";

const BASE_DIR = join(process.env.DATA_DIR || join(process.cwd(), "data"), "dit-snapshots");


interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
}

interface HistoryEntry {
  date: string;
  stt: number;
  scenario: string;
  signalsCount: number;
  coverageScore?: number;
  computedAt: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['‘’ʼ`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function makeSlug(s: string): string {
  return normalize(s).replace(/\s+/g, "-");
}

/**
 * Colapsa contração portuguesa separada por espaço: "dias d avila" vira
 * "dias davila". O slug antigo perdia o apóstrofo de "Dias d'Ávila" e virava
 * `dias-d-avila`, que não batia com nada na malha do IBGE — e Dias d'Ávila é
 * território real do polo de Camaçari, não caso de laboratório.
 */
function normalizeCollapsed(s: string): string {
  return normalize(s).replace(/\b([dnlmstv])\s+(?=[aeiou])/gi, "$1");
}

const UF_SUFIXOS: Record<string, string> = {
  ac: "AC", al: "AL", ap: "AP", am: "AM", ba: "BA", ce: "CE", df: "DF",
  es: "ES", go: "GO", ma: "MA", mt: "MT", ms: "MS", mg: "MG", pa: "PA",
  pb: "PB", pr: "PR", pe: "PE", pi: "PI", rj: "RJ", rn: "RN", rs: "RS",
  ro: "RO", rr: "RR", sc: "SC", sp: "SP", se: "SE", to: "TO",
  bahia: "BA", "rio-grande-do-norte": "RN", "rio-grande-do-sul": "RS",
  "rio-de-janeiro": "RJ", "sao-paulo": "SP", "minas-gerais": "MG",
  "mato-grosso-do-sul": "MS", "santa-catarina": "SC",
};

/**
 * Territórios a remover do snapshot store, com o motivo declarado.
 *
 * Não é limpeza cosmética: enquanto estão lá, aparecem em /monitored como
 * território de verdade, entram na conta que a PRINT mostra e o scheduler
 * gasta cota coletando para eles.
 *
 * Cada linha diz por que sai. Remoção sem motivo escrito não entra aqui —
 * quem ler daqui a seis meses precisa poder conferir a decisão.
 */
const PURGA: Array<{ slug: string; motivo: string }> = [
  {
    slug: "gatinhos",
    motivo:
      "Entrada de teste. 1 dia, 2 sinais, cobertura 3,9% — sob o piso atual " +
      "(35%) nem seria emitido. O STT 97 é artefato do modelo antigo, que " +
      "premiava ausência de dado.",
  },
  {
    slug: "lajeado",
    motivo:
      "Duplicata de lajeado-4311403 (Lajeado/RS): mesma coleta de 13/08/2026, " +
      "com 4 minutos de diferença (140 sinais contra 146). O canônico tem mais " +
      "sinal e mais cobertura; este não acrescenta ponto nenhum à série.",
  },
];

export interface SlugMigrationReport {
  dirsFound: number;
  resolved: number;
  unresolved: string[];
  merged: number;
  renamed: number;
  purged: string[];
  applied: boolean;
}

/**
 * Idempotente: slug já canônico é reconhecido e ignorado, então rodar de novo
 * não faz nada. É por isso que dá para chamar no boot sem medo.
 */
export async function migrateCanonicalSlugs(
  opts: { apply?: boolean; log?: (line: string) => void } = {}
): Promise<SlugMigrationReport> {
  const APPLY = opts.apply === true;
  const console = { log: opts.log ?? (() => {}) };
  if (!existsSync(BASE_DIR)) {
    return { dirsFound: 0, resolved: 0, unresolved: [], merged: 0, renamed: 0, purged: [], applied: APPLY };
  }

  // Purga declarada — antes de tudo, para não migrar o que vai sair.
  //
  // UMA VEZ SÓ, marcada em disco. Sem a marca, a lista rodaria em todo boot e
  // um território legítimo criado depois com um desses nomes sumiria sozinho,
  // sem ninguém entender por quê. Apagar é irreversível; repetir apagamento
  // automático é pior ainda.
  const purged: string[] = [];
  const marcaPurga = join(BASE_DIR, ".purga-aplicada.json");
  const jaPurgado: string[] = existsSync(marcaPurga)
    ? (JSON.parse(await fs.readFile(marcaPurga, "utf8")) as { slugs?: string[] }).slugs ?? []
    : [];

  for (const { slug, motivo } of PURGA) {
    if (jaPurgado.includes(slug)) continue;
    const dir = join(BASE_DIR, slug);
    if (!existsSync(dir)) {
      // Não existe e nunca foi purgado: marca como resolvido e segue.
      purged.push(slug);
      continue;
    }
    console.log(`  PURGA  ${slug} — ${motivo}`);
    if (APPLY) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    purged.push(slug);
  }

  if (APPLY && purged.length > 0) {
    await fs.writeFile(
      marcaPurga,
      JSON.stringify({
        slugs: Array.from(new Set([...jaPurgado, ...purged])),
        aplicadaEm: new Date().toISOString(),
        motivos: PURGA.map((x) => `${x.slug}: ${x.motivo}`),
      }),
      "utf8"
    );
  }

  const res = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
    { headers: { "User-Agent": "DIT-PRINT/1.0" }, signal: AbortSignal.timeout(60000) }
  );
  const municipios = (await res.json()) as IbgeMunicipio[];

  // índice: nome normalizado → lista de municípios com esse nome
  const porNome = new Map<string, IbgeMunicipio[]>();
  const add = (k: string, m: IbgeMunicipio) => {
    const arr = porNome.get(k) ?? [];
    if (!arr.includes(m)) arr.push(m);
    porNome.set(k, arr);
  };
  for (const m of municipios) {
    add(normalize(m.nome), m);
    add(normalizeCollapsed(m.nome), m);
  }

  // Lido depois da purga, senão a migração ainda enxerga o que acabou de sair.
  const dirs = (await fs.readdir(BASE_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  // slug antigo → slug canônico
  const mapa = new Map<string, string>();
  const semResolucao: string[] = [];

  for (const slug of dirs) {
    // já está no formato canônico? (termina em código IBGE de 7 dígitos,
    // possivelmente seguido do nome de distrito/localidade)
    if (/-\d{7}(-|$)/.test(slug)) {
      mapa.set(slug, slug);
      continue;
    }

    // separa sufixo de UF, quando houver
    const partes = slug.split("-");
    let uf: string | null = null;
    let nome = slug;

    for (let corte = 1; corte <= 4 && corte < partes.length; corte++) {
      const cand = partes.slice(partes.length - corte).join("-");
      if (UF_SUFIXOS[cand]) {
        uf = UF_SUFIXOS[cand];
        nome = partes.slice(0, partes.length - corte).join("-");
        break;
      }
    }

    const nomeTexto = nome.replace(/-/g, " ");
    // Localidade curada primeiro: `surui` e `surui-mage` são o mesmo distrito
    // de Magé com dois históricos, e nenhuma busca por nome de município
    // resolveria isso. A tabela é a mesma que a resolução da API consulta,
    // então o slug que sai aqui é idêntico ao que a API produz.
    const curada =
      buscarLocalidadeCurada(normalizeCollapsed(nomeTexto)) ??
      buscarLocalidadeCurada(normalizeCollapsed(slug.replace(/-/g, " ")));
    if (curada && (!uf || uf === curada.uf)) {
      mapa.set(slug, `${makeSlug(curada.municipio)}-${curada.ibgeId}-${makeSlug(curada.nome)}`);
      continue;
    }

    const candidatos =
      porNome.get(normalize(nomeTexto)) ??
      porNome.get(normalizeCollapsed(nomeTexto)) ??
      [];
    const filtrados = uf
      ? candidatos.filter((m) => m.microrregiao?.mesorregiao?.UF?.sigla === uf)
      : candidatos;

    let escolhido = filtrados.length === 1 ? filtrados[0]
      : candidatos.length === 1 ? candidatos[0]
      : null;

    // Último recurso: slug truncado por acento perdido ("Caarapó" virou
    // "caarap"). Só aceita com UF declarada E prefixo único naquela UF —
    // sem essas duas travas, prefixo casa território errado, e território
    // errado no relatório é pior que território sem histórico.
    if (!escolhido && uf) {
      const alvo = normalize(nomeTexto);
      const porPrefixo = municipios.filter(
        (m) =>
          m.microrregiao?.mesorregiao?.UF?.sigla === uf &&
          normalize(m.nome).startsWith(alvo) &&
          alvo.length >= 4
      );
      if (porPrefixo.length === 1) escolhido = porPrefixo[0];
    }

    if (!escolhido) {
      semResolucao.push(slug);
      continue;
    }
    mapa.set(slug, `${makeSlug(escolhido.nome)}-${escolhido.id}`);
  }

  // agrupa por destino
  const grupos = new Map<string, string[]>();
  for (const [antigo, canonico] of Array.from(mapa.entries())) {
    const arr = grupos.get(canonico) ?? [];
    arr.push(antigo);
    grupos.set(canonico, arr);
  }

  console.log("");
  console.log(`  Migração de slugs — ${APPLY ? "APLICANDO" : "SIMULAÇÃO (use --apply)"}`);
  console.log("  ────────────────────────────────────────────────────────────");
  console.log(`  diretórios encontrados : ${dirs.length}`);
  console.log(`  resolvidos             : ${mapa.size}`);
  console.log(`  sem resolução          : ${semResolucao.length}`);
  console.log("");

  let fundidos = 0;
  let renomeados = 0;

  for (const [canonico, antigos] of Array.from(grupos.entries())) {
    const mudou = antigos.filter((a) => a !== canonico);
    if (mudou.length === 0) continue;

    if (antigos.length > 1) {
      console.log(`  FUSÃO  ${antigos.join(" + ")}`);
      console.log(`      →  ${canonico}`);
      fundidos++;
    } else {
      console.log(`  RENOME ${antigos[0]} → ${canonico}`);
      renomeados++;
    }

    if (!APPLY) continue;

    // Une os históricos por data
    const porData = new Map<string, HistoryEntry>();
    for (const antigo of antigos) {
      const hp = join(BASE_DIR, antigo, "history.jsonl");
      if (!existsSync(hp)) continue;
      const linhas = (await fs.readFile(hp, "utf8")).split("\n").filter((l) => l.trim());
      for (const l of linhas) {
        try {
          const e = JSON.parse(l) as HistoryEntry;
          const atual = porData.get(e.date);
          // Empate de data: fica o registro com mais sinais atrás.
          if (!atual || (e.signalsCount ?? 0) > (atual.signalsCount ?? 0)) {
            porData.set(e.date, e);
          }
        } catch { /* linha corrompida — ignora */ }
      }
    }

    const destino = join(BASE_DIR, canonico);
    await fs.mkdir(destino, { recursive: true });

    // Copia os snapshots diários (o mais recente de cada data vence)
    for (const antigo of antigos) {
      const origem = join(BASE_DIR, antigo);
      if (origem === destino || !existsSync(origem)) continue;
      for (const f of await fs.readdir(origem)) {
        if (f === "history.jsonl") continue;
        const alvo = join(destino, f);
        if (!existsSync(alvo)) {
          await fs.copyFile(join(origem, f), alvo);
        }
      }
    }

    const ordenado = Array.from(porData.values()).sort((a, b) => a.date.localeCompare(b.date));
    await fs.writeFile(
      join(destino, "history.jsonl"),
      ordenado.map((e) => JSON.stringify(e)).join("\n") + "\n",
      "utf8"
    );

    // Remove os diretórios antigos só depois de o destino estar escrito
    for (const antigo of antigos) {
      const origem = join(BASE_DIR, antigo);
      if (origem === destino || !existsSync(origem)) continue;
      await fs.rm(origem, { recursive: true, force: true });
    }

    console.log(`      histórico unificado: ${ordenado.length} dias`);
  }

  if (semResolucao.length > 0) {
    console.log("");
    console.log("  Sem resolução na malha do IBGE (mantidos como estão):");
    for (const s of semResolucao) console.log(`    ${s}`);
  }

  console.log("");
  console.log(`  fusões: ${fundidos} | renomes: ${renomeados}`);
  if (!APPLY) console.log("  Nada foi alterado. Rode com --apply para executar.");
  console.log("");

  return {
    dirsFound: dirs.length,
    resolved: mapa.size,
    unresolved: semResolucao,
    merged: fundidos,
    renamed: renomeados,
    purged,
    applied: APPLY,
  };
}
