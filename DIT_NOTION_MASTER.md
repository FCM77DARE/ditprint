# DIT — Print Territorial Intelligence™
> Documento mestre para organização no Notion · Atualizado em 07/05/2026

---

## 🏢 Visão Geral do Projeto

| Campo | Detalhe |
|-------|---------|
| **Produto** | DIT — Plataforma de Inteligência Territorial |
| **Empresa** | PRINT Comunicação |
| **Stack** | React 19 + Vite + Tailwind 4 · Express + tRPC 11 + Drizzle ORM + MySQL |
| **LLM** | OpenAI (via OPENAI_API_KEY) para cálculo do STT |
| **Dev local** | http://localhost:4000 |
| **Banco local** | MySQL via XAMPP · `dit_territorial` |
| **Repositório** | `C:\Users\Printrio\Desktop\dit-print\dit-territorial-intelligence` |

### Propósito
Democratizar a inteligência territorial que antes só estava disponível via consultorias caras. A plataforma monitora territórios em 6 dimensões e entrega um Score de Tensão Territorial (STT) diário, consolidado com LLM.

### Público-alvo
C-level de infraestrutura, energia e fundos de investimento.

### Modelo de negócio
- **Radar™** — assinatura · alertas diários por território
- **Diagnóstico** — ticket · análise aprofundada sob demanda
- **Inteligência Contínua** — modelo preditivo (fase futura)

---

## 📐 Metodologia PRINT — 6 Dimensões (v.0)

### Fórmula STT
```
STT = Σ (Di × Wi)   onde Σ Wi = 1.0

Dentro de cada dimensão:
Di = Σ (indicador × peso_indicador) / Σ pesos
```

| Dimensão | Peso |
|----------|------|
| D1 · Socioambiental | 0.22 |
| D2 · Socioeconômica | 0.15 |
| D3 · Infraestrutura e Serviços | 0.15 |
| D4 · Dinâmica Territorial | 0.22 |
| D5 · Governança e Articulação | 0.15 |
| D6 · Reputação e Visibilidade | 0.11 |

### D1 — Socioambiental
- **1.1 Bioma** — % APA, % APP, cumprimento da legislação ambiental
- **1.2 Vulnerabilidade Ambiental** — eventos extremos (últimos 5 anos), degradação
- **1.3 Passivos Ambientais** — acidentes com contaminação, TACs ativos, ACPs, empreendimentos médios/grandes

### D2 — Socioeconômica
- **2.1 População** — pirâmide etária, urbano/rural, densidade, IDH
- **2.2 Desigualdade** — renda per capita, desemprego/informalidade, taxa de pobreza, Gini

### D3 — Infraestrutura e Serviços
- **3.1 Acesso a Políticas Públicas** — saneamento, saúde, educação, habitação, resíduo sólido
- **3.2 Vocação Econômica** — indústrias, serviços, comércios, agricultura/pecuária
- **3.3 Logística** — transporte/mobilidade, rodovias, portos, hidrovias, aéreo

### D4 — Dinâmica Territorial
- **4.1 Uso e Ocupação** — zoneamento, áreas de lazer, empreendimentos previstos/atuantes
- **4.2 Conflitos de Uso** — poder público, setor privado, poder paralelo, sobrecarga de projetos
- **4.3 Expansão Urbana** — populações em áreas de risco
- **4.4 Populações tradicionais e assentamentos** — comunidades tradicionais, reconhecimento

### D5 — Governança e Articulação
- **5.1 Capacidade Institucional** — instituições e movimentos atuantes, conselhos, autogestão
- **5.2 Participação Social** — perfil comunitário, representatividade em controle social
- **5.3 Articulação com Poder Público** — TACs, orçamento participativo aplicado

### D6 — Reputação e Visibilidade
- **6.1 Mídia** — volume de buscas, matérias positivas/negativas, engajamento em redes sociais
- **6.2 Interesse Científico** — núcleos/centros de pesquisa, conselhos/comissões/comitês

### Governança de sinais
| Situação | Ação |
|----------|------|
| Impacto ≥ 0.7 | Alerta imediato (email + push) + registra para STT |
| 0.3 ≤ impacto < 0.7 | Registra para STT (silencioso) |
| Impacto < 0.3 | Registra mas não impacta STT |
| Ambíguo | Fallback para LLM em batch (não tempo real) |

