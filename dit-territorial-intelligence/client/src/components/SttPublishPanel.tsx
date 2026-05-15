/**
 * SttPublishPanel — STT Aguardando Publicação Humana
 *
 * Lista todos os registros de stt_scores com published=false.
 * O analista pode: Publicar, Ajustar nota, ou Rejeitar.
 * Implementa o gate human-in-the-loop da governança PRINT.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle, FileText, Loader2, Shield } from "lucide-react";

function ScenarioBadge({ scenario }: { scenario: string | null }) {
  if (!scenario) return null;
  const styles: Record<string, string> = {
    escalada: "bg-red-500/20 text-red-300 border-red-500/40",
    pressao: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    estabilidade: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  };
  return (
    <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${styles[scenario] ?? "bg-muted/20 text-muted-foreground border-muted/40"}`}>
      {scenario}
    </span>
  );
}

export default function SttPublishPanel({ territorySlug }: { territorySlug: string }) {
  const [noteEdit, setNoteEdit] = useState<Record<number, string>>({});
  const [publishing, setPublishing] = useState<number | null>(null);

  const { data: scores, refetch } = trpc.dashboard.getPendingScores.useQuery(
    { territorySlug },
    { refetchInterval: 30 * 1000 }
  );

  const publishMutation = trpc.dashboard.publishSttScore.useMutation({
    onSuccess: () => { refetch(); toast.success("STT publicado com sucesso"); },
    onError: (err) => toast.error(`Erro ao publicar: ${err.message}`),
    onSettled: () => setPublishing(null),
  });

  if (!scores?.length) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
            <Shield className="h-4 w-4 text-primary" />
            Publicação Pendente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 text-emerald-400 opacity-60" />
            <p className="font-mono text-xs">Nenhum STT aguardando publicação.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
          <Shield className="h-4 w-4 text-primary" />
          Publicação Pendente ({scores.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {scores.map((score) => (
          <div key={score.id} className="rounded-lg border border-border/40 bg-muted/10 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-3xl font-bold text-foreground text-glow">
                  {score.stt?.toFixed(1)}
                </span>
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-muted-foreground">{score.period}</span>
                  <ScenarioBadge scenario={score.scenario} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/50 font-mono text-xs text-primary hover:bg-primary/10"
                  disabled={publishing === score.id}
                  onClick={() => {
                    setPublishing(score.id);
                    publishMutation.mutate({
                      scoreId: score.id,
                      executiveNote: noteEdit[score.id] ?? score.executiveNote ?? "",
                    });
                  }}
                >
                  {publishing === score.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  Publicar
                </Button>
              </div>
            </div>

            {/* Scores dimensionais */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(["d1Score", "d2Score", "d3Score", "d4Score", "d5Score", "d6Score"] as const).map((key, i) => (
                <div key={key} className="text-center">
                  <div className="font-mono text-[10px] text-muted-foreground">D{i + 1}</div>
                  <div className="font-mono text-sm font-bold text-foreground">
                    {score[key]?.toFixed(0) ?? "—"}
                  </div>
                </div>
              ))}
            </div>

            {/* Nota executiva — editável */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Nota Executiva</span>
              </div>
              <Textarea
                rows={3}
                value={noteEdit[score.id] ?? score.executiveNote ?? ""}
                onChange={(e) => setNoteEdit((prev) => ({ ...prev, [score.id]: e.target.value }))}
                className="resize-none border-border/40 bg-background/50 font-body text-xs"
                placeholder="Nota executiva para publicação…"
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
