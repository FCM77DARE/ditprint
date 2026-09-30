import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Secao,
  Sparkline,
} from "@/components/dit";
import { PortalFrame, LinkBotao } from "./PortalFrame";
import {
  NOME_DIMENSAO,
  fmtDataHora,
  useAlertasPortal,
  useTerritoriosPortal,
  type AlertaPortal,
  type TerritorioPortal,
} from "./dados";
import { ConfiancaTexto, DeltaTexto, ImpactoBarra, TensaoLinha, fmtDelta1 } from "./pecas";

type Filtro = "todos" | "mudaram";

/** Frase-conclusao gerada por regra (codigo, nao LLM) a partir dos deltas. */
export function fraseHoje(itens: TerritorioPortal[]): string {
  const total = itens.length;
  const medidos = itens.filter(t => t.delta !== null);
  if (medidos.length === 0) {
    return `Ainda não há publicação de 7 dias atrás para comparar nos seus ${total} ${total === 1 ? "território" : "territórios"}.`;
  }
  const maior = [...medidos].sort((a, b) => Math.abs(b.delta as number) - Math.abs(a.delta as number))[0];
  const maiorAbs = Math.abs(maior.delta as number);
  const mudaram = itens.filter(t => t.mudouDeFaixa).length;
  const seus = total === 1 ? "do seu território" : `dos seus ${total} territórios`;
  if (mudaram > 0) {
    const verbo = mudaram === 1 ? "mudou" : "mudaram";
    return `${mudaram} ${seus} ${verbo} de faixa em 7 dias; o maior movimento é ${maior.nome} (${fmtDelta1(maior.delta)} pontos).`;
  }
  if (maiorAbs >= 1) {
    return `Nenhum ${total === 1 ? "território" : `dos seus ${total} territórios`} mudou de faixa em 7 dias; o maior movimento é ${maior.nome} (${fmtDelta1(maior.delta)} pontos).`;
  }
  return `Nada relevante mudou ${total === 1 ? "no seu território" : `nos seus ${total} territórios`} em 7 dias.`;
}

function CabecalhoOrdenacao() {
  return (
    <tr className="text-left text-xs text-tinta-2">
      <th scope="col" className="pb-2 pr-4 font-medium">Território</th>
      <th scope="col" className="pb-2 pr-4 font-medium">Tensão (0 a 100)</th>
      <th scope="col" className="pb-2 pr-4 text-right font-medium">7 dias</th>
      <th scope="col" className="pb-2 pr-4 text-right font-medium">30 dias</th>
      <th scope="col" className="pb-2 pr-4 font-medium">Tendência</th>
      <th scope="col" className="pb-2 pr-4 text-right font-medium">Confiança</th>
      <th scope="col" className="pb-2 font-medium">Último alerta</th>
    </tr>
  );
}

function ultimoAlertaDe(slug: string, alertas: AlertaPortal[]): AlertaPortal | undefined {
  return alertas.find(a => a.slug === slug);
}