> **Decisão confirmada:** classificação de sinais é **determinística** (regras, sem LLM por sinal). LLM entra apenas 1×/território/dia no cálculo consolidado do STT.

---

## 🗺️ Roadmap de Fases

### Status geral
| Fase | Nome | Sprints | Status |
|------|------|---------|--------|
| **Fase 0** | Fundação Técnica | 1–2 | ✅ Concluída |
| **Fase 1** | Indicadores e Governança | 3–4 | 🔲 Próxima |
| **Fase 2** | Arquitetura de Agentes | 5–8 | 🔲 Pendente |
| **Fase 3** | Modelagem e Cálculo | 9–10 | 🔲 Pendente |
| **Fase 4** | Monitoramento e Alertas | 11–14 | 🔲 Pendente |
| **Fase 5** | Frontend e Portal | paralela | ✅ Concluída |

---

## ✅ Fase 0 — Fundação Técnica (CONCLUÍDA)

### Segurança
| # | Tarefa | Status |
|---|--------|--------|
| S1 | Migrar hash de senhas SHA-256 → bcrypt cost 12+ | ✅ |
| S2 | JWT_SECRET: validação ≥ 32 chars + fail-fast no startup | ✅ |
| S3 | Rate limiting global + estrito no login (express-rate-limit) | ✅ |
| S4 | Criar `dashboardProcedure` middleware (proteção das rotas admin) | ✅ |

### Integridade de Dados
| # | Tarefa | Status |
|---|--------|--------|
| D1 | Unique index em `(territoryId, period)` para `sttScores` e `indexHistory` | ✅ |
| D2 | Foreign keys com `.references()` em todas as tabelas filhas | ✅ |
| D3 | Clamp 0–100 / 0.0–1.0 nos ranges do LLM | ✅ |
| D4 | Extrair seed data para `scripts/seed.ts` (fora do boot de produção) | ✅ |

### Arquitetura
| # | Tarefa | Status |
|---|--------|--------|
| A1 | Quebrar `routers.ts` monolítico em domain routers | ✅ |
| A2 | Env vars com validação fail-fast (`server/_core/env.ts`) | ✅ |
| A3 | Logging estruturado com `pino` (substituiu console.log) | ✅ |
| A4 | Bootstrap histórico movido para CLI (`scripts/bootstrap-history.ts`) | ✅ |

### Windows / Dev
| # | Tarefa | Status |
|---|--------|--------|
| W1 | Instalar `cross-env` + corrigir script `dev` para Windows | ✅ |
| W2 | Criar `.env` local com JWT_SECRET + DATABASE_URL + PORT=4000 | ✅ |
| W3 | Configurar MySQL XAMPP + criar banco `dit_territorial` + rodar migrações | ✅ |
| W4 | Criar admin via `node scripts/create-admin.mjs` | ✅ |
| W5 | Primeira coleta real: 127 sinais coletados (Google RSS, IBAMA, INPE, ANA, Querido Diário) | ✅ |

---

## ✅ Fase 5 — Frontend e Portal (CONCLUÍDA)

### Brandbook PRINT aplicado
| # | Tarefa | Status |
|---|--------|--------|
| B1 | Fonte Nunito (web substitute de Nexa) em todo o sistema | ✅ |
| B2 | Paleta Verde Floresta #2D5340 como primary | ✅ |
| B3 | Fundo Off-white #F5F1ED (warm paper) | ✅ |
| B4 | Padrão topográfico SVG como elemento gráfico do fundo | ✅ |
| B5 | Glass effect quente (off-white translúcido) | ✅ |
| B6 | Default theme light (brand editorial) | ✅ |
| B7 | STT Gauge com cores da paleta PRINT (Sálvia → Floresta → Dourado) | ✅ |

### tRPC + Rotas
| # | Tarefa | Status |
|---|--------|--------|
| R1 | Rota `territories.history` (slug → histórico STT) | ✅ |
| R2 | Rota `dashboard.getPendingScores` (scores aguardando publicação) | ✅ |
| R3 | Rota `dashboard.publishSttScore` (publicação humana) | ✅ |
| R4 | Rotas de alertas (`alertPreferences`, `alertLog`) com nível correto | ✅ |

