import { describe, expect, it } from "vitest";
import {
  ESTADO_INICIAL,
  contagemFontes,
  detalheDaOrigem,
  ehPrimeiraLeitura,
  leituraPrincipal,
  nomeExibido,
  observacaoDoLead,
  reduzir,
  type EstadoLeitura,
  type Frame,
  type LeituraEstrutural,
} from "./leitura-estado";

const M = { nome: "Galinhos", uf: "RN", ibgeId: "2404200", slug: "galinhos-2404200", consulta: "Galinhos, RN" };
const EST: LeituraEstrutural = {
  municipio: M,
  leitura: { tensao: 38, confianca: 52, faixa: { min: 20, max: 68 }, dimensoes: [] },
  perfil: [],
  sustenta: [],
  falta: [],
  custo: "zero",
  camada: { geradoEm: null, fonte: "IBGE" },
  noRadar: true,
};

const rodar = (frames: Frame[], ini: EstadoLeitura = ESTADO_INICIAL) => frames.reduce(reduzir, ini);

describe("reduzir", () => {
  it("a estrutural vem primeiro e já dá município, Radar e fase", () => {
    const s = rodar([{ tipo: "inicio", consulta: "x" }, { tipo: "estrutural", leitura: EST }]);
    expect(s.fase).toBe("estrutural");
    expect(s.municipio?.slug).toBe("galinhos-2404200");
    expect(s.noRadar).toBe(true);
  });

  it("fontes, sinais e dimensões chegam ao vivo e a fase vira coletando", () => {
    const s = rodar([
      { tipo: "estrutural", leitura: EST },
      { tipo: "etapa", id: "coleta", rotulo: "Consultando" },
      { tipo: "fonte", dimensao: "D1", fonte: "src-a", nome: "IBAMA", ok: true, brutos: 3 },
      { tipo: "fonte", dimensao: "D1", fonte: "src-b", nome: "ICMBio", ok: false, brutos: 0 },
      { tipo: "sinal", dimensao: "D1", fonte: "IBAMA", titulo: "Embargo", data: "2026-09-01", url: null, impacto: "alto" },
      { tipo: "dimensao", id: "D1", nome: "Socioambiental", sinais: 1, fontesOk: 1, fontesTotal: 2 },
    ]);
    expect(s.fase).toBe("coletando");
    expect(contagemFontes(s)).toEqual({ ok: 1, falhas: 1, total: 2 });
    expect(s.sinais).toHaveLength(1);
    expect(s.dimensoes[0].id).toBe("D1");
  });

  it("fonte e dimensão repetidas (reconexão, leitura compartilhada) não duplicam", () => {
    const f: Frame = { tipo: "fonte", dimensao: "D1", fonte: "src-a", nome: "IBAMA", ok: true, brutos: 3 };
    const d: Frame = { tipo: "dimensao", id: "D1", nome: "Socioambiental", sinais: 1, fontesOk: 1, fontesTotal: 1 };
    const s = rodar([f, f, d, d]);
    expect(s.fontes).toHaveLength(1);
    expect(s.dimensoes).toHaveLength(1);
  });

  it("guarda no máximo 60 sinais, os mais recentes", () => {
    const frames: Frame[] = Array.from({ length: 75 }, (_, i) => ({
      tipo: "sinal",
      dimensao: "D6",
      fonte: "X",
      titulo: `s${i}`,
      data: null,
      url: null,
      impacto: "baixo",
    }));
    const s = rodar(frames);
    expect(s.sinais).toHaveLength(60);
    expect(s.sinais[s.sinais.length - 1].titulo).toBe("s74");
  });

  it("teaser fecha como pronta; sem_leitura guarda o motivo; fim marca finalizado", () => {
    const pronta = rodar([{ tipo: "estrutural", leitura: EST }, { tipo: "teaser", isca: { executiveSummaryTeaser: "x" } }, { tipo: "fim", status: "teaser" }]);
    expect(pronta.fase).toBe("pronta");
    expect(pronta.finalizado).toBe(true);
    const teto = rodar([
      { tipo: "estrutural", leitura: EST },
      { tipo: "sem_leitura", motivo: "teto", detalhe: "esgotou", extra: { causa: "orcamento" } },
    ]);
    expect(teto.fase).toBe("sem_leitura");
    expect(teto.semLeitura?.motivo).toBe("teto");
  });

  it("ambiguo e nao_encontrado levam opções e sugestões", () => {
    const a = rodar([{ tipo: "ambiguo", detalhe: "Mais de um.", options: [{ nome: "Lajeado", uf: "RS" }, { nome: "Lajeado", uf: "TO" }] }]);
    expect(a.fase).toBe("ambiguo");
    expect(a.opcoes).toHaveLength(2);
    const n = rodar([{ tipo: "nao_encontrado", detalhe: "Não achamos.", sugestoes: [M] }]);
    expect(n.fase).toBe("nao_encontrado");
    expect(n.sugestoes).toEqual([M]);
  });
});

describe("derivados", () => {
  it("a leitura completa manda quando existe; senão, a parcial; nunca inventa", () => {
    const parcial = rodar([{ tipo: "estrutural", leitura: EST }]);
    expect(leituraPrincipal(parcial)).toEqual({ leitura: EST.leitura, completa: false });
    const completa = rodar([
      { tipo: "estrutural", leitura: EST },
      { tipo: "teaser", isca: { leitura: { tensao: 61, confianca: 70, faixa: { min: 55, max: 70 }, dimensoes: [] } } },
    ]);
    expect(leituraPrincipal(completa).completa).toBe(true);
    expect(leituraPrincipal(completa).leitura?.tensao).toBe(61);
    // teaser sem tensão (cache antigo) não derruba a parcial
    const semTensao = rodar([{ tipo: "estrutural", leitura: EST }, { tipo: "teaser", isca: { leitura: null } }]);
    expect(leituraPrincipal(semTensao)).toEqual({ leitura: EST.leitura, completa: false });
    expect(leituraPrincipal(ESTADO_INICIAL)).toEqual({ leitura: null, completa: false });
  });

  it("nome exibido: município, composto e localidade", () => {
    expect(nomeExibido(M)).toBe("Galinhos, RN");
    expect(nomeExibido({ ...M, nome: "Baía de Guanabara", uf: "RJ", composto: true })).toBe("Baía de Guanabara");
    expect(nomeExibido({ ...M, lugar: "Praia do Lugar" })).toBe("Praia do Lugar (Galinhos, RN)");
    expect(nomeExibido(null)).toBe("");
  });

  it("observação do lead: origem legível pela Mesa, ida e volta", () => {
    const o = observacaoDoLead({ interesse: "Marco Radar", situacao: "teaser entregue" });
    expect(o).toBe("origem: primeira leitura. Interesse: Marco Radar. Situação: teaser entregue.");
    expect(ehPrimeiraLeitura(o)).toBe(true);
    expect(detalheDaOrigem(o)).toBe("Interesse: Marco Radar. Situação: teaser entregue.");
    expect(ehPrimeiraLeitura("Interesse: Marco Radar.")).toBe(false);
    expect(ehPrimeiraLeitura(null)).toBe(false);
  });
});
