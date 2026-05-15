/**
 * AlertConfigPanel — Preferências de Alertas por Assinante
 *
 * Permite configurar canais, threshold e quiet hours por território.
 * Usado na página /portal/configuracoes.
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bell, Loader2, Save } from "lucide-react";

type Channel = "email" | "push" | "sse";

type FormState = {
  channels: Channel[];
  minImpactThreshold: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  digestFrequency: "realtime" | "daily" | "weekly";
  active: boolean;
};

const DEFAULT_FORM: FormState = {
  channels: ["email"],
  minImpactThreshold: 0.7,
  quietHoursStart: "",
  quietHoursEnd: "",
  digestFrequency: "realtime",
  active: true,
};

export default function AlertConfigPanel({
  subscriberEmail,
  territoryId,
  territoryName,
}: {
  subscriberEmail: string;
  territoryId: number;
  territoryName: string;
}) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const { data: prefs } = trpc.alertPreferences.list.useQuery({ subscriberEmail });

  useEffect(() => {
    if (!prefs) return;
    const pref = prefs.find((p) => p.territoryId === territoryId);
    if (pref) {
      setForm({
        channels: (pref.channels as Channel[]) ?? ["email"],
        minImpactThreshold: pref.minImpactThreshold ?? 0.7,
        quietHoursStart: pref.quietHoursStart ?? "",
        quietHoursEnd: pref.quietHoursEnd ?? "",
        digestFrequency: (pref.digestFrequency ?? "realtime") as FormState["digestFrequency"],
        active: pref.active ?? true,
      });
    }
  }, [prefs, territoryId]);

  const upsertMutation = trpc.alertPreferences.upsert.useMutation({
    onSuccess: () => { setSaving(false); toast.success("Preferências salvas"); },
    onError: (err) => { setSaving(false); toast.error(`Erro: ${err.message}`); },
  });

  const toggleChannel = (ch: Channel) => {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter((c) => c !== ch)
        : [...prev.channels, ch],
    }));
  };

  const handleSave = () => {
    if (form.channels.length === 0) {
      toast.error("Selecione pelo menos um canal de alerta");
      return;
    }
    setSaving(true);
    upsertMutation.mutate({
      subscriberEmail,
      territoryId,
      channels: form.channels,
      minImpactThreshold: form.minImpactThreshold,
      quietHoursStart: form.quietHoursStart || undefined,
      quietHoursEnd: form.quietHoursEnd || undefined,
      digestFrequency: form.digestFrequency,
      active: form.active,
    });
  };

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
          <Bell className="h-4 w-4 text-primary" />
          Alertas — {territoryName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <Label className="font-body text-sm">Alertas ativos</Label>
          <Switch
            checked={form.active}
            onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))}
          />
        </div>

        {/* Channels */}
        <div className="space-y-2">
          <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Canais</Label>
          <div className="flex flex-wrap gap-2">
            {(["email", "push", "sse"] as Channel[]).map((ch) => (
              <button
                key={ch}
                onClick={() => toggleChannel(ch)}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide transition-all ${
                  form.channels.includes(ch)
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : "border-border/40 bg-muted/10 text-muted-foreground hover:border-primary/30"
                }`}
              >
                {ch === "sse" ? "Dashboard" : ch}
              </button>
            ))}
          </div>
        </div>

        {/* Threshold */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Impacto mínimo
            </Label>
            <span className="font-mono text-sm font-bold text-primary">
              {Math.round(form.minImpactThreshold * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.3}
            max={1.0}
            step={0.05}
            value={form.minImpactThreshold}
            onChange={(e) => setForm((prev) => ({ ...prev, minImpactThreshold: parseFloat(e.target.value) }))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>30% (moderado)</span>
            <span>70% (alto)</span>
            <span>100% (crítico)</span>
          </div>
        </div>

        {/* Digest frequency */}
        <div className="space-y-2">
          <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Frequência</Label>
          <Select
            value={form.digestFrequency}
            onValueChange={(v) => setForm((prev) => ({ ...prev, digestFrequency: v as FormState["digestFrequency"] }))}
          >
            <SelectTrigger className="border-border/40 bg-background/50 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="realtime">Tempo real</SelectItem>
              <SelectItem value="daily">Diário (08:00)</SelectItem>
              <SelectItem value="weekly">Semanal (sexta 18:00)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quiet hours */}
        <div className="space-y-2">
          <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Horário de silêncio (opcional)
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="time"
              value={form.quietHoursStart}
              onChange={(e) => setForm((prev) => ({ ...prev, quietHoursStart: e.target.value }))}
              className="border-border/40 bg-background/50 font-mono text-xs w-32"
              placeholder="00:00"
            />
            <span className="font-mono text-xs text-muted-foreground">até</span>
            <Input
              type="time"
              value={form.quietHoursEnd}
              onChange={(e) => setForm((prev) => ({ ...prev, quietHoursEnd: e.target.value }))}
              className="border-border/40 bg-background/50 font-mono text-xs w-32"
              placeholder="07:00"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full glow bg-primary font-mono text-sm font-bold text-primary-foreground"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar preferências
        </Button>
      </CardContent>
    </Card>
  );
}