### Componentes novos
| Componente | Descrição | Status |
|------------|-----------|--------|
| `AgentHealthPanel.tsx` | Status dos 39 agentes em tempo real | ✅ |
| `SignalFeed.tsx` | Feed SSE de sinais entrando | ✅ |
| `SttPublishPanel.tsx` | STT aguardando publicação humana | ✅ |
| `AlertConfigPanel.tsx` | Preferências do assinante | ✅ |
| `DevHub.tsx` | Hub de navegação local `/dev` | ✅ |

### Portal do Assinante (`/portal/*`)
| Rota | Componente | Status |
|------|------------|--------|
| `/portal` | RadarPortal | ✅ |
| `/portal/territorio/:slug` | RadarTerritoryPage | ✅ |
| `/portal/alertas` | RadarAlertas | ✅ |
| `/portal/configuracoes` | RadarConfiguracoes | ✅ |

### Bugs corrigidos
| Bug | Fix | Status |
|-----|-----|--------|
| `onSuccess` removido no TanStack Query v5 | Substituído por `useEffect` em `AlertConfigPanel` | ✅ |
| `label` missing em `<STTGauge>` | Adicionado `label="STT"` em `RadarTerritoryPage` | ✅ |
| `notifyOwner` lançando 500 em dev | Retorna `false` silencioso quando forge não configurado | ✅ |
| `NODE_ENV=` não reconhecido no Windows | `cross-env` + script corrigido | ✅ |

---

## 🔲 Fase 1 — Indicadores e Governança (PRÓXIMA)

### Tarefas
| # | Tarefa | Arquivo | Prioridade |
|---|--------|---------|------------|
| 1.1 | Criar `server/indicators.ts` com a planilha v.0 completa em código | `server/indicators.ts` (novo) | 🔴 Alta |
| 1.2 | Implementar fórmula STT com 6 dimensões e pesos configuráveis | `server/stt/calculator.ts` | 🔴 Alta |
| 1.3 | Migração `drizzle/0008_six_dimensions.sql` — adicionar `d1_score`..`d6_score` | `drizzle/schema.ts` | 🔴 Alta |
| 1.4 | Nova tabela `indicators` (master data) e `indicator_scores` (por período) | `drizzle/schema.ts` | 🔴 Alta |
| 1.5 | Criar premissas LLM por dimensão (`server/premises/d1.md`..`d6.md`) | `server/premises/` (novo) | 🟡 Média |
| 1.6 | Aumentar LLM thinking budget: 128 → 4096 tokens | `server/_core/llm.ts:299-301` | 🟡 Média |
| 1.7 | Manter `itt`, `ics`, `ivs`, `ive`, `ici` por 1 release (backwards compat) | `server/stt/calculator.ts` | 🟢 Baixa |

### Interface de dados (`server/indicators.ts`)
```typescript
interface Indicator {
  id: string;           // ex: "apa-percentual"
  code: string;         // ex: "1.1.1.1" (da planilha)
  dimension: 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6';
  objectOfStudy: string;
  name: string;
  itemOfStudy: string;
  sources: SourceId[];
  weight: 1 | 2 | 3;
  premises: string;
}
```

---

## 🔲 Fase 2 — Arquitetura de Agentes (39 agentes)

### Hierarquia
```
ORQUESTRADOR
  ↓
D1 · D2 · D3 · D4 · D5 · D6  (6 agentes de dimensão)
  ↓
32 agentes de fonte (1 por fonte de dados)
```

### Agentes de Fonte por Dimensão

#### D1 — Socioambiental (8 agentes)
| ID | Fonte | Método | Indicadores-chave |
|----|-------|--------|-------------------|
| `src-cnuc` | CNUC/ICMBio | API dados abertos | % APA |
| `src-secretarias-ma` | Secretarias Meio Ambiente | Apify | % APP, legislação |
| `src-ibama` | IBAMA Dados Abertos | API dadosabertos.ibama.gov.br | Embargos, autos |
| `src-cemaden` | CEMADEN | API | Eventos climáticos |
| `src-inmet` | INMET | API apitempo.inmet.gov.br | Clima, extremos |
| `src-fiocruz-clima` | Fiocruz / Clima Adapt | Scraper | Degradação ambiental |
| `src-inpe-deter` | INPE TerraBrasilis | WFS | DETER, PRODES, IDA |
| `src-mp-ambiental` | Ministério Público | Apify | TACs, ACPs |

