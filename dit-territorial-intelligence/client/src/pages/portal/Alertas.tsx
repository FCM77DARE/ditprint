import { useMemo, useState } from "react";
import { Check, Eye, TriangleAlert, type LucideIcon } from "lucide-react";
import { EmptyState, ErrorState, LoadingBlock, Secao } from "@/components/dit";
import { LinkBotao, PortalFrame } from "./PortalFrame";
import {
  NOME_CANAL,
  NOME_DIMENSAO,
  fmtDataHora,
  useAlertasPortal,
  useTerritoriosPortal,
  type AlertaPortal,
} from "./dados";
import { ImpactoBarra } from "./pecas";

type FiltroImpacto = "todos" | "imediato";

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

function statusDe(a: AlertaPortal): { rotulo: string; Icone: LucideIcon } {
  if (a.erro || (!a.entregue && !a.aberto)) return { rotulo: "Falhou", Icone: TriangleAlert };
  if (a.aberto) return { rotulo: "Aberto", Icone: Eye };
  return { rotulo: "Entregue", Icone: Check };
}

function StatusAlerta({ alerta }: { alerta: AlertaPortal }) {
  const { rotulo, Icone } = statusDe(alerta);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-tinta">
      <Icone size={14} aria-hidden />
      {rotulo}
    </span>
  );
}

const CAMPO =
  "min-h-11 rounded-[2px] border border-tinta-2 bg-transparent px-3 text-sm text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]";

export default function PortalAlertas() {
  return (
    <PortalFrame titulo="Alertas">
      {() => <ConteudoAlertas />}
    </PortalFrame>
  );
}

