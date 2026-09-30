import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ExternalLink, Lock } from "lucide-react";
import {
  Button,
  Chip,
  DimensoesTable,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Secao,
  TensaoBar,
  botaoVariants,
  faixaDeTensao,
  fmtInt,
} from "@/components/dit";
import { cn } from "@/lib/utils";
import { enviarLead, useLeituraAoVivo } from "@/lib/leitura-ao-vivo";
import {
  contagemFontes,
  leituraPrincipal,
  nomeExibido,
  observacaoDoLead,
  type EstadoLeitura,
  type IndicadorPerfil,
  type Isca,
  type LeituraEstrutural,
  type Municipio,
} from "@/lib/leitura-estado";
import BuscaLeitura from "./BuscaLeitura";
import { Acao, MarcoPagina, Rotulo, Vertice } from "./MarcoShell";

/**
 * Primeira leitura: a isca do funil. Três camadas, na ordem em que chegam.
 *   1. Leitura estrutural (custo zero, na hora): tensão parcial, Confiança, o que
 *      sustenta e o que falta.
 *   2. Leitura ao vivo: o DIT de verdade, com fontes e sinais chegando em tempo
 *      real, e no fim o teaser.
 *   3. Atrás do cadastro: relatório inteiro, nota do analista e acompanhamento.
 * Embaixo, a escada do produto, com um CTA por degrau que grava lead.
 *
 * Nenhum número nasce aqui: tudo vem do stream ou fica em estado vazio com motivo.
 */

type Interesse = "Leitura completa deste território" | "Diagnóstico completo" | "Marco Radar" | "Diagnóstico no local com a PRINT";
const INTERESSES: Interesse[] = [
  "Leitura completa deste território",
  "Diagnóstico completo",
  "Marco Radar",
  "Diagnóstico no local com a PRINT",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  "min-h-11 w-full rounded-[2px] border border-input bg-superficie px-3 text-base text-tinta placeholder:text-tinta-2";

// ─── Formatação ──────────────────────────────────────────────────────────────

function fmtValor(i: IndicadorPerfil): string {
  const n = i.valor.toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(i.valor) < 100 ? 1 : 0 });
  switch (i.unidade) {
    case "R$":
      return `R$ ${n}`;
    case "R$/hab":
      return `R$ ${n} por habitante`;
    case "pessoas":
      return `${n} pessoas`;
    default:
      return `${n} ${i.unidade}`;
  }
}

