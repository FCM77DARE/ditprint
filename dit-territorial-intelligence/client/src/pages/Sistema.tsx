import { useState } from "react";
import type { Leitura } from "@shared/leitura";
import {
  AppShell,
  Button,
  Chip,
  DimensoesTable,
  MarcoLogo,
  MarcoMark,
  EmptyState,
  ErrorState,
  FAIXAS_TENSAO,
  KpiTile,
  LoadingBlock,
  MarcaFaixa,
  PageShell,
  PoweredByPrint,
  Secao,
  Sparkline,
  StatusDot,
  TensaoBar,
} from "@/components/dit";

/** EXEMPLO: Macaé fictício, não é leitura real. */
const EXEMPLO: Leitura = {
  tensao: 74,
  confianca: 63,
  faixa: { min: 47, max: 84 },
  stt_legado: 61,
  dimensoes: [
    { id: "habitacao", nome: "Habitação e moradia", score: 82, peso: 0.2, medida: true, fonte: "ambos" },
    { id: "mobilidade", nome: "Mobilidade", score: 71, peso: 0.15, medida: true, fonte: "estrutural" },
    { id: "seguranca", nome: "Segurança pública", score: 64, peso: 0.2, medida: true, fonte: "sinal" },
    { id: "saude", nome: "Saúde", score: 38, peso: 0.15, medida: true, fonte: "ambos" },
    { id: "educacao", nome: "Educação", score: 22, peso: 0.15, medida: true, fonte: "estrutural" },
    { id: "ambiente", nome: "Meio ambiente", score: null, peso: 0.15, medida: false, fonte: "nenhuma" },
  ],
};

const SERIE_EXEMPLO = [58, 61, 60, 64, 67, 66, 70, 72, 71, 74];

function Exemplo() {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-tinta-2">
      EXEMPLO
    </span>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold text-tinta">{titulo}</h3>
      {children}
    </div>
  );
}

