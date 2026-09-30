import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: async () => null }));

import { broadcastSignalToFeed, clientePodeReceber, registerSseClient } from "./alertEngine";

const alerta = (slug: string, id: number) => ({
  territoryId: id,
  territoryName: slug,
  territorySlug: slug,
  signalTitle: `sinal de ${slug}`,
  impactScore: 0.8,
  dimension: "D1" as const,
  alertType: "signal" as const,
});

describe("B9: feed SSE filtrado por território", () => {
  it("regra: território pedido e contrato do assinante", () => {
    expect(clientePodeReceber({}, { territoryId: 1, territorySlug: "a" })).toBe(true);
    expect(clientePodeReceber({ territoryId: 2 }, { territoryId: 1, territorySlug: "a" })).toBe(false);
    expect(clientePodeReceber({ slugs: new Set(["a"]) }, { territoryId: 1, territorySlug: "a" })).toBe(true);
    expect(clientePodeReceber({ slugs: new Set(["a"]) }, { territoryId: 9, territorySlug: "b" })).toBe(false);
  });

  it("assinante só recebe os territórios do contrato (ao vivo e no replay); operador recebe tudo", () => {
    const assinante: string[] = [];
    const operador: string[] = [];

    broadcastSignalToFeed(alerta("macae", 11)); // entra no buffer de replay antes de conectar
    broadcastSignalToFeed(alerta("belford-roxo", 12));

    const sair1 = registerSseClient("ass", (d) => assinante.push(d), undefined, ["macae"]);
    const sair2 = registerSseClient("op", (d) => operador.push(d));

    // replay: assinante vê só Macaé
    expect(assinante.join("")).toContain("sinal de macae");
    expect(assinante.join("")).not.toContain("sinal de belford-roxo");
    expect(operador.join("")).toContain("sinal de belford-roxo");

    broadcastSignalToFeed(alerta("belford-roxo", 12));
    broadcastSignalToFeed(alerta("macae", 11));
    const textoAss = assinante.join("");
    expect(textoAss.match(/sinal de macae/g)?.length).toBe(2); // replay + ao vivo
    expect(textoAss).not.toContain("belford-roxo");

    sair1();
    sair2();
  });
});
