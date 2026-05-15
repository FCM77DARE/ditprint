import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, FileText, Sparkles, CheckCircle, AlertCircle,
  Loader2, Upload, ChevronRight, Info, BarChart2, Globe
} from "lucide-react";
import { toast } from "sonner";

// Índices STT com descrições
const INDEX_DESCRIPTIONS = [
  {
    key: "ITT",
    name: "Índice de Tensão Territorial",
    weight: "25%",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    desc: "Conflitos fundiários, disputas por uso do solo, pressão sobre comunidades tradicionais e povos indígenas.",
  },
  {
    key: "ICS",
    name: "Índice de Complexidade Socioambiental",
    weight: "20%",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    desc: "Sobreposição de interesses econômicos, ambientais e sociais; pressão sobre biomas e recursos naturais.",
  },
  {
    key: "IVS",
    name: "Índice de Vulnerabilidade Social",
    weight: "20%",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    desc: "Desigualdade, pobreza, dependência econômica de setores primários, fragilidade institucional local.",
  },
  {
    key: "IVE",
    name: "Índice de Vulnerabilidade Econômica",
    weight: "20%",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    desc: "Exposição a ciclos de commodities, dependência de capital externo, riscos regulatórios e fiscais.",
  },
  {
    key: "ICI",
    name: "Índice de Complexidade Institucional",
    weight: "15%",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    desc: "Sobreposição de competências entre entes federativos, histórico de disputas jurídicas, licenciamento ambiental.",
  },
];

type WizardStep = "intro" | "form" | "processing" | "result";

interface TerritoryWizardProps {
  onComplete?: () => void;
}

