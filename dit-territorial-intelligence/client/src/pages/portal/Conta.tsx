import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, ErrorState, LoadingBlock, Secao } from "@/components/dit";
import { trpc } from "@/lib/trpc";
import { NOME_CANAL, useTerritoriosPortal } from "./dados";
import { PortalFrame } from "./PortalFrame";
import { usePortalSessao } from "./usePortalSessao";

type Canal = "email" | "push" | "sse";
type Digest = "realtime" | "daily" | "weekly";

interface LinhaPref {
  ativo: boolean;
  limite: number;
  canais: Canal[];
  existe: boolean;
}

const CANAIS: Canal[] = ["email", "push", "sse"];
const LIMITES = [0.5, 0.6, 0.7, 0.8, 0.9];
const PADRAO: LinhaPref = { ativo: false, limite: 0.7, canais: ["email"], existe: false };

const CAMPO =
  "min-h-11 rounded-[2px] border border-tinta-2 bg-transparent px-3 text-sm text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]";
const CHECK =
  "h-5 w-5 shrink-0 accent-[var(--acento)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acento)]";

export default function PortalConta() {
  return (
    <PortalFrame titulo="Preferências">
      {email => <ConteudoConta email={email} />}
    </PortalFrame>
  );
}

function ConteudoConta({ email }: { email: string }) {
  const { sair } = usePortalSessao();
  const territorios = useTerritoriosPortal();
  // TODO backend B2: alertPreferences.* passa a usar a sessao do assinante e ignora este e-mail.
  const prefs = trpc.alertPreferences.list.useQuery({ subscriberEmail: email });
  const upsert = trpc.alertPreferences.upsert.useMutation();
  const desativar = trpc.alertPreferences.deactivate.useMutation();

  const [linhas, setLinhas] = useState<Record<number, LinhaPref>>({});
  const [silencioDe, setSilencioDe] = useState("");
  const [silencioAte, setSilencioAte] = useState("");
  const [digest, setDigest] = useState<Digest>("realtime");
  const [salvando, setSalvando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [validacao, setValidacao] = useState<string | null>(null);

  // Carrega o estado salvo quando as preferencias chegam.
  useEffect(() => {
    if (!prefs.data) return;
    const mapa: Record<number, LinhaPref> = {};
    for (const p of prefs.data) {
      mapa[p.territoryId] = {
        ativo: p.active,
        limite: p.minImpactThreshold ?? 0.7,
        canais: ((p.channels as Canal[]) ?? ["email"]).filter(c => CANAIS.includes(c)),
        existe: true,
      };
    }
    setLinhas(mapa);
    const primeira = prefs.data[0];
    if (primeira) {
      setSilencioDe(primeira.quietHoursStart ?? "");
      setSilencioAte(primeira.quietHoursEnd ?? "");
      setDigest((primeira.digestFrequency ?? "realtime") as Digest);
    }
  }, [prefs.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ancora #slug (vinda de Territorio): rola ate a linha quando a tabela existe.
  useEffect(() => {
    const alvo = window.location.hash.slice(1);
    if (!alvo || territorios.itens.length === 0) return;
    const desktop = document.getElementById(alvo);
    const el = desktop && desktop.getClientRects().length > 0 ? desktop : document.getElementById(`${alvo}-m`);
    el?.scrollIntoView({ block: "center" });
  }, [territorios.itens.length]);

  const linhaDe = (id: number): LinhaPref => linhas[id] ?? PADRAO;
  const mudar = (id: number, parte: Partial<LinhaPref>) =>
    setLinhas(l => ({ ...l, [id]: { ...(l[id] ?? PADRAO), ...parte } }));
  const alternarCanal = (id: number, c: Canal) => {
    const atual = linhaDe(id).canais;
    mudar(id, { canais: atual.includes(c) ? atual.filter(x => x !== c) : [...atual, c] });
  };

  const ativos = useMemo(
    () => territorios.itens.filter(t => linhaDe(t.id).ativo).length,
    [territorios.itens, linhas] // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function salvar() {
    setFalhou(false);
    const semCanal = territorios.itens.find(t => linhaDe(t.id).ativo && linhaDe(t.id).canais.length === 0);
    if (semCanal) {
      setValidacao(`Escolha ao menos um canal para ${semCanal.nome} ou desligue os alertas dele.`);
      return;
    }
    if ((silencioDe && !silencioAte) || (!silencioDe && silencioAte)) {
      setValidacao("Preencha o início e o fim do horário de silêncio, ou deixe os dois vazios.");
      return;
    }
    setValidacao(null);
    setSalvando(true);
    try {
      await Promise.all(
        territorios.itens.map(t => {
          const l = linhaDe(t.id);
          if (!l.ativo) {
            return l.existe ? desativar.mutateAsync({ subscriberEmail: email, territoryId: t.id }) : null;
          }
          return upsert.mutateAsync({
            subscriberEmail: email,
            territoryId: t.id,
            channels: l.canais,
            minImpactThreshold: l.limite,
            quietHoursStart: silencioDe || undefined,
            quietHoursEnd: silencioAte || undefined,
            digestFrequency: digest,
            active: true,
          });
        })
      );
      toast.success("Preferência salva");
      await prefs.refetch();
    } catch {
      setFalhou(true);
      toast.error("Não salvamos a mudança. Ela volta ao valor anterior.");
      await prefs.refetch();
    } finally {
      setSalvando(false);
    }
  }

  if (territorios.carregando || prefs.isLoading) {
    return (
      <div className="space-y-6">
        <p className="font-display text-2xl text-tinta-2">Carregando suas preferências...</p>
        <LoadingBlock linhas={4} rotulo="Carregando suas preferências" />
      </div>
    );
  }
  if (territorios.erro || prefs.isError) {
    return (
      <ErrorState
        motivo="Não carregamos suas preferências."
        proximoPasso="Tente de novo; se continuar, fale com o time PRINT."
        onAcao={() => {
          territorios.recarregar();
          void prefs.refetch();
        }}
      />
    );
  }
  if (territorios.itens.length === 0) {
    return (
      <EmptyState
        titulo="Você ainda não tem territórios no Radar"
        descricao="Sem território não há alerta para configurar. Escolha os seus com o time PRINT."
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
          Defina quando e por onde o Radar te avisa.
        </p>
        <p className="nota">
          {ativos} de {territorios.itens.length} territórios com alerta ativo. Os avisos vão para {email}.
        </p>
      </div>

      <Secao
        titulo="Horário de silêncio e resumo"
        nota="Vale para todos os territórios. Alertas de impacto imediato respeitam o silêncio e chegam depois."
      >
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs text-tinta-2">
            Silêncio a partir de
            <input type="time" className={CAMPO} value={silencioDe} onChange={e => setSilencioDe(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-tinta-2">
            Silêncio até
            <input type="time" className={CAMPO} value={silencioAte} onChange={e => setSilencioAte(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-tinta-2">
            Frequência dos avisos comuns
            <select className={CAMPO} value={digest} onChange={e => setDigest(e.target.value as Digest)}>
              <option value="realtime">Na hora</option>
              <option value="daily">Resumo diário</option>
              <option value="weekly">Resumo semanal</option>
            </select>
          </label>
        </div>
      </Secao>

      <Secao
        titulo="Alertas por território"
        nota="Impacto mínimo de 0,70 é o padrão do Radar; abaixo disso chegam sinais menos relevantes."
      >
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse">
            <caption className="sr-only">Preferências de alerta por território</caption>
            <thead>
              <tr className="text-left text-xs text-tinta-2">
                <th scope="col" className="pb-2 pr-4 font-medium">Território</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Alertas ativos</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Impacto mínimo</th>
                <th scope="col" className="pb-2 font-medium">Canais</th>
              </tr>
            </thead>
            <tbody>
              {territorios.itens.map(t => {
                const l = linhaDe(t.id);
                return (
                  <tr key={t.slug} id={t.slug} className="scroll-mt-24 border-t text-sm">
                    <th scope="row" className="py-2 pr-4 text-left font-medium text-tinta">
                      {t.nome}
                    </th>
                    <td className="py-2 pr-4">
                      <label className="flex min-h-11 items-center gap-2 text-tinta">
                        <input
                          type="checkbox"
                          className={CHECK}
                          checked={l.ativo}
                          onChange={e => mudar(t.id, { ativo: e.target.checked })}
                        />
                        {l.ativo ? "Ativos" : "Desligados"}
                        <span className="sr-only"> para {t.nome}</span>
                      </label>
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        className={CAMPO}
                        aria-label={`Impacto mínimo para ${t.nome}`}
                        disabled={!l.ativo}
                        value={l.limite}
                        onChange={e => mudar(t.id, { limite: Number(e.target.value) })}
                      >
                        {LIMITES.map(v => (
                          <option key={v} value={v}>
                            {v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <fieldset disabled={!l.ativo} className="flex flex-wrap gap-x-4">
                        <legend className="sr-only">Canais para {t.nome}</legend>
                        {CANAIS.map(c => (
                          <label key={c} className="flex min-h-11 items-center gap-2 text-tinta">
                            <input
                              type="checkbox"
                              className={CHECK}
                              checked={l.canais.includes(c)}
                              onChange={() => alternarCanal(t.id, c)}
                            />
                            {NOME_CANAL[c]}
                          </label>
                        ))}
                      </fieldset>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ul className="divide-y border-y md:hidden" aria-label="Preferências de alerta por território">
          {territorios.itens.map(t => {
            const l = linhaDe(t.id);
            return (
              <li key={t.slug} id={`${t.slug}-m`} className="scroll-mt-24 space-y-2 py-3 text-sm">
                <p className="font-medium text-tinta">{t.nome}</p>
                <label className="flex min-h-11 items-center gap-2 text-tinta">
                  <input
                    type="checkbox"
                    className={CHECK}
                    checked={l.ativo}
                    onChange={e => mudar(t.id, { ativo: e.target.checked })}
                  />
                  Alertas ativos
                </label>
                <label className="flex flex-col gap-1 text-xs text-tinta-2">
                  Impacto mínimo
                  <select
                    className={CAMPO}
                    disabled={!l.ativo}
                    value={l.limite}
                    onChange={e => mudar(t.id, { limite: Number(e.target.value) })}
                  >
                    {LIMITES.map(v => (
                      <option key={v} value={v}>
                        {v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset disabled={!l.ativo} className="flex flex-wrap gap-x-4">
                  <legend className="text-xs text-tinta-2">Canais</legend>
                  {CANAIS.map(c => (
                    <label key={c} className="flex min-h-11 items-center gap-2 text-tinta">
                      <input
                        type="checkbox"
                        className={CHECK}
                        checked={l.canais.includes(c)}
                        onChange={() => alternarCanal(t.id, c)}
                      />
                      {NOME_CANAL[c]}
                    </label>
                  ))}
                </fieldset>
              </li>
            );
          })}
        </ul>
      </Secao>

      <div className="space-y-3">
        {validacao && (
          <p role="alert" className="text-sm text-tinta">
            {validacao}
          </p>
        )}
        {falhou && (
          <p role="alert" className="text-sm text-tinta">
            Não salvamos a mudança. Ela volta ao valor anterior.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primario" onClick={() => void salvar()} disabled={salvando}>
            {salvando ? "Salvando..." : falhou ? "Tentar de novo" : "Salvar preferências"}
          </Button>
          <Button variant="fantasma" onClick={sair}>
            Sair do portal
          </Button>
        </div>
      </div>
    </div>
  );
}