function ConteudoAlertas() {
  const territorios = useTerritoriosPortal();
  const { alertas, carregando, erro, recarregar } = useAlertasPortal(territorios.itens, 50);
  const [slug, setSlug] = useState("todos");
  const [impacto, setImpacto] = useState<FiltroImpacto>("todos");

  const dos7dias = useMemo(() => {
    const corte = Date.now() - SETE_DIAS;
    return alertas.filter(a => a.enviadoEm.getTime() >= corte);
  }, [alertas]);

  const filtrados = useMemo(
    () =>
      dos7dias.filter(
        a => (slug === "todos" || a.slug === slug) && (impacto === "todos" || (a.impacto ?? 0) >= 0.7)
      ),
    [dos7dias, slug, impacto]
  );

  if (territorios.carregando || (carregando && alertas.length === 0)) {
    return (
      <div className="space-y-6">
        <p className="font-display text-2xl text-tinta-2">Carregando seus alertas...</p>
        <LoadingBlock linhas={4} rotulo="Carregando seus alertas" />
      </div>
    );
  }
  if (territorios.erro || erro) {
    return (
      <ErrorState
        motivo="Não carregamos seus alertas."
        proximoPasso="Tente de novo; se continuar, fale com o time PRINT."
        onAcao={() => {
          territorios.recarregar();
          recarregar();
        }}
      />
    );
  }

  const naoAbertos = dos7dias.filter(a => !a.aberto).length;
  // alertLog.recent exige sessao e so responde para territorios do contrato; o registro e por territorio.

  return (
    <div className="space-y-6">
      <p className="max-w-[60ch] font-display text-xl font-semibold leading-snug text-tinta md:text-2xl">
        {dos7dias.length === 0
          ? "Nenhum alerta nos últimos 7 dias."
          : `Seus territórios dispararam ${dos7dias.length} ${dos7dias.length === 1 ? "alerta" : "alertas"} nos últimos 7 dias; ${naoAbertos} ${naoAbertos === 1 ? "ainda não foi aberto" : "ainda não foram abertos"}.`}
      </p>

      {dos7dias.length === 0 ? (
        <EmptyState
          titulo="Nenhum alerta nos últimos 7 dias"
          descricao="Alerta dispara quando um sinal passa de impacto 0,7 nos seus territórios."
        />
      ) : (
        <Secao titulo="Histórico de alertas, do mais recente ao mais antigo">
          <form
            className="flex flex-wrap items-end gap-4"
            aria-label="Filtros dos alertas"
            onSubmit={e => e.preventDefault()}
          >
            <label className="flex flex-col gap-1 text-xs text-tinta-2">
              Território
              <select className={CAMPO} value={slug} onChange={e => setSlug(e.target.value)}>
                <option value="todos">Todos os territórios</option>
                {territorios.itens.map(t => (
                  <option key={t.slug} value={t.slug}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-tinta-2">
              Impacto
              <select
                className={CAMPO}
                value={impacto}
                onChange={e => setImpacto(e.target.value as FiltroImpacto)}
              >
                <option value="todos">Todos os impactos</option>
                <option value="imediato">Só alerta imediato (0,70 ou mais)</option>
              </select>
            </label>
            <p className="nota pb-3" role="status">
              Mostrando {filtrados.length} de {dos7dias.length}
            </p>
          </form>

          {filtrados.length === 0 ? (
            <EmptyState
              titulo="Nenhum alerta com esses filtros"
              descricao="Mude o território ou o impacto para ver os demais alertas dos últimos 7 dias."
              acao="Limpar filtros"
              onAcao={() => {
                setSlug("todos");
                setImpacto("todos");
              }}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse">
                  <caption className="sr-only">Alertas dos últimos 7 dias</caption>
                  <thead>
                    <tr className="text-left text-xs text-tinta-2">
                      <th scope="col" className="pb-2 pr-4 font-medium">Território</th>
                      <th scope="col" className="pb-2 pr-4 font-medium">Sinal</th>
                      <th scope="col" className="pb-2 pr-4 font-medium">Dimensão</th>
                      <th scope="col" className="pb-2 pr-4 font-medium">Impacto</th>
                      <th scope="col" className="pb-2 pr-4 font-medium">Canal</th>
                      <th scope="col" className="pb-2 pr-4 font-medium">Situação</th>
                      <th scope="col" className="pb-2 font-medium">Enviado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(a => (
                      <tr key={a.id} className="border-t align-top text-sm">
                        <th scope="row" className="py-2 pr-4 text-left font-medium text-tinta">
                          {a.territorio}
                        </th>
                        <td className="max-w-[360px] py-2 pr-4 text-tinta">{a.titulo}</td>
                        <td className="py-2 pr-4 text-tinta-2">
                          {a.dimensao ? NOME_DIMENSAO[a.dimensao] : "Geral"}
                        </td>
                        <td className="py-2 pr-4">
                          <ImpactoBarra valor={a.impacto} />
                        </td>
                        <td className="py-2 pr-4 text-tinta">{NOME_CANAL[a.canal]}</td>
                        <td className="py-2 pr-4">
                          <StatusAlerta alerta={a} />
                        </td>
                        <td className="num py-2 text-tinta-2">{fmtDataHora(a.enviadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y border-y md:hidden" aria-label="Alertas dos últimos 7 dias">
                {filtrados.map(a => (
                  <li key={a.id} className="space-y-1.5 py-3 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-tinta">{a.territorio}</span>
                      <span className="num text-xs text-tinta-2">{fmtDataHora(a.enviadoEm)}</span>
                    </div>
                    <p className="text-tinta">{a.titulo}</p>
                    <ImpactoBarra valor={a.impacto} />
                    <p className="nota flex flex-wrap items-center gap-x-3">
                      <span>{a.dimensao ? NOME_DIMENSAO[a.dimensao] : "Geral"}</span>
                      <span>{NOME_CANAL[a.canal]}</span>
                      <StatusAlerta alerta={a} />
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {/* TODO backend B3: link "Abrir sinal" para a fonte; alertLog nao guarda a URL do sinal. */}
        </Secao>
      )}

      <LinkBotao href="/portal/conta">Ajustar limite de alerta</LinkBotao>
    </div>
  );
}
