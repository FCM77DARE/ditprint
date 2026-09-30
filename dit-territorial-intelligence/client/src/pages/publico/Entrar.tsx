import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Button, PageShell, botaoVariants } from "@/components/dit";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Acesso do assinante por link enviado ao e-mail.
 * TODO backend B2: portalAuth.requestLink e portalAuth.verify ainda nao existem.
 * Enquanto nao existirem, esta tela NAO chama nada e diz isso. Quando o endpoint
 * entrar, chamar requestLink(email) e trocar o estado "pendente" por:
 * "Enviamos o link se este e-mail tiver assinatura ativa."
 */
export default function PublicoEntrar() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setErro("Use um e-mail completo, como nome@empresa.com.br.");
      document.getElementById("entrar-email")?.focus();
      return;
    }
    setErro(null);
    setPendente(true);
  }

  return (
    <PageShell>
      <section className="container max-w-xl space-y-6 py-14 md:py-20">
        <h1 className="text-3xl md:text-4xl">Digite seu e-mail e receba o link de acesso.</h1>

        {pendente ? (
          <div className="space-y-4" role="status">
            <p className="text-tinta">
              O envio automático do link ainda não está ativo, então nada foi enviado para {email.trim()}.
            </p>
            <p className="text-sm text-tinta-2">
              Se você assina o Radar, peça o acesso à PRINT respondendo ao e-mail da sua assinatura. Se ainda não assina,
              peça acesso abaixo.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/diagnostico?interesse=radar"
                className={cn(botaoVariants({ variant: "primario", size: "md" }))}
              >
                Pedir acesso ao Radar
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
                  Sem senha. Usamos o e-mail só para liberar o acesso.
                </p>
              )}
            </div>
            <Button type="submit" size="lg">
              Enviar link de acesso
            </Button>
          </form>
        )}

        <p className="text-sm text-tinta-2">
          Ainda não assina?{" "}
          <Link href="/radar" className="text-acento-texto underline underline-offset-4">
            Conheça o Radar
          </Link>
        </p>
      </section>
    </PageShell>
  );
}