#### D2 — Socioeconômica (4 agentes)
| ID | Fonte | Método | Indicadores-chave |
|----|-------|--------|-------------------|
| `src-ibge-censo` | IBGE Agregados | API servicodados.ibge.gov.br | População, densidade |
| `src-ibge-renda` | IBGE/PNAD | API | Renda, emprego, informalidade |
| `src-ipeadata` | IPEAData | API | Gini, pobreza |
| `src-pnud-atlas` | PNUD / Atlas IDH | Scraper | IDH |

#### D3 — Infraestrutura (7 agentes)
| ID | Fonte | Método | Indicadores-chave |
|----|-------|--------|-------------------|
| `src-snis-sinasa` | SNIS/SINASA | API MDR | Saneamento |
| `src-datasus` | DataSUS/TABNET | API | Saúde |
| `src-inep` | INEP | API | Educação |
| `src-ibge-habitacao` | IBGE (déficit habit.) | API | Habitação |
| `src-sinir` | SINIR | Scraper | Resíduo sólido |
| `src-mapa-empresas` | IBGE + Mapa de Empresas | API | Indústrias, serviços, agro |
| `src-antt-portos` | ANTT + Min. Portos | API | Logística |

#### D4 — Dinâmica Territorial (7 agentes)
| ID | Fonte | Método | Indicadores-chave |
|----|-------|--------|-------------------|
| `src-plano-diretor` | Prefeituras / Plano Diretor | Apify | Zoneamento |
| `src-judiciario` | TJ, TRF, STF | Apify | Conflitos jurídicos |
| `src-fogo-cruzado` | Instituto Fogo Cruzado | API api.fogocruzado.org.br | Poder paralelo |
| `src-geni-uff` | GENI/UFF | Apify | Poder paralelo (análises) |
| `src-isp-ssp` | ISP-RJ e SSPs estaduais | Apify | Violência |
| `src-funai-iphan` | FUNAI + IPHAN | Apify | Populações tradicionais |
| `src-unicamp-terr` | Territórios Tradicionais (Unicamp) | Apify | Reconhecimento de comunidades |

#### D5 — Governança (4 agentes)
| ID | Fonte | Método | Indicadores-chave |
|----|-------|--------|-------------------|
| `src-querido-diario` | Querido Diário | API queridodiario.ok.org.br | Atos oficiais, TACs |
| `src-conselhos` | Conselhos Municipais + Sindicatos | Apify | Capacidade institucional |
| `src-audiencias` | Audiências / Comissões (YouTube) | Whisper | Participação social |
| `src-orcamento-participativo` | PPA, OP, Prestação de Contas | Apify | Articulação poder público |

#### D6 — Reputação (4 agentes)
| ID | Fonte | Método | Indicadores-chave |
|----|-------|--------|-------------------|
| `src-google-news` | Google News RSS | RSS | Matérias sobre o território |
| `src-google-trends` | Google Trends | SerpAPI | Volume de buscas |
| `src-redes-sociais` | Instagram, X, TikTok | Apify | Engajamento |
| `src-universidades` | Universidades / CAPES / SciELO | Apify | Interesse científico |

### Estrutura de arquivos planejada
```
server/agents/
  orchestrator.ts
  base-dimension.ts
  base-source.ts
  dimensions/
    dim-socioambiental.ts   (D1)
    dim-socioeconomico.ts   (D2)
    dim-infraestrutura.ts   (D3)
    dim-dinamica.ts         (D4)
    dim-governanca.ts       (D5)
    dim-reputacao.ts        (D6)
  sources/
    d1/  (8 arquivos)
    d2/  (4 arquivos)
    d3/  (7 arquivos)
    d4/  (7 arquivos)
    d5/  (4 arquivos)
    d6/  (4 arquivos)
```

