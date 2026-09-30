import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { Button, ErrorState, PageShell, botaoVariants } from "@/components/dit";
import { cn } from "@/lib/utils";

type Momento = "Entrar" | "Operar" | "Responder";
const MOMENTOS: Momento[] = ["Entrar", "Operar", "Responder"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Form {
  nome: string;
  empresa: string;
  email: string;
  territorio: string;
  momento: Momento | "";
  decisao: string;
}

type Erros = Partial<Record<keyof Form, string>>;
type Estado =
  | { tipo: "idle" }
  | { tipo: "enviando" }
  | { tipo: "sucesso" }
  | { tipo: "erro"; motivo: string };

function momentoDaUrl(v: string | null): Momento | "" {
  const m = (v ?? "").toLowerCase();
  if (m === "entrar") return "Entrar";
  if (m === "operar") return "Operar";
  if (m === "responder") return "Responder";
  return "";
}

function validar(f: Form): Erros {
  const e: Erros = {};
  if (!f.nome.trim()) e.nome = "Informe seu nome.";
  if (!f.empresa.trim()) e.empresa = "Informe a empresa.";
  if (!f.email.trim()) e.email = "Informe seu e-mail.";
  else if (!EMAIL_RE.test(f.email.trim())) e.email = "Use um e-mail completo, como nome@empresa.com.br.";
  if (!f.territorio.trim()) e.territorio = "Diga o território, por exemplo Macaé RJ.";
  if (!f.momento) e.momento = "Escolha o momento da sua decisão.";
  return e;
}

function Campo({
  id,
  rotulo,
  erro,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {rotulo}
      </label>
      {children}
      {dica && !erro && (
        <p id={`${id}-dica`} className="nota">
          {dica}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} className="text-sm" style={{ color: "var(--tensao-5)" }}>
          {erro}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "min-h-11 w-full rounded-[2px] border border-input bg-superficie px-3 text-base text-tinta placeholder:text-tinta-2";

/**
 * Envio do pedido para POST /api/dit/lead (schema zod no servidor: nome, empresa, email,
 * territorio, momento, decisao, observacao). O interesse (radar ou diagnostico) vai em
 * observacao, porque o schema nao tem campo proprio.
 */
async function enviarPedido(f: Form, interesse: string | null): Promise<void> {
  const momento = f.momento ? (f.momento.toLowerCase() as "entrar" | "operar" | "responder") : undefined;
  const r = await fetch("/api/dit/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: f.email.trim(),
      nome: f.nome.trim() || undefined,
      empresa: f.empresa.trim() || undefined,
      territorio: f.territorio.trim() || undefined,
      momento,
      decisao: f.decisao.trim() || undefined,
      observacao: `Interesse: ${interesse === "radar" ? "Marco Radar" : "Marco Diagnóstico"}.`,
    }),
  });
  if (r.status === 429) throw new Error("Muitas tentativas em sequência. Aguarde 1 minuto e envie de novo.");
  if (r.status === 400) {
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error ? `${j.error}. Corrija o campo e envie de novo.` : "Confira os campos e envie de novo.");
  }
  if (!r.ok) throw new Error("Nosso servidor não respondeu. Seus dados continuam na tela.");
  const j = (await r.json().catch(() => null)) as { saved?: boolean; captured?: boolean } | null;
  if (j && j.saved === false && j.captured !== true) throw new Error("O pedido não foi gravado.");
}

