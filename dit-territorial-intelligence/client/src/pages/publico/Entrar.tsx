import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Button, LoadingBlock, PageShell, botaoVariants } from "@/components/dit";
import { Palavras } from "@/components/dit/motion";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { definirSessaoPortal, type SessaoPortal } from "../portal/usePortalSessao";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Acesso do assinante.
 * 1) Sem token: o assinante pede acesso (portal.solicitarAcesso). Nao ha e-mail automatico ainda:
 *    a PRINT recebe o pedido e envia o link. A resposta do servidor e a mesma para e-mail conhecido ou nao.
 * 2) Com ?token=: portal.sessao valida e grava o cookie httpOnly; depois vai para /portal.
 */
export default function PublicoEntrar() {
  const [, navegar] = useLocation();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);
  const solicitar = trpc.portal.solicitarAcesso.useMutation();
  const sessao = trpc.portal.sessao.useMutation();

  const token = useRef<string | null>(
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("token")
  );
  const [validando, setValidando] = useState(Boolean(token.current));
  const [linkInvalido, setLinkInvalido] = useState(false);

  useEffect(() => {
    const t = token.current;
    if (!t) return;
    // Tira o token da barra de endereco e do historico assim que ele e lido.
    window.history.replaceState(null, "", "/entrar");
    sessao
      .mutateAsync({ token: t })
      .then(s => {
        if (s) {
          definirSessaoPortal(s as SessaoPortal);
          navegar("/portal");
        } else {
          setLinkInvalido(true);
          setValidando(false);
        }
      })
      .catch(() => {
        setLinkInvalido(true);
        setValidando(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (solicitar.isPending) return;
    if (!EMAIL_RE.test(email.trim())) {
      setErro("Use um e-mail completo, como nome@empresa.com.br.");
      document.getElementById("entrar-email")?.focus();
      return;
    }
    setErro(null);
    try {
      await solicitar.mutateAsync({ email: email.trim() });
      setPendente(true);
    } catch {
      setErro("Não conseguimos registrar o pedido agora. Tente de novo em instantes.");
    }
  }

  if (validando) {
    return (
      <PageShell>
        <section className="container max-w-xl space-y-6 py-14 md:py-20">
          <Palavras as="h1" className="text-3xl md:text-4xl" texto="Conferindo seu link de acesso." />
          <LoadingBlock linhas={2} rotulo="Conferindo seu link de acesso" />
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section className="container max-w-xl space-y-6 py-14 md:py-20">
        <Palavras as="h1" className="text-3xl md:text-4xl" texto="Peça o link de acesso ao seu Marco Radar." />

        {linkInvalido && (
          <p role="alert" className="text-sm" style={{ color: "var(--tensao-5)" }}>
            Este link expirou ou já foi substituído. Peça um novo abaixo e a PRINT envia.
          </p>
        )}

        {pendente ? (
          <div className="space-y-4" role="status">
            <p className="text-tinta">
              Pedido registrado. Se {email.trim()} tem assinatura ativa, a equipe da PRINT envia o link de acesso a esse
              e-mail.
            </p>
            <p className="text-sm text-tinta-2">
              O envio é feito por uma pessoa da PRINT, não por um robô; pode levar algumas horas úteis. Ainda não assina?
              Peça acesso abaixo.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/diagnostico?interesse=radar"
                className={cn(botaoVariants({ variant: "primario", size: "md" }))}
              >
                Pedir acesso ao Marco Radar
              </Link>
              <Button variant="fantasma" onClick={() => setPendente(false)}>
                Usar outro e-mail
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Acesso do assinante">
            <div className="space-y-1.5">
              <label htmlFor="entrar-email" className="text-sm font-medium text-tinta">
                E-mail da assinatura
              </label>
              <input
                id="entrar-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nome@empresa.com.br"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (erro) setErro(null);
                }}
                aria-invalid={!!erro}
                aria-describedby={erro ? "entrar-erro" : "entrar-dica"}
                className="min-h-11 w-full rounded-[2px] border border-input bg-superficie px-3 text-base text-tinta placeholder:text-tinta-2"
              />
              {erro ? (
                <p id="entrar-erro" className="text-sm" style={{ color: "var(--tensao-5)" }}>
                  {erro}
                </p>
              ) : (
                <p id="entrar-dica" className="nota">
                  Sem senha. A PRINT envia o link para o e-mail da assinatura.
                </p>
              )}
            </div>
            <Button type="submit" size="lg" disabled={solicitar.isPending}>
              {solicitar.isPending ? "Registrando..." : "Pedir link de acesso"}
            </Button>
          </form>
        )}

        <p className="text-sm text-tinta-2">
          Ainda não assina?{" "}
          <Link href="/radar" className="text-acento-texto underline underline-offset-4">
            Conheça o Marco Radar
          </Link>
        </p>
      </section>
    </PageShell>
  );
}