### Tarefas
| # | Tarefa | Prioridade |
|---|--------|------------|
| 2.1 | Criar `base-source.ts` com classe abstrata para agentes de fonte | 🔴 Alta |
| 2.2 | Criar `base-dimension.ts` com lógica de agregação e classificação | 🔴 Alta |
| 2.3 | Implementar os 8 agentes D1 | 🔴 Alta |
| 2.4 | Implementar os 4 agentes D2 | 🔴 Alta |
| 2.5 | Implementar os 7 agentes D3 | 🟡 Média |
| 2.6 | Implementar os 7 agentes D4 | 🟡 Média |
| 2.7 | Implementar os 4 agentes D5 | 🟡 Média |
| 2.8 | Implementar os 4 agentes D6 | 🟡 Média |
| 2.9 | Criar `orchestrator.ts` — consolida STT diário | 🔴 Alta |

---

## 🔲 Fase 3 — Modelagem e Cálculo

### Tarefas
| # | Tarefa | Arquivo | Prioridade |
|---|--------|---------|------------|
| 3.1 | Engine de cálculo STT com 6 dimensões + verificação pós-LLM (tolerância ±0.5) | `server/stt/calculator.ts` | 🔴 Alta |
| 3.2 | Migrar configs hardcoded de território → `territories.contextData` (JSON) | `server/collector.ts` + 3 outros | 🔴 Alta |
| 3.3 | Trocar `float` por `decimal(5,2)` nos scores do banco | `drizzle/schema.ts` | 🟡 Média |
| 3.4 | Anomaly detection: desvio > 2σ → flag; delta > 5 em 24h → "escalada" | `server/agents/orchestrator.ts` | 🟡 Média |

---

## 🔲 Fase 4 — Monitoramento e Alertas

### Ciclo diário planejado
```
00:00–05:59  Coleta contínua · alertas em tempo real (impacto ≥ 0.7)
06:00        Sweep completo das 32 fontes
06:30        Agentes de dimensão agregam e classificam
07:00        Orquestrador → LLM calcula STT + rationale
07:30        STT pendente no dashboard
[HUMANO]     Analista PRINT valida e publica
08:00        Briefing diário → email assinantes
Sexta 18:00  One-pager semanal PDF → email
```

### Motor de alertas (`server/alertEngine.ts`)
| Canal | Trigger | Implementação |
|-------|---------|---------------|
| Push mobile | impacto ≥ 0.7 | Firebase Cloud Messaging |
| Email | impacto ≥ 0.7 + briefings | SendGrid ou Resend |
| Dashboard SSE | todos os sinais | Server-Sent Events (já existe base) |
| WhatsApp Business | futuro | Meta Business API |

### Novas tabelas de banco
| Tabela | Campos principais |
|--------|------------------|
| `alert_preferences` | subscriber_id, territory_id, channels (JSON), min_impact_threshold, quiet_hours, digest_frequency |
| `alert_log` | subscriber_id, signal_id, channel, sent_at, delivered, opened |

### Tarefas
| # | Tarefa | Prioridade |
|---|--------|------------|
| 4.1 | Implementar `server/alertEngine.ts` — classificação + despacho multi-canal | 🔴 Alta |
| 4.2 | Integrar Firebase Cloud Messaging (push mobile) | 🔴 Alta |
| 4.3 | Integrar Resend ou SendGrid (email) | 🔴 Alta |
| 4.4 | Dashboard tab "Saúde dos Indicadores" — status de cada agente | 🟡 Média |
| 4.5 | Dashboard tab "Feed de Sinais" — leitura ao vivo | 🟡 Média |
| 4.6 | Dashboard tab "Alertas Disparados" — sinais impacto ≥ 0.7 | 🟡 Média |
| 4.7 | Dashboard tab "Configuração" — pesos, thresholds, fontes ativas | 🟡 Média |
| 4.8 | One-pager semanal PDF automático | 🟢 Baixa |

---

## 📋 Backlog Técnico (fora das fases)

