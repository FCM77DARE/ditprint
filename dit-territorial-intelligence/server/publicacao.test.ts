import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Modo disco: sem MySQL (é o que a produção roda hoje).
vi.mock("./db", () => ({ getDb: async () => null }));

import { colecao, _resetarColecaoParaTeste } from "./_core/colecao";
import {
  devolver,
  lerPublicacoes,
  montarFilaPublicacao,
  publicadosDoSlug,
  publicadosPorTerritorio,
  publicar,
  registrarRascunho,
} from "./publicacao";
import { camposPublicados, entradasDeHistorico } from "./visao-publica";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dit-pub-"));
  process.env.DATA_DIR = dir;
  delete process.env.DATABASE_URL;
  _resetarColecaoParaTeste();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const leitura = (tensao: number, confianca: number) => ({
  tensao,
  confianca,
  faixa: { min: tensao - 5, max: tensao + 5 },
  dimensoes: [],
});

function calculo(slug: string, stt: number, l = leitura(stt, 60), period = "2026-09") {
  return {
    slug,
    territoryId: 0,
    nome: slug.toUpperCase(),
    estado: "RJ",
    regiao: "Sudeste",
    period,
    stt,
    dims: { d1: 50, d2: 60, d3: 70, d4: 80, d5: 40, d6: 30, d7: null },
    activatedIndex: "D4",
    notaExecutiva: "Primeiro parágrafo público.\n\nDetalhe só para assinante.",
    leitura: l,
    nSinais: 14,
  };
}

describe("colecao (modo JSON)", () => {
  it("grava, lê, lista e remove; duas escritas simultâneas não se perdem", async () => {
    const c = colecao<{ n: number }>("teste");
    await Promise.all(Array.from({ length: 25 }, (_, i) => c.gravar(`k${i}`, { n: i })));
    expect((await c.listar()).length).toBe(25);
    expect(await c.obter("k7")).toEqual({ n: 7 });
    await c.remover("k7");
    expect(await c.obter("k7")).toBeNull();
    expect(existsSync(join(dir, "teste.json"))).toBe(true);
  });
});

describe("B1: portão de publicação em modo disco", () => {
  it("rascunho do motor NÃO aparece em nenhuma leitura pública", async () => {
    await registrarRascunho(calculo("macae-3302403", 82));
    expect(await lerPublicacoes("macae-3302403")).toEqual([]);
    expect(await publicadosPorTerritorio()).toEqual([]);
    expect(await publicadosDoSlug("macae-3302403")).toBeNull();
    expect(entradasDeHistorico(await lerPublicacoes("macae-3302403"))).toEqual([]);
  });

  it("depois de publicar, o número público é o publicado e fica congelado", async () => {
    await registrarRascunho(calculo("macae-3302403", 82));
    const pub = await publicar({ slug: "macae-3302403", period: "2026-09" }, { por: "op@print.com.br" });
    expect(pub.publishedBy).toBe("op@print.com.br");
    expect(pub.tensao).toBe(82);
    expect(pub.confianca).toBe(60);
    expect(pub.origem).toBe("disco");

    // O motor roda de novo e calcula 95: o público continua vendo 82.
    await registrarRascunho(calculo("macae-3302403", 95, leitura(95, 80)));
    const pubs = await lerPublicacoes("macae-3302403");
    expect(pubs).toHaveLength(1);
    expect(pubs[0].stt).toBe(82);
    expect(pubs[0].tensao).toBe(82);
  });

  it("nota editada na publicação vira a nota publicada", async () => {
    await registrarRascunho(calculo("macae-3302403", 70));
    await publicar(
      { slug: "macae-3302403", period: "2026-09" },
      { por: "op@print.com.br", notaExecutiva: "Nota revisada pelo analista." }
    );
    const tp = await publicadosDoSlug("macae-3302403");
    expect(tp?.pubs[0].notaExecutiva).toBe("Nota revisada pelo analista.");
  });

  it("publicar sem rascunho é NOT_FOUND", async () => {
    await expect(publicar({ slug: "nada", period: "2026-09" }, { por: "op" })).rejects.toThrow(/não encontrado/i);
  });
});