export default function TerritoryWizard({ onComplete }: TerritoryWizardProps) {
  const [step, setStep] = useState<WizardStep>("intro");
  const [inputMode, setInputMode] = useState<"manual" | "pdf">("manual");
  const [pdfText, setPdfText] = useState("");
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    region: "",
    state: "",
    contextDescription: "",
  });

  const [result, setResult] = useState<{
    slug: string;
    name: string;
    onboardingStatus: string;
    contextData: Record<string, unknown>;
  } | null>(null);

  const createMutation = trpc.territories.create.useMutation({
    onSuccess: (data: typeof result) => {
      setResult(data);
      setStep("result");
    },
    onError: (err: { message: string }) => {
      toast.error(`Erro ao criar território: ${err.message}`);
      setStep("form");
    },
  });

  // Extrair texto de PDF via FileReader (texto simples)
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsPdfLoading(true);
    try {
      // Usar pdf.js via CDN para extrair texto
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      // Tentar extrair texto simples do PDF (heurística básica)
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const raw = decoder.decode(uint8);

      // Extrair strings legíveis do PDF (entre parênteses em streams de texto)
      const textMatches = raw.match(/\(([^)]{3,})\)/g) || [];
      const extracted = textMatches
        .map((m) => m.slice(1, -1))
        .filter((t) => /[a-zA-ZÀ-ÿ]{3,}/.test(t))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (extracted.length > 200) {
        setPdfText(extracted.slice(0, 8000));
        setForm((f) => ({ ...f, contextDescription: extracted.slice(0, 8000) }));
        toast.success(`PDF processado: ${extracted.length} caracteres extraídos.`);
      } else {
        // Fallback: pedir que o usuário cole o texto manualmente
      toast.error("PDF com texto não extraível. Por favor, copie e cole o conteúdo do PDF no campo de texto abaixo.");
        setInputMode("manual");
      }
    } catch {
      toast.error("Erro ao processar PDF. Tente copiar e colar o texto do PDF manualmente.");
    } finally {
      setIsPdfLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Nome obrigatório. Informe o nome do território.");
      return;
    }
    const description = inputMode === "pdf" ? pdfText : form.contextDescription;
    if (description.length < 100) {
      toast.error("Contexto insuficiente. Forneça pelo menos 100 caracteres de contexto para que a IA aplique a metodologia DIT.");
      return;
    }
    setStep("processing");
    createMutation.mutate({
      name: form.name,
      region: form.region || undefined,
      state: form.state || undefined,
      contextDescription: description,
      inputMode,
    });
  };

  const contextData = result?.contextData as {
    baselineScores?: { stt: number; itt: number; ics: number; ivs: number; ive: number; ici: number };
    historicalBackground?: string;
    institutionalActors?: string;
    keyRisks?: string;
    llmRationale?: string;
    searchQueries?: string[];
  } | undefined;

  // ─── Intro ───────────────────────────────────────────────────────────────────
  if (step === "intro") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Novo Território</h2>
            <p className="text-sm text-muted-foreground">Wizard inteligente — metodologia DIT aplicada por IA</p>
          </div>
        </div>

        {/* Legenda STT */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart2 className="h-4 w-4 text-primary" />
              Composição do STT — Score de Tensão Territorial
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              STT = (ITT × 25%) + (ICS × 20%) + (IVS × 20%) + (IVE × 20%) + (ICI × 15%)
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {INDEX_DESCRIPTIONS.map((idx) => (
              <div key={idx.key} className={`rounded-lg border p-3 ${idx.bg}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono text-xs font-bold ${idx.color}`}>{idx.key}</span>
                  <Badge variant="outline" className="text-xs">{idx.weight}</Badge>
                </div>
                <p className="text-xs font-semibold text-foreground">{idx.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{idx.desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Como funciona:</strong> Você descreve o território (contexto histórico, atores, conflitos, dados econômicos) ou faz upload de um PDF com esse conteúdo. A IA aplica a metodologia DIT e gera o contexto estruturado com scores iniciais para cada índice.</p>
              <p><strong className="text-foreground">Importante:</strong> A IA usa apenas o que você fornecer. Não são inventados dados. Quanto mais rico o contexto, mais preciso o score.</p>
            </div>
          </div>
        </div>

        <Button onClick={() => setStep("form")} className="w-full gap-2">
          Começar
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────────
  if (step === "form") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Dados do Território</h2>
            <p className="text-sm text-muted-foreground">Preencha as informações básicas e forneça o contexto</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="name">Nome do Território *</Label>
            <Input
              id="name"
              placeholder="ex: Corredor Mineral do Quadrilátero Ferrífero"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="region">Região</Label>
            <Input
              id="region"
              placeholder="ex: Sudeste"
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">Estado(s)</Label>
            <Input
              id="state"
              placeholder="ex: MG"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            />
          </div>
        </div>

        {/* Modo de entrada */}
        <div className="space-y-2">
          <Label>Fonte do Contexto Territorial</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setInputMode("manual")}
              className={`rounded-lg border p-3 text-left transition-all ${
                inputMode === "manual"
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <FileText className="h-4 w-4 mb-1 text-primary" />
              <p className="text-sm font-semibold">Descrição manual</p>
              <p className="text-xs text-muted-foreground">Digite ou cole o contexto</p>
            </button>
            <button
              onClick={() => setInputMode("pdf")}
              className={`rounded-lg border p-3 text-left transition-all ${
                inputMode === "pdf"
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <Upload className="h-4 w-4 mb-1 text-primary" />
              <p className="text-sm font-semibold">Upload de PDF</p>
              <p className="text-xs text-muted-foreground">Relatório, estudo ou laudo</p>
            </button>
          </div>
        </div>

        {inputMode === "pdf" ? (
          <div className="space-y-3">
            <Label>Upload do PDF</Label>
            <div
              className="rounded-lg border-2 border-dashed border-border/50 p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {isPdfLoading ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              ) : pdfText ? (
                <div className="space-y-1">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-500" />
                  <p className="text-sm font-semibold text-foreground">PDF processado</p>
                  <p className="text-xs text-muted-foreground">{pdfText.length} caracteres extraídos</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">Clique para selecionar o PDF</p>
                  <p className="text-xs text-muted-foreground">Relatórios, estudos de impacto, laudos técnicos</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handlePdfUpload}
            />
            {pdfText && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 max-h-32 overflow-y-auto">
                <p className="text-xs text-muted-foreground font-mono">{pdfText.slice(0, 500)}...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="context">
              Contexto Territorial *
              <span className="ml-2 text-xs text-muted-foreground">(mínimo 100 caracteres)</span>
            </Label>
            <Textarea
              id="context"
              placeholder={`Descreva o território com o máximo de detalhes possível. Inclua:

• Histórico e contexto estrutural (quando foi formado, principais marcos)
• Atores institucionais (órgãos públicos, empresas, comunidades, ONGs)
• Conflitos e tensões existentes (fundiários, ambientais, sociais)
• Atividades econômicas principais e sua relação com o território
• Dados ambientais relevantes (biomas, recursos hídricos, áreas protegidas)
• Histórico de licenciamentos, embargos, decisões judiciais
• Vulnerabilidades sociais (populações em risco, dependência econômica)

Quanto mais rico o contexto, mais preciso será o score STT gerado pela IA.`}
              className="min-h-[200px] font-mono text-xs"
              value={form.contextDescription}
              onChange={(e) => setForm((f) => ({ ...f, contextDescription: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground text-right">
              {form.contextDescription.length} caracteres
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("intro")} className="flex-1">
            Voltar
          </Button>
          <Button onClick={handleSubmit} className="flex-1 gap-2">
            <Sparkles className="h-4 w-4" />
            Aplicar Metodologia DIT
          </Button>
        </div>
      </div>
    );
  }

  // ─── Processing ───────────────────────────────────────────────────────────────
  if (step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-display text-xl font-bold text-foreground">Aplicando Metodologia DIT</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            A IA está analisando o contexto fornecido e calculando os scores iniciais para cada índice do STT.
            Isso pode levar até 30 segundos.
          </p>
        </div>
        <div className="space-y-2 w-full max-w-xs">
          {["Analisando contexto histórico...", "Identificando atores institucionais...", "Calculando ITT, ICS, IVS, IVE, ICI...", "Gerando score STT inicial..."].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0" />
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Result ───────────────────────────────────────────────────────────────────
  if (step === "result" && result) {
    const scores = contextData?.baselineScores;
    const isSuccess = result.onboardingStatus === "ready";

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          {isSuccess ? (
            <CheckCircle className="h-8 w-8 text-green-500" />
          ) : (
            <AlertCircle className="h-8 w-8 text-red-500" />
          )}
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              {isSuccess ? "Território criado com sucesso!" : "Erro no processamento"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isSuccess
                ? `${result.name} foi adicionado ao pipeline com contexto DIT completo.`
                : "O território foi criado mas o contexto LLM falhou. Tente novamente."}
            </p>
          </div>
        </div>

        {isSuccess && scores && (
          <>
            {/* Score STT */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-sm font-bold text-primary uppercase tracking-wider">Score STT Inicial</span>
                  <span className="font-mono text-4xl font-bold text-foreground">{scores.stt.toFixed(1)}</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { key: "ITT", val: scores.itt, color: "text-red-400" },
                    { key: "ICS", val: scores.ics, color: "text-orange-400" },
                    { key: "IVS", val: scores.ivs, color: "text-yellow-400" },
                    { key: "IVE", val: scores.ive, color: "text-blue-400" },
                    { key: "ICI", val: scores.ici, color: "text-purple-400" },
                  ].map((idx) => (
                    <div key={idx.key} className="text-center">
                      <p className={`font-mono text-xs font-bold ${idx.color}`}>{idx.key}</p>
                      <p className="font-mono text-lg font-bold text-foreground">{idx.val?.toFixed(0) ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contexto gerado */}
            {contextData?.historicalBackground && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Contexto Histórico</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{contextData.historicalBackground}</p>
                </CardContent>
              </Card>
            )}

            {contextData?.keyRisks && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Principais Riscos Identificados</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{contextData.keyRisks}</p>
                </CardContent>
              </Card>
            )}

            {contextData?.llmRationale && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Raciocínio da IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{contextData.llmRationale}</p>
                </CardContent>
              </Card>
            )}

            {contextData?.searchQueries && contextData.searchQueries.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Queries de Coleta Geradas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {contextData.searchQueries.map((q, i) => (
                      <Badge key={i} variant="secondary" className="text-xs font-mono">{q}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setStep("intro");
              setForm({ name: "", region: "", state: "", contextDescription: "" });
              setPdfText("");
              setResult(null);
            }}
            className="flex-1"
          >
            Criar outro território
          </Button>
          {onComplete && (
            <Button onClick={onComplete} className="flex-1 gap-2">
              <CheckCircle className="h-4 w-4" />
              Ir para o Dashboard
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
