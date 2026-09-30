import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Button, DitLogo, PoweredByPrint } from "@/components/dit";
import { trpc } from "@/lib/trpc";

const CAMPO =
  "min-h-11 w-full rounded-[2px] border border-input bg-superficie px-3 text-base text-tinta placeholder:text-tinta-2";

/** Login da mesa do operador PRINT. Mesma chamada de auth de antes: dashboardAuth.login (e-mail e senha). */
export default function DashboardLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Entrar na Mesa DIT";
  }, []);

  const login = trpc.dashboardAuth.login.useMutation({
    onSuccess: () => {
      // Recarga completa para o cookie de sessao valer em todas as consultas da mesa.
      window.location.href = "/mesa";
    },
    onError: e => {
      setErro(e.message || "Não conseguimos entrar. Confira o e-mail e a senha.");
    },
  });

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (login.isPending) return;
    setErro(null);
    login.mutate({ email: email.trim(), password: senha });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="container flex min-h-16 items-center">
        <Link href="/" aria-label="DIT, voltar ao início">
          <DitLogo size={24} />
        </Link>
      </header>

      <main className="container flex flex-1 items-start justify-center py-10 md:py-16">
        <section className="w-full max-w-sm space-y-6" aria-labelledby="login-titulo">
          <div className="space-y-2">
            <h1 id="login-titulo" className="text-3xl">
              Entre na mesa do operador.
            </h1>
            <p className="text-sm text-tinta-2">Acesso restrito à equipe da PRINT.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" aria-label="Entrada da equipe PRINT">
            <div className="space-y-1.5">
              <label htmlFor="mesa-email" className="text-sm font-medium text-tinta">
                E-mail
              </label>
              <input
                id="mesa-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                aria-invalid={!!erro}
                aria-describedby={erro ? "mesa-erro" : undefined}
                className={CAMPO}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="mesa-senha" className="text-sm font-medium text-tinta">
                Senha
              </label>
              <div className="flex gap-2">
                <input
                  id="mesa-senha"
                  type={mostrar ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  aria-invalid={!!erro}
                  aria-describedby={erro ? "mesa-erro" : undefined}
                  className={CAMPO}
                />
                <Button
                  variant="secundario"
                  size="md"
                  aria-pressed={mostrar}
                  onClick={() => setMostrar(v => !v)}
                  className="shrink-0"
                >
                  {mostrar ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
            </div>

            {erro && (
              <p id="mesa-erro" role="alert" className="text-sm" style={{ color: "var(--tensao-5)" }}>
                {erro}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
              {login.isPending ? "Entrando..." : "Entrar na mesa"}
            </Button>
          </form>

          <p className="text-sm text-tinta-2">
            É assinante do Radar?{" "}
            <Link href="/entrar" className="text-acento-texto underline underline-offset-4">
              Entre pelo portal
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t">
        <div className="container flex min-h-14 items-center">
          <PoweredByPrint />
        </div>
      </footer>
    </div>
  );
}
