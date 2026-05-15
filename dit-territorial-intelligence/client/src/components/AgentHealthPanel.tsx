/**
 * AgentHealthPanel — Status dos 39 Agentes em Tempo Real
 *
 * Exibe saúde de cada source agent: último run, taxa de sucesso, latência média.
 * Dados via trpc.agentHealth.list (polling a cada 60s).
 */

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, Clock } from "lucide-react";

type AgentHealth = {
  id: string;
  lastRunAt: string | null;
  lastError: string | null;
  successCount: number;
  errorCount: number;
  avgLatencyMs: number;
  successRate: number;
};

function StatusDot({ rate }: { rate: number }) {
  if (rate >= 0.9) return <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse inline-block" />;
  if (rate >= 0.5) return <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse inline-block" />;
  return <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse inline-block" />;
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelative(isoString: string | null): string {
  if (!isoString) return "nunca";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

const DIMENSION_LABEL: Record<string, string> = {
  "src-inmet": "D1", "src-cptec-inpe": "D1", "src-ibge-mapbiomas": "D1",
  "src-cnuc": "D1", "src-secretarias-ma": "D1", "src-cemaden": "D1",
  "src-fiocruz-clima": "D1", "src-inpe-deter": "D1", "src-ibama": "D1",
  "src-mp-ambiental": "D1",
  "src-ibge-censo": "D2", "src-ibge-renda": "D2", "src-pnud-atlas": "D2", "src-ipeadata": "D2",
  "src-snis-sinasa": "D3", "src-datasus": "D3", "src-inep": "D3", "src-ibge-habitacao": "D3",
  "src-mapa-empresas": "D3", "src-antt-portos": "D3", "src-sinir": "D3",
  "src-plano-diretor": "D4", "src-judiciario": "D4", "src-fogo-cruzado": "D4",
  "src-geni-uff": "D4", "src-isp-ssp": "D4", "src-funai-iphan": "D4", "src-unicamp-terr": "D4",
  "src-querido-diario": "D5", "src-conselhos": "D5", "src-audiencias": "D5",
  "src-orcamento-participativo": "D5",
  "src-google-news": "D6", "src-google-trends": "D6", "src-redes-sociais": "D6", "src-universidades": "D6",
};

const DIM_COLOR: Record<string, string> = {
  D1: "text-green-400 bg-green-400/10 border-green-400/30",
  D2: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  D3: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  D4: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  D5: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  D6: "text-pink-400 bg-pink-400/10 border-pink-400/30",
};

export default function AgentHealthPanel() {
  const { data: agents, isLoading } = trpc.agentHealth.list.useQuery(undefined, {
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
            <Activity className="h-4 w-4 text-primary" />
            Saúde dos Agentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted/30" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const agentList = (agents ?? []) as AgentHealth[];
  const healthy = agentList.filter((a) => a.successRate >= 0.9).length;
  const degraded = agentList.filter((a) => a.successRate >= 0.5 && a.successRate < 0.9).length;
  const failing = agentList.filter((a) => a.successRate < 0.5).length;

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
            <Activity className="h-4 w-4 text-primary" />
            Saúde dos Agentes ({agentList.length})
          </CardTitle>
          <div className="flex gap-3 text-xs font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle className="h-3 w-3" />{healthy} ok
            </span>
            {degraded > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <Clock className="h-3 w-3" />{degraded} degraded
              </span>
            )}
            {failing > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="h-3 w-3" />{failing} failing
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 border-b border-border/50 bg-background/80 backdrop-blur">
              <tr className="text-left font-mono uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">Agente</th>
                <th className="px-2 py-2 text-center">Dim</th>
                <th className="px-2 py-2 text-right">Sucesso</th>
                <th className="px-2 py-2 text-right">Latência</th>
                <th className="px-4 py-2 text-right">Último Run</th>
              </tr>
            </thead>
            <tbody>
              {agentList.map((agent) => {
                const dim = DIMENSION_LABEL[agent.id] ?? "?";
                const dimColor = DIM_COLOR[dim] ?? "text-muted-foreground bg-muted/10 border-muted/30";
                return (
                  <tr
                    key={agent.id}
                    className="border-b border-border/20 transition-colors hover:bg-muted/10"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <StatusDot rate={agent.successRate} />
                        <span className="font-mono text-foreground/80">{agent.id.replace("src-", "")}</span>
                        {agent.lastError && (
                          <span className="truncate max-w-[140px] text-red-400/70" title={agent.lastError}>
                            — {agent.lastError.slice(0, 30)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${dimColor}`}>
                        {dim}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono">
                      <span className={agent.successRate >= 0.9 ? "text-emerald-400" : agent.successRate >= 0.5 ? "text-amber-400" : "text-red-400"}>
                        {(agent.successRate * 100).toFixed(0)}%
                      </span>
                      <span className="text-muted-foreground/60 ml-1">
                        ({agent.successCount}/{agent.successCount + agent.errorCount})
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-muted-foreground">
                      {agent.avgLatencyMs > 0 ? formatLatency(agent.avgLatencyMs) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground/70">
                      {formatRelative(agent.lastRunAt)}
                    </td>
                  </tr>
                );
              })}
              {agentList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground font-mono text-xs">
                    Nenhum agente executado ainda nesta sessão.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
