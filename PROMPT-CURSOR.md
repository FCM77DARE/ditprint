# Prompt para Cursor — DIT / Print Territorial Intelligence™

Cole este prompt no Cursor (ou no chat do Claude/GPT integrado ao Cursor) ao abrir o projeto.

---

## Contexto do Projeto

Você está trabalhando no **DIT — Print Territorial Intelligence™**, uma plataforma de inteligência territorial que:

1. Coleta sinais de múltiplas fontes (notícias, dados ambientais, dados socioeconômicos, atos oficiais)
2. Calcula um **Score de Tensão Territorial (STT 0–100)** composto por 5 sub-índices
3. Exibe análises históricas de 24 meses por território
4. Publica os dados em um site público e em um dashboard administrativo protegido

### Stack Técnica

- **Frontend:** React 19 + Vite + Tailwind CSS 4 + shadcn/ui + Recharts
- **Backend:** Express 4 + tRPC 11 + Drizzle ORM
- **Banco:** MySQL/TiDB (via `DATABASE_URL`)
- **Auth:** JWT customizado para dashboard admin + Manus OAuth para usuários
- **LLM:** `server/_core/llm.ts` → `invokeLLM()` (OpenAI-compatible)
- **Armazenamento:** S3 via `server/storage.ts` → `storagePut()`

---

## Arquitetura de Dados

### Tabelas principais (ver `drizzle/schema.ts`)

| Tabela | Descrição |
|--------|-----------|
| `territories` | Territórios cadastrados (slug, name, region, contextData JSON) |
| `signals` | Sinais coletados (notícias + dados estruturados) com análise LLM |
| `index_history` | Série histórica mensal: STT + 5 sub-índices + deltas + narrativa LLM |
| `collection_snapshots` | Snapshots brutos de cada coleta por fonte |
| `admins` | Usuários do dashboard admin |

### Os 5 Sub-índices do STT

| Sigla | Nome | Fontes de dados |
|-------|------|-----------------|
| **ITT** | Índice de Tensão Territorial | Google News RSS, Querido Diário |
| **ICS** | Índice de Complexidade Socioambiental | IBGE, INPE/DETER, PRODES |
| **IVS** | Índice de Vulnerabilidade Social | IBGE Censo 2022, rendimento domiciliar |
| **IVE** | Índice de Vulnerabilidade Ecossistêmica | IBAMA embargos, ANA outorgas, INPE alertas |
| **ICI** | Índice de Complexidade Institucional | Querido Diário, IBAMA autos de infração |

**Fórmula STT:** média ponderada dos 5 índices (pesos configuráveis em `server/territoryContext.ts`)

---

## Estrutura de Arquivos Chave

```
server/
  routers.ts          ← Todas as procedures tRPC (signals, analytics, historical, publicData)
  db.ts               ← Query helpers (getSignalsByTerritory, getIndexHistory, etc.)
  dataCollector.ts    ← Coleta de dados estruturados (IBAMA, IBGE, INPE, ANA, QD)
  collector.ts        ← Coleta de notícias (Google News RSS + NewsAPI)
  historicalCollector.ts ← Coleta retroativa de 24 meses
  scheduler.ts        ← Agendamento automático (coleta diária + mensal)
  territoryContext.ts ← Contexto territorial para o LLM (metodologia DIT)
  dashboardAuth.ts    ← Auth do dashboard admin (JWT)
  storage.ts          ← S3 helpers

client/src/
  pages/
    Home.tsx              ← Site público (dados dinâmicos do banco)
    Dashboard.tsx         ← Dashboard admin principal
    AnalyticsPanel.tsx    ← Histórico temporal (gráficos + tabela + expansão de sinais)
    TerritoryComparison.tsx ← Comparativo de STT entre territórios
    TerritoryPage.tsx     ← Página pública de território (/territorio/:slug)
  components/
    STTGauge.tsx          ← Gauge circular do STT
    Header.tsx            ← Header do site público

drizzle/
  schema.ts           ← Schema completo do banco
```

---

## Variáveis de Ambiente Necessárias

Crie um arquivo `.env` na raiz com:

```env
# Banco de dados (MySQL/TiDB)
DATABASE_URL=mysql://user:password@host:port/database

# JWT para dashboard admin
JWT_SECRET=seu-jwt-secret-aqui

# LLM (OpenAI-compatible)
BUILT_IN_FORGE_API_URL=https://api.openai.com/v1
BUILT_IN_FORGE_API_KEY=sk-...

# NewsAPI (opcional — o sistema usa Google News RSS como principal)
NEWS_API_KEY=sua-newsapi-key

# S3 (para armazenamento de arquivos)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_BUCKET_NAME=...

# OAuth Manus (opcional — apenas se usar auth de usuários)
VITE_APP_ID=...
OAUTH_SERVER_URL=...
VITE_OAUTH_PORTAL_URL=...
VITE_FRONTEND_FORGE_API_KEY=...
VITE_FRONTEND_FORGE_API_URL=...
```

---

## Como Rodar Localmente

```bash
# Instalar dependências
pnpm install

# Criar as tabelas no banco
pnpm db:push

# Iniciar o servidor de desenvolvimento
pnpm dev
```

