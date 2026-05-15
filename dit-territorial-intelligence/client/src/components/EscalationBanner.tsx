/**
 * EscalationBanner — Banner de Alerta quando STT ≥ 75
 *
 * Exibe um banner fixo no topo da página com o score atual e cenário
 * quando o território está em escalada (STT ≥ 75).
 * Dismissível por sessão.
 */

import { useState } from "react";
import { AlertTriangle, X, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

type Props = {
  stt: number;
  territoryName: string;
  territorySlug?: string;
  executiveNote?: string;
};

export default function EscalationBanner({ stt, territoryName, territorySlug, executiveNote }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || stt < 75) return null;

  const isEscalada = stt >= 75;

  return (
    <div className={`relative border-b px-4 py-3 ${
      isEscalada
        ? "border-red-500/40 bg-red-950/60"
        : "border-orange-500/40 bg-orange-950/60"
    }`}>
      <div className="container flex items-center gap-4">
        <div className={`flex-shrink-0 rounded-full p-1.5 ${isEscalada ? "bg-red-500/20" : "bg-orange-500/20"}`}>
          <AlertTriangle className={`h-4 w-4 ${isEscalada ? "text-red-400" : "text-orange-400"}`} />
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`font-mono text-xs font-bold uppercase tracking-wider ${isEscalada ? "text-red-400" : "text-orange-400"}`}>
              ESCALADA
            </span>
            <span className={`font-mono text-2xl font-bold ${isEscalada ? "text-red-300" : "text-orange-300"}`}>
              {stt.toFixed(1)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">STT</span>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-foreground/80 min-w-0">
            <TrendingUp className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
            <span className="font-body">
              <strong>{territoryName}</strong> está em cenário de escalada.
              {executiveNote && (
                <span className="ml-1 text-muted-foreground line-clamp-1 hidden sm:inline">
                  {executiveNote.slice(0, 120)}{executiveNote.length > 120 ? "…" : ""}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {territorySlug && (
            <Link href={`/territorio/${territorySlug}`}>
              <Button
                size="sm"
                variant="outline"
                className={`border font-mono text-xs ${
                  isEscalada
                    ? "border-red-500/50 text-red-300 hover:bg-red-500/20"
                    : "border-orange-500/50 text-orange-300 hover:bg-orange-500/20"
                }`}
              >
                Ver análise
              </Button>
            </Link>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar alerta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
