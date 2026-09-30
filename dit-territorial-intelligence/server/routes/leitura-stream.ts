/**
 * Primeira leitura ao vivo.
 *
 *   GET /api/dit/leitura/stream?q=<município, "Município, UF", slug ou código IBGE>
 *
 * É a isca do funil: o DIT de verdade rodando para o território que a pessoa
 * pesquisou, com as fontes respondendo e os sinais verificados chegando em
 * tempo real, e no fim o teaser (Tensão, faixa, Confiança, identidade, síntese,
 * 3 sinais, 1 risco, 1 oportunidade). O relatório inteiro fica atrás do cadastro.
 *
 * Sequência de eventos (SSE, um JSON por frame, campo `tipo`):
 *   inicio → resolvido → estrutural        instantâneos, custo zero, qualquer município
 *   etapa | fonte | sinal | dimensao       ao vivo, vindos do motor (leitura-progresso.ts)
 *   teaser                                 a leitura do dia, derivada do DIT completo
 *   sem_leitura                            cobertura_insuficiente | teto | limite_ip |
 *                                          coleta_falhou | erro (a estrutural já foi entregue)
 *   ambiguo | nao_encontrado               território não resolvido
 *   fim                                    sempre o último
 *
 * Custo: a coleta paga só roda quando NÃO existe leitura do dia e há teto de
 * gasto (budget.ts). Leitura do dia em cache é reproduzida na hora. Quem chega
 * enquanto a mesma leitura roda entra nela, em vez de pagar de novo. Cada IP
 * tem um limite de leituras novas por hora.
 *
 * As dependências entram por parâmetro (`DepsLeituraStream`) para a rota ser
 * testada sem coleta real, sem LLM e sem rede.
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { ouvir, type EventoProgresso } from "../_core/leitura-progresso";
import type { RespostaEstrutural } from "../structural/leitura-estrutural";
import { logger } from "../_core/logger";

const log = logger.child({ module: "leitura-stream" });

export interface LocResolvida {
  /** Nome do lugar ("Cabiúnas"). */
  nome: string;
  /** Município pai. */
  municipio: string;
  uf: string;
  ibgeId: number;
  /** Slug canônico, o mesmo do /analyze e do cache. */
  slug: string;
  tipo: string;
}

export interface OpcaoAmbigua {
  name: string;
  state: string;
  ibgeId: number;
}

export interface DepsLeituraStream {
  estrutural(q: string): Promise<RespostaEstrutural>;
  resolver(q: string): Promise<{ loc: LocResolvida | null; ambiguas: OpcaoAmbigua[] | null }>;
  /** Teaser do dia em cache (memória ou disco), ou null. */
  iscaEmCache(slug: string): Record<string, unknown> | null;
  /** Há teto de gasto para uma leitura nova? */
  podeGastar(): Promise<{ ok: boolean; motivo?: string }>;
  /** Roda o DIT completo (coleta real). Devolve o status HTTP e o corpo do /analyze. */
  executarAnalise(territorio: string, ctx: { ip: string; porta: number }): Promise<{ status: number; corpo: unknown }>;
  /** Teaser a partir do DIT completo, quando a isca não ficou em cache. */
  derivarIsca(completo: Record<string, unknown>): Record<string, unknown>;
  /** Pausa (injetável para o teste não esperar). */
  esperar?: (ms: number) => Promise<void>;
  /** Leituras novas por IP por hora. Padrão: env DIT_LEITURA_POR_IP_HORA ou 3. */
  limiteNovasPorIpHora?: number;
  agora?: () => number;
}

type Frame = Record<string, unknown> & { tipo: string };

type Final =
  | { tipo: "teaser"; isca: Record<string, unknown> }
  | { tipo: "sem_leitura"; motivo: "cobertura_insuficiente" | "teto" | "coleta_falhou" | "erro" | "sob_demanda"; detalhe: string; extra?: Record<string, unknown> };

interface Corrida {
  eventos: EventoProgresso[];
  espectadores: Set<(e: EventoProgresso) => void>;
  promessa: Promise<Final>;
}

const consulta = z.object({ q: z.string().trim().min(2).max(120) });

const ROTULO_ETAPA: Record<string, string> = {
  coleta: "Consultando as fontes oficiais e a imprensa",
  verificacao: "Conferindo se cada sinal é mesmo deste território",
  consolidacao: "Consolidando as dimensões em Tensão e Confiança",
  redacao: "Escrevendo a síntese",
};

function intEnv(v: string | undefined, padrao: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : padrao;
}