export default function PublicoDiagnostico() {
  const busca = useSearch();
  const params = useMemo(() => new URLSearchParams(busca), [busca]);
  const interesse = params.get("interesse");
  const ehRadar = interesse === "radar";

  const [form, setForm] = useState<Form>(() => ({
    nome: "",
    empresa: "",
    email: "",
    territorio: params.get("territorio") ?? "",
    momento: momentoDaUrl(params.get("momento")) || (ehRadar ? "Operar" : ""),
    decisao: "",
  }));
  const [erros, setErros] = useState<Erros>({});
  const [estado, setEstado] = useState<Estado>({ tipo: "idle" });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    if (erros[k]) setErros(e => ({ ...e, [k]: undefined }));
  };

  const rotuloBotao = ehRadar ? "Pedir acesso ao Marco Radar" : "Pedir diagnóstico";

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (estado.tipo === "enviando") return;
    const e = validar(form);
    setErros(e);
    if (Object.keys(e).length > 0) {
      const primeiro = (Object.keys(e) as (keyof Form)[])[0];
      document.getElementById(`campo-${primeiro}`)?.focus();
      return;
    }
    setEstado({ tipo: "enviando" });
    try {
      await enviarPedido(form, interesse);
      setEstado({ tipo: "sucesso" });
    } catch (err) {
      setEstado({
        tipo: "erro",
        motivo: err instanceof Error ? err.message : "Não conseguimos enviar o pedido agora.",
      });
    }
  }

  if (estado.tipo === "sucesso") {
    return (
      <PageShell>
        <section className="container max-w-2xl space-y-5 py-14 md:py-20" aria-live="polite">
          <h1 className="text-3xl md:text-4xl">Recebemos. Um analista da PRINT responde por e-mail.</h1>
          <p className="text-tinta-2">
            Você não precisa fazer mais nada agora. Enquanto isso, veja como o número nasce.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/metodologia" className={cn(botaoVariants({ variant: "secundario", size: "md" }))}>
              Ver a metodologia
            </Link>
            <Link href="/" className={cn(botaoVariants({ variant: "fantasma", size: "md" }))}>
              Voltar ao início
            </Link>
          </div>
        </section>
      </PageShell>
    );
  }

  const enviando = estado.tipo === "enviando";
  const descr = (k: keyof Form, comDica = false) =>
    [erros[k] ? `campo-${k}-erro` : null, comDica && !erros[k] ? `campo-${k}-dica` : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <PageShell>
      <div className="container grid gap-10 py-12 md:grid-cols-[1fr_minmax(0,24rem)] md:py-16">
        <section className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl">
              {ehRadar
                ? "Diga o território que você acompanha e peça acesso ao Marco Radar."
                : "Diga o território e a decisão que você precisa tomar."}
            </h1>
            <p className="max-w-prose text-tinta-2">
              Decidir sem ler o território custa caro depois. Um analista da PRINT lê seu pedido e responde por e-mail.
            </p>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Pedido de diagnóstico">
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo id="campo-nome" rotulo="Nome" erro={erros.nome}>
                <input
                  id="campo-nome"
                  className={inputCls}
                  autoComplete="name"
                  value={form.nome}
                  onChange={e => set("nome", e.target.value)}
                  aria-invalid={!!erros.nome}
                  aria-describedby={descr("nome")}
                />
              </Campo>
              <Campo id="campo-empresa" rotulo="Empresa" erro={erros.empresa}>
                <input
                  id="campo-empresa"
                  className={inputCls}
                  autoComplete="organization"
                  value={form.empresa}
                  onChange={e => set("empresa", e.target.value)}
                  aria-invalid={!!erros.empresa}
                  aria-describedby={descr("empresa")}
                />
              </Campo>
            </div>
            <Campo id="campo-email" rotulo="E-mail" erro={erros.email}>
              <input
                id="campo-email"
                type="email"
                inputMode="email"
                className={inputCls}
                autoComplete="email"
                placeholder="nome@empresa.com.br"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                aria-invalid={!!erros.email}
                aria-describedby={descr("email")}
              />
            </Campo>
            <Campo
              id="campo-territorio"
              rotulo="Território"
              erro={erros.territorio}
              dica="Município e UF, por exemplo Macaé RJ."
            >
              <input
                id="campo-territorio"
                className={inputCls}
                placeholder="Município e UF"
                value={form.territorio}
                onChange={e => set("territorio", e.target.value)}
                aria-invalid={!!erros.territorio}
                aria-describedby={descr("territorio", true)}
              />
            </Campo>

            <fieldset className="space-y-1.5" aria-describedby={erros.momento ? "campo-momento-erro" : undefined}>
              <legend className="text-sm font-medium text-tinta">Momento da decisão</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Momento da decisão">
                {MOMENTOS.map((m, i) => {
                  const ativo = form.momento === m;
                  return (
                    <label
                      key={m}
                      className={cn(
                        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[2px] border px-4 text-sm",
                        ativo ? "border-acento bg-muted font-medium text-tinta" : "border-input text-tinta-2"
                      )}
                    >
                      <input
                        id={i === 0 ? "campo-momento" : undefined}
                        type="radio"
                        name="momento"
                        value={m}
                        checked={ativo}
                        onChange={() => set("momento", m)}
                        className="accent-[var(--acento)]"
                      />
                      {m}
                    </label>
                  );
                })}
              </div>
              {erros.momento && (
                <p id="campo-momento-erro" className="text-sm" style={{ color: "var(--tensao-5)" }}>
                  {erros.momento}
                </p>
              )}
            </fieldset>

            <Campo
              id="campo-decisao"
              rotulo="Decisão que você precisa tomar (opcional)"
              dica="Uma ou duas frases ajudam o analista a responder com o escopo certo."
            >
              <textarea
                id="campo-decisao"
                rows={3}
                className={cn(inputCls, "py-2")}
                value={form.decisao}
                onChange={e => set("decisao", e.target.value)}
                aria-describedby={descr("decisao", true)}
              />
            </Campo>

            {estado.tipo === "erro" && (
              <ErrorState
                motivo={estado.motivo}
                proximoPasso="Seus dados continuam na tela. Envie de novo."
                acao="Enviar de novo"
                onAcao={() => setEstado({ tipo: "idle" })}
              />
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={enviando} aria-busy={enviando}>
                {enviando ? "Enviando o pedido" : rotuloBotao}
              </Button>
              <p className="nota">Usamos seus dados só para responder a este pedido.</p>
            </div>
          </form>
        </section>

        <aside className="space-y-6 md:pt-2" aria-label="O que acontece depois">
          <div className="space-y-3 border-t-2 border-tinta pt-4">
            <h2 className="text-lg">O que acontece depois</h2>
            <ol className="space-y-3 text-sm text-tinta-2">
              <li>
                <span className="num text-tinta">1.</span> Um analista da PRINT lê o território e a decisão.
              </li>
              <li>
                <span className="num text-tinta">2.</span> Você recebe a resposta por e-mail, com o escopo do que dá para
                medir.
              </li>
              <li>
                <span className="num text-tinta">3.</span> Você decide se quer o diagnóstico completo ou o Marco Radar.
              </li>
            </ol>
          </div>
          <div className="space-y-2 text-sm text-tinta-2">
            <p>
              O que o diagnóstico entrega: Tensão e Confiança, as seis dimensões, atores, cenários e nota executiva.
            </p>
            <p>
              <Link href="/radar" className="text-acento-texto underline underline-offset-4">
                Prefere acompanhar por assinatura? Ver o Marco Radar
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
