/**
 * Página de Login do Dashboard Interno — Print Territorial Intelligence™
 * Autenticação por e-mail + senha, independente do OAuth Manus.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Radio, Shield } from "lucide-react";

export default function DashboardLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = trpc.dashboardAuth.login.useMutation({
    onSuccess: (data) => {
      toast.success(`Bem-vindo, ${data.name}!`);
      // Usar reload completo para garantir que o cookie seja lido
      setTimeout(() => { window.location.href = "/dashboard"; }, 500);
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Radio className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-xl font-bold text-foreground">Radar Territorial™</h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Dashboard Interno — Print
            </p>
          </div>
        </div>

        {/* Card de Login */}
        <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Acesso restrito à equipe Print</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@print.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="mt-2 w-full bg-primary text-primary-foreground"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Entrar
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Print Territorial Intelligence™ · Acesso exclusivo
        </p>
      </div>
    </div>
  );
}