function dia(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function criarLeituraStream(deps: DepsLeituraStream) {
  const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const agora = deps.agora ?? (() => Date.now());
  const limiteIp = deps.limiteNovasPorIpHora ?? intEnv(process.env.DIT_LEITURA_POR_IP_HORA, 3);

  /** Leituras rodando agora, por slug. */
  const emCurso = new Map<string, Corrida>();
  /** Sequência ao vivo da última leitura do dia, para reproduzir quando vier do cache. */
  const gravacoes = new Map<string, EventoProgresso[]>();
  /** Leituras novas iniciadas por IP (timestamps). */
  const novasPorIp = new Map<string, number[]>();
  /** Conexões por IP por minuto. */
  const conexoes = new Map<string, number[]>();

  function conexaoLimitada(ip: string): boolean {
    const t = agora();
    const recentes = (conexoes.get(ip) ?? []).filter((x) => t - x < 60_000);
    recentes.push(t);
    conexoes.set(ip, recentes);
    return recentes.length > 12;
  }

  function ipExcedeu(ip: string): boolean {
    const t = agora();
    const recentes = (novasPorIp.get(ip) ?? []).filter((x) => t - x < 3_600_000);
    novasPorIp.set(ip, recentes);
    return recentes.length >= limiteIp;
  }

  function marcarNova(ip: string): void {
    const recentes = novasPorIp.get(ip) ?? [];
    recentes.push(agora());
    novasPorIp.set(ip, recentes);
  }

  function iniciarCorrida(slug: string, territorio: string, ctx: { ip: string; porta: number }): Corrida {
    const corrida: Corrida = { eventos: [], espectadores: new Set(), promessa: undefined as unknown as Promise<Final> };
    const publicar = (e: EventoProgresso) => {
      corrida.eventos.push(e);
      corrida.espectadores.forEach((f) => f(e));
    };
    corrida.promessa = (async (): Promise<Final> => {
      const parar = ouvir(slug, publicar);
      try {
        publicar({ tipo: "etapa", id: "coleta", rotulo: ROTULO_ETAPA.coleta });
        const r = await deps.executarAnalise(territorio, ctx);
        const corpo = (r.corpo ?? {}) as Record<string, unknown>;
        if (r.status === 429) {
          return {
            tipo: "sem_leitura",
            motivo: corpo.status === "orcamento_esgotado" ? "teto" : "erro",
            detalhe: String(corpo.detail ?? corpo.error ?? "Limite de requisições atingido."),
          };
        }
        if (r.status === 503) {
          return { tipo: "sem_leitura", motivo: "coleta_falhou", detalhe: String(corpo.detail ?? "A coleta não respondeu a tempo.") };
        }
        if (r.status >= 400) {
          return { tipo: "sem_leitura", motivo: "erro", detalhe: String(corpo.detail ?? corpo.error ?? "A leitura não pôde ser feita.") };
        }
        if (corpo.status === "cobertura_insuficiente") {
          return {
            tipo: "sem_leitura",
            motivo: "cobertura_insuficiente",
            detalhe: String(corpo.message ?? "A cobertura de fontes ainda é insuficiente."),
            extra: { cobertura: corpo.coverageScore ?? null, minimo: corpo.minCoverage ?? null },
          };
        }
        if (corpo.status === "sob_demanda") {
          return { tipo: "sem_leitura", motivo: "sob_demanda", detalhe: String(corpo.message ?? "") };
        }
        const isca = deps.iscaEmCache(slug) ?? deps.derivarIsca(corpo);
        gravacoes.set(`${slug}|${dia(agora())}`, corrida.eventos.slice());
        return { tipo: "teaser", isca };
      } catch (err) {
        log.error({ territorio: slug, err: (err as Error).message }, "Leitura ao vivo falhou");
        return { tipo: "sem_leitura", motivo: "erro", detalhe: "A leitura não pôde ser concluída. Tente de novo em instantes." };
      } finally {
        parar();
        emCurso.delete(slug);
      }
    })();
    emCurso.set(slug, corrida);
    return corrida;
  }

  return async function handler(req: Request, res: Response): Promise<void> {
    const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").slice(0, 50);
    if (conexaoLimitada(ip)) {
      res.status(429).json({ error: "Muitas requisições. Aguarde 1 minuto." });
      return;
    }
    const parsed = consulta.safeParse({ q: req.query.q });
    if (!parsed.success) {
      res.status(400).json({ error: "Informe o município", detail: "Use o nome do município, com o estado se houver homônimo." });
      return;
    }
    const q = parsed.data.q;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let aberta = true;
    const send = (f: Frame) => {
      if (!aberta) return;
      try {
        res.write(`data: ${JSON.stringify(f)}\n\n`);
      } catch {
        aberta = false;
      }
    };
    const heartbeat = setInterval(() => {
      if (!aberta) return;
      try {
        res.write(": heartbeat\n\n");
      } catch {
        aberta = false;
      }
    }, 15_000);
    let saiDoEspectador: (() => void) | null = null;
    req.on("close", () => {
      aberta = false;
      clearInterval(heartbeat);
      saiDoEspectador?.();
    });

    const fim = (status: string) => {
      send({ tipo: "fim", status });
      clearInterval(heartbeat);
      if (aberta) res.end();
    };

    try {
      send({ tipo: "inicio", consulta: q });

      // 1. Camada estrutural: instantânea e de custo zero para qualquer município.
      let est = await deps.estrutural(q);
      if (est.status === 409) {
        send({ tipo: "ambiguo", detalhe: est.corpo.detail, options: est.corpo.options });
        return fim("ambiguo");
      }
      let entregouEstrutural = false;
      const entregarEstrutural = (r: RespostaEstrutural, nomeDoLugar?: string) => {
        if (r.status !== 200 || entregouEstrutural) return;
        entregouEstrutural = true;
        send({ tipo: "resolvido", municipio: { ...r.corpo.municipio, ...(nomeDoLugar ? { lugar: nomeDoLugar } : {}) }, noRadar: r.corpo.noRadar });
        send({ tipo: "estrutural", leitura: r.corpo });
      };
      entregarEstrutural(est);

      // 2. Resolução oficial (a mesma do /analyze): define o slug e aceita distrito e localidade.
      const consultaReal = est.status === 200 ? est.corpo.municipio.consulta : q;
      const { loc, ambiguas } = await deps.resolver(consultaReal);
      if (!loc && ambiguas) {
        send({
          tipo: "ambiguo",
          detalhe: `Existe mais de um lugar chamado "${q}". Escolha o estado.`,
          options: ambiguas.map((o) => ({ nome: o.name, uf: o.state, ibgeId: String(o.ibgeId), consulta: `${o.name}, ${o.state}` })),
        });
        return fim("ambiguo");
      }
      if (!loc) {
        if (est.status === 200) {
          send({
            tipo: "sem_leitura",
            motivo: "erro",
            detalhe: "Não conseguimos confirmar este território na malha do IBGE agora. A leitura estrutural acima segue valendo.",
          });
          return fim("sem_leitura");
        }
        send({
          tipo: "nao_encontrado",
          detalhe: est.status === 404 ? est.corpo.detail : `Não achamos "${q}". Confira a grafia ou informe o estado, como "Galinhos, RN".`,
          sugestoes: est.status === 404 ? est.corpo.sugestoes : [],
        });
        return fim("nao_encontrado");
      }
      if (!entregouEstrutural) {
        // Distrito ou localidade: a estrutural é a do município pai.
        est = await deps.estrutural(String(loc.ibgeId));
        entregarEstrutural(est, loc.nome);
        if (!entregouEstrutural) {
          send({ tipo: "resolvido", municipio: { nome: loc.nome, uf: loc.uf, ibgeId: String(loc.ibgeId), slug: loc.slug, consulta: loc.nome }, noRadar: false });
        }
      }

      const slug = loc.slug;

      // 3. Leitura do dia já pronta: reproduz a sequência rápido.
      const pronta = deps.iscaEmCache(slug);
      if (pronta) {
        send({ tipo: "cache", mensagem: "A leitura de hoje deste território já está pronta." });
        const gravada = gravacoes.get(`${slug}|${dia(agora())}`);
        const sequencia: EventoProgresso[] = gravada ?? [];
        const passo = sequencia.length > 0 ? Math.min(140, Math.floor(4000 / sequencia.length)) : 0;
        for (const e of sequencia) {
          if (!aberta) return;
          send(e as unknown as Frame);
          await esperar(passo);
        }
        send({ tipo: "teaser", isca: pronta });
        return fim("teaser");
      }

      // 4. Leitura nova: limite por IP e teto de gasto antes de qualquer coleta paga.
      const jaRodando = emCurso.get(slug);
      if (!jaRodando) {
        if (ipExcedeu(ip)) {
          send({
            tipo: "sem_leitura",
            motivo: "teto",
            detalhe: "Você já pediu leituras novas demais nesta hora. A leitura estrutural acima segue valendo.",
            extra: { causa: "limite_ip" },
          });
          return fim("sem_leitura");
        }
        const orcamento = await deps.podeGastar();
        if (!orcamento.ok) {
          send({ tipo: "sem_leitura", motivo: "teto", detalhe: orcamento.motivo ?? "O teto de leituras de hoje foi atingido.", extra: { causa: "orcamento" } });
          return fim("sem_leitura");
        }
        marcarNova(ip);
      }

      // 5. Roda (ou entra na leitura que já está rodando) e repassa o que o motor avisa.
      const corrida = jaRodando ?? iniciarCorrida(slug, consultaReal, { ip, porta: req.socket.localPort ?? 0 });
      for (const e of corrida.eventos) send(e as unknown as Frame);
      const aoVivo = (e: EventoProgresso) => send(e as unknown as Frame);
      corrida.espectadores.add(aoVivo);
      saiDoEspectador = () => corrida.espectadores.delete(aoVivo);
      const final = await corrida.promessa;
      saiDoEspectador();
      saiDoEspectador = null;

      if (final.tipo === "teaser") {
        send({ tipo: "teaser", isca: final.isca });
        return fim("teaser");
      }
      send({ tipo: "sem_leitura", motivo: final.motivo, detalhe: final.detalhe, ...(final.extra ? { extra: final.extra } : {}) });
      return fim("sem_leitura");
    } catch (err) {
      log.error({ err: (err as Error).message }, "Falha na rota de leitura ao vivo");
      send({ tipo: "sem_leitura", motivo: "erro", detalhe: "A leitura não pôde ser concluída. Tente de novo em instantes." });
      fim("erro");
    }
  };
}