function PainelDeComponentes() {
  return (
    <div className="space-y-8 bg-background p-6 text-foreground">
      <Bloco titulo="Símbolo e assinatura">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <MarcoMark size={40} title="Símbolo do Marco" />
          <MarcoLogo />
          <MarcoLogo comDescricao />
          <PoweredByPrint />
        </div>
      </Bloco>

      <Bloco titulo="Tensão: Macaé (fictício) fica em faixa Alta, com confiança moderada">
        <div className="flex items-center gap-2">
          <Exemplo />
          <span className="nota">Macaé fictício, tensão 74, faixa 47 a 84, confiança 63%</span>
        </div>
        <TensaoBar
          tensao={EXEMPLO.tensao}
          faixa={EXEMPLO.faixa}
          confianca={EXEMPLO.confianca}
          comparacao={{ valor: 67, rotulo: "há 7 dias" }}
        />
        <div>
          <p className="nota mb-2">Confiança baixa (hachura) e tensão não medida</p>
          <div className="grid gap-6 md:grid-cols-2">
            <TensaoBar tensao={31} faixa={{ min: 12, max: 58 }} confianca={38} escala={false} />
            <TensaoBar tensao={null} />
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {FAIXAS_TENSAO.map(f => (
            <li key={f.id} className="flex items-center gap-2 text-tinta">
              <span style={{ color: f.cor }}>
                <MarcaFaixa nivel={f.id} />
              </span>
              <span className="inline-block h-3 w-6" style={{ background: f.cor }} aria-hidden />
              {f.rotulo}
              <span className="num text-xs text-tinta-2">
                {f.min} a {f.max}
              </span>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Dimensões: a mais pressionada é Habitação e moradia; Meio ambiente não foi medida">
        <div className="flex items-center gap-2">
          <Exemplo />
        </div>
        <DimensoesTable dimensoes={EXEMPLO.dimensoes} />
        <div className="grid gap-4 md:grid-cols-2">
          <DimensoesTable dimensoes={undefined} />
          <DimensoesTable dimensoes={[]} carregando />
        </div>
      </Bloco>

      <Bloco titulo="KPI e tendência">
        <div className="flex items-center gap-2">
          <Exemplo />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile rotulo="Tensão territorial" valor={74} unidade="de 100" comparacao={{ delta: 7, rotulo: "há 7 dias" }} />
          <KpiTile rotulo="Sinais coletados" valor={1284} unidade="em 30 dias" comparacao={{ delta: -96, rotulo: "vs. 30 dias anteriores" }} />
          <KpiTile rotulo="Confiança" valor={63} unidade="%" />
          <KpiTile rotulo="Alertas abertos" valor={null} comparacao={{ delta: 0, rotulo: "vs. ontem" }} />
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Sparkline valores={SERIE_EXEMPLO} rotulo="Tensão nos últimos 10 dias" />
            <span className="nota">Tensão nos últimos 10 dias</span>
          </div>
          <Sparkline valores={[50]} rotulo="Tensão" />
        </div>
        <KpiTile rotulo="Carregando" valor={null} carregando className="max-w-xs" />
      </Bloco>

      <Bloco titulo="Saúde dos agentes: forma mais texto">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <StatusDot status="ok" rotulo="Ok, coletou há 3 min" />
          <StatusDot status="atencao" rotulo="Atenção, sem coleta há 26 h" />
          <StatusDot status="mudo" rotulo="Mudo, desligado" />
        </div>
      </Bloco>

      <Bloco titulo="Botões e chips">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Pedir diagnóstico</Button>
          <Button variant="secundario">Baixar relatório</Button>
          <Button variant="fantasma">Ver metodologia</Button>
          <Button disabled>Enviar pedido</Button>
          <Button size="sm">Coletar sinais</Button>
          <Chip>Macaé</Chip>
          <Chip tom="acento">Novo</Chip>
          <Chip tom="contorno">Estrutural</Chip>
        </div>
      </Bloco>

      <Bloco titulo="Estados">
        <div className="grid gap-4 md:grid-cols-3">
          <EmptyState
            titulo="Nenhum território acompanhado"
            descricao="Adicione um município para ver a primeira leitura de tensão."
            acao="Adicionar território"
          />
          <ErrorState
            motivo="A coleta de sinais deste município demorou mais que o limite."
            proximoPasso="Tente de novo em alguns minutos ou confira a saúde dos agentes."
            onAcao={() => undefined}
          />
          <LoadingBlock linhas={5} rotulo="Carregando leitura" />
        </div>
      </Bloco>
    </div>
  );
}

export default function Sistema() {
  const [vista, setVista] = useState<"lado" | "claro" | "escuro">("lado");
  return (
    <AppShell
      titulo="Sistema visual do Marco"
      itens={[{ href: "/sistema", rotulo: "Componentes" }]}
      acoes={
        <div role="group" aria-label="Modo de visualização" className="flex gap-1">
          {(
            [
              ["lado", "Lado a lado"],
              ["claro", "Só claro"],
              ["escuro", "Só escuro"],
            ] as const
          ).map(([id, rotulo]) => (
            <Button
              key={id}
              size="sm"
              variant={vista === id ? "secundario" : "fantasma"}
              aria-pressed={vista === id}
              onClick={() => setVista(id)}
            >
              {rotulo}
            </Button>
          ))}
        </div>
      }
    >
      <div className="space-y-8">
        <Secao
          titulo="Todos os componentes, nos dois modos"
          nota="Página interna do time. Todo dado aqui é EXEMPLO (Macaé fictício: tensão 74, faixa 47 a 84, confiança 63%). Regras em docs/redesign/03-design-system.md."
        >
          <div className={vista === "lado" ? "grid gap-6 xl:grid-cols-2" : "grid gap-6"}>
            {vista !== "escuro" && (
              <section aria-label="Modo claro" className="claro overflow-hidden rounded-[6px] border">
                <p className="border-b bg-card px-6 py-2 text-xs font-medium text-tinta-2">Modo claro</p>
                <PainelDeComponentes />
              </section>
            )}
            {vista !== "claro" && (
              <section aria-label="Modo escuro" className="dark overflow-hidden rounded-[6px] border">
                <p className="border-b bg-card px-6 py-2 text-xs font-medium text-tinta-2">Modo escuro</p>
                <PainelDeComponentes />
              </section>
            )}
          </div>
        </Secao>

        <Secao
          titulo="Shell público: cabeçalho com MarcoLogo e nav, rodapé com assinatura"
          nota="Prévia reduzida. O fundo de curvas de nível (prop hero) é só para o hero público."
        >
          <div className="overflow-hidden rounded-[6px] border">
            <PageShell hero className="min-h-0">
              <div className="container py-12">
                <h2 className="max-w-2xl text-3xl">Onde a tensão do território pesa mais, e com quanta certeza</h2>
                <p className="mt-3 max-w-prose text-tinta-2">Texto de exemplo do hero público.</p>
                <div className="mt-6">
                  <Button size="lg">Pedir diagnóstico</Button>
                </div>
              </div>
            </PageShell>
          </div>
        </Secao>
      </div>
    </AppShell>
  );
}
