import { describe, expect, it } from "vitest";
import {
  deltaEmDias,
  devolucaoVigente,
  entraNaFila,
  gateAtivo,
  mesclarPublicacoes,
  montarItemFila,
  ordenarFila,
  portalAuthAtivo,
  primeiroParagrafo,
  serieParaSparkline,
  visaoDasPublicacoes,
  type Publicacao,
  type Rascunho,
} from "./publicacao-logica";

function pub(dia: string, stt: number, extra: Partial<Publicacao> = {}): Publicacao {
  return {
    slug: "macae-3302403",
    territoryId: 0,
    nome: "Macaé",
    estado: "RJ",
    regiao: "Sudeste",
    period: dia.slice(0, 7),
    stt,
    tensao: null,
    confianca: null,
    scenario: "pressao",
    dims: {},
    activatedIndex: null,
    notaExecutiva: null,
    leitura: null,
    nSinais: null,
    publishedAt: `${dia}T12:00:00.000Z`,
    publishedBy: "op@print.com.br",
    origem: "disco",
    ...extra,
  };
}

function rasc(geradoEm: string, stt: number, extra: Partial<Rascunho> = {}): Rascunho {
  return {
    slug: "macae-3302403",
    territoryId: 0,
    nome: "Macaé",
    estado: "RJ",
    regiao: null,
    period: "2026-09",
    stt,
    scenario: "pressao",
    dims: {},
    activatedIndex: null,
    notaExecutiva: "nota",
    leitura: null,
    nSinais: 12,
    geradoEm,
    ...extra,
  };
}

describe("flags", () => {
  it("portão e auth ligados por padrão e desligáveis por env", () => {
    expect(gateAtivo({})).toBe(true);
    expect(gateAtivo({ DIT_GATE_PUBLICACAO: "false" })).toBe(false);
    expect(gateAtivo({ DIT_GATE_PUBLICACAO: "0" })).toBe(false);
    expect(gateAtivo({ DIT_GATE_PUBLICACAO: "true" })).toBe(true);
    expect(portalAuthAtivo({})).toBe(true);
    expect(portalAuthAtivo({ DIT_PORTAL_AUTH: "false" })).toBe(false);
  });
});

describe("delta 7/30 dias e série", () => {
  const pubs = [
    pub("2026-08-01", 60),
    pub("2026-08-25", 64),
    pub("2026-09-01", 70),
    pub("2026-09-01", 72, { publishedAt: "2026-09-01T18:00:00.000Z" }), // mesmo dia: vale a última
    pub("2026-09-08", 75),
  ];

  it("delta de 7 dias compara com o ponto de 09-01 (limite 09-01)", () => {
    expect(deltaEmDias(pubs, 7)).toBe(3);
  });

  it("delta de 30 dias usa o ponto de 08-01 (limite 08-09)", () => {
    expect(deltaEmDias(pubs, 30)).toBe(15);
  });

  it("sem publicação tão antiga, delta é null (não inventa base)", () => {
    expect(deltaEmDias([pub("2026-09-01", 70), pub("2026-09-03", 72)], 30)).toBeNull();
    expect(deltaEmDias([pub("2026-09-01", 70)], 7)).toBeNull();
    expect(deltaEmDias([], 7)).toBeNull();
  });

  it("série: um ponto por dia, cronológica, no máximo 12", () => {
    const s = serieParaSparkline(pubs);
    expect(s.map((p) => p.data)).toEqual(["2026-08-01", "2026-08-25", "2026-09-01", "2026-09-08"]);
    expect(s.find((p) => p.data === "2026-09-01")?.valor).toBe(72);
    const muitas = Array.from({ length: 20 }, (_, i) => pub(`2026-08-${String(i + 1).padStart(2, "0")}`, 50 + i));
    expect(serieParaSparkline(muitas)).toHaveLength(12);
    expect(serieParaSparkline(muitas).at(-1)?.data).toBe("2026-08-20");
  });

  it("usa a tensão publicada quando existe, senão o STT", () => {
    const comTensao = [pub("2026-08-01", 90, { tensao: 40 }), pub("2026-09-10", 90, { tensao: 46 })];
    expect(deltaEmDias(comTensao, 30)).toBe(6);
  });
});

