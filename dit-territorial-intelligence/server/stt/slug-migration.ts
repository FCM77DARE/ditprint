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

const UF_SUFIXOS: Record<string, string> = {
  ac: "AC", al: "AL", ap: "AP", am: "AM", ba: "BA", ce: "CE", df: "DF",
  es: "ES", go: "GO", ma: "MA", mt: "MT", ms: "MS", mg: "MG", pa: "PA",
  pb: "PB", pr: "PR", pe: "PE", pi: "PI", rj: "RJ", rn: "RN", rs: "RS",
  ro: "RO", rr: "RR", sc: "SC", sp: "SP", se: "SE", to: "TO",
  bahia: "BA", "rio-grande-do-norte": "RN", "rio-grande-do-sul": "RS",
  "rio-de-janeiro": "RJ", "sao-paulo": "SP", "minas-gerais": "MG",
  "mato-grosso-do-sul": "MS", "santa-catarina": "SC",
};

export interface SlugMigrationReport {
  dirsFound: number;
  resolved: number;
  unresolved: string[];
  merged: number;
  renamed: number;
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
    return { dirsFound: 0, resolved: 0, unresolved: [], merged: 0, renamed: 0, applied: APPLY };
  }

  const res = await fetch(
    "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
    { headers: { "User-Agent": "DIT-PRINT/1.0" }, signal: AbortSignal.timeout(60000) }
  );
  const municipios = (await res.json()) as IbgeMunicipio[];

  // índice: nome normalizado → lista de municípios com esse nome
  const porNome = new Map<string, IbgeMunicipio[]>();
  for (const m of municipios) {
    const k = normalize(m.nome);
    const arr = porNome.get(k) ?? [];
    arr.push(m);
    porNome.set(k, arr);
  }

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

    const candidatos = porNome.get(normalize(nome.replace(/-/g, " "))) ?? [];
    const filtrados = uf
      ? candidatos.filter((m) => m.microrregiao?.mesorregiao?.UF?.sigla === uf)
      : candidatos;

    const escolhido = filtrados.length === 1 ? filtrados[0]
      : candidatos.length === 1 ? candidatos[0]
      : null;

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
    applied: APPLY,
  };
}
