import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";
import {
  ShieldAlert,
  Activity,
  ArrowLeft,
  AlertTriangle,
  FileText,
  Zap,
  Globe,
  Database
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function DITCommandCenter() {
  const [, params] = useRoute("/dashboard/dit/:slug");
  const slug = params?.slug || "";

  const { data: territories } = trpc.territories.list.useQuery();
  const territory = territories?.find((t) => t.slug === slug);

  const { data: history, isLoading } = trpc.analytics.indexHistory.useQuery(
    { territoryId: territory?.id || 0 },
    { enabled: !!territory }
  );

  useEffect(() => {
    document.title = `DIT Command Center | ${territory?.name || "Carregando"}`;
  }, [territory]);

  if (isLoading || !territory) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0c] text-white">
        <div className="flex flex-col items-center gap-4">
          <Activity className="h-10 w-10 animate-spin text-emerald-500" />
          <p className="text-xl font-light tracking-widest text-emerald-500/80">
            Sincronizando Inteligência DIT PRINT...
          </p>
        </div>
      </div>
    );
  }

  const latest = history?.[0];
  const sortedHistory = history ? [...history].reverse() : [];

  const radarData = [
    { subject: 'D1 Socioambiental', A: latest?.d1Score || 0, fullMark: 100 },
    { subject: 'D2 Socioeconômica', A: latest?.d2Score || 0, fullMark: 100 },
    { subject: 'D3 Infraestrutura', A: latest?.d3Score || 0, fullMark: 100 },
    { subject: 'D4 Dinâmica', A: latest?.d4Score || 0, fullMark: 100 },
    { subject: 'D5 Governança', A: latest?.d5Score || 0, fullMark: 100 },
    { subject: 'D6 Reputação', A: latest?.d6Score || 0, fullMark: 100 },
  ];

  const getStatusColor = (stt: number) => {
    if (stt >= 75) return "text-red-500";
    if (stt >= 60) return "text-orange-500";
    if (stt >= 40) return "text-yellow-500";
    return "text-emerald-500";
  };

  const getStatusBg = (stt: number) => {
    if (stt >= 75) return "bg-red-500/10 border-red-500/20";
    if (stt >= 60) return "bg-orange-500/10 border-orange-500/20";
    if (stt >= 40) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-emerald-500/10 border-emerald-500/20";
  };

  return (
    <div className="min-h-screen bg-[#060608] text-slate-300 font-sans selection:bg-emerald-500/30">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/5 bg-[#0a0a0c]/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="hover:bg-white/5 hover:text-white rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-emerald-500" />
              <h1 className="text-xl font-medium tracking-wide text-white">DIT Command Center</h1>
            </div>
            <p className="text-xs tracking-widest text-slate-500 uppercase mt-1">
              Inteligência DIT PRINT • {territory.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Database className="w-3 h-3 mr-1" /> ONLINE
          </Badge>
          <div className="px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm font-medium">
            Período: <span className="text-white">{latest?.period || "N/A"}</span>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* COLUNA ESQUERDA - STT E RADAR */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            
            {/* STT Principal */}
            <div className={`relative overflow-hidden rounded-2xl border p-6 ${getStatusBg(latest?.stt || 0)} backdrop-blur-sm transition-all duration-500 hover:border-white/20`}>
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-current opacity-5 blur-3xl" />
              <h2 className="text-sm font-medium tracking-widest uppercase text-current opacity-80">STT Global</h2>
              <div className="mt-4 flex items-baseline gap-2">
                <span className={`text-6xl font-light tracking-tighter ${getStatusColor(latest?.stt || 0)}`}>
                  {latest?.stt?.toFixed(1) || "0.0"}
                </span>
                <span className="text-lg font-medium text-slate-400">/ 100</span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="secondary" className="bg-black/40 text-white border-white/5">
                  {latest?.scenario?.toUpperCase() || "ESTABILIDADE"}
                </Badge>
              </div>
            </div>

            {/* Radar PRINT */}
            <div className="rounded-2xl border border-white/5 bg-[#0a0a0c] p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium tracking-widest text-slate-400 uppercase">Assinatura Territorial</h2>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger>
                      <Activity className="h-4 w-4 text-emerald-500" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-black border-white/10 text-white">
                      As dimensões D3 e D5 operam como déficit (100 - X).
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Tensão PRINT"
                      dataKey="A"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="#10b981"
                      fillOpacity={0.2}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA - RATIONALE E HISTÓRICO */}
          <div className="flex flex-col gap-6 lg:col-span-8">
            
            {/* Founder Briefing */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#111115] to-[#0a0a0c] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <FileText className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Zap className="h-5 w-5 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-medium text-white tracking-wide">Founder Briefing</h2>
                </div>
                
                <div className="prose prose-invert prose-emerald max-w-none">
                  <p className="text-lg leading-relaxed text-slate-300 font-light">
                    {latest?.llmRationale || "O motor não gerou rationale para este período."}
                  </p>
                </div>
              </div>
            </div>

            {/* Evolução Histórica */}
            <div className="rounded-2xl border border-white/5 bg-[#0a0a0c] p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-sm font-medium tracking-widest text-slate-400 uppercase">Memória Territorial (Evolução STT)</h2>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sortedHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorStt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="period" 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={12} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0c', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: '#10b981' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="stt" 
                      name="Tensão (STT)"
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorStt)" 
                      activeDot={{ r: 6, fill: "#10b981", stroke: "#000", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
