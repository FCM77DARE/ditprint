import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button, Chip, EmptyState, ErrorState, KpiTile, LoadingBlock, Secao } from "@/components/dit";
import { MesaLayout, Tabela, TD, TH, fmtHa, fmtQuando } from "./comum";

const CAMPO =
  "min-h-9 w-full rounded-[2px] border border-tinta-2 bg-card px-2 text-sm text-tinta placeholder:text-tinta-2";

interface LinkGerado {
  email: string;
  link: string;
  expiraEm: string | number | Date;
  emailEnviado: boolean;
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export default function MesaAssinantes() {
  const utils = trpc.useUtils();
  const lista = trpc.dashboard.assinantes.list.useQuery();
  const territorios = trpc.territories.listAll.useQuery();
  const upsert = trpc.dashboard.assinantes.upsert.useMutation();
  const gerar = trpc.dashboard.assinantes.gerarLink.useMutation();

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [revogar, setRevogar] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [linkGerado, setLinkGerado] = useState<LinkGerado | null>(null);

  const assinantes = lista.data?.assinantes ?? [];
  const pedidos = lista.data?.pedidosDeAcesso ?? [];
  const pendentes = pedidos.filter(p => !p.atendida);
  const conhecidos = new Set(assinantes.map(a => a.email));

  const titulo = lista.isLoading
    ? "Assinantes"
    : pendentes.length > 0
      ? `${pendentes.length} ${pendentes.length === 1 ? "pedido de acesso espera" : "pedidos de acesso esperam"} um link seu`
      : `${assinantes.length} ${assinantes.length === 1 ? "assinante cadastrado" : "assinantes cadastrados"}, nenhum pedido pendente`;

  function preencher(a: { email: string; nome?: string | null; territorios?: string[] }) {
    setEmail(a.email);
    setNome(a.nome ?? "");
    setSelecionados(a.territorios ?? []);
    setRevogar(false);
    setErroForm(null);
    document.getElementById("ass-email")?.focus();
  }

  function alternar(slug: string) {
    setSelecionados(s => (s.includes(slug) ? s.filter(x => x !== slug) : [...s, slug]));
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErroForm("Use um e-mail completo.");
      return;
    }
    if (selecionados.length === 0) {
      setErroForm("Escolha ao menos um território do contrato.");
      return;
    }
    setErroForm(null);
    try {
      await upsert.mutateAsync({
        email: email.trim().toLowerCase(),
        nome: nome.trim() || undefined,
        territorios: selecionados,
        revogarLinks: revogar || undefined,
      });
      toast.success(revogar ? "Assinante salvo e links antigos revogados." : "Assinante salvo.");
      setEmail("");
      setNome("");
      setSelecionados([]);
      setRevogar(false);
      await utils.dashboard.assinantes.list.invalidate();
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Não salvamos o assinante. Tente de novo.");
    }
  }

  async function gerarLink(alvo: string) {
    try {
      const r = await gerar.mutateAsync({ email: alvo, baseUrl: window.location.origin });
      setLinkGerado({ email: alvo, link: r.link, expiraEm: r.expiraEm, emailEnviado: r.emailEnviado });
      await utils.dashboard.assinantes.list.invalidate();
      if (await copiar(r.link)) toast.success("Link gerado e copiado.");
      else toast.success("Link gerado. Copie no quadro abaixo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não geramos o link.");
    }
  }

  async function copiarLink() {
    if (!linkGerado) return;
    if (await copiar(linkGerado.link)) toast.success("Link copiado.");
    else toast.error("Não copiamos. Selecione o texto e copie.");
  }

