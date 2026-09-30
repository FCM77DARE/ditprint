import { afterEach, describe, expect, it } from "vitest";
import {
  classificarPolaridadePorConteudo,
  polaridadeConteudoAtiva,
  polaridadeDoSinal,
} from "./polaridade";

describe("classificarPolaridadePorConteudo", () => {
  it("fato negativo vira tensionante", () => {
    const r = classificarPolaridadePorConteudo("Incêndio atinge área de mata e deixa moradores desabrigados");
    expect(r.polaridade).toBe("tensionante");
    expect(r.negativos.length).toBeGreaterThanOrEqual(2);
  });

  it("fato positivo vira resolutiva", () => {
    const r = classificarPolaridadePorConteudo("Prefeitura inaugura hospital e amplia cobertura de saneamento");
    expect(r.polaridade).toBe("resolutiva");
    expect(r.positivos.length).toBeGreaterThanOrEqual(2);
  });

  it("sem palavra de fato fica neutra", () => {
    const r = classificarPolaridadePorConteudo("Câmara realiza sessão ordinária na terça-feira");
    expect(r.polaridade).toBe("neutra");
    expect(r.negativos).toEqual([]);
    expect(r.positivos).toEqual([]);
  });

  it("empate fica neutro", () => {
    const r = classificarPolaridadePorConteudo("Obra inaugurada após acidente");
    expect(r.polaridade).toBe("neutra");
  });

  it("negação inverte o termo: 'sem mortes' não é tensionante", () => {
    const r = classificarPolaridadePorConteudo("Temporal passa sem mortes na cidade");
    expect(r.negativos).toEqual([]);
    expect(r.invertidos).toEqual(["mortes"]);
    expect(r.polaridade).toBe("resolutiva");
  });

  it("redução de fato negativo é resolutiva", () => {
    expect(classificarPolaridadePorConteudo("Queda de 20% no desmatamento").polaridade).toBe("resolutiva");
    expect(classificarPolaridadePorConteudo("Sem investimento, obra fica parada").polaridade).toBe("tensionante");
  });

  it("ignora acento e caixa", () => {
    expect(classificarPolaridadePorConteudo("DESLIZAMENTO DE ENCOSTA").polaridade).toBe("tensionante");
    expect(classificarPolaridadePorConteudo("investimento e emprego em alta").polaridade).toBe("resolutiva");
  });

  it("casa por palavra e não por pedaço (não confunde 'mortar' com 'morte')", () => {
    expect(classificarPolaridadePorConteudo("Argamassa de cimento e mortar").polaridade).toBe("neutra");
  });

  it("aceita texto vazio ou nulo", () => {
    expect(classificarPolaridadePorConteudo("").polaridade).toBe("neutra");
    expect(classificarPolaridadePorConteudo(undefined).polaridade).toBe("neutra");
  });

  it("é determinístico", () => {
    const t = "Enchente causa prejuízo, mas prefeitura anuncia investimento";
    expect(classificarPolaridadePorConteudo(t)).toEqual(classificarPolaridadePorConteudo(t));
  });
});

describe("flag DIT_POLARIDADE_CONTEUDO", () => {
  const original = process.env.DIT_POLARIDADE_CONTEUDO;
  afterEach(() => {
    if (original === undefined) delete process.env.DIT_POLARIDADE_CONTEUDO;
    else process.env.DIT_POLARIDADE_CONTEUDO = original;
  });

  it("vem desligada por padrão e com 'false'", () => {
    delete process.env.DIT_POLARIDADE_CONTEUDO;
    expect(polaridadeConteudoAtiva()).toBe(false);
    process.env.DIT_POLARIDADE_CONTEUDO = "false";
    expect(polaridadeConteudoAtiva()).toBe(false);
  });

  it("só liga com 'true'", () => {
    process.env.DIT_POLARIDADE_CONTEUDO = "true";
    expect(polaridadeConteudoAtiva()).toBe(true);
    process.env.DIT_POLARIDADE_CONTEUDO = "1";
    expect(polaridadeConteudoAtiva()).toBe(false);
  });

  it("polaridadeDoSinal devolve a polaridade da fonte quando desligada", () => {
    process.env.DIT_POLARIDADE_CONTEUDO = "false";
    const r = polaridadeDoSinal("Incêndio atinge mata", "resolutive");
    expect(r).toBe("resolutive");
  });

  it("polaridadeDoSinal usa o conteúdo quando ligada e cai na fonte se neutro", () => {
    process.env.DIT_POLARIDADE_CONTEUDO = "true";
    expect(polaridadeDoSinal("Incêndio atinge mata", "resolutive")).toBe("tensioning");
    expect(polaridadeDoSinal("Hospital inaugurado e saneamento ampliado", "tensioning")).toBe("resolutive");
    expect(polaridadeDoSinal("Sessão ordinária", "tensioning")).toBe("tensioning");
  });
});