describe("nota pública", () => {
  it("área pública só o primeiro parágrafo; portal a nota inteira", () => {
    const nota = "Primeiro parágrafo.\n\nSegundo parágrafo com o detalhe pago.";
    expect(primeiroParagrafo(nota)).toBe("Primeiro parágrafo.");
    const pubs = [pub("2026-09-01", 70, { notaExecutiva: nota })];
    expect(visaoDasPublicacoes(pubs, { notaCompleta: false }).notaExecutiva).toBe("Primeiro parágrafo.");
    expect(visaoDasPublicacoes(pubs, { notaCompleta: true }).notaExecutiva).toBe(nota);
    expect(primeiroParagrafo(null)).toBeNull();
    expect(primeiroParagrafo("   ")).toBeNull();
  });
});

describe("legado do MySQL", () => {
  it("o livro vence quando o período coincide; legado entra onde não há livro", () => {
    const livro = [pub("2026-09-05", 71)];
    const legado = [pub("2026-09-01", 99, { origem: "legado" }), pub("2026-08-01", 60, { origem: "legado" })];
    const m = mesclarPublicacoes(livro, legado);
    expect(m.map((p) => p.stt)).toEqual([60, 71]);
  });
});

describe("fila da mesa", () => {
  it("entra se nunca publicou ou se o motor calculou depois da última publicação", () => {
    expect(entraNaFila(rasc("2026-09-10T00:00:00.000Z", 70), null)).toBe(true);
    const ultima = pub("2026-09-10", 70);
    expect(entraNaFila(rasc("2026-09-10T08:00:00.000Z", 71), ultima)).toBe(false);
    expect(entraNaFila(rasc("2026-09-11T00:00:00.000Z", 71), ultima)).toBe(true);
  });

  it("devolução só vale para o mesmo cálculo; cálculo novo reabre", () => {
    const r = rasc("2026-09-11T00:00:00.000Z", 71);
    const d = { slug: r.slug, period: r.period, motivo: "sem fonte", por: "op", em: "2026-09-11T01:00:00.000Z", rascunhoGeradoEm: r.geradoEm };
    expect(devolucaoVigente(r, d)).not.toBeNull();
    expect(devolucaoVigente(rasc("2026-09-12T00:00:00.000Z", 71), d)).toBeNull();
    expect(devolucaoVigente(r, null)).toBeNull();
  });

  it("item traz delta contra a última publicada e ordena pelo maior |delta|", () => {
    const ultima = pub("2026-09-01", 60);
    const a = montarItemFila(rasc("2026-09-11T00:00:00.000Z", 63, { slug: "a" }), ultima, null);
    const b = montarItemFila(rasc("2026-09-11T00:00:00.000Z", 50, { slug: "b" }), ultima, null);
    const c = montarItemFila(rasc("2026-09-11T00:00:00.000Z", 80, { slug: "c" }), null, null);
    expect(a.delta).toBe(3);
    expect(b.delta).toBe(-10);
    expect(c.delta).toBeNull();
    expect(ordenarFila([a, c, b]).map((i) => i.slug)).toEqual(["b", "a", "c"]);
  });

  it("delta usa a tensão do rascunho quando há leitura", () => {
    const leitura = { tensao: 55, confianca: 70, faixa: { min: 50, max: 60 }, dimensoes: [] };
    const item = montarItemFila(rasc("2026-09-11T00:00:00.000Z", 90, { leitura }), pub("2026-09-01", 90, { tensao: 50 }), null);
    expect(item.delta).toBe(5);
    expect(item.rascunho.confianca).toBe(70);
  });
});