O servidor roda em `http://localhost:3000`.

---

## Fontes de Dados a Conectar (Pendentes)

As seguintes fontes já têm estrutura no código mas precisam de ajuste de endpoint ou credencial:

### 1. IBAMA — Embargos e Autos de Infração
- **Arquivo:** `server/dataCollector.ts` → função `collectIbama()`
- **Endpoint atual:** `https://servicos.ibama.gov.br/ctf/publico/areasembargadas/ConsultaPublicaAreasEmbargadas.php`
- **O que falta:** O endpoint retorna HTML; implementar parser ou usar a API REST do IBAMA: `https://dadosabertos.ibama.gov.br/`
- **Índices afetados:** IVE, ICI

### 2. ANA — Agência Nacional de Águas
- **Arquivo:** `server/dataCollector.ts` → função `collectAna()`
- **Endpoint atual:** `https://www.snirh.gov.br/hidroweb/rest/api/documento/convencionais`
- **O que falta:** Autenticação e filtro por bacia hidrográfica do território
- **Índices afetados:** IVE

### 3. INPE/DETER — Alertas de Desmatamento
- **Arquivo:** `server/dataCollector.ts` → função `collectInpe()`
- **Endpoint atual:** `http://terrabrasilis.dpi.inpe.br/geoserver/deter-amz/ows`
- **O que falta:** Filtro geoespacial por polígono do território (bbox)
- **Índices afetados:** IVE, ICS

### 4. IBGE — Dados Socioeconômicos
- **Arquivo:** `server/dataCollector.ts` → função `collectIbge()`
- **Endpoint atual:** `https://servicodados.ibge.gov.br/api/v3/agregados/`
- **O que falta:** Mapear municípios do território para os códigos IBGE corretos
- **Índices afetados:** IVS, ICS

### 5. Querido Diário — Atos Oficiais
- **Arquivo:** `server/dataCollector.ts` → função `collectQueridoDiario()`
- **Endpoint atual:** `https://queridodiario.ok.org.br/api/gazettes`
- **O que falta:** Filtro por `territory_ids` (IDs municipais do QD) para cada território
- **Índices afetados:** ICI, ITT

---

## Como Adicionar uma Nova Fonte de Dados

1. **Adicionar a função de coleta** em `server/dataCollector.ts`:
```typescript
export async function collectMinhaFonte(territory: Territory): Promise<CollectedData[]> {
  // Buscar dados da API
  const response = await fetch(`https://api.minhafonte.gov.br/dados?territorio=${territory.slug}`);
  const data = await response.json();
  
  // Retornar no formato padrão
  return data.items.map(item => ({
    title: item.titulo,
    content: item.descricao,
    source: 'MinhaFonte',
    sourceType: 'structured', // ou 'news'
    publishedAt: new Date(item.data),
    url: item.url,
    relatedIndex: 'IVE', // qual índice este dado afeta
    metadata: { raw: item },
  }));
}
```

2. **Chamar a função** dentro de `collectAllSources()` em `server/dataCollector.ts`

3. **Salvar os sinais** — o sistema já salva automaticamente via `saveSignals()` em `server/db.ts`

4. **Testar** com `pnpm test` (os testes ficam em `server/*.test.ts`)

---

## Como o Cálculo do STT Funciona

O STT é calculado pelo LLM em `server/historicalCollector.ts` → `calculateSttWithLLM()`:

1. Coleta todos os sinais do período (mês/ano)
2. Envia para o LLM com o contexto territorial (`server/territoryContext.ts`)
3. O LLM retorna: `{ stt, itt, ics, ivs, ive, ici, scenario, llmRationale, keyEvents }`
4. O resultado é salvo em `index_history`

O prompt do LLM usa a metodologia DIT completa (pesos, critérios, escala) definida em `server/territoryContext.ts`.

---

## Pendências Conhecidas

- [ ] **Exportar One-Pager como PDF** — implementar em `client/src/pages/Dashboard.tsx` usando `@react-pdf/renderer`
- [ ] **Remover seed de dados fictícios** — após coleta real completa, apagar registros com `source = 'import'` da tabela `index_history`
- [ ] **Filtro geoespacial nas APIs** — INPE e IBAMA precisam de polígono/bbox por território
- [ ] **Mapeamento de municípios** — cada território precisa de lista de códigos IBGE e IDs do Querido Diário
- [ ] **Agendamento automático** — já implementado em `server/scheduler.ts`, verificar se está rodando corretamente em produção
- [ ] **Conectar botão "Publicar Alerta"** com envio de e-mail (Resend ou SendGrid)

---

## Padrão de Código

- **Procedures tRPC:** sempre em `server/routers.ts` (ou `server/routers/feature.ts` se crescer)
- **Query helpers:** sempre em `server/db.ts` — nunca SQL direto nas procedures
- **Frontend:** sempre usar `trpc.*.useQuery/useMutation` — nunca fetch/axios direto
- **Tipos compartilhados:** em `shared/types.ts`
- **Constantes:** em `shared/const.ts`

---

## Credenciais do Dashboard Admin

Para criar o primeiro admin, rode:
```bash
node scripts/create-admin.mjs
```

O script solicita nome, e-mail e senha e insere na tabela `admins`.
