/**
 * Primeira leitura ao vivo: sequência de eventos, cache, teto de gasto, limite
 * por IP, leitura compartilhada e os desfechos sem leitura. Tudo com
 * dependências falsas: nenhuma coleta real, nenhum LLM, nenhuma rede.
 */
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarLeituraStream, type DepsLeituraStream } from "./leitura-stream";
import { emitirPara, _ouvintesParaTeste } from "../_core/leitura-progresso";
import type { RespostaEstrutural } from "../structural/leitura-estrutural";

const MUNICIPIO = { nome: "Galinhos", uf: "RN", ibgeId: "2404200", slug: "galinhos-2404200", consulta: "Galinhos, RN" };

function estruturalOk(): RespostaEstrutural {
  return {
    status: 200,
    corpo: {
      municipio: MUNICIPIO,
      leitura: { tensao: 40, confianca: 52, faixa: { min: 21, max: 69 }, dimensoes: [] },
      perfil: [],
      sustenta: [],
      falta: [],
      custo: "zero",
      camada: { geradoEm: "2026-09-30T12:00:00.000Z", fonte: "IBGE, em lote nacional" },
      noRadar: false,
    },
  };
}

const LOC = { nome: "Galinhos", municipio: "Galinhos", uf: "RN", ibgeId: 2404200, slug: "galinhos-2404200", tipo: "municipality" };
const ISCA = { isIsca: true, territory: "Galinhos", stt: 41, leitura: { tensao: 41, confianca: 70 }, executiveSummaryTeaser: "Síntese." };

let servidor: Server;
let base: string;
let deps: DepsLeituraStream;
let cache: Map<string, Record<string, unknown>>;
let analises: number;

function montar(sobrescreve: Partial<DepsLeituraStream> = {}) {
  cache = new Map();
  analises = 0;
  deps = {
    estrutural: async () => estruturalOk(),
    resolver: async () => ({ loc: LOC, ambiguas: null }),
    iscaEmCache: (slug) => cache.get(slug) ?? null,
    podeGastar: async () => ({ ok: true }),
    executarAnalise: async () => {
      analises++;
      emitirPara(LOC.slug, { tipo: "fonte", dimensao: "D6", fonte: "src-news", nome: "Notícias", ok: true, brutos: 7 });
      emitirPara(LOC.slug, {
        tipo: "sinal",
        dimensao: "D6",
        fonte: "Notícias",
        titulo: "Prefeitura anuncia obra",
        data: "2026-09-28",
        url: "https://exemplo.test/a",
        impacto: "medio",
      });
      emitirPara(LOC.slug, { tipo: "dimensao", id: "D6", nome: "Reputação e Visibilidade", sinais: 1, fontesOk: 1, fontesTotal: 1 });
      cache.set(LOC.slug, ISCA);
      return { status: 200, corpo: { stt: 41 } };
    },
    derivarIsca: (c) => ({ ...ISCA, derivadoDe: c }),
    esperar: async () => undefined,
    limiteNovasPorIpHora: 3,
    ...sobrescreve,
  };
  const app = express();
  app.get("/leitura/stream", criarLeituraStream(deps));
  return new Promise<void>((ok) => {
    servidor = app.listen(0, "127.0.0.1", () => {
      base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
      ok();
    });
  });
}

async function ler(q: string): Promise<Array<Record<string, any>>> {
  const r = await fetch(`${base}/leitura/stream?q=${encodeURIComponent(q)}`);
  const texto = await r.text();
  return texto
    .split("\n\n")
    .map((b) => b.trim())
    .filter((b) => b.startsWith("data:"))
    .map((b) => JSON.parse(b.slice(5)));
}

const tipos = (f: Array<Record<string, any>>) => f.map((x) => x.tipo);

afterEach(async () => {
  await new Promise<void>((ok) => servidor.close(() => ok()));
});

