/**
 * Leitura estrutural gratuita: resolução de município, perfil com percentis,
 * tensão parcial com Confiança e o que falta. Base sintética em disco temporário
 * (nenhuma rede, nenhum LLM, nenhuma busca paga).
 */
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;
let servidor: Server;
let base: string;
let mod: typeof import("./leitura-estrutural");

function valor(label: string, value: number, unit: string, dimension: string, pct: number, period = "2022") {
  return { value, unit, label, period, source: "IBGE · teste", dimension, polarity: "neutral", pct, provenance: "teste" };
}

function indicadores(p: { pop: number; dens: number; sal: number; vinc: number; pibpc: number; ind: number }) {
  return {
    populacao_residente: valor("População residente", p.pop, "pessoas", "D2", p.pop > 1e6 ? 0.99 : 0.1),
    densidade_demografica: valor("Densidade demográfica", p.dens, "hab/km²", "D3", p.dens < 5 ? 0.05 : 0.5),
    salario_medio_mensal: valor("Salário médio mensal do trabalho formal", p.sal, "R$", "D2", p.sal > 5000 ? 0.9 : 0.2, "2023"),
    taxa_assalariamento: valor("Vínculos formais por 100 habitantes", p.vinc, "por 100 hab", "D2", p.vinc > 30 ? 0.8 : 0.3, "2023"),
    pib_per_capita: valor("PIB per capita", p.pibpc, "R$/hab", "D2", p.pibpc > 50000 ? 0.95 : 0.3, "2022"),
    presenca_indigena_por_mil: valor("População indígena por mil habitantes", p.ind, "por mil hab", "D4", p.ind > 0 ? 0.7 : 0.1),
  };
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "dit-estrutural-"));
  mkdirSync(join(dir, "structural"), { recursive: true });
  const store = {
    generatedAt: "2026-09-30T12:00:00.000Z",
    catalogVersion: 2,
    indicatorCount: 9,
    municipalityCount: 7,
    names: {
      "2404200": "Galinhos - RN",
      "2927408": "Salvador - BA",
      "4318101": "Salvador das Missões - RS",
      "1712009": "Lajeado - TO",
      "4311403": "Lajeado - RS",
      "1200401": "Rio Branco - AC",
      "5107180": "Rio Branco - MT",
      "3304557": "Rio de Janeiro - RJ",
      "3303302": "Niterói - RJ",
      "3304904": "São Gonçalo - RJ",
      "3301702": "Duque de Caxias - RJ",
      "3302502": "Magé - RJ",
      "3301850": "Guapimirim - RJ",
      "3301900": "Itaboraí - RJ",
      "9999999": "Sem Dado - ZZ",
    } as Record<string, string>,
    data: {
      "2404200": indicadores({ pop: 2104, dens: 4, sal: 3200, vinc: 40, pibpc: 78741, ind: 0 }),
      "2927408": indicadores({ pop: 2418005, dens: 3500, sal: 4100, vinc: 35, pibpc: 28000, ind: 1 }),
      "1712009": indicadores({ pop: 3000, dens: 10, sal: 2500, vinc: 20, pibpc: 20000, ind: 0 }),
      "4311403": indicadores({ pop: 86000, dens: 400, sal: 3000, vinc: 30, pibpc: 40000, ind: 0 }),
      "3304557": indicadores({ pop: 6211223, dens: 5000, sal: 5500, vinc: 45, pibpc: 60000, ind: 2 }),
      "3303302": indicadores({ pop: 481749, dens: 3600, sal: 5000, vinc: 40, pibpc: 45000, ind: 1 }),
      "3304904": indicadores({ pop: 896744, dens: 3600, sal: 3000, vinc: 20, pibpc: 20000, ind: 0 }),
      "3301702": indicadores({ pop: 808161, dens: 1800, sal: 4000, vinc: 25, pibpc: 60000, ind: 0 }),
      "3302502": indicadores({ pop: 228127, dens: 600, sal: 2800, vinc: 18, pibpc: 15000, ind: 0 }),
      "3301850": indicadores({ pop: 62225, dens: 300, sal: 2700, vinc: 15, pibpc: 14000, ind: 3 }),
      "3301900": indicadores({ pop: 224267, dens: 500, sal: 2900, vinc: 19, pibpc: 16000, ind: 0 }),
    },
  };
  writeFileSync(join(dir, "structural", "municipios.json"), JSON.stringify(store));
  process.env.DATA_DIR = dir;
  process.env.JWT_SECRET = "r".repeat(48);
  delete process.env.DATABASE_URL;
  mod = await import("./leitura-estrutural");
  const { estruturalRouter } = await import("../routes/estrutural");
  const app = express();
  app.use("/api/dit", estruturalRouter);
  await new Promise<void>((ok) => {
    servidor = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/api/dit`;
});

afterAll(async () => {
  await new Promise<void>((ok) => servidor.close(() => ok()));
  rmSync(dir, { recursive: true, force: true });
});

describe("resolverMunicipio", () => {
  it("acha por nome com e sem acento, com UF de vários jeitos", async () => {
    for (const q of ["Galinhos", "galinhos", "Galinhos, RN", "Galinhos RN", "Galinhos - rn", "Galinhos/RN", "Galinhos (RN)"]) {
      const r = await mod.resolverMunicipio(q);
      expect(r.tipo, q).toBe("ok");
      if (r.tipo === "ok") {
        expect(r.municipio.ibgeId).toBe("2404200");
        expect(r.municipio.slug).toBe("galinhos-2404200");
        expect(r.municipio.consulta).toBe("Galinhos, RN");
      }
    }
    const r = await mod.resolverMunicipio("niteroi");
    expect(r.tipo === "ok" && r.municipio.nome).toBe("Niterói");
  });

  it("acha por código IBGE e por slug canônico", async () => {
    const porCodigo = await mod.resolverMunicipio("2404200");
    expect(porCodigo.tipo === "ok" && porCodigo.municipio.nome).toBe("Galinhos");
    const porSlug = await mod.resolverMunicipio("galinhos-2404200");
    expect(porSlug.tipo === "ok" && porSlug.municipio.ibgeId).toBe("2404200");
    const codigoInexistente = await mod.resolverMunicipio("1111111");
    expect(codigoInexistente.tipo).toBe("nao_encontrado");
  });

  it("homônimo sem UF e sem capital é ambíguo; com UF, resolve; capital ganha do homônimo", async () => {
    const amb = await mod.resolverMunicipio("Lajeado");
    expect(amb.tipo).toBe("ambiguo");
    if (amb.tipo === "ambiguo") expect(amb.opcoes.map((o) => o.uf).sort()).toEqual(["RS", "TO"]);
    const comUf = await mod.resolverMunicipio("Lajeado, RS");
    expect(comUf.tipo === "ok" && comUf.municipio.ibgeId).toBe("4311403");
    const capital = await mod.resolverMunicipio("Rio Branco");
    expect(capital.tipo === "ok" && capital.municipio.ibgeId).toBe("1200401");
    const salvador = await mod.resolverMunicipio("Salvador");
    expect(salvador.tipo === "ok" && salvador.municipio.ibgeId).toBe("2927408");
  });

  it("nome que não existe devolve sugestões, nunca um palpite", async () => {
    const r = await mod.resolverMunicipio("Galinho");
    expect(r.tipo).toBe("nao_encontrado");
    if (r.tipo === "nao_encontrado") expect(r.sugestoes.map((s) => s.nome)).toContain("Galinhos");
    const nada = await mod.resolverMunicipio("Xyzzy");
    expect(nada.tipo === "nao_encontrado" && nada.sugestoes).toEqual([]);
  });
});

describe("frasePublica", () => {
  it("tira o travessão e troca o ponto decimal, sem tocar no milhar", () => {
    expect(mod.frasePublica("densidade de 202,46 hab/km² (percentil 93 \u2014 adensamento alto); população de 246.391 (percentil 98)")).toBe(
      "densidade de 202,46 hab/km² (percentil 93, adensamento alto); população de 246.391 (percentil 98)"
    );
    expect(mod.frasePublica("1.4 pessoas indígenas por mil habitantes, percentil 64.")).toBe(
      "1,4 pessoas indígenas por mil habitantes, percentil 64."
    );
    expect(mod.frasePublica("2.104 habitantes")).toBe("2.104 habitantes");
    expect(mod.frasePublica("1 pessoas indígenas por mil habitantes")).toBe("1 pessoa indígenas por mil habitantes");
  });
});

describe("sugerirMunicipios", () => {
  it("prefixo primeiro, capital antes do homônimo, limite respeitado", async () => {
    const s = await mod.sugerirMunicipios("salvad");
    expect(s[0].nome).toBe("Salvador");
    expect(s[0].uf).toBe("BA");
    expect(s.map((x) => x.nome)).toContain("Salvador das Missões");
    expect((await mod.sugerirMunicipios("r", 8)).length).toBe(0); // 1 letra não busca
    expect((await mod.sugerirMunicipios("ri", 2)).length).toBe(2);
  });
});

describe("lerEstrutural", () => {
  it("devolve perfil com percentis, fonte e ano, tensão parcial e o que falta", async () => {
    const r = await mod.lerEstrutural("Galinhos, RN");
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    const c = r.corpo;
    expect(c.custo).toBe("zero");
    expect(c.municipio.slug).toBe("galinhos-2404200");

    // Perfil: indicador oficial com valor, ano, fonte e percentil nacional
    const sal = c.perfil.find((p) => p.chave === "salario_medio_mensal")!;
    expect(sal.valor).toBe(3200);
    expect(sal.periodo).toBe("2023");
    expect(sal.fonte).toContain("IBGE");
    expect(sal.percentil).toBe(20);
    expect(c.perfil.map((p) => p.chave)).toEqual([
      "populacao_residente",
      "densidade_demografica",
      "salario_medio_mensal",
      "taxa_assalariamento",
      "pib_per_capita",
      "presenca_indigena_por_mil",
    ]);

    // Só D2, D3, D4 têm camada estrutural: Confiança = 0,15 + 0,15 + 0,22 = 52%
    expect(c.leitura.confianca).toBe(52);
    const medidas = c.leitura.dimensoes.filter((d) => d.medida).map((d) => d.id).sort();
    expect(medidas).toEqual(["D2", "D3", "D4"]);
    for (const d of c.leitura.dimensoes.filter((x) => !x.medida)) {
      expect(d.score).toBeNull(); // nunca 100 por "não sei"
      expect(d.fonte).toBe("nenhuma");
    }
    expect(c.leitura.tensao).not.toBeNull();
    // A faixa tem a largura da ignorância: 48% do peso entre 0 e 100
    expect(c.leitura.faixa.max - c.leitura.faixa.min).toBeGreaterThanOrEqual(47);
    expect(c.leitura.faixa.min).toBeLessThanOrEqual(c.leitura.tensao as number);
    expect(c.leitura.faixa.max).toBeGreaterThanOrEqual(c.leitura.tensao as number);

    // O que sustenta: só dimensões estruturais, com frase e base auditável
    expect(c.sustenta.map((s) => s.dimensao).sort()).toEqual(["D2", "D3", "D4"]);
    const d2 = c.sustenta.find((s) => s.dimensao === "D2")!;
    expect(d2.frase).toContain("salário médio formal");
    expect(d2.base.every((b) => b.fonte && b.periodo)).toBe(true);

    // O que falta: D1, D5, D6, com peso e motivo
    expect(c.falta.map((f) => f.dimensao)).toEqual(["D1", "D5", "D6"]);
    expect(c.falta.every((f) => f.motivo.length > 20 && f.peso > 0)).toBe(true);
    expect(c.camada.geradoEm).toBe("2026-09-30T12:00:00.000Z");
  });

  it("município sem nenhum indicador: tensão nula, Confiança 0, tudo em falta (nada de 100 inventado)", async () => {
    const r = await mod.lerEstrutural("9999999");
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.corpo.leitura.tensao).toBeNull();
    expect(r.corpo.leitura.confianca).toBe(0);
    expect(r.corpo.falta.length).toBe(6);
    expect(r.corpo.perfil).toEqual([]);
  });

  it("recorte composto usa a média dos membros ponderada por população", async () => {
    const r = await mod.lerEstrutural("Baía de Guanabara");
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.corpo.municipio.composto).toBe(true);
    expect(r.corpo.municipio.slug).toBe("baia-de-guanabara");
    expect(r.corpo.perfil).toEqual([]);
    expect(r.corpo.sustenta.length).toBeGreaterThan(0);
    expect(r.corpo.sustenta[0].frase).toMatch(/ponderada por população/);
  });

  it("409 no homônimo e 404 no inexistente", async () => {
    const amb = await mod.lerEstrutural("Lajeado");
    expect(amb.status).toBe(409);
    const nf = await mod.lerEstrutural("Nowhereville");
    expect(nf.status).toBe(404);
  });
});

describe("GET /api/dit/estrutural", () => {
  it("200 com a leitura, sem tocar LLM nem rede externa", async () => {
    const r = await fetch(`${base}/estrutural?q=${encodeURIComponent("Galinhos, RN")}`);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.custo).toBe("zero");
    expect(j.leitura.confianca).toBe(52);
  });

  it("400 sem q ou com q curto; 409 ambíguo com opções; 404 com sugestões", async () => {
    expect((await fetch(`${base}/estrutural`)).status).toBe(400);
    expect((await fetch(`${base}/estrutural?q=a`)).status).toBe(400);
    const amb = await fetch(`${base}/estrutural?q=Lajeado`);
    expect(amb.status).toBe(409);
    const j = await amb.json();
    expect(j.status).toBe("ambiguo");
    expect(j.options.length).toBe(2);
    const nf = await fetch(`${base}/estrutural?q=Galinho`);
    expect(nf.status).toBe(404);
    expect((await nf.json()).sugestoes.length).toBeGreaterThan(0);
  });

  it("sugestões para o autocomplete", async () => {
    const r = await fetch(`${base}/estrutural/sugestoes?q=gal`);
    const j = await r.json();
    expect(j.sugestoes[0].nome).toBe("Galinhos");
    const curto = await (await fetch(`${base}/estrutural/sugestoes?q=g`)).json();
    expect(curto.sugestoes).toEqual([]);
  });
});