  return (
    <MesaLayout titulo={titulo}>
      <div className="space-y-8">
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiTile
            rotulo="Pedidos sem link"
            valor={lista.isLoading ? null : pendentes.length}
            carregando={lista.isLoading}
          />
          <KpiTile
            rotulo="Assinantes"
            valor={lista.isLoading ? null : assinantes.length}
            carregando={lista.isLoading}
          />
          <KpiTile
            rotulo="E-mail automático"
            valor={lista.isLoading ? null : lista.data?.emailAtivo ? "Ativo" : "Desligado"}
            carregando={lista.isLoading}
          />
        </div>

        {linkGerado && (
          <section className="space-y-2 rounded-[6px] border p-4" aria-live="polite">
            <h2 className="text-lg">Link de acesso de {linkGerado.email}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                aria-label="Link de acesso"
                value={linkGerado.link}
                onFocus={e => e.currentTarget.select()}
                className={`${CAMPO} min-w-0 flex-1 font-mono`}
              />
              <Button variant="primario" size="sm" onClick={() => void copiarLink()}>
                Copiar link
              </Button>
              <Button variant="fantasma" size="sm" onClick={() => setLinkGerado(null)}>
                Fechar
              </Button>
            </div>
            <p className="nota">
              Vale até {fmtQuando(new Date(linkGerado.expiraEm))}.{" "}
              {linkGerado.emailEnviado
                ? "Também enviado por e-mail."
                : "Nenhum e-mail foi enviado: mande este link pelo canal da PRINT (e-mail ou WhatsApp)."}
            </p>
          </section>
        )}

        <Secao
          titulo={pendentes.length > 0 ? "Pedidos de acesso, os sem link primeiro" : "Pedidos de acesso"}
          nota="O pedido vem da tela /entrar. O servidor responde igual para e-mail conhecido ou não; quem decide é você."
        >
          {lista.isLoading ? (
            <LoadingBlock linhas={3} rotulo="Carregando pedidos de acesso" />
          ) : lista.isError ? (
            <ErrorState
              motivo="Não lemos os pedidos de acesso."
              proximoPasso="Tente de novo; se repetir, confira se o servidor está no ar."
              onAcao={() => lista.refetch()}
            />
          ) : pedidos.length === 0 ? (
            <EmptyState
              titulo="Nenhum pedido de acesso"
              descricao="Quando um assinante digitar o e-mail em /entrar, o pedido aparece aqui com o botão de gerar o link."
            />
          ) : (
            <Tabela legenda="Pedidos de acesso ao portal">
              <thead>
                <tr>
                  <th className={TH}>E-mail</th>
                  <th className={TH}>Pedido</th>
                  <th className={TH}>Situação</th>
                  <th className={TH}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {[...pedidos]
                  .sort((a, b) => Number(a.atendida) - Number(b.atendida) || String(a.em).localeCompare(String(b.em)))
                  .map(p => {
                    const cadastrado = p.conhecido || conhecidos.has(p.email);
                    return (
                      <tr key={`${p.email}-${String(p.em)}`} className="border-t">
                        <th scope="row" className="px-3 py-2 text-left font-medium">
                          {p.email}
                        </th>
                        <td className={`${TD} text-xs text-tinta-2`}>
                          {fmtQuando(new Date(p.em))} ({fmtHa(new Date(p.em))})
                        </td>
                        <td className={TD}>
                          {p.atendida ? (
                            <Chip tom="contorno">Link gerado</Chip>
                          ) : cadastrado ? (
                            <Chip tom="acento">Espera link</Chip>
                          ) : (
                            <Chip tom="neutro">E-mail sem cadastro</Chip>
                          )}
                        </td>
                        <td className={TD}>
                          {cadastrado ? (
                            <Button
                              size="sm"
                              variant={p.atendida ? "secundario" : "primario"}
                              disabled={gerar.isPending}
                              onClick={() => void gerarLink(p.email)}
                            >
                              {p.atendida ? "Gerar outro link" : "Gerar link"}
                            </Button>
                          ) : (
                            <Button size="sm" variant="secundario" onClick={() => preencher({ email: p.email })}>
                              Cadastrar assinante
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </Tabela>
          )}
        </Secao>

        <Secao titulo="Assinantes e o que cada um vê" nota="O portal mostra só os territórios listados aqui.">
          {lista.isLoading ? (
            <LoadingBlock linhas={4} rotulo="Carregando assinantes" />
          ) : assinantes.length === 0 ? (
            <EmptyState
              titulo="Nenhum assinante cadastrado"
              descricao="Cadastre o primeiro no formulário abaixo: e-mail, nome e os territórios do contrato."
            />
          ) : (
            <Tabela legenda="Assinantes do portal">
              <thead>
                <tr>
                  <th className={TH}>Assinante</th>
                  <th className={TH}>Territórios</th>
                  <th className={TH}>Último acesso</th>
                  <th className={TH}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {assinantes.map(a => (
                  <tr key={a.email} className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {a.nome || a.email}
                      {a.nome ? <span className="nota block">{a.email}</span> : null}
                    </th>
                    <td className={TD}>
                      <span className="flex flex-wrap gap-1">
                        {a.territorios.length === 0 ? (
                          <span className="text-tinta-2">nenhum</span>
                        ) : (
                          a.territorios.map(t => (
                            <Chip key={t} tom="neutro">
                              {territorios.data?.find(x => x.slug === t)?.name ?? t}
                            </Chip>
                          ))
                        )}
                      </span>
                    </td>
                    <td className={`${TD} text-xs text-tinta-2`}>
                      {a.ultimoAcesso ? fmtHa(new Date(a.ultimoAcesso)) : "nunca entrou"}
                    </td>
                    <td className={TD}>
                      <span className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secundario"
                          disabled={gerar.isPending || a.territorios.length === 0}
                          onClick={() => void gerarLink(a.email)}
                        >
                          Gerar link
                        </Button>
                        <Button size="sm" variant="fantasma" onClick={() => preencher(a)}>
                          Editar
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Secao>

        <Secao titulo="Cadastrar ou editar assinante" nota="Salvar com um e-mail existente atualiza nome e territórios.">
          <form onSubmit={salvar} className="grid max-w-3xl gap-4" noValidate aria-label="Cadastro de assinante">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="ass-email" className="text-xs font-medium text-tinta-2">
                  E-mail
                </label>
                <input
                  id="ass-email"
                  type="email"
                  autoComplete="off"
                  className={CAMPO}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nome@empresa.com.br"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ass-nome" className="text-xs font-medium text-tinta-2">
                  Nome
                </label>
                <input id="ass-nome" className={CAMPO} value={nome} onChange={e => setNome(e.target.value)} />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-tinta-2">Territórios do contrato</legend>
              {territorios.isLoading ? (
                <LoadingBlock linhas={2} rotulo="Carregando territórios" />
              ) : territorios.isError ? (
                <p className="text-sm text-tinta-2">Não carregamos a lista de territórios. Recarregue a página.</p>
              ) : (
                <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  {(territorios.data ?? []).map(t => (
                    <label key={t.slug} className="flex min-h-9 items-center gap-2 text-sm text-tinta">
                      <input
                        type="checkbox"
                        checked={selecionados.includes(t.slug)}
                        onChange={() => alternar(t.slug)}
                      />
                      {t.name}
                      {t.state ? <span className="text-tinta-2">, {t.state}</span> : null}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <label className="flex min-h-9 items-center gap-2 text-sm text-tinta">
              <input type="checkbox" checked={revogar} onChange={e => setRevogar(e.target.checked)} />
              Revogar todos os links já emitidos para este e-mail
            </label>

            {erroForm && (
              <p role="alert" className="text-sm" style={{ color: "var(--tensao-5)" }}>
                {erroForm}
              </p>
            )}
            <div>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando..." : "Salvar assinante"}
              </Button>
            </div>
          </form>
        </Secao>
      </div>
    </MesaLayout>
  );
}