describe("GET /leitura/stream", () => {
  beforeEach(() => montar());

  it("entrega a estrutural na hora, repassa o que o motor avisa e fecha com o teaser", async () => {
    const f = await ler("Galinhos, RN");
    expect(tipos(f)).toEqual(["inicio", "resolvido", "estrutural", "etapa", "fonte", "sinal", "dimensao", "teaser", "fim"]);
    expect(f.find((x) => x.tipo === "estrutural")!.leitura.custo).toBe("zero");
    const sinal = f.find((x) => x.tipo === "sinal")!;
    expect(sinal.titulo).toBe("Prefeitura anuncia obra");
    expect(sinal.data).toBe("2026-09-28");
    expect(f.find((x) => x.tipo === "teaser")!.isca).toMatchObject({ isIsca: true, stt: 41 });
    expect(f[f.length - 1]).toMatchObject({ tipo: "fim", status: "teaser" });
    expect(analises).toBe(1);
    expect(_ouvintesParaTeste()).toBe(0); // ninguém fica escutando depois do fim
  });

  it("leitura do dia em cache é reproduzida sem nova coleta", async () => {
    await ler("Galinhos, RN"); // roda e grava
    const f = await ler("Galinhos, RN");
    expect(tipos(f)).toEqual(["inicio", "resolvido", "estrutural", "cache", "etapa", "fonte", "sinal", "dimensao", "teaser", "fim"]);
    expect(analises).toBe(1);
  });

  it("cache sem gravação ao vivo (ex.: depois de reiniciar) entrega o teaser direto", async () => {
    cache.set(LOC.slug, ISCA);
    const f = await ler("Galinhos, RN");
    expect(tipos(f)).toEqual(["inicio", "resolvido", "estrutural", "cache", "teaser", "fim"]);
    expect(analises).toBe(0);
  });

  it("dois visitantes do mesmo território dividem uma coleta só", async () => {
    let solta!: () => void;
    const porta = new Promise<void>((r) => (solta = r));
    await new Promise<void>((ok) => servidor.close(() => ok()));
    await montar({
      executarAnalise: async () => {
        analises++;
        emitirPara(LOC.slug, { tipo: "fonte", dimensao: "D1", fonte: "src-x", nome: "IBAMA", ok: true, brutos: 2 });
        await porta;
        cache.set(LOC.slug, ISCA);
        return { status: 200, corpo: {} };
      },
    });
    const a = ler("Galinhos, RN");
    await vi.waitFor(() => expect(analises).toBe(1));
    const b = ler("Galinhos, RN");
    await new Promise((r) => setTimeout(r, 60));
    solta();
    const [fa, fb] = await Promise.all([a, b]);
    expect(analises).toBe(1);
    expect(tipos(fa)).toContain("teaser");
    expect(tipos(fb)).toContain("teaser");
    // quem chegou depois também recebe o que já tinha acontecido
    expect(fb.some((x) => x.tipo === "fonte" && x.nome === "IBAMA")).toBe(true);
  });

  it("teto de gasto estourado: estrutural entregue, sem coleta, motivo honesto", async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    await montar({ podeGastar: async () => ({ ok: false, motivo: "teto diário de 80 atingido" }) });
    const f = await ler("Galinhos, RN");
    expect(tipos(f)).toEqual(["inicio", "resolvido", "estrutural", "sem_leitura", "fim"]);
    expect(f.find((x) => x.tipo === "sem_leitura")).toMatchObject({ motivo: "teto", extra: { causa: "orcamento" } });
    expect(analises).toBe(0);
  });

  it("cada IP tem um limite de leituras novas por hora", async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    await montar({ limiteNovasPorIpHora: 1 });
    await ler("Galinhos, RN"); // 1ª leitura nova, roda
    cache.clear(); // simula outro território sem cache
    const f = await ler("Galinhos, RN");
    const s = f.find((x) => x.tipo === "sem_leitura")!;
    expect(s).toMatchObject({ motivo: "teto", extra: { causa: "limite_ip" } });
    expect(analises).toBe(1);
  });

  it("cobertura insuficiente vira sem_leitura com os números da cobertura", async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    await montar({
      executarAnalise: async () => ({
        status: 200,
        corpo: { status: "cobertura_insuficiente", message: "Cobertura de 20%.", coverageScore: 0.2, minCoverage: 0.35 },
      }),
    });
    const f = await ler("Galinhos, RN");
    expect(f.find((x) => x.tipo === "sem_leitura")).toMatchObject({
      motivo: "cobertura_insuficiente",
      extra: { cobertura: 0.2, minimo: 0.35 },
    });
    expect(tipos(f)).not.toContain("teaser");
  });

  it("coleta que falha (503) e teto do /analyze (429) não fabricam leitura", async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    await montar({ executarAnalise: async () => ({ status: 503, corpo: { detail: "Coleta indisponível" } }) });
    let f = await ler("Galinhos, RN");
    expect(f.find((x) => x.tipo === "sem_leitura")).toMatchObject({ motivo: "coleta_falhou" });
    await new Promise<void>((ok) => servidor.close(() => ok()));
    await montar({ executarAnalise: async () => ({ status: 429, corpo: { status: "orcamento_esgotado", detail: "teto" } }) });
    f = await ler("Galinhos, RN");
    expect(f.find((x) => x.tipo === "sem_leitura")).toMatchObject({ motivo: "teto" });
  });

  it("exceção na coleta vira erro tratado e o stream fecha", async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    await montar({
      executarAnalise: async () => {
        throw new Error("boom");
      },
    });
    const f = await ler("Galinhos, RN");
    expect(f.find((x) => x.tipo === "sem_leitura")).toMatchObject({ motivo: "erro" });
    expect(f[f.length - 1].tipo).toBe("fim");
    expect(_ouvintesParaTeste()).toBe(0);
  });

  it("sem teaser em cache, deriva do DIT completo e nunca devolve o relatório inteiro", async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    await montar({
      executarAnalise: async () => ({ status: 200, corpo: { stt: 41, recommendations: ["segredo"] } }),
      derivarIsca: (c) => ({ isIsca: true, stt: c.stt }),
    });
    const f = await ler("Galinhos, RN");
    const teaser = f.find((x) => x.tipo === "teaser")!;
    expect(teaser.isca.isIsca).toBe(true);
    expect(teaser.isca).toEqual({ isIsca: true, stt: 41 });
    expect(JSON.stringify(f)).not.toContain("segredo");
  });

  it("homônimo: pede o estado, sem coletar", async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    await montar({
      estrutural: async () => ({
        status: 409,
        corpo: {
          error: "Território ambíguo",
          detail: 'Existe mais de um município chamado "Lajeado".',
          status: "ambiguo",
          options: [
            { ...MUNICIPIO, nome: "Lajeado", uf: "RS" },
            { ...MUNICIPIO, nome: "Lajeado", uf: "TO" },
          ],
        },
      }),
    });
    const f = await ler("Lajeado");
    expect(tipos(f)).toEqual(["inicio", "ambiguo", "fim"]);
    expect(f[1].options).toHaveLength(2);
    expect(analises).toBe(0);
  });

  it("território que não existe: não_encontrado com sugestões, sem coleta", async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    await montar({
      estrutural: async () => ({ status: 404, corpo: { error: "Município não encontrado", detail: "Não achamos.", sugestoes: [MUNICIPIO] } }),
      resolver: async () => ({ loc: null, ambiguas: null }),
    });
    const f = await ler("Galinho");
    expect(tipos(f)).toEqual(["inicio", "nao_encontrado", "fim"]);
    expect(f[1].sugestoes).toHaveLength(1);
    expect(analises).toBe(0);
  });

  it("localidade fora da lista de municípios: estrutural do município pai e leitura normal", async () => {
    await new Promise<void>((ok) => servidor.close(() => ok()));
    const chamadas: string[] = [];
    await montar({
      estrutural: async (q) => {
        chamadas.push(q);
        return q === "2404200" ? estruturalOk() : { status: 404, corpo: { error: "x", detail: "x", sugestoes: [] } };
      },
    });
    const f = await ler("Praia do Lugar");
    expect(chamadas).toEqual(["Praia do Lugar", "2404200"]);
    expect(f.find((x) => x.tipo === "resolvido")!.municipio.lugar).toBe("Galinhos");
    expect(tipos(f)).toContain("teaser");
  });

  it("q ausente ou curta: 400 antes de abrir o stream", async () => {
    const r = await fetch(`${base}/leitura/stream?q=a`);
    expect(r.status).toBe(400);
    expect((await fetch(`${base}/leitura/stream`)).status).toBe(400);
  });
});