describe("B5: fila, devolução e caminho único", () => {
  it("a fila junta todos os territórios com tensão nova, com delta e nº de sinais", async () => {
    await registrarRascunho(calculo("macae-3302403", 82));
    await registrarRascunho(calculo("belford-roxo-3300456", 55));
    const fila = await montarFilaPublicacao();
    expect(fila.map((i) => i.slug).sort()).toEqual(["belford-roxo-3300456", "macae-3302403"]);
    expect(fila[0].rascunho.nSinais).toBe(14);
    expect(fila[0].ultimaPublicada).toBeNull();
    expect(fila[0].delta).toBeNull();
  });

  it("depois de publicar sai da fila; cálculo novo com valor diferente volta com delta", async () => {
    await registrarRascunho(calculo("macae-3302403", 60), new Date("2026-09-01T10:00:00Z"));
    await publicar({ slug: "macae-3302403", period: "2026-09" }, { por: "op" }, new Date("2026-09-01T12:00:00Z"));
    expect(await montarFilaPublicacao()).toEqual([]);

    await registrarRascunho(calculo("macae-3302403", 68, leitura(68, 70)), new Date("2026-09-02T12:00:00Z"));
    const fila = await montarFilaPublicacao();
    expect(fila).toHaveLength(1);
    expect(fila[0].delta).toBe(8);
    expect(fila[0].ultimaPublicada?.publishedBy).toBe("op");
  });

  it("devolver ao motor tira da fila com motivo e reabre quando o motor recalcula", async () => {
    await registrarRascunho(calculo("macae-3302403", 82), new Date("2026-09-01T10:00:00Z"));
    const d = await devolver({ slug: "macae-3302403", period: "2026-09" }, { motivo: "Sem fonte oficial", por: "op" });
    expect(d.motivo).toBe("Sem fonte oficial");
    expect(await montarFilaPublicacao()).toEqual([]);

    const comDevolvidos = await montarFilaPublicacao({ incluirDevolvidos: true });
    expect(comDevolvidos[0].devolvidoAntes?.motivo).toBe("Sem fonte oficial");

    await registrarRascunho(calculo("macae-3302403", 79), new Date("2026-09-02T10:00:00Z"));
    const fila = await montarFilaPublicacao();
    expect(fila).toHaveLength(1);
    expect(fila[0].devolvidoAntes).toBeNull();
  });

  it("devolvido não é publicado por engano: nada vai ao público", async () => {
    await registrarRascunho(calculo("macae-3302403", 82));
    await devolver({ slug: "macae-3302403", period: "2026-09" }, { motivo: "Dado duvidoso", por: "op" });
    expect(await lerPublicacoes("macae-3302403")).toEqual([]);
  });
});

describe("B3 e B7: nota, delta 7/30 e série a partir do publicado", () => {
  it("publicações com 30 dias de distância dão delta30, delta7 e série", async () => {
    const slug = "macae-3302403";
    const rodada = async (stt: number, period: string, calculoEm: string, publicaEm: string) => {
      await registrarRascunho(calculo(slug, stt, leitura(stt, 60), period), new Date(calculoEm));
      await publicar({ slug, period }, { por: "op" }, new Date(publicaEm));
    };
    await rodada(60, "2026-08", "2026-08-01T10:00:00Z", "2026-08-01T12:00:00Z");
    await rodada(66, "2026-08", "2026-08-25T10:00:00Z", "2026-08-25T12:00:00Z");
    await rodada(72, "2026-09", "2026-09-02T10:00:00Z", "2026-09-02T12:00:00Z");

    const tp = (await publicadosDoSlug(slug))!;
    const campos = camposPublicados(tp.pubs, { notaCompleta: false });
    expect(campos.publicado).toBe(true);
    expect(campos.notaExecutiva).toBe("Primeiro parágrafo público.");
    expect(campos.delta7).toBe(6); // 72 contra 66 (ponto de 08-25 é anterior a 09-02 menos 7 dias)
    expect(campos.delta30).toBe(12); // 72 contra 60 (ponto de 08-01)
    expect(campos.serie.map((p) => p.valor)).toEqual([60, 66, 72]);

    const lista = await publicadosPorTerritorio();
    expect(lista).toHaveLength(1);
    expect(lista[0].slug).toBe(slug);
  });

  it("território sem publicação não entra em territoriosPublicados", async () => {
    await registrarRascunho(calculo("so-rascunho-1", 70));
    expect(await publicadosPorTerritorio()).toEqual([]);
  });
});
