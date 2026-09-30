import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ESTADO_INICIAL,
  reduzir,
  type EstadoLeitura,
  type Frame,
  type LeituraEstrutural,
  type Municipio,
} from "./leitura-estado";

/** Hook da primeira leitura ao vivo: abre o SSE, alimenta o reducer e fecha no fim. */
export function useLeituraAoVivo(consulta: string | null): { estado: EstadoLeitura; recomecar: () => void } {
  const [estado, despachar] = useReducer((s: EstadoLeitura, a: Frame | { tipo: "__zerar" } | { tipo: "__erro"; detalhe: string }) => {
    if (a.tipo === "__zerar") return ESTADO_INICIAL;
    if (a.tipo === "__erro") return { ...s, fase: "erro" as const, detalhe: a.detalhe, finalizado: true };
    return reduzir(s, a);
  }, ESTADO_INICIAL);
  const [rodada, setRodada] = useState(0);
  const finalizou = useRef(false);

  useEffect(() => {
    despachar({ tipo: "__zerar" });
    finalizou.current = false;
    if (!consulta) return;

    const fonte = new EventSource(`/api/dit/leitura/stream?q=${encodeURIComponent(consulta)}`);
    fonte.onmessage = (ev) => {
      let frame: Frame;
      try {
        frame = JSON.parse(ev.data) as Frame;
      } catch {
        return;
      }
      despachar(frame);
      if (frame.tipo === "fim") {
        finalizou.current = true;
        fonte.close(); // sem isto o navegador reconectaria e pediria a leitura de novo
      }
    };
    fonte.onerror = () => {
      if (finalizou.current) return;
      fonte.close();
      despachar({ tipo: "__erro", detalhe: "A conexão com a leitura ao vivo caiu antes de terminar." });
      // A estrutural não depende do stream: se ela não chegou, busca por conta própria.
      void buscarEstrutural(consulta).then((r) => {
        if (r.tipo === "ok") despachar({ tipo: "estrutural", leitura: r.leitura });
      });
    };
    return () => {
      finalizou.current = true;
      fonte.close();
    };
  }, [consulta, rodada]);

  const recomecar = useCallback(() => setRodada((n) => n + 1), []);
  return { estado, recomecar };
}

// ─── Rotas de apoio ──────────────────────────────────────────────────────────

export type ResultadoEstrutural =
  | { tipo: "ok"; leitura: LeituraEstrutural }
  | { tipo: "ambiguo"; detalhe: string; opcoes: Municipio[] }
  | { tipo: "nao_encontrado"; detalhe: string; sugestoes: Municipio[] }
  | { tipo: "erro"; detalhe: string };

/** GET /api/dit/estrutural: resolve o texto para um município (ou diz por que não deu). */
export async function buscarEstrutural(q: string, sinal?: AbortSignal): Promise<ResultadoEstrutural> {
  try {
    const r = await fetch(`/api/dit/estrutural?q=${encodeURIComponent(q)}`, { signal: sinal });
    const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (r.ok && j) return { tipo: "ok", leitura: j as unknown as LeituraEstrutural };
    if (r.status === 409 && j) {
      return { tipo: "ambiguo", detalhe: String(j.detail ?? ""), opcoes: (j.options as Municipio[]) ?? [] };
    }
    if (r.status === 404 && j) {
      return { tipo: "nao_encontrado", detalhe: String(j.detail ?? ""), sugestoes: (j.sugestoes as Municipio[]) ?? [] };
    }
    if (r.status === 429) return { tipo: "erro", detalhe: "Muitas buscas em sequência. Aguarde 1 minuto." };
    if (r.status === 503) return { tipo: "erro", detalhe: String(j?.detail ?? "A base de municípios ainda não carregou. Tente de novo em instantes.") };
    return { tipo: "erro", detalhe: "Nosso servidor não respondeu. Tente de novo em instantes." };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return { tipo: "erro", detalhe: "" };
    return { tipo: "erro", detalhe: "Sem conexão com o servidor. Confira a internet e tente de novo." };
  }
}

/** GET /api/dit/estrutural/sugestoes: autocomplete de município. Falha vira lista vazia. */
export async function buscarSugestoes(q: string, sinal?: AbortSignal): Promise<Municipio[]> {
  try {
    const r = await fetch(`/api/dit/estrutural/sugestoes?q=${encodeURIComponent(q)}`, { signal: sinal });
    if (!r.ok) return [];
    const j = (await r.json()) as { sugestoes?: Municipio[] };
    return j.sugestoes ?? [];
  } catch {
    return [];
  }
}

/** POST /api/dit/lead. Lança Error com a mensagem para a pessoa; não lança em sucesso. */
export async function enviarLead(corpo: {
  email: string;
  nome?: string;
  empresa?: string;
  territorio?: string;
  decisao?: string;
  observacao: string;
}): Promise<void> {
  const r = await fetch("/api/dit/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (r.status === 429) throw new Error("Muitas tentativas em sequência. Aguarde 1 minuto e envie de novo.");
  if (r.status === 400) {
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error ? `${j.error}. Corrija o campo e envie de novo.` : "Confira os campos e envie de novo.");
  }
  if (!r.ok) throw new Error("Nosso servidor não respondeu. Seus dados continuam na tela.");
  const j = (await r.json().catch(() => null)) as { saved?: boolean; captured?: boolean } | null;
  if (j && j.saved === false && j.captured !== true) throw new Error("O pedido não foi gravado. Tente de novo.");
}