function TabelaTerritorios({ itens, alertas }: { itens: TerritorioPortal[]; alertas: AlertaPortal[] }) {
  return (
    <>
      {/* Tabela a partir de 768px */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse">
          <caption className="sr-only">Seus territórios, ordenados pelo maior movimento</caption>
          <thead>
            <CabecalhoOrdenacao />
          </thead>
          <tbody>
            {itens.map(t => {
              const ult = ultimoAlertaDe(t.slug, alertas);
              return (
                <tr key={t.slug} className="border-t text-sm hover:bg-muted">
                  <th scope="row" className="py-2 pr-4 text-left font-medium text-tinta">
                    <Link
                      href={`/portal/territorio/${t.slug}`}
                      className="inline-flex min-h-11 items-center gap-1 hover:underline"
                    >
                      {t.nome}
                      <ChevronRight size={14} aria-hidden className="text-tinta-2" />
                      <span className="sr-only">: abrir leitura do território</span>
                    </Link>
                    {t.mudouDeFaixa && <span className="nota ml-1">mudou de faixa</span>}
                  </th>
                  <td className="py-2 pr-4">
                    <TensaoLinha leitura={t.leitura} />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <DeltaTexto valor={t.delta7} />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <DeltaTexto valor={t.delta30} />
                  </td>
                  <td className="py-2 pr-4">
                    <Sparkline valores={t.serie} largura={96} altura={28} rotulo={`Tensão de ${t.nome}`} />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <ConfiancaTexto leitura={t.leitura} />
                  </td>
                  <td className="py-2 text-sm text-tinta-2">
                    {ult ? <span className="num">{fmtDataHora(ult.enviadoEm)}</span> : "nenhum"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lista de linhas abaixo de 768px (375px primeiro) */}
      <ul className="divide-y border-y md:hidden" aria-label="Seus territórios, ordenados pelo maior movimento">
        {itens.map(t => {
          const ult = ultimoAlertaDe(t.slug, alertas);
          return (
            <li key={t.slug}>
              <Link
                href={`/portal/territorio/${t.slug}`}
                className="block min-h-11 space-y-2 py-3"
                aria-label={`${t.nome}: abrir leitura do território`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-tinta">{t.nome}</span>
                  <span className="flex items-baseline gap-2">
                    <DeltaTexto valor={t.delta7} />
                    <ChevronRight size={14} aria-hidden className="self-center text-tinta-2" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <TensaoLinha leitura={t.leitura} />
                  <Sparkline valores={t.serie} largura={64} altura={24} rotulo={`Tensão de ${t.nome}`} />
                </div>
                <p className="nota">
                  30 dias <DeltaTexto valor={t.delta30} />
                  {" · "}
                  Confiança <ConfiancaTexto leitura={t.leitura} />
                  {" · "}
                  Último alerta {ult ? fmtDataHora(ult.enviadoEm) : "nenhum"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function AlertasDoDia({ alertas }: { alertas: AlertaPortal[] }) {
  const corte = Date.now() - 24 * 60 * 60 * 1000;
  const lista = alertas.filter(a => a.enviadoEm.getTime() >= corte).slice(0, 5);
  if (lista.length === 0) {
    return (
      <EmptyState
        titulo="Nenhum alerta nas últimas 24 horas"
        descricao="Alerta dispara quando um sinal passa de impacto 0,7 nos seus territórios."
      />
    );
  }
  return (
    <ul className="divide-y border-y">
      {lista.map(a => (
        <li key={a.id} className="grid gap-x-4 gap-y-1 py-3 text-sm md:grid-cols-[72px_160px_1fr_auto]">
          <span className="num text-tinta-2">
            {a.enviadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="text-tinta">
            {a.territorio}
            <span className="nota block">{a.dimensao ? NOME_DIMENSAO[a.dimensao] : "Geral"}</span>
          </span>
          <span className="text-tinta">{a.titulo}</span>
          <ImpactoBarra valor={a.impacto} />
        </li>
      ))}
    </ul>
  );
}

export default function PortalHoje() {
  return (
    <PortalFrame titulo="Hoje">
      {() => <ConteudoHoje />}
    </PortalFrame>
  );
}

function ConteudoHoje() {
  const { itens, carregando, erro, erroHistorico, recarregar, atualizadoEm } = useTerritoriosPortal();
  const { alertas } = useAlertasPortal(itens, 20);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const visiveis = useMemo(
    () => (filtro === "mudaram" ? itens.filter(t => t.mudouDeFaixa) : itens),
    [itens, filtro]
  );
  const destaque = itens.find(t => t.nota);

  if (carregando) {
    return (
      <div className="space-y-6">
        <p className="font-display text-2xl text-tinta-2">Carregando seus territórios...</p>
        <LoadingBlock linhas={3} rotulo="Carregando seus territórios" />
      </div>
    );
  }

  if (erro) {
    return (
      <ErrorState
        motivo="Não carregamos seus territórios."
        proximoPasso="Tente de novo; se continuar, fale com o time PRINT."
        onAcao={recarregar}
      />
    );
  }

  if (itens.length === 0) {
    return (
      <EmptyState
        titulo="Você ainda não tem territórios no Radar"
        descricao="Escolha os seus com o time PRINT. Assim que um território for publicado, ele aparece aqui."
        acao="Falar com a PRINT"
        onAcao={() => {
          window.location.href = "/#pedir-diagnostico";
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="max-w-[60ch] font-display text-xl font-semibold leading-snug text-tinta md:text-2xl">
          {fraseHoje(itens)}
        </p>
        <p className="nota">
          {atualizadoEm
            ? `Atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. `
            : ""}
          Variação contra a última publicação de 7 e 30 dias atrás; sem publicação tão antiga, mostramos "sem base".
        </p>
      </div>

      <Secao titulo="Seus territórios, do maior movimento ao menor">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtro da tabela">
          <Button
            variant={filtro === "todos" ? "primario" : "secundario"}
            size="sm"
            aria-pressed={filtro === "todos"}
            onClick={() => setFiltro("todos")}
          >
            Todos
          </Button>
          <Button
            variant={filtro === "mudaram" ? "primario" : "secundario"}
            size="sm"
            aria-pressed={filtro === "mudaram"}
            onClick={() => setFiltro("mudaram")}
          >
            Só os que mudaram de faixa
          </Button>
          <span className="nota">
            Mostrando {visiveis.length} de {itens.length}
          </span>
        </div>
        {erroHistorico && (
          <p className="nota" role="status">
            Não carregamos o histórico de alguns territórios; a tendência pode aparecer incompleta.
          </p>
        )}
        {visiveis.length === 0 ? (
          <EmptyState
            titulo="Nenhum território mudou de faixa"
            descricao="A tabela estável também é resposta: nada atravessou uma fronteira de faixa desde a leitura anterior."
            acao="Ver todos"
            onAcao={() => setFiltro("todos")}
          />
        ) : (
          <TabelaTerritorios itens={visiveis} alertas={alertas} />
        )}
      </Secao>

      <Secao titulo="O que chegou nas últimas 24 horas" nota="Alertas de impacto 0,7 ou mais nos seus territórios.">
        <AlertasDoDia alertas={alertas} />
        <p className="nota">
          {/* TODO backend B3: link para a fonte do sinal e filtro por assinante (portal.hoje). */}
          Atualiza sozinho a cada 5 minutos.
        </p>
      </Secao>

      {destaque && (
        <Secao
          titulo={`Nota executiva: ${destaque.nome}`}
          nota={
            [
              destaque.notaPeriodo ? `Período ${destaque.notaPeriodo}` : null,
              destaque.publicadoPor ? `publicada por ${destaque.publicadoPor}` : null,
            ]
              .filter(Boolean)
              .join(", ") || undefined
          }
        >
          <p className="line-clamp-3 max-w-[70ch] text-sm text-tinta">{destaque.nota}</p>
          <LinkBotao href={`/portal/territorio/${destaque.slug}`}>Ler nota completa</LinkBotao>
        </Secao>
      )}
    </div>
  );
}