| # | Item | Origem | Prioridade |
|---|------|--------|------------|
| BT-01 | PDF export de one-pagers | Auditoria inicial | 🟡 Média |
| BT-02 | Remover seed data fictícia do boot | Auditoria inicial | 🔴 Alta (já em D4 Fase 0) |
| BT-03 | Site público com dados dinâmicos do banco (atualmente parcialmente hardcoded) | Auditoria inicial | 🟡 Média |
| BT-04 | Painel comparativo de STT entre territórios | Produto | 🟡 Média |
| BT-05 | Rota unificada `/territorio/:slug` | Frontend | ✅ Feito |
| BT-06 | `EscalationBanner` quando STT ≥ 75 | Frontend | 🟢 Baixa |
| BT-07 | Dados primários PRINT (entrevistas, campo) | Metodologia | ⏸️ Fora de escopo nesta fase |

---

## 🔧 Arquitetura Técnica Atual

### Stack completa
```
Frontend
  React 19 · Vite 7 · Tailwind 4
  tRPC client 11 · TanStack Query 5
  Wouter (roteamento) · Framer Motion
  shadcn/ui (Radix primitives) · Recharts
  Nunito (Google Fonts) · JetBrains Mono

Backend
  Express 4 · tRPC server 11
  Drizzle ORM 0.44 · MySQL2
  Jose (JWT) · bcrypt · pino (logs)
  express-rate-limit · nanoid

LLM / AI
  OpenAI API (OPENAI_API_KEY)
  Compatível com BUILT_IN_FORGE_API_KEY (Manus)

Infra local (dev)
  XAMPP MySQL · localhost:3306
  Porta app: 4000
```

### Variáveis de ambiente (`.env`)
```env
JWT_SECRET=<min 32 chars>
DATABASE_URL=mysql://root:@localhost:3306/dit_territorial
OPENAI_API_KEY=sk-...
NODE_ENV=development
PORT=4000
```

### Scripts disponíveis
| Comando | O que faz |
|---------|-----------|
| `pnpm dev` | Sobe o servidor em desenvolvimento (porta 4000) |
| `pnpm build` | Build de produção (Vite + esbuild) |
| `pnpm check` | TypeScript sem emitir |
| `pnpm test` | Vitest |
| `pnpm db:push` | Gera + aplica migrações Drizzle |
| `pnpm bootstrap:history` | Coleta histórico de 24 meses |
| `pnpm admin:create` | Cria usuário admin |

---

## 🎨 Design System PRINT

### Paleta de cores
| Token | Nome | Hex |
|-------|------|-----|
| `--primary` | Verde Floresta | `#2D5340` |
| `--background` | Off-white | `#F5F1ED` |
| `--accent` | Verde Sálvia | `#6B9B7C` |
| `--foreground` | Grafite | `#2C2C2C` |
| `--border` | Areia | `#D4C9B8` |
| `--chart-1` | Azul Ardósia | `#5B8FA3` |
| `--chart-3` | Dourado | `#D4A574` |
| `--chart-5` | Marrom | `#6B5346` |

### Tipografia
| Uso | Família | Peso |
|-----|---------|------|
| Display / Headings | Nunito | 800 (ExtraBold) |
| Body | Nunito | 400–600 |
| Dados / Código | JetBrains Mono | 400–700 |

### Elemento gráfico
- **Padrão topográfico** em SVG como textura de fundo (`.bg-topo-pattern`)
- **Glass effect quente** — off-white translúcido (`oklch(0.96 0.01 75 / 0.82)`)

---

## 📅 Cronograma

| Sprint | Fase | Objetivo |
|--------|------|----------|
| 1–2 | Fase 0 | ✅ Segurança, integridade, arquitetura de base |
| 3–4 | Fase 1 | 🔲 Tabela indicators, premissas LLM, schema 6 dimensões |
| 5–8 | Fase 2 | 🔲 32 agentes de fonte + 6 de dimensão + orquestrador |
| 9–10 | Fase 3 | 🔲 Engine de cálculo, anomaly detection |
| 11–14 | Fase 4 | 🔲 Alert engine, dashboard completo, portal assinante |
| 15–16 | QA | 🔲 Testes E2E + documentação |

*Fase 5 (Frontend) rodou em paralelo e está concluída.*

---

## ✅ Ciclo de validação por sprint

```
1. pnpm check    — TypeScript limpo
2. pnpm test     — Testes passando
3. pnpm build    — Build de produção ok
4. Teste manual  — Criar território → coletar sinais → STT → publicar → briefing
```

---

*Gerado por Claude Code · DIT — Print Territorial Intelligence™*