function fmtData(iso: string | null): string {
  if (!iso) return "sem data";
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

const IMPACTO: Record<"alto" | "medio" | "baixo", { rotulo: string; tom: "acento" | "neutro" | "contorno" }> = {
  alto: { rotulo: "Impacto alto", tom: "acento" },
  medio: { rotulo: "Impacto médio", tom: "neutro" },
  baixo: { rotulo: "Impacto baixo", tom: "contorno" },
};

// ─── Camada 1: estrutural ────────────────────────────────────────────────────

function PerfilTabela({ perfil }: { perfil: IndicadorPerfil[] }) {
  if (perfil.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Indicadores oficiais do município e a posição dele entre os municípios do país</caption>
        <thead>
          <tr className="text-left text-xs text-tinta-2">
            <th scope="col" className="pb-2 pr-3 font-medium">Indicador</th>
            <th scope="col" className="pb-2 pr-3 text-right font-medium">Valor</th>
            <th scope="col" className="pb-2 pr-3 font-medium">Posição no país</th>
            <th scope="col" className="pb-2 font-medium">Fonte e ano</th>
          </tr>
        </thead>
        <tbody>
          {perfil.map((i) => (
            <tr key={i.chave} className="border-t align-top">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-tinta">{i.rotulo}</th>
              <td className="num py-2 pr-3 text-right text-tinta">{fmtValor(i)}</td>
              <td className="w-[26%] min-w-[120px] py-2 pr-3">
                {i.percentil === null ? (
                  <span className="text-xs text-tinta-2">sem posição</span>
                ) : (
                  <div className="space-y-1">
                    <div
                      className="h-[6px]"
                      style={{ background: "var(--muted)" }}
                      role="img"
                      aria-label={`${i.rotulo}: maior que ${fmtInt(i.percentil)}% dos municípios`}
                    >
                      <div className="h-full" style={{ width: `${i.percentil}%`, background: "var(--tinta-2)" }} />
                    </div>
                    <span className="nota">percentil {fmtInt(i.percentil)}</span>
                  </div>
                )}
              </td>
              <td className="py-2 text-xs text-tinta-2">
                {i.fonte}
                {i.periodo && !i.fonte.includes(i.periodo) ? `, ${i.periodo}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CamadaEstrutural({ est }: { est: LeituraEstrutural }) {
  const { leitura, perfil, sustenta, falta } = est;
  const pesoFalta = Math.round(falta.reduce((a, f) => a + f.peso, 0) * 100);
  return (
    <div className="space-y-10">
      {perfil.length > 0 && (
        <Secao
          titulo="O que os dados oficiais dizem sobre o território."
          nota="Percentil 90 quer dizer valor maior que o de 90% dos municípios do país. Indicadores do IBGE, baixados em lote nacional; ler esta camada não custa coleta nem busca paga."
        >
          <PerfilTabela perfil={perfil} />
        </Secao>
      )}

      {sustenta.length > 0 && (
        <Secao
          titulo={`${sustenta.length} ${sustenta.length === 1 ? "dimensão sustenta" : "dimensões sustentam"} a tensão parcial.`}
          nota="Cada dimensão pontua pela posição do município entre os do país, sem faixa escolhida a dedo."
        >
          <ul className="divide-y border-y">
            {sustenta.map((s) => (
              <li key={s.dimensao} className="grid gap-1 py-3 md:grid-cols-[14rem_1fr] md:gap-6">
                <div>
                  <p className="text-sm font-semibold text-tinta">{s.nome}</p>
                  <p className="nota">
                    <span className="num">{fmtInt(s.score)}</span> de 100, peso <span className="num">{fmtInt(s.peso * 100)}%</span>
                  </p>
                </div>
                <p className="max-w-prose text-sm text-tinta">{s.frase}</p>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao
        titulo={
          falta.length === 0
            ? "Todas as dimensões têm base estrutural."
            : `Faltam ${falta.length} ${falta.length === 1 ? "dimensão" : "dimensões"}, ${pesoFalta}% da metodologia, para a leitura completa.`
        }
        nota={
          falta.length === 0
            ? undefined
            : "Dimensão sem evidência fica fora do cálculo. O Marco não assume valor para o que não mediu."
        }
      >
        {falta.length > 0 ? (
          <ul className="divide-y border-y">
            {falta.map((f) => (
              <li key={f.dimensao} className="grid gap-1 py-3 md:grid-cols-[14rem_1fr] md:gap-6">
                <div>
                  <p className="text-sm font-semibold text-tinta">{f.nome}</p>
                  <p className="nota">
                    peso <span className="num">{fmtInt(f.peso * 100)}%</span>, não medida
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="max-w-prose text-sm text-tinta">{f.motivo}</p>
                  <p className="nota">Olha: {f.olha}.</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tinta-2">Confiança de {fmtInt(leitura.confianca)}% pela camada estrutural.</p>
        )}
      </Secao>
    </div>
  );
}

// ─── Camada 2: ao vivo ───────────────────────────────────────────────────────

type PassoEstado = "feito" | "agora" | "espera";

interface Passo {
  id: string;
  rotulo: string;
  detalhe?: string;
  estado: PassoEstado;
}

/** Passos narrados, derivados do que o servidor já avisou. Nada avança sem um frame que o justifique. */
function passosDe(s: EstadoLeitura): Passo[] {
  const fontes = contagemFontes(s);
  const viuEtapa = (id: string) => s.etapas.some((e) => e.id === id);
  const pronta = s.fase === "pronta" || s.fase === "sem_leitura";
  const consolidou = viuEtapa("consolidacao") || viuEtapa("redacao") || pronta;
  const redigiu = viuEtapa("redacao") || s.fase === "pronta";
  const coletou = consolidou || s.doCache;

  const p: Passo[] = [
    { id: "territorio", rotulo: "Território confirmado na malha do IBGE", estado: s.municipio ? "feito" : "agora" },
    {
      id: "estrutural",
      rotulo: "Camada estrutural lida",
      detalhe: s.estrutural ? "dados oficiais, custo zero" : undefined,
      estado: s.estrutural ? "feito" : s.municipio ? "agora" : "espera",
    },
    {
      id: "fontes",
      rotulo: "Consultando fontes oficiais e imprensa",
      detalhe:
        fontes.total > 0
          ? `${fontes.ok} ${fontes.ok === 1 ? "fonte respondeu" : "fontes responderam"}${fontes.falhas > 0 ? `, ${fontes.falhas} sem resposta` : ""}`
          : undefined,
      estado: coletou ? "feito" : viuEtapa("coleta") || fontes.total > 0 ? "agora" : "espera",
    },
    {
      id: "sinais",
      rotulo: "Verificando se cada sinal é deste território",
      detalhe:
        s.sinais.length > 0
          ? `${s.sinais.length} ${s.sinais.length === 1 ? "sinal verificado" : "sinais verificados"} em ${s.dimensoes.length} ${s.dimensoes.length === 1 ? "dimensão fechada" : "dimensões fechadas"}`
          : undefined,
      estado: coletou ? "feito" : s.sinais.length > 0 || s.dimensoes.length > 0 ? "agora" : "espera",
    },
    {
      id: "consolidacao",
      rotulo: "Consolidando Tensão e Confiança",
      detalhe: s.etapas.find((e) => e.id === "consolidacao")?.detalhe,
      estado: redigiu ? "feito" : viuEtapa("consolidacao") ? "agora" : "espera",
    },
    {
      id: "sintese",
      rotulo: "Escrevendo a síntese",
      estado: s.fase === "pronta" ? "feito" : viuEtapa("redacao") ? "agora" : "espera",
    },
  ];
  return p;
}

function PassoLinha({ p }: { p: Passo }) {
  return (
    <li className="flex items-start gap-3 py-2" aria-current={p.estado === "agora" ? "step" : undefined}>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[11px]",
          p.estado === "feito" && "border-transparent bg-tinta text-background",
          p.estado === "agora" && "border-acento",
          p.estado === "espera" && "border-dashed text-tinta-2"
        )}
      >
        {p.estado === "feito" ? <Check size={12} /> : p.estado === "agora" ? <span className="h-2 w-2 bg-acento" /> : null}
      </span>
      <div className="min-w-0">
        <p className={cn("text-sm", p.estado === "espera" ? "text-tinta-2" : "font-medium text-tinta")}>
          {p.rotulo}
          <span className="sr-only">{p.estado === "feito" ? ", concluído" : p.estado === "agora" ? ", em andamento" : ", aguardando"}</span>
        </p>
        {p.detalhe && <p className="nota">{p.detalhe}</p>}
      </div>
    </li>
  );
}

function Cronometro({ ativo }: { ativo: boolean }) {
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const t = window.setInterval(() => setSeg((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [ativo]);
  return <span className="num text-xs text-tinta-2">{seg}s</span>;
}

function LeituraAoVivo({ s, recomecar }: { s: EstadoLeitura; recomecar: () => void }) {
  const reduzir = useReducedMotion();
  const rodando = !s.finalizado && (s.fase === "coletando" || s.fase === "estrutural") && s.estrutural !== null;
  const passos = useMemo(() => passosDe(s), [s]);
  const recentes = useMemo(() => [...s.sinais].reverse().slice(0, 12), [s.sinais]);
  const fontes = contagemFontes(s);
  const atual = passos.find((p) => p.estado === "agora");

  const titulo =
    s.fase === "pronta"
      ? s.doCache
        ? "A leitura de hoje já estava pronta."
        : "A leitura ao vivo terminou."
      : s.fase === "sem_leitura"
        ? "A leitura ao vivo não fechou hoje."
        : s.fase === "erro"
          ? "A leitura ao vivo não chegou ao fim."
          : "Lendo as fontes agora.";

  return (
    <Secao
      titulo={titulo}
      nota="Cada linha vem de uma fonte que respondeu agora ou na última leitura do dia. Sinal que não cita este território é descartado antes de pontuar."
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_1fr]">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-tinta-2">Etapas</p>
            {rodando && <Cronometro ativo />}
          </div>
          <ol className="divide-y border-y">
            {passos.map((p) => (
              <PassoLinha key={p.id} p={p} />
            ))}
          </ol>
          <p className="sr-only" role="status" aria-live="polite">
            {atual ? `${atual.rotulo}${atual.detalhe ? `, ${atual.detalhe}` : ""}` : ""}
          </p>
        </div>

        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-tinta-2">Sinais verificados, os mais recentes primeiro</p>
            {fontes.total > 0 && (
              <p className="nota">
                <span className="num">{fontes.ok}</span> de <span className="num">{fontes.total}</span> fontes já responderam
              </p>
            )}
          </div>
          {recentes.length === 0 ? (
            <p className="border-y py-4 text-sm text-tinta-2">
              {rodando
                ? "Nenhum sinal verificado ainda. As fontes oficiais respondem primeiro, a imprensa depois."
                : s.doCache
                  ? "Esta leitura foi reproduzida do cache do dia, sem a sequência ao vivo."
                  : "Nenhum sinal chegou nesta leitura."}
            </p>
          ) : (
            <ul className="divide-y border-y">
              <AnimatePresence initial={false}>
                {recentes.map((g) => (
                  <motion.li
                    key={`${g.fonte}|${g.titulo}|${g.data}`}
                    layout={!reduzir}
                    initial={reduzir ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduzir ? 0 : 0.18 }}
                    className="sinal-vivo"
                  >
                    <Vertice fixo />
                    <div className="min-w-0">
                    <p className="sv-t">{g.titulo}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tinta-2">
                      <span className="num">{g.dimensao}</span>
                      <span>{g.fonte}</span>
                      <span>{fmtData(g.data)}</span>
                      <Chip tom={IMPACTO[g.impacto].tom}>{IMPACTO[g.impacto].rotulo}</Chip>
                      {g.url && (
                        <a
                          href={g.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-6 items-center gap-1 underline underline-offset-2"
                        >
                          Abrir a fonte
                          <ExternalLink size={12} aria-hidden />
                          <span className="sr-only">(abre em nova aba)</span>
                        </a>
                      )}
                    </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          {s.fontes.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="min-h-9 cursor-pointer py-1.5 text-tinta-2 hover:text-tinta">
                Ver as {s.fontes.length} fontes que responderam
              </summary>
              <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {s.fontes.map((f) => (
                  <li key={`${f.dimensao}-${f.fonte}`} className="flex justify-between gap-3 text-xs">
                    <span className={f.ok ? "text-tinta" : "text-tinta-2"}>{f.nome}</span>
                    <span className="num text-tinta-2">{f.ok ? `${f.brutos} resultados` : "sem resposta"}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {s.fase === "erro" && (
            <div className="mt-4">
              <ErrorState
                motivo={s.detalhe ?? "A leitura ao vivo parou no meio."}
                proximoPasso="Tente de novo. A leitura estrutural acima continua valendo."
                onAcao={recomecar}
              />
            </div>
          )}
        </div>
      </div>
    </Secao>
  );
}

// ─── Camada 2b: o teaser ─────────────────────────────────────────────────────

function Teaser({ isca }: { isca: Isca }) {
  const id = isca.identidade;
  const forcas = (id?.forcas ?? []).filter(Boolean).slice(0, 2);
  const fragilidades = (id?.fragilidades ?? []).filter(Boolean).slice(0, 2);
  const semana = (id?.semana ?? []).filter((x) => x && x.fato);
  const temIdentidade = Boolean(id && (id.localizacao || id.conhecidoPor || id.problemaCaracteristico || forcas.length || fragilidades.length));
  const sinais = (isca.keySignalsTeaser ?? []).filter((x) => x && x.text).slice(0, 3);
  const risco = isca.forecastTeaser?.risks?.[0];
  const oportunidade = isca.forecastTeaser?.opportunity;
  const leitura = isca.leitura;

  return (
    <div className="space-y-10">
      {temIdentidade && id && (
        <Secao titulo="Quem é este território, em poucas linhas." nota="Contexto de conhecimento geral, sem número. O que foi levantado agora está em 'Nesta semana'.">
          <dl className="space-y-3 text-sm">
            {id.localizacao && (
              <div className="grid gap-1 md:grid-cols-[10rem_1fr]">
                <dt className="nota">Onde fica</dt>
                <dd className="max-w-prose text-tinta">{id.localizacao}</dd>
              </div>
            )}
            {id.conhecidoPor && (
              <div className="grid gap-1 md:grid-cols-[10rem_1fr]">
                <dt className="nota">Conhecido por</dt>
                <dd className="max-w-prose text-tinta">{id.conhecidoPor}</dd>
              </div>
            )}
            {id.problemaCaracteristico && (
              <div className="grid gap-1 md:grid-cols-[10rem_1fr]">
                <dt className="nota">Problema característico</dt>
                <dd className="max-w-prose border-l-2 pl-3 text-tinta" style={{ borderColor: "var(--tensao-4)" }}>
                  {id.problemaCaracteristico}
                </dd>
              </div>
            )}
            {(forcas.length > 0 || fragilidades.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {forcas.length > 0 && (
                  <div>
                    <dt className="nota">Forças</dt>
                    <dd>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-tinta">
                        {forcas.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
                {fragilidades.length > 0 && (
                  <div>
                    <dt className="nota">Fragilidades</dt>
                    <dd>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-tinta">
                        {fragilidades.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-1 md:grid-cols-[10rem_1fr]">
              <dt className="nota">Nesta semana</dt>
              <dd className="text-tinta">
                {semana.length > 0 ? (
                  <ul className="space-y-1">
                    {semana.map((x, i) => (
                      <li key={i}>
                        {x.fato} <span className="nota">{[x.fonte, x.data].filter(Boolean).join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-tinta-2">Nenhum fato novo captado nos últimos 30 dias.</span>
                )}
              </dd>
            </div>
          </dl>
        </Secao>
      )}

      {isca.executiveSummaryTeaser?.trim() && (
        <Secao titulo="A síntese, em um parágrafo." nota="Primeiro parágrafo da síntese executiva. A síntese inteira fica no diagnóstico completo.">
          <p className="max-w-prose whitespace-pre-line text-tinta">{isca.executiveSummaryTeaser.trim()}</p>
        </Secao>
      )}

      {leitura && leitura.dimensoes.length > 0 && (
        <Secao
          titulo="As dimensões que mais pesam vêm primeiro."
          nota="Dimensão não medida fica fora do cálculo, sem valor assumido."
        >
          <DimensoesTable dimensoes={leitura.dimensoes} />
        </Secao>
      )}

      {(sinais.length > 0 || risco || oportunidade) && (
        <Secao titulo="O que merece sua atenção primeiro.">
          <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="mb-1 text-xs font-medium text-tinta-2">
                {sinais.length > 0 ? `${sinais.length} ${sinais.length === 1 ? "sinal-chave" : "sinais-chave"}` : "Sinais-chave"}
              </p>
              {sinais.length > 0 ? (
                <ul className="divide-y border-y">
                  {sinais.map((g, i) => (
                    <li key={i} className="space-y-1 py-2.5">
                      <p className="text-sm text-tinta">{g.text}</p>
                      <p className="nota">
                        {[g.dimension, g.source, g.status].filter(Boolean).join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-y py-4 text-sm text-tinta-2">Nenhum sinal real passou na verificação. O Marco não completa a lista com sinal plausível.</p>
              )}
            </div>
            <div className="space-y-5">
              {risco && (
                <div className="border-l-2 pl-3" style={{ borderColor: "var(--tensao-5)" }}>
                  <p className="text-xs font-medium text-tinta-2">Um risco{isca.forecastTeaser?.horizon ? `, ${isca.forecastTeaser.horizon}` : ""}</p>
                  <p className="mt-1 text-sm text-tinta">{risco}</p>
                </div>
              )}
              {oportunidade && (
                <div className="border-l-2 pl-3" style={{ borderColor: "var(--tensao-1)" }}>
                  <p className="text-xs font-medium text-tinta-2">Uma oportunidade</p>
                  <p className="mt-1 text-sm text-tinta">{oportunidade}</p>
                </div>
              )}
            </div>
          </div>
        </Secao>
      )}
    </div>
  );
}

// ─── Sem leitura: desfechos honestos ─────────────────────────────────────────

function SemLeitura({ s, recomecar, pedir }: { s: EstadoLeitura; recomecar: () => void; pedir: (i: Interesse) => void }) {
  const f = s.semLeitura;
  if (!f) return null;
  const nome = nomeExibido(s.municipio);
  if (f.motivo === "teto") {
    const porIp = f.extra?.causa === "limite_ip";
    return (
      <EmptyState
        titulo={porIp ? "Você já pediu leituras novas demais nesta hora." : "A leitura completa de hoje esgotou."}
        descricao={
          porIp
            ? "Para manter a leitura gratuita para todos, cada pessoa pode pedir poucas leituras novas por hora. A leitura estrutural acima segue valendo. Deixe seu e-mail e um analista da PRINT envia a leitura completa deste território."
            : `O Marco lê poucos territórios novos por dia para não entregar leitura com base fraca. ${nome ? `A leitura estrutural de ${nome} acima segue valendo. ` : ""}Deixe seu e-mail e um analista da PRINT envia a leitura completa deste território.`
        }
        acao="Pedir a leitura completa"
        onAcao={() => pedir("Leitura completa deste território")}
      />
    );
  }
  if (f.motivo === "cobertura_insuficiente") {
    const cob = typeof f.extra?.cobertura === "number" ? Math.round(f.extra.cobertura * 100) : null;
    const min = typeof f.extra?.minimo === "number" ? Math.round(f.extra.minimo * 100) : null;
    return (
      <EmptyState
        titulo="Ainda não há fonte suficiente para emitir a leitura completa."
        descricao={`${cob !== null && min !== null ? `${cob}% das fontes responderam, e o mínimo para emitir é ${min}%. ` : ""}O Marco não escreve leitura de memória quando falta dado. O território entrou na fila de coleta, e a leitura estrutural acima segue valendo.`}
        acao="Pedir a leitura completa"
        onAcao={() => pedir("Leitura completa deste território")}
      />
    );
  }
  if (f.motivo === "sob_demanda") {
    return (
      <EmptyState
        titulo="Este território é lido sob demanda."
        descricao="A coleta dedicada e a publicação analisada são feitas por um analista da PRINT. A leitura estrutural acima já está disponível."
        acao="Pedir a leitura completa"
        onAcao={() => pedir("Leitura completa deste território")}
      />
    );
  }
  return (
    <ErrorState
      motivo={f.motivo === "coleta_falhou" ? "A malha de fontes não respondeu a tempo para este território." : f.detalhe}
      proximoPasso="Tente de novo em alguns minutos. A leitura estrutural acima continua valendo."
      onAcao={recomecar}
    />
  );
}

// ─── Camada 3: captura e escada ──────────────────────────────────────────────

function situacaoDe(s: EstadoLeitura): string {
  if (s.fase === "pronta") return "teaser entregue";
  if (s.fase === "sem_leitura" && s.semLeitura) {
    if (s.semLeitura.motivo === "teto") return s.semLeitura.extra?.causa === "limite_ip" ? "limite por pessoa" : "teto de leituras do dia";
    return s.semLeitura.motivo.replace(/_/g, " ");
  }
  if (s.fase === "erro") return "leitura ao vivo interrompida";
  return "leitura em andamento";
}

function CapturaLead({
  s,
  interesse,
  setInteresse,
  campoRef,
}: {
  s: EstadoLeitura;
  interesse: Interesse;
  setInteresse: (i: Interesse) => void;
  campoRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [decisao, setDecisao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [envio, setEnvio] = useState<{ tipo: "idle" } | { tipo: "enviando" } | { tipo: "ok" } | { tipo: "erro"; motivo: string }>({ tipo: "idle" });
  const territorio = s.municipio?.consulta ?? s.municipio?.nome ?? "";

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (envio.tipo === "enviando") return;
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Informe seu nome.";
    if (!email.trim()) e.email = "Informe seu e-mail.";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Use um e-mail completo, como nome@empresa.com.br.";
    if (!empresa.trim()) e.empresa = "Informe a empresa.";
    setErros(e);
    if (Object.keys(e).length > 0) {
      document.getElementById(`leitura-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    setEnvio({ tipo: "enviando" });
    try {
      await enviarLead({
        email: email.trim(),
        nome: nome.trim(),
        empresa: empresa.trim(),
        territorio: territorio || undefined,
        decisao: decisao.trim() || undefined,
        observacao: observacaoDoLead({ interesse, situacao: situacaoDe(s) }),
      });
      setEnvio({ tipo: "ok" });
    } catch (err) {
      setEnvio({ tipo: "erro", motivo: err instanceof Error ? err.message : "Não conseguimos enviar. Tente de novo." });
    }
  }

  if (envio.tipo === "ok") {
    return (
      <div role="status" className="space-y-2 border p-6">
        <p className="text-lg font-semibold text-tinta">Pedido recebido.</p>
        <p className="max-w-prose text-sm text-tinta">
          Um analista da PRINT responde no e-mail informado{territorio ? `, com o que falta sobre ${territorio}` : ""}. Enquanto isso, a leitura acima fica nesta página.
        </p>
      </div>
    );
  }

  const campo = (id: "nome" | "email" | "empresa", rotulo: string, props: React.InputHTMLAttributes<HTMLInputElement>, valor: string, set: (v: string) => void) => (
    <div className="space-y-1.5">
      <label htmlFor={`leitura-${id}`} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>
      <input
        id={`leitura-${id}`}
        ref={id === "nome" ? campoRef : undefined}
        className={inputCls}
        value={valor}
        onChange={(e) => {
          set(e.target.value);
          if (erros[id]) setErros((x) => ({ ...x, [id]: "" }));
        }}
        aria-invalid={erros[id] ? true : undefined}
        aria-describedby={erros[id] ? `leitura-${id}-erro` : undefined}
        {...props}
      />
      {erros[id] && (
        <p id={`leitura-${id}-erro`} className="text-sm" style={{ color: "var(--tensao-5)" }}>
          {erros[id]}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Pedir o restante da leitura">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-tinta">O que você quer receber</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {INTERESSES.map((i) => (
            <label
              key={i}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 border px-3 text-sm text-tinta",
                interesse === i ? "border-acento bg-muted" : "hover:bg-muted"
              )}
            >
              <input type="radio" name="interesse" value={i} checked={interesse === i} onChange={() => setInteresse(i)} />
              {i}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        {campo("nome", "Seu nome", { autoComplete: "name", maxLength: 120 }, nome, setNome)}
        {campo("email", "E-mail de trabalho", { type: "email", autoComplete: "email", maxLength: 320, inputMode: "email" }, email, setEmail)}
        {campo("empresa", "Empresa", { autoComplete: "organization", maxLength: 160 }, empresa, setEmpresa)}
        <div className="space-y-1.5">
          <label htmlFor="leitura-decisao" className="text-sm font-medium text-tinta">
            Que decisão esta leitura apoia? <span className="nota">(opcional)</span>
          </label>
          <input
            id="leitura-decisao"
            className={inputCls}
            value={decisao}
            maxLength={500}
            placeholder="Entrar, operar ou responder neste território"
            onChange={(e) => setDecisao(e.target.value)}
          />
        </div>
      </div>
      {envio.tipo === "erro" && (
        <p role="alert" className="text-sm" style={{ color: "var(--tensao-5)" }}>
          {envio.motivo}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={envio.tipo === "enviando"}>
          {envio.tipo === "enviando" ? "Enviando" : "Pedir o restante da leitura"}
        </Button>
        <p className="nota">Só usamos seus dados para responder este pedido.</p>
      </div>
    </form>
  );
}

const DEGRAUS: Array<{ id: string; titulo: string; texto: string; acao: string; interesse: Interesse | null }> = [
  {
    id: "leitura",
    titulo: "Leitura gratuita",
    texto: "Tensão, Confiança e os sinais do dia deste território. É o que você acabou de ler.",
    acao: "",
    interesse: null,
  },
  {
    id: "diagnostico",
    titulo: "Diagnóstico completo",
    texto: "Todas as dimensões com insight, recomendações, previsão e a nota do analista.",
    acao: "Pedir o diagnóstico completo",
    interesse: "Diagnóstico completo",
  },
  {
    id: "radar",
    titulo: "Marco Radar",
    texto: "Acompanhamento diário do território, com alerta quando a tensão muda.",
    acao: "Pedir o Marco Radar",
    interesse: "Marco Radar",
  },
  {
    id: "local",
    titulo: "Diagnóstico no local",
    texto: "A PRINT vai ao território e confirma no campo o que os dados indicam.",
    acao: "Pedir o diagnóstico no local",
    interesse: "Diagnóstico no local com a PRINT",
  },
];

function Escada({ pedir }: { pedir: (i: Interesse) => void }) {
  return (
    <section className="secao-l escada" aria-labelledby="escada-t">
      <Rotulo>O que vem depois</Rotulo>
      <h2 id="escada-t" className="titulo-l">Do que você acabou de ler até a decisão em campo.</h2>
      <ol className="degraus">
        {DEGRAUS.map((d, i) => (
          <li key={d.id} className={d.interesse === null ? "aqui" : ""}>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <h3>{d.titulo}</h3>
            <p>{d.texto}</p>
            {d.interesse ? <Acao onClick={() => pedir(d.interesse!)}>{d.acao.replace(/^Pedir o /, "Pedir ")}</Acao> : <span className="voce-aqui"><Vertice fixo />Você está aqui</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A Tensão no topo escuro: número grande, faixa possível, ponto do valor, Confiança. */
function TensaoGrande({ tensao, faixa, confianca, completa }: { tensao: number; faixa: { min: number; max: number }; confianca: number; completa: boolean }) {
  const rotulo = faixaDeTensao(tensao).rotulo;
  return (
    <div className="tensao-g">
      <div className="tg-num"><strong data-mo="count">{fmtInt(tensao)}</strong><span>{completa ? "Tensão" : "Tensão parcial"}<b>{rotulo}</b></span></div>
      <div className="tg-barra" role="img" aria-label={`Tensão ${fmtInt(tensao)} de 100, faixa possível de ${fmtInt(faixa.min)} a ${fmtInt(faixa.max)}, confiança ${fmtInt(confianca)}%`}>
        <span className="faixa" style={{ left: `${faixa.min}%`, width: `${Math.max(0, faixa.max - faixa.min)}%` }} />
        <span className="ponto" style={{ left: `${tensao}%` }} />
        <span className="escala">{[0, 20, 40, 60, 80, 100].map(n => <i key={n} style={{ left: `${n}%` }}>{n}</i>)}</span>
      </div>
      <p className="tg-nota">Faixa possível <b>{fmtInt(faixa.min)} a {fmtInt(faixa.max)}</b>. Confiança <b>{fmtInt(confianca)}%</b>{completa ? "." : ": só as dimensões com dado oficial entram na conta."}</p>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

function tituloDa(s: EstadoLeitura): string {
  const nome = nomeExibido(s.municipio);
  const { leitura, completa } = leituraPrincipal(s);
  switch (s.fase) {
    case "ambiguo":
      return "Existe mais de um território com esse nome.";
    case "nao_encontrado":
      return "Não achamos este território.";
    case "conectando":
      return "Procurando o território.";
    default:
      break;
  }
  if (!nome) return s.fase === "erro" ? "A leitura não carregou." : "Procurando o território.";
  if (!leitura) return `${nome}: lendo a base estrutural.`;
  if (leitura.tensao === null) return `${nome}: sem dimensão medida, então sem número.`;
  const faixa = faixaDeTensao(leitura.tensao).rotulo.toLowerCase();
  return completa
    ? `${nome}: tensão ${fmtInt(leitura.tensao)}, faixa ${faixa}, confiança ${fmtInt(leitura.confianca)}%.`
    : `${nome}: tensão parcial ${fmtInt(leitura.tensao)}, medida em ${fmtInt(leitura.confianca)}% da metodologia.`;
}

function Opcoes({ s }: { s: EstadoLeitura }) {
  const itens: Array<{ chave: string; rotulo: string; to: string }> =
    s.fase === "ambiguo"
      ? s.opcoes.map((o) => ({
          chave: String(o.ibgeId ?? o.consulta ?? `${o.nome}${o.uf}`),
          rotulo: `${o.nome}, ${o.uf}`,
          to: `/leitura/${o.slug ?? o.ibgeId ?? encodeURIComponent(o.consulta ?? o.nome)}`,
        }))
      : s.sugestoes.map((m: Municipio) => ({ chave: m.ibgeId, rotulo: m.uf ? `${m.nome}, ${m.uf}` : m.nome, to: `/leitura/${m.slug}` }));
  if (itens.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {itens.map((i) => (
        <li key={i.chave}>
          <Link href={i.to} className={botaoVariants({ variant: "secundario", size: "md" })}>
            {i.rotulo}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function PublicoLeitura() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { estado: s, recomecar } = useLeituraAoVivo(slug || null);
  const [interesse, setInteresse] = useState<Interesse>("Leitura completa deste território");
  const formRef = useRef<HTMLElement>(null);
  const primeiroCampo = useRef<HTMLInputElement>(null);
  const reduzir = useReducedMotion();

  // Título da aba acompanha a leitura.
  useEffect(() => {
    const nome = nomeExibido(s.municipio);
    document.title = nome ? `${nome}: primeira leitura | Marco` : "Primeira leitura | Marco";
  }, [s.municipio]);

  function pedir(i: Interesse) {
    setInteresse(i);
    formRef.current?.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => primeiroCampo.current?.focus({ preventScroll: true }), reduzir ? 0 : 350);
  }

  const { leitura, completa } = leituraPrincipal(s);
  const semTerritorio = s.fase === "ambiguo" || s.fase === "nao_encontrado";
  const aguardaEstrutural = !s.estrutural && !semTerritorio && s.fase !== "erro";
  // A camada ao vivo aparece quando a leitura começou; num teto ou numa falha sem nenhum sinal, só o aviso honesto.
  const aconteceuAlgo = s.fontes.length > 0 || s.sinais.length > 0 || s.etapas.length > 0;
  const mostraAoVivo =
    s.fase === "coletando" || s.fase === "pronta" || (s.fase === "erro" && aconteceuAlgo) || (s.fase === "sem_leitura" && aconteceuAlgo);

  return (
    <MarcoPagina dep={s.fase}>
      <section className="hero hero-leitura">
        <img className="fundo" src="/arte/relevo-hero.jpg" alt="" aria-hidden="true" fetchPriority="high" />
        <div className="veu" />
        <div className="largura">
          <div className="selos">
            <span className="selo"><Vertice fixo={s.fase === "pronta"} />Primeira leitura</span>
            {s.fase === "coletando" && <span className="selo vivo"><i />Leitura ao vivo em andamento</span>}
            {s.noRadar && s.estrutural && <span className="selo">No Marco Radar</span>}
          </div>
          <h1 aria-live="polite">{tituloDa(s)}</h1>
          {semTerritorio && (
            <div className="sem-territorio">
              <p>{s.detalhe}</p>
              <Opcoes s={s} />
              <div className="busca"><BuscaLeitura variante="compacta" /></div>
            </div>
          )}
          {aguardaEstrutural && <div className="carregando-escuro"><span /><span /><span /><p>Lendo a base estrutural do território</p></div>}
          {leitura && !semTerritorio && (leitura.tensao !== null ? (
            <TensaoGrande
              key={`${completa ? "completa" : "parcial"}-${leitura.tensao}-${leitura.confianca}`}
              tensao={leitura.tensao} faixa={leitura.faixa} confianca={leitura.confianca} completa={completa}
            />
          ) : (
            <p className="sem-numero">Sem número, de propósito: este município não tem indicador oficial na camada estrutural, e o Marco não preenche o vazio com um valor assumido.</p>
          ))}
        </div>
      </section>

      <div className="largura corpo-leitura">
        {s.fase === "erro" && (!s.estrutural || !aconteceuAlgo) && (
          <ErrorState motivo={s.detalhe ?? "A leitura não carregou."} proximoPasso="Confira a internet e tente de novo." onAcao={recomecar} />
        )}
        {s.estrutural && !semTerritorio && <section className="secao-l"><CamadaEstrutural est={s.estrutural} /></section>}
      </div>

      {s.estrutural && !semTerritorio && mostraAoVivo && (
        <section className="escuro palco"><div className="largura"><LeituraAoVivo s={s} recomecar={recomecar} /></div></section>
      )}

      <div className="largura corpo-leitura">
        {s.fase === "pronta" && s.teaser && <section className="secao-l"><Teaser isca={s.teaser} /></section>}
        {s.fase === "sem_leitura" && <section className="secao-l"><SemLeitura s={s} recomecar={recomecar} pedir={pedir} /></section>}
      </div>

      {s.estrutural && !semTerritorio && (
        <section ref={formRef} id="pedir" aria-labelledby="pedir-titulo" className="escuro pedir-l">
          <img className="fundo" src="/arte/relevo-cta.jpg" alt="" aria-hidden="true" />
          <div className="largura grade2">
            <div>
              <Rotulo>O restante da leitura</Rotulo>
              <h2 id="pedir-titulo" className="titulo-l">O restante fica atrás de um pedido.</h2>
              <ul className="travado">
                {["Relatório completo, com insight, recomendações e previsão por dimensão", "Nota do analista sobre o território", "Acompanhamento diário, com alerta quando a tensão muda"].map((t) => (
                  <li key={t}><Lock size={16} aria-hidden />{t}</li>
                ))}
              </ul>
            </div>
            <div className="form-claro"><CapturaLead s={s} interesse={interesse} setInteresse={setInteresse} campoRef={primeiroCampo} /></div>
          </div>
        </section>
      )}

      <div className="largura corpo-leitura">
        {s.estrutural && !semTerritorio && <Escada pedir={pedir} />}
        {!semTerritorio && (
          <section aria-labelledby="outra-titulo" className="secao-l outra">
            <h2 id="outra-titulo" className="titulo-l pequeno">Quer ler outro território?</h2>
            <div className="busca"><BuscaLeitura variante="compacta" /></div>
          </section>
        )}
      </div>
    </MarcoPagina>
  );
}
