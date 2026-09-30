# DIT, redesign total: arquitetura de informação e fluxo

Postos: ag_ux_pesquisa + ag_ux_arquitetura + ag_ux_fluxo (p_design) · 30/09/2026 · base: auditoria de `client/src` (19 mil linhas) e de `server/routers.ts`.
Padrões citados pelo código: T01 a T18 e "E1 a E20" (20 erros de amador) de `design-de-produto/PADROES-TRANSVERSAIS.md`. Lei da cidade 8: número, cliente ou resultado nunca é inventado.
Posicionamento: Entrar (due diligence), Operar (Radar), Responder (leitura fria). Crise não é a proposta de valor. Headline "Toda operação tem um CEP.", tese "O território decide.". STT = Score de Tensão Territorial, publicado por humano.

---

## 0. Diagnóstico em 8 linhas (o que decide o redesign)

1. **O gate humano não gateia nada.** `orchestrator.ts:480-545` grava `stt_scores` com `published:false` e, na sequência, grava direto em `index_history`. Landing, portal e `/territorio/:slug` leem `index_history` (`db.ts:470-510`, `getPublicTerritoryDetail`). Publicar (`dashboard.publishSttScore`) só vira um flag que ninguém lê.
2. **A promessa central do Radar nunca chega ao assinante.** A Nota Executiva (vendida em `RadarTerritorial.tsx:50-56`) não é exposta por nenhuma procedure pública; o portal só mostra número e delta.
3. **O portal não tem assinante.** Sem login, sem vínculo assinante x território (`subscribers` só tem `territoryInterest` varchar). `DEMO_EMAIL = "analista@print.com.br"` hardcoded em `RadarTerritoryPage.tsx:22` e `RadarConfiguracoes.tsx:15`. `alertPreferences.*` e `alertLog.recent` são `publicProcedure` por e-mail: qualquer um lê e edita a config de qualquer e-mail.
4. **Números inventados em produção.** `TerritoryDetail.tsx:182` (`Math.random()`, "Fontes Locais" 800 a 1500) e `:187` (`92 + Math.random()*6`, "Confiança Preditiva"). Landing: "47 territórios", "32 agentes", "35 fontes", STT 78/64/89 fixos.
5. **A metodologia pública contradiz o motor.** `Methodology.tsx:153` publica 7 dimensões e pesos 20/14/14/20/12/10/10; o motor (`calculator.ts:32`, `consolidator.ts:64`) usa 6 dimensões 0,22/0,15/0,15/0,22/0,15/0,11 e D7 = 0. A sigla é escrita "Score de Território Total" em 3 lugares.
6. **Toda conversão é buraco.** 9 botões "Agendar conversa" sem `onClick` nem `href`; o formulário do Radar (`RadarTerritorial.tsx:197-200`) só faz `setSubmitted(true)`, sem rede; `/api/dit/lead` existe no servidor e nenhum componente o chama; `subscribers.subscribe` idem.
7. **Três produtos e três vocabulários.** Landing vende DIT/Radar/SSE; `/radar` vende Radar; `/sse` e `TelesPires` usam o modelo antigo de 5 eixos (ITT, ICS, IVS, IVE, ICI), que também sobrevive em `TerritoryWizard.tsx:19,391`. O modelo de negócio é Radar e Diagnóstico.
8. **Visual decorativo onde o dado deveria mandar.** Gauge circular com glow (E1, T05), `text-glow` e `glass` em 100+ usos, `scanline`, `hover:scale`, `transition-all` em 93 pontos (E16, T14, T15), radar chart no command center (E1).

---

## 1. Inventário

### 1.1 Rotas registradas em `App.tsx`

| Rota | Arquivo (linhas) | O que faz | Quem usa | Dados (tRPC / HTTP) | Situação |
|---|---|---|---|---|---|
| `/` | LandingSimple (432) | Busca um território, espera 30 a 60 s, mostra relatório inline, prova social, ecossistema, CTA | Prospect | `POST /api/dit/analyze` (fetch), `GET /api/alerts/stream` (via SignalFeed) | Viva, principal. Conteúdo inventado e CTA morto |
| `/sse` | SSE (515) | Exposição setorial, barras e "radar", entregáveis | Prospect | nenhum (tudo hardcoded) | Viva mas fora do modelo Radar e Diagnóstico. Remover |
| `/metodologia` | Methodology (371) | Fórmula do STT, dimensões, pesos | Prospect | nenhum (hardcoded) | Viva, **contradiz o motor** |
| `/territorio/:slug` | TerritoryDetail (398) | Ficha pública do território: gauge, D1 a D7, hotspots, mapa, bloqueio "Inteligência Restrita" | Prospect | `publicData.territoryDetail` | Viva. Números aleatórios, lê dado não publicado |
| `/radar` | RadarTerritorial (978) | Página de venda do Radar, FAQ, formulário de cadastro | Prospect | nenhum (form local) | Legada, formulário não envia nada |
| `/portal` | RadarPortal (140) | Cards de todos os territórios + feed SSE | Assinante | `publicData.territories`, `GET /api/alerts/stream` | Viva, sem auth, mostra todos os territórios |
| `/portal/territorio/:slug` | RadarTerritoryPage (132) | Gauge, 6 barras de histórico, feed, config de alerta | Assinante | `publicData.territories`, `territories.history`, `alertPreferences.list/upsert` | Viva, e-mail demo |
| `/portal/alertas` | RadarAlertas (155) | Tabela do `alert_log` por território | Assinante | `publicData.territories`, `alertLog.recent` | Viva |
| `/portal/configuracoes` | RadarConfiguracoes (67) | Um AlertConfigPanel por território | Assinante | `publicData.territories`, `alertPreferences.list/upsert` | Viva, e-mail demo |
| `/dashboard` | Dashboard (1448) | Mesa interna: 8 abas (sinais, STT, publicar, feed, agentes, analytics, one-pager, assinantes) + aba Novo Território | Operador PRINT | `territories.list`, `signals.list/curate/collect/collectStructuredData/analyze`, `stt.latest/history/upsert`, `subscribers.list`, `onepager.generate`, `dashboardAuth.logout` | Viva, 1448 linhas, tudo atrás de abas |
| `/dashboard/dit/:slug` | DITCommandCenter (262) | "Command Center Premium": radar chart + área do STT | Operador | `territories.list`, `analytics.indexHistory` | Viva, duplica AnalyticsPanel |
| `/dashboard/login` | DashboardLogin (117) | Login do operador | Operador | `dashboardAuth.login` | Viva |
| `/dev` | DevHub (531) | Atalhos de desenvolvimento | Dev | `fetch /api/trpc/system.health` (procedure `system.health` não existe no `appRouter`) | **Morta em produção**, exposta no Header público |
| `/404` e `*` | NotFound (52) | 404 | Todos | nenhum | Viva |

### 1.2 Páginas e componentes sem rota (confirmado com Grep de `import`)

| Arquivo | Importado por | Veredito |
|---|---|---|
| `pages/Home.tsx` (511) | só `App.tsx` (import sem `<Route>`) | **Morta.** Landing antiga, carrossel por `publicData.territories`. Remover |
| `pages/TelesPires.tsx` (441) | ninguém | **Morta.** Estudo de caso hardcoded no modelo de 5 eixos. Remover (o caso real vira ficha pública publicada) |
| `pages/ComponentShowcase.tsx` (1437) | ninguém | **Morta.** Catálogo shadcn. Remover |
| `pages/AnalyticsPanel.tsx` (711) | Dashboard (aba "analytics") | Absorvida pela tela de análise da Mesa |
| `pages/TerritoryWizard.tsx` (532) | Dashboard (aba "Novo Território") | Reescrever com 6 dimensões e `territories.create`; sai da aba |
| `components/STTGauge.tsx` | Home, RadarPortal, RadarTerritoryPage, SSE, TelesPires, TerritoryDetail | **Remover** (T05, E1). 4 dos 6 importadores também saem |
| `components/SignalFeed.tsx` | Dashboard, LandingSimple, RadarPortal, RadarTerritoryPage | Substituir por lista de eventos em polling (seção 4) |
| `components/EscalationBanner.tsx` | RadarPortal, RadarTerritoryPage | Remover (faixa vermelha cheia contradiz T04 e o posicionamento) |
| `components/AgentHealthPanel.tsx` | Dashboard | Reescrever como `/mesa/fontes` |
| `components/SttPublishPanel.tsx` | Dashboard | Reescrever como `/mesa/publicacao` |
| `components/AlertConfigPanel.tsx` | RadarConfiguracoes, RadarTerritoryPage | Reaproveitar a lógica em `/portal/conta` |
| `components/DiagnosisReport.tsx` (781) | LandingSimple | Reescrever (CSS embutido de 200 linhas fora dos tokens, E17) |
| `components/Map.tsx` | TerritoryDetail | Só se receber coordenadas reais do território (hoje `TerritoryDetail.tsx:257` renderiza mapa sem marcar nada) |
| `components/AIChatBox.tsx`, `ManusDialog.tsx`, `DashboardLayout*.tsx` | só ComponentShowcase ou ninguém | **Mortos.** `trpc.ai.chat` não existe no `appRouter` |
| `components/ui/*` (55 arquivos) | parcial | Manter só o que a nova UI usa; tirar o resto do bundle |

### 1.3 Procedures sem consumidor no front (existem no servidor)

`territories.bySlug/listAll/toggle`, `stt.all`, `signals.pendingCount/confirmStt/listByPeriod` (só AnalyticsPanel), `subscribers.subscribe/byTerritory`, `scheduler.*`, `historical.collectAll/backfillSignalsAll`, `analytics.collectionSnapshots`, `publicData.sampleSignals/territoriesComparison`, `alertPreferences.deactivate`, `alertLog.markOpened`, `digest.send`, `system.health` (chamada pelo front, não existe). A Mesa nova deve consumir `scheduler.status/runNow`, `analytics.collectionSnapshots` e `subscribers.byTerritory`, que hoje ninguém vê.

---

## 2. Problemas por página

Formato: `arquivo:linha` · problema · padrão violado.

### 2.1 Landing (`LandingSimple.tsx`) e Header

| Onde | Problema | Padrão |
|---|---|---|
| `LandingSimple.tsx:163-167` | Headline "Conheça o território em que você está inserido." Não é a aprovada; promete conhecimento, não decisão | T01, posicionamento |
| `:205` | "monitorando 47 territórios estratégicos" sem fonte; o banco tem `territories.active` | Lei 8, T03 |
| `:22` | "Ativando 32 agentes PRINT"; o painel interno fala em 39 (`AgentHealthPanel.tsx:2`); o repo tem fontes por dimensão. Três números diferentes | Lei 8, T02 |
| `:19-25` | Emojis como ícones de etapa; animação de etapas por `setTimeout` fingida (marcos fixos em ms), não reflete o progresso real | E16, T12 |
| `:107-121` | "Casos de Sucesso DIT" com STT 78/64/89 e texto em itálico entre aspas (parece depoimento) sem cliente nem fonte | Lei 8, E5 |
| `:293,299,321-322` | "Live Engine Feed", "Inteligência em Tempo Real", "milhares de sinais diários", "Prova Social": inglês e adjetivo sem número | T08, E18 |
| `:147` | Card "DIT Completo" aponta para `/` (volta para a própria página) | T02 |
| `:142-160` | Três produtos (Radar, SSE, DIT); o modelo é Radar e Diagnóstico | T01 |
| `:191` | Botão "Pesquisar" com `hidden ... sm:flex`: some no celular | T16, T09, E20 |
| `:196` | "Processando..." | E13 |
| `:398-399` | "Agendar Conversa Estratégica" sem handler | E13, conversão |
| `:419-421` | Rodapé "Metodologia/Privacidade/Termos" com `href="#"` | T12 |
| `:302` (SignalFeed) | Feed SSE ao vivo na landing pública exibe sinais de todos os territórios para qualquer visitante (vazamento de inteligência paga) e mostra "desconectado" quando vazio | T12 |
| `Header.tsx:56` | Link "Sobre" para `/sobre`, rota inexistente (404) | T12 |
| `Header.tsx:79-88` | Botão "DEV" no header público | E10 |
| `Header.tsx:91-100` | Botão "Dashboard" no header público para visitantes | E10, T01 |
| `Header.tsx:103-108` | CTA "Agendar conversa" sem handler | E13 |
| `Header.tsx:19-21` | Header fixo de 80 px com `glass` (blur) | T14, E9 |

### 2.2 Relatório inline (`DiagnosisReport.tsx`)

| Onde | Problema | Padrão |
|---|---|---|
| `:504` | "Score de Território Total (STT)", sigla errada | T02, canon |
| `:255-259,351-375,597` | Barras de "dimensão bloqueada" com largura fixa (88%, 65%, 42%...) por classe CSS: parece dado, é decoração | Lei 8, E19 |
| `:541` | "Nenhum sinal crítico detectado" sem explicar se a fonte respondeu ou ficou muda (ausência de dado lida como ausência de risco) | T12, T03 |
| `:260-460` | ~200 linhas de CSS em string, cores hex soltas (`#B84A3A`, `#D4A574`, `#5B8FA3`) | E17, T02 |
| `:637` | CTA de assinatura sem link | E13 |
| `:16` | Tipo replicado à mão do servidor (`shape replicado de ditLanding.ts`) | T02 |

### 2.3 STTGauge e fichas de território

| Onde | Problema | Padrão |
|---|---|---|
| `STTGauge.tsx:195-229` | Gauge circular com `drop-shadow` e `glow` | T05, E1, E9 |
| `:173-191` | Contagem animada de 2 s até o número | E16 |
| `:153-169` | Faixas 70/40 e nomes "Alta/Média/Baixa Complexidade"; o motor usa 75/50 e "escalada/pressão/estabilidade" (`orchestrator.ts:647-651`). Duas réguas para o mesmo número | T02 |
| `:254-259` | Dourado para "alta" e verde para "baixa": cor sem significado estável | T04, E3 |
| `TerritoryDetail.tsx:182,187` | `Math.random()` exibido como "Fontes Locais" e "Confiança Preditiva" | Lei 8, E5 |
| `:85-91` | `d?Score ?? 50`: dimensão não medida aparece como 50, nunca como "sem dado". O contrato novo `shared/leitura.ts` já prevê `score: null` | E5, T12 |
| `:33-42,84-91` | D1 a D7 com nomes diferentes de Methodology e do portal (`DIM_LABELS`), D7 com peso 0 no motor | T02 |
| `:98-100` | Cores de faixa: vermelho, laranja, amarelo, verde-primary; 4 cores sem rótulo de + ou -, nenhum dado de período anterior | T04, T03, T07 |
| `:112-125` | Hotspots fabricados por quebra de string de `keyRisks` ("Vetor de Risco Principal", "Detectado pelo Agente") | E19 |
| `:135` | Fallback "Mapeamento de atores em progresso..." | E11, T12 |
| `:143-159` | Hero com badge "Output 100% Dinâmico" (texto para dev, não para cliente) | T01 |
| `:176,250,262` | "DIT Engine", "SCAN PROFUNDO ATIVADO", "DIT Targeting System": jargão sem função | E18, T11 |
| `:257,266-273` | Mapa sem marcador do território e overlay com texto por cima | T14, E9 |
| `:309-374` | Paywall com fundo borrado falso, vermelho, `glow` e "Garantia de confidencialidade" | E9, T04 |
| `:362-365` | "Agendar Conversa Estratégica" sem handler | E13 |
| `:70-80` | Erro "Território não processado" sem próximo passo (não oferece pedir o Diagnóstico) | T12, E12 |
| `:53-67` | Carregando: tela cheia com ping animado em vez de skeleton da ficha | T12, E16 |

### 2.4 Metodologia, Radar e SSE

| Onde | Problema | Padrão |
|---|---|---|
| `Methodology.tsx:126-133,153,163` | 7 dimensões, pesos 20/14/14/20/12/10/10, "Score de Território Total". Motor: 6 dimensões 0,22/0,15/0,15/0,22/0,15/0,11 | Lei 8, T02 |
| `Methodology.tsx:142,180,247,281,326` | Títulos por tema ("Fórmula do STT") sem conclusão | T11 |
| `RadarTerritorial.tsx:221-228` | Duas `<h1>` ("Radar" e "Territorial™") | T09 acessibilidade |
| `:197-200` | `handleSubmit` só faz `setSubmitted(true)`: lead perdido; `/api/dit/lead` e `subscribers.subscribe` ignorados | conversão |
| `:307` | "Mock Email Alert" exibido como exemplo: não é alerta real | Lei 8 |
| `:50-56,62-70` | Promete Nota Executiva, Alerta de Ativação, Termômetro de Cenários, "STT revisado mensalmente": o portal entrega diário e não mostra a nota | T01, T02 |
| `:894` | "Cadastrar para alerta gratuito": o plano `free_alert` não é produto no modelo Radar e Diagnóstico | T01 |
| `SSE.tsx:25-29,36-55,77` | 85/82/54 por setor, níveis "Alta/Alto" e jornada DIT, SSE, PTE, Monitor: nada vem de dado; PTE e SSE não existem no motor | Lei 8 |
| `SSE.tsx:110-125,454-468` | CTAs sem handler | E13 |

### 2.5 Portal do assinante

| Onde | Problema | Padrão |
|---|---|---|
| `RadarPortal.tsx:296,357` | Mostra todos os territórios ativos do sistema, não os do assinante | T01 |
| `:326-328` | Título "Territórios Monitorados" (rótulo, não conclusão) | T11, E7 |
| `:300-314` | Faixa vermelha por território com STT ≥ 75, empilhada no topo | T04, E9, posicionamento |
| `:370-372` | STT 5xl com `text-glow`; traço longo quando nulo, sem motivo | T10, T12, E5 |
| `:375-379` | Delta colorido vermelho/verde (E4), `toFixed(1)` sem janela ("+2.3 em quê?") e sem confiança | T03, T07, E5 |
| `:281-293` | Pill mostra `escalada`, `pressao` em minúsculas e sem acento | T02 |
| `:356-391` | Sem estado vazio se o assinante não tem territórios | T12 |
| `:382-386` | "Ver detalhe" | E13 |
| `:397` | Feed SSE global (todos os territórios) | T01 |
| `RadarTerritoryPage.tsx:22,57-60` | E-mail demo fixo para preferências | segurança |
| `:37-44` | "Território não encontrado." sem próximo passo | T12, E12 |
| `:47` | `territory.stt ? round : 0`: STT nulo vira 0 (falsifica "sem dado" como "tensão zero") | E5 |
| `:71-90` | Histórico em barras de altura `max(8, val)%` (piso de 8 quebra o zero), 6 períodos mensais, cores 75/50 (terceira régua), sem rótulo de valor | E2, T05, T03 |
| `:19` | `DIM_LABELS` declarado e nunca usado: a página de detalhe não mostra nenhuma dimensão | T01 |
| (ausente) | Nota executiva publicada não aparece em lugar nenhum do portal | T01, promessa do produto |
| `RadarAlertas.tsx:41-48` | Um território por vez via Select; "Nenhum alerta registrado..." sem explicar a regra (≥ 0,7) | T13, T12 |
| `:102-148` | Tabela: 1ª coluna é "Sinal" cortado em 1 linha (`line-clamp-1`), impacto em % arredondado, ícones de canal só por cor, `DimBadge` com 6 cores | T06, T07, E3 |
| `RadarConfiguracoes.tsx:43-46` | Um painel completo por território em grade; 10 territórios = 10 formulários | T10, T13 |

### 2.6 Mesa do operador

| Onde | Problema | Padrão |
|---|---|---|
| `Dashboard.tsx:1351-1443` | Duas `Tabs` aninhadas e duplicadas (`signals` aparece 2 vezes); 8 abas de 1448 linhas; `TerritoryWizard` dentro de aba com `window.location.reload()` (`:1368`) | T13, T17, E10 |
| `:1294-1311` | Seletor de território por botões: com 20 territórios estoura a linha; obriga a repetir a rotina por território | T10 |
| `:1313-1320` | "Abrir Command Center Premium" (adjetivo) | E18, E13 |
| `:1276-1290` | Tela "Acesso Restrito" + `window.location.replace` no render | T12 |
| `SttPublishPanel.tsx:35-38` | Fila **por território** (`getPendingScores({territorySlug})`): para publicar o STT do dia o operador visita N territórios | T17, T10 |
| `:46-63` | Vazio "Nenhum STT aguardando publicação." sem dizer o que já foi publicado hoje nem quando roda o próximo ciclo | T12 |
| `:86-107` | Só existe "Publicar". O cabeçalho do arquivo promete "Ajustar nota ou Rejeitar" (`:5`), não existe Rejeitar | T12, lei 6 |
| `:75-121` | Mostra STT, 6 dimensões e nota, mas **nenhuma comparação** com o STT publicado anterior, nem faixa/confiança, nem sinais que o causaram: o operador aprova às cegas | T03, T08 |
| `:78-79` | STT com 1 casa decimal, dimensões sem casa: inconsistência | T02, E5 |
| `Dashboard.tsx:773` | Segundo caminho de publicação (`stt.upsert` com `published`) no SttPanel, paralelo ao SttPublishPanel: duas portas para o mesmo gate | T02 |
| `AgentHealthPanel.tsx:2,94-97` | "39 Agentes"; sucesso por agente desde o último restart do processo (`orchestrator.getAgentHealth()` é memória); vazio diz "nesta sessão" | T03, T12 |
| `:24-26` | `animate-pulse` em todo ponto de status (E16); verde/âmbar/vermelho como único sinal (E4), só o texto "ok/degraded/failing" em inglês ajuda | T07, E4 |
| `:137-175` | Ordem da tabela = ordem de registro, não por gravidade; "mudo" (sem rodar há dias) só aparece como "nunca" ou "Xd atrás" sem destaque | T06, E14 |
| `:138` | Mapa id→dimensão hardcoded no componente (36 ids); agente novo aparece como "?" | T02 |
| `:152` | Erro truncado em 30 caracteres, sem próximo passo | E12 |
| `DITCommandCenter.tsx:163-179` | Radar chart das 6 dimensões | E1, T05 |
| `:55-63` | Tela de carregamento preta full-screen com hex solto (`bg-[#0a0a0c]`) e "Sincronizando Inteligência DIT PRINT..." | E17, E18 |
| `:203` | "O motor não gerou rationale para este período." (termo interno) | E12 |
| `AnalyticsPanel.tsx:465-554` | Mesmo dado em 3 gráficos (barra, área, linha) alternáveis | T13, T02 |
| `TerritoryWizard.tsx:19,391,184` | Modelo de 5 eixos (ITT/ICS/IVS/IVE/ICI) numa tela de 6 dimensões | T02 |

### 2.7 Transversais

| Problema | Onde | Padrão |
|---|---|---|
| Tokens: `glass`, `glow`, `text-glow`, `scanline`, `bg-neural-pattern` em 10 arquivos; hex e oklch soltos em 6; `hover:scale` e `transition-all` em 93 pontos | `index.css:245-306`, páginas | T14, T15, E9, E16, E17 |
| Inglês na UI: "Live Engine Feed", "Output 100% Dinâmico", "DIT Targeting System", "degraded", "failing", "Intelligence", "rationale" | vários | T02 |
| Mobile: grades `lg:grid-cols-[1fr_380px]`, botão escondido `hidden sm:flex`, tabelas sem alternativa no celular | Portal, Landing | T16, E20 |
| Acessibilidade: `<div>` clicável no Header, ícones sem rótulo, `label` sem `htmlFor` no formulário do Radar, cor como único sinal | Header, RadarTerritorial, Alertas | T07, T09 |
| Tema claro/escuro "switchable" em todas as telas, mas as cores de status são `text-red-400` (feitas para escuro) | `App.tsx`, portal | T04, T07 |

---

## 3. Nova arquitetura

### 3.1 Princípios (cada um verificável)

1. **Uma frase por tela (T01).** Está escrita no topo do blueprint de cada tela abaixo e vira o `<h1>` (T11).
2. **Número nunca sozinho (T03).** STT sempre com Δ 7 dias, Δ 30 dias, faixa e confiança (`leitura.tensao`, `leitura.faixa`, `leitura.confianca`). Dimensão `score: null` mostra "sem dado" e motivo, nunca 50 nem 0.
3. **Só o publicado sai para fora.** Portal e área pública leem apenas `stt_scores.published = true` (seção 7, item B1). A Mesa lê o rascunho.
4. **Uma régua de faixa**, constante única em `shared/const.ts`: `>= 75 Escalada`, `50 a 74 Pressão`, `< 50 Estabilidade` (igual ao `scoreToScenario`). Nome e ícone sempre juntos (triângulo cheio, losango, círculo) além da cor (T07).
5. **Sem gauge, sem radar, sem glow.** Quantidade em barra no zero e linha no tempo; sparkline de 12 pontos em tabela (T05, T13).
6. **Crise fora do topo.** "Escalada" é um rótulo de linha, não um banner. O momento Responder é uma seção, não a manchete.
7. **Três áreas, três layouts.** Pública (editorial, leitura), Portal (tabela densa, leitura de 10 segundos), Mesa (ferramenta de especialista, T13 e T17: monitorar e analisar em telas separadas).
8. **Mesma palavra, mesmo lugar (T02):** STT, Δ, Confiança, Faixa, Dimensão, Fonte, Publicado em.

### 3.2 Mapa de rotas novo e redirecionamentos

| Área | Rota nova | Substitui | Observação |
|---|---|---|---|
| Pública | `/` | `/` | Landing nova |
| Pública | `/diagnostico` | busca da landing + CTAs mortos | Pedido de Diagnóstico (e de Radar, campo `interesse`) |
| Pública | `/radar` | `/radar` | Página curta do Radar, exemplo real publicado |
| Pública | `/metodologia` | `/metodologia` | Reescrita para 6 dimensões reais |
| Pública | `/territorio/:slug` | `/territorio/:slug` | Ficha pública só com STT publicado, 6 dimensões, sem aleatório |
| Pública | `/entrar` | (não existia) | Login do assinante por link mágico |
| Portal | `/portal` | `/portal` | "Hoje" |
| Portal | `/portal/territorio/:slug` | igual | Leitura do território |
| Portal | `/portal/alertas` | `/portal/alertas` | Histórico filtrável de todos os territórios |
| Portal | `/portal/conta` | `/portal/configuracoes` | Preferências de alerta e canais, uma tabela |
| Mesa | `/mesa` | `/dashboard` (visão) | "Hoje na mesa": pendências |
| Mesa | `/mesa/publicacao` | aba "publish" | Fila única de publicação |
| Mesa | `/mesa/fontes` | aba "agents" | Saúde e silêncio das fontes |
| Mesa | `/mesa/sinais` | aba "signals" | Curadoria |
| Mesa | `/mesa/territorios` e `/mesa/territorios/novo` | aba "Novo Território" | Lista e wizard |
| Mesa | `/mesa/analise/:slug` | `/dashboard/dit/:slug` + aba analytics + aba stt | Uma tela de análise comparada |
| Mesa | `/mesa/assinantes` | aba "subscribers" + one-pager | Leads, assinantes, one-pager |
| Mesa | `/mesa/entrar` | `/dashboard/login` | Login do operador |

| Rota antiga | Destino (301 no servidor, `redirect` no `Switch`) |
|---|---|
| `/dashboard` | `/mesa` |
| `/dashboard/login` | `/mesa/entrar` |
| `/dashboard/dit/:slug` | `/mesa/analise/:slug` |
| `/portal/configuracoes` | `/portal/conta` |
| `/sse` | `/diagnostico` (a visão setorial vira linha dos entregáveis do Diagnóstico) |
| `/sobre` (link quebrado) | `/` |
| `/dev` | removida do build de produção (só com `import.meta.env.DEV`) |
| `/pesquisa.html`, `/land-dit.html` | já redirecionam para `/` (`_core/index.ts:116`) |

`Home.tsx`, `TelesPires.tsx`, `ComponentShowcase.tsx`, `AIChatBox.tsx`, `ManusDialog.tsx`, `DashboardLayout*.tsx`, `STTGauge.tsx`, `EscalationBanner.tsx` são apagados.

### 3.3 Área Pública

Header público: marca, Radar, Metodologia, "Pedir Diagnóstico" (botão único, leva a `/diagnostico`), "Entrar" (texto, leva a `/entrar`). Sem DEV, sem Dashboard, sem Sobre, sem tema switch (um tema por área; Pública em claro).

#### P1 `/` Landing

- **Frase (T01):** "Toda operação tem um CEP: o território decide o que ela aguenta." O visitante sai sabendo que o DIT lê o território antes da decisão e que pode pedir o Diagnóstico ou assinar o Radar.
- **Blocos, em ordem:**
  1. Hero: H1 "Toda operação tem um CEP.", subtítulo "O território decide. O DIT mede a tensão do seu CEP em 6 dimensões e diz o que mudou." Um campo "Território" + botão **Ver leitura do território** (chama `POST /api/dit/isca`, não `/analyze`: isca já é o teaser cacheado). Abaixo do campo, link secundário "Pedir Diagnóstico completo".
  2. Os 3 momentos (Entrar, Operar, Responder): 3 colunas, cada uma com a pergunta do C-level ("Vale entrar neste território?", "O que mudou no meu CEP desde ontem?", "O que está acontecendo aqui agora?"), o entregável e o botão (Entrar leva a `/diagnostico`, Operar a `/radar`, Responder a `/diagnostico?momento=responder`). Responder sem destaque (punch secundário: "Toda crise tem um CEP").
  3. Território real, publicado: uma linha de tabela de 3 territórios com STT, Δ 30 dias, confiança e "publicado em" (dado de `publicData.territoriosPublicados`, seção 7). Sem depoimento, sem "caso de sucesso". Se não houver 3 publicados, mostra os que existem; se 0, o bloco some (nunca fixo).
  4. Como o número nasce: 6 dimensões, fontes oficiais (IBGE, IBAMA, CEMADEN, DataSUS, INEP, Querido Diário), "STT publicado por analista PRINT" (o gate humano como argumento de confiança). Link para `/metodologia`.
  5. Modelo em duas linhas: Radar (assinatura) e Diagnóstico (ticket), sem preço (não há tabela oficial no repo), cada um com seu botão.
  6. FAQ de objeções (fonte dos dados, quem publica, cobertura de territórios, prazo do Diagnóstico).
  7. Rodapé com links reais (Metodologia, Privacidade, Termos) e PRINT.
- **Dados:** `POST /api/dit/isca` (existente), `publicData.territoriosPublicados` (nova). Contagens ("N territórios") só a partir de `territories.active` publicados, ou não aparecem.
- **Estados:** carregando isca: skeleton de leitura com texto "Lendo IBGE, IBAMA, CEMADEN..." baseado em evento real ou sem etapas fingidas; vazio da tabela de territórios: bloco omitido; erro da isca: "Não achamos esse território. Tente o município e a UF (ex.: Macaé RJ) ou peça o Diagnóstico e nós localizamos." + botão **Pedir Diagnóstico**; 429: "Muitas consultas. Tente em 1 minuto ou peça o Diagnóstico."
- **Ação principal:** **Ver leitura do território** (hero) e **Pedir Diagnóstico** (header).

#### P2 `/diagnostico` Pedido de Diagnóstico

- **Frase:** "Diga o território e o que você vai decidir; nós respondemos em até 1 dia útil com escopo e prazo." (prazo a confirmar com o Felipe antes de publicar; sem promessa se não houver SLA.)
- **Blocos:** (1) contexto em 3 linhas (o que é o Diagnóstico, o que entrega: STT, 6 dimensões, atores, cenários, nota executiva); (2) formulário de 5 campos: nome, e-mail corporativo, empresa, território (texto livre com sugestão da isca), momento (Entrar, Operar, Responder), decisão em jogo (texto curto, opcional); (3) o que acontece depois (3 passos); (4) link para o Radar.
- **Dados:** `POST /api/dit/lead` (existente; estender o corpo com nome, empresa, momento, decisão) e notificação ao dono (já feita em `subscribers.subscribe` via `notifyOwner`).
- **Estados:** sucesso: "Pedido recebido. Enviamos a confirmação para {email}. Próximo passo: {nome do responsável} retorna até {data}." e o botão **Ver a leitura do território** (isca); erro de rede: "Não enviamos seu pedido. Seus dados continuam na tela. Tente de novo." + botão **Enviar de novo**; validação inline por campo (E12).
- **Ação principal:** **Pedir Diagnóstico**.

#### P3 `/radar` Página do Radar

- **Frase:** "Você abre o Radar e sabe o que mudou no seu CEP antes do jornal."
- **Blocos:** (1) H1 + exemplo real do portal em uma imagem fiel da tabela "Hoje" com dados de território publicado (não mock); (2) entregáveis com o nome exato da tela onde aparecem (STT diário, Δ, Nota Executiva, Alertas ≥ 0,7); (3) como o STT é publicado (gate humano); (4) formulário igual ao de `/diagnostico` com `interesse = radar`; (5) FAQ.
- **Dados:** `publicData.territoriosPublicados`, `POST /api/dit/lead`.
- **Estados:** iguais a P2. Sem "alerta gratuito" (não é produto).
- **Ação principal:** **Pedir acesso ao Radar**.

#### P4 `/metodologia`

- **Frase:** "O STT é a soma ponderada de 6 dimensões; nenhum número sai sem passar por um analista."
- **Blocos:** (1) fórmula `STT = Σ (Di × Wi)` com os pesos reais lidos de `shared/const.ts` (mesma constante que o motor importa; nunca digitados na página); (2) tabela das 6 dimensões: nome, peso, o que olha, fontes; (3) duas camadas (estrutural mensal, sinais diários) e a regra de sinais (≥ 0,7 alerta, 0,3 a 0,7 entra em silêncio, < 0,3 só registra); (4) confiança e faixa: o que significam; (5) governança: LLM uma vez por território por dia, publicação humana; (6) limites (o que o STT não faz).
- **Dados:** constantes compartilhadas (sem tRPC). Nenhuma D7.
- **Estados:** página estática, sem estados de dado.
- **Ação principal:** **Pedir Diagnóstico**.

#### P5 `/territorio/:slug` Ficha pública

- **Frase:** "{Território}: tensão {STT} ({faixa}), {subiu/caiu/estável} {Δ} em 30 dias." (a frase é gerada, o H1 afirma a conclusão, T11).
- **Blocos:** (1) linha de número: STT, Δ 7d, Δ 30d, faixa, confiança, "publicado em {data}" e quem publicou (analista PRINT); (2) barras das 6 dimensões no zero, ordenadas pelo valor, dimensão sem dado marcada "sem dado ({motivo})"; (3) linha do tempo do STT publicado (12 pontos, eixo no zero ou com faixa explícita); (4) nota executiva (primeiro parágrafo público, o resto atrás do pedido); (5) bloco "O que o Diagnóstico completo acrescenta" com lista real (não borrada) e botão.
- **Dados:** `publicData.territoryDetail` (corrigir para ler só `published=true`, incluir `leitura`, `executiveNote` truncada, `publishedAt`).
- **Estados:** carregando: skeleton com as mesmas 4 caixas; não publicado ou inexistente: "Este território ainda não tem leitura publicada." + botão **Pedir leitura deste território** (leva a `/diagnostico?territorio={slug}`); erro: "Não conseguimos carregar a leitura. Tente de novo." + botão **Tentar de novo**.
- **Ação principal:** **Pedir Diagnóstico deste território**.

#### P6 `/entrar` Login do assinante

- **Frase:** "Digite seu e-mail e receba o link de acesso."
- **Blocos:** campo e-mail, botão, nota de privacidade.
- **Dados:** `portalAuth.requestLink`, `portalAuth.verify` (novas). Sem senha.
- **Estados:** e-mail não cadastrado: "Este e-mail não tem acesso ao Radar. Peça acesso" + link para `/radar`; link expirado: "O link expirou." + **Enviar novo link**.
- **Ação principal:** **Enviar link de acesso**.

### 3.4 Portal do assinante (auth obrigatória; só os territórios do assinante)

Header do portal: marca, "Hoje", "Alertas", "Conta", nome/e-mail e **Sair**. Sem banner de escalada. Tema claro por padrão; escuro opcional em "Conta".

#### S1 `/portal` Hoje

- **Frase (T01):** "{N} dos seus {M} territórios mudaram desde {ontem/sua última visita}; o maior movimento é {território} ({Δ7} em 7 dias)." Se nada mudou: "Nada relevante mudou nos seus {M} territórios desde {data}." (resposta também é decisão).
- **Blocos, em ordem** (cabe em 1366x768 sem rolar, T10):
  1. Linha-resposta (a frase) + "Atualizado às {hora} · STT publicado por {analista}".
  2. Tabela de territórios (T06, T13), ordenada por |Δ7| decrescente: Território (nome legível, 1ª coluna) | STT (tabular, à direita) | Δ 7d | Δ 30d | Tendência (sparkline 12 pontos) | Dimensão que mais moveu | Faixa (ícone + rótulo) | Confiança. Clique na linha abre S2. Filtro ativo visível ("Todos · Só os que mudaram").
  3. "O que mudou" (até 5 itens, os de impacto ≥ 0,7 das últimas 24 h que o assinante recebeu ou recebería): hora, território, dimensão, título do sinal com link para a fonte, impacto como barra de 0 a 1. Sem SSE ao vivo; atualiza por polling de 5 min (sem número saltando).
  4. Nota executiva do território de maior movimento: 3 linhas + **Ler nota completa**.
- **Dados:** `portal.hoje` (nova: agrega `published` STT, deltas, sparkline, `alertLog` do assinante, nota). Reaproveita a lógica de `territories.history` e `alertLog.recent`.
- **Estados:** carregando: skeleton de 3 linhas + frase "Carregando seus territórios..."; vazio (assinante sem território): "Você ainda não tem territórios no Radar. Escolha os seus com o time PRINT." + botão **Falar com a PRINT**; sem publicação hoje: "O STT de hoje ainda não foi publicado. Último publicado: {data}." (nunca mostrar rascunho); erro: "Não carregamos seus territórios." + **Tentar de novo**.
- **Ação principal:** **Abrir leitura do território** (linha da tabela).

#### S2 `/portal/territorio/:slug` Leitura do território

- **Frase:** "{Território}: STT {n}, {Δ30} em 30 dias; o que mais pesa é {dimensão}."
- **Blocos:** (1) linha de número (STT, Δ7, Δ30, faixa, confiança, publicado em); (2) nota executiva completa; (3) 6 dimensões em barras no zero com Δ30 por dimensão e "sem dado" quando `score: null`; (4) linha do tempo do STT (mínimo 12 pontos, rótulo direto no último ponto, título-conclusão: "O STT subiu 6 pontos em 30 dias, puxado por D4"); (5) sinais dos últimos 30 dias que pesaram (tabela: data, dimensão, título, fonte, impacto); (6) alertas deste território com link para configurar em `/portal/conta#{slug}`.
- **Dados:** `portal.territorio({slug})` (nova; devolve `leitura`, nota, histórico publicado, sinais). Reaproveita `territories.history`.
- **Estados:** slug fora do escopo do assinante ou inexistente: "Este território não está no seu Radar." + **Voltar para Hoje**; sem histórico suficiente: "Histórico com {k} de 12 pontos: o gráfico completa conforme o Radar acumula publicações." (mostra os k); erro como S1.
- **Ação principal:** **Configurar alertas deste território**.

#### S3 `/portal/alertas` Histórico de alertas

- **Frase:** "Você recebeu {n} alertas nos últimos 7 dias; {k} ainda não foram abertos."
- **Blocos:** (1) filtros visíveis (território, dimensão, canal, período); (2) tabela única, todos os territórios (T13): Território | Sinal (2 linhas, sem corte) | Dimensão (texto, sem 6 cores) | Impacto (número 0 a 1) | Canal (texto + ícone) | Status (entregue, aberto, falhou, com ícone) | Enviado (data e hora).
- **Dados:** `alertLog.recent` (existente) em versão escopada ao assinante (`portal.alertas`).
- **Estados:** vazio: "Nenhum alerta nos últimos 7 dias. Alerta dispara quando um sinal passa de impacto 0,7 nos seus territórios." + **Ajustar limite de alerta**; erro padrão.
- **Ação principal:** **Abrir sinal** (link da fonte) e **Ajustar limite de alerta**.

#### S4 `/portal/conta` Preferências

- **Frase:** "Defina quando e por onde o Radar te avisa."
- **Blocos:** (1) canais globais (e-mail, push) e horário de silêncio; (2) tabela por território (uma linha por território, não um card): Território | Alertas ativos (switch rotulado) | Impacto mínimo | Canais; (3) resumo diário (digest) ligado/desligado; (4) sair.
- **Dados:** `alertPreferences.list/upsert/deactivate` (existentes, passando a exigir sessão do assinante e ignorar e-mail vindo do cliente).
- **Estados:** salvando com `toast` "Preferência salva"; erro: "Não salvamos a mudança. Ela volta ao valor anterior." + **Tentar de novo**.
- **Ação principal:** **Salvar preferências**.

### 3.5 Mesa do operador PRINT (auth de operador; densidade alta, T13)

Layout: barra lateral estreita e cinza (T14) com Hoje, Publicação (contador), Fontes (contador de mudas), Sinais, Territórios, Assinantes; título da página, conteúdo em tabela. Sem abas para o que se compara (T13); monitorar (`/mesa`) e analisar (`/mesa/analise/:slug`) são telas separadas (T17).

#### M1 `/mesa` Hoje na mesa

- **Frase:** "Faltam {a} STT para publicar e {b} fontes mudas; o resto está em dia."
- **Blocos:** (1) três números de pendência com comparação (publicações pendentes vs ontem, fontes mudas vs ontem, sinais a curar vs média de 7 dias) e cada um é um link; (2) "Próxima rodada do motor às {hora}" + última rodada e duração; (3) lista curta "Exige você" (até 8 linhas: STT pendente com Δ grande, fonte muda por mais de 48 h, território sem publicação há mais de 3 dias); (4) atalho **Publicar os {a} STT**.
- **Dados:** `mesa.resumo` (nova; agrega `dashboard.getPendingScores` de todos os territórios, `agentHealth.list` e `scheduler.status`, existentes).
- **Estados:** tudo em dia: "Tudo publicado às {hora}. Próxima rodada às {hora}." (vazio com motivo); carregando: skeleton; erro: "Não carregamos a mesa." + **Tentar de novo**.
- **Ação principal:** **Publicar os STT pendentes**.

#### M2 `/mesa/publicacao` Fila de publicação

- **Frase:** "Revise o que mudou e publique: {a} STT aguardam, {c} com variação acima de 5 pontos."
- **Blocos:** (1) tabela única de todos os territórios pendentes, ordenada por |Δ| (T06): Território | STT proposto | STT publicado anterior | Δ | Faixa (anterior → proposta) | Confiança | Dimensões que mais mudaram | Nº de sinais ≥ 0,7 na janela | Data do cálculo; (2) painel de revisão ao lado da tabela (não modal, E15) da linha selecionada: nota executiva editável, 6 dimensões com anterior e atual em barras pareadas, sinais que causaram (título, fonte, impacto), campo **Motivo da edição** quando a nota ou o STT muda; (3) ações por linha e em lote: **Publicar**, **Devolver ao motor** (substitui o "Rejeitar" inexistente), **Segurar até amanhã**.
- **Dados:** `mesa.filaPublicacao` (nova; todos os territórios, junta `stt_scores` pendente + último publicado + sinais), `dashboard.publishSttScore` (existente, com `executiveNote`), `mesa.devolverAoMotor` (nova). `stt.upsert` deixa de ser usada para publicar (um único caminho, T02).
- **Estados:** vazio: "Nenhum STT pendente. Último publicado por {operador} às {hora}. Próxima rodada às {hora}."; carregando: skeleton de tabela com 5 linhas; erro de publicação: "Não publicamos o STT de {território}: {motivo curto}. Nada mudou para os assinantes." + **Publicar de novo**.
- **Regra de gate:** Publicar grava `published=true`, `publishedAt`, `publishedBy`; só então o portal e a ficha pública enxergam o número (item B1 da seção 7). Confirmação de lote mostra "Vai aparecer para {k} assinantes".
- **Ação principal:** **Publicar** (por linha) e **Publicar selecionados** (lote).

#### M3 `/mesa/fontes` Saúde das fontes

- **Frase:** "{m} fontes estão mudas há mais de 24 h; {d} degradaram; {o} estão ok."
- **Blocos:** (1) resumo com comparação ("ontem: {m0} mudas"); (2) tabela ordenada por gravidade, não por id (T06, E14): Fonte (nome legível) | Dimensão | Estado (Muda, Falhando, Lenta, OK, com ícone e rótulo) | Último sucesso | Sucesso 7 dias | Latência | Último erro (texto completo em linha expansível) | Territórios afetados | **Reexecutar**; (3) filtro por dimensão e por estado, visível; (4) linha do tempo de coleta (últimas 24 h por dimensão) para ver buraco.
- **Dados:** `agentHealth.list` (existente, **hoje em memória; precisa persistir** por fonte e por território, item B4) + `analytics.collectionSnapshots` (existente, sem consumidor) + `scheduler.status/runNow`.
- **Estados:** vazio (processo recém reiniciado): "O motor reiniciou às {hora}; histórico anterior vem do banco." com os dados persistidos; erro: "Não lemos o estado das fontes." + **Tentar de novo**.
- **Ação principal:** **Reexecutar fonte**.

#### M4 `/mesa/sinais` Curadoria

- **Frase:** "{p} sinais esperam curadoria; {q} têm impacto acima de 0,7."
- **Blocos:** filtro global de território (multi-seleção) e status; tabela (Sinal | Território | Dimensão | Fonte | Impacto | Data | Status) com painel lateral de detalhe; ações **Aprovar**, **Descartar**, **Reclassificar**; **Coletar agora** por território.
- **Dados:** `signals.list/curate/collect/collectStructuredData/analyze/pendingCount` (existentes).
- **Estados:** vazio: "Nada a curar. Última coleta às {hora}." ; erro padrão.
- **Ação principal:** **Aprovar sinal**.

#### M5 `/mesa/territorios` e `/novo`

- **Frase:** "{n} territórios ativos; {k} sem publicação há mais de 3 dias."
- **Blocos:** tabela (Território | UF | Ativo | Último STT publicado | Última publicação | Fontes mudas | Assinantes); **Novo território** abre `/mesa/territorios/novo` (wizard de 3 passos: localizar no IBGE, confirmar recorte e fontes, rodar primeira leitura; 6 dimensões; sem ITT/ICS/IVS/IVE/ICI).
- **Dados:** `territories.listAll/toggle/create`, `subscribers.byTerritory`.
- **Estados:** wizard em processamento usa etapas reais do servidor; erro por etapa com **Tentar de novo a etapa**.
- **Ação principal:** **Criar território**.

#### M6 `/mesa/analise/:slug` Análise comparada

- **Frase:** "{Território}: STT {n}, {Δ30} em 30 dias, puxado por {dimensão}; {x} sinais pesaram."
- **Blocos (uma superfície, T13):** linha do tempo do STT publicado e do rascunho com faixa de confiança; tabela das 6 dimensões com valor, Δ7, Δ30, peso, contribuição ao STT, fonte (estrutural, sinal, ambos, nenhuma); tabela de sinais que pesaram; rationale do LLM (texto do motor, rotulado "Justificativa do cálculo"); comparação com território irmão (seletor).
- **Dados:** `analytics.indexHistory`, `signals.listByPeriod`, `stt.history`, `territories.list`.
- **Estados:** sem histórico: "Só há {k} períodos; comparação de 30 dias disponível em {data}." ; erro padrão.
- **Ação principal:** **Exportar leitura** (one-pager) via `onepager.generate`.

#### M7 `/mesa/assinantes`

- **Frase:** "{l} pedidos novos e {a} assinantes ativos; {s} pedidos sem resposta há mais de 1 dia."
- **Blocos:** tabela de pedidos (origem `/diagnostico` ou `/radar`, momento, território, data, status Novo/Em contato/Ganho/Perdido) e tabela de assinantes (plano, territórios vinculados, último acesso); painel lateral para **Vincular territórios** e **Convidar ao portal** (envia o link de `/entrar`); one-pager por território.
- **Dados:** `subscribers.list/byTerritory`, `onepager.generate`, novos `leads.list/updateStatus` e `subscribers.vincular` (seção 7).
- **Estados:** vazio: "Nenhum pedido novo. O formulário em `/diagnostico` está no ar." (com link para testá-lo); erro padrão.
- **Ação principal:** **Convidar ao portal**.

#### M0 `/mesa/entrar`

- **Frase:** "Acesso da equipe PRINT."
- **Blocos:** e-mail, senha, **Entrar**. Sem placeholder com e-mail real (hoje `admin@print.com`, `DashboardLogin.tsx:66`).
- **Dados:** `dashboardAuth.login`.
- **Estados:** erro: "E-mail ou senha incorretos." (sem detalhe técnico).

---

## 4. Substituição do feed em tempo real

`SignalFeed` (SSE global, sem auth, `_core/index.ts:67`, comentário diz "Authenticated clients" mas não há checagem) sai do público e do portal. O portal usa a lista "O que mudou" em polling de 5 minutos, escopada ao assinante. A Mesa usa uma lista curta no M1 e a tabela de M4. O endpoint `/api/alerts/stream` ou exige sessão e filtra por `territoryId` do assinante, ou é desligado.

---

## 5. Fluxos passo a passo

### 5.a Prospect entende e pede o Diagnóstico (alvo: menos de 90 segundos, 4 cliques)

| # | Usuário | Tela | Sistema | Saída |
|---|---|---|---|---|
| 1 | Chega por indicação ou e-mail | P1 | Mostra "Toda operação tem um CEP." e os 3 momentos | Entende o que é e para quem |
| 2 | Digita "Macaé" no hero | P1 | `POST /api/dit/isca` (cache por slug canônico) | Vê STT, confiança, 2 dimensões abertas e as demais marcadas "no Diagnóstico" |
| 3 | Clica **Pedir Diagnóstico** (no resultado ou no header) | P2 | Território já vem preenchido | Formulário de 5 campos |
| 4 | Escolhe o momento (Entrar) e descreve a decisão | P2 | Validação inline | Botão habilitado |
| 5 | Clica **Pedir Diagnóstico** | P2 | `POST /api/dit/lead`; `notifyOwner` ao Felipe; e-mail de confirmação | Tela de sucesso com próximo passo e data |
| 6 | (Opcional) clica **Ver a leitura do território** | P5 | Ficha publicada | Mantém interesse até o retorno |
| Falha | Isca não acha o território | P1 | Mensagem com exemplo de formato + **Pedir Diagnóstico** | Lead não se perde |
| Falha | Rede cai no passo 5 | P2 | Dados preservados + **Enviar de novo** | Sem retrabalho |

Medição: evento por passo (`view_landing`, `isca_ok`, `lead_started`, `lead_sent`) para T08; meta inicial a definir com o Felipe após 30 dias de dado real (não inventar taxa).

### 5.b Assinante abre o portal de manhã e entende o que mudou em 10 segundos

| # | Tempo | Usuário vê | Sistema |
|---|---|---|---|
| 1 | 0 s | Abre `/portal` (sessão persistente por 30 dias; se expirou, `/entrar` com link mágico) | Carrega `portal.hoje` |
| 2 | 1 a 3 s | Linha-resposta: "2 dos seus 6 territórios mudaram desde ontem; o maior movimento é Macaé (+4,1 em 7 dias)." | Frase gerada por regra (código, não LLM) a partir de Δ |
| 3 | 3 a 7 s | Tabela ordenada por movimento; primeira linha é Macaé com ícone de faixa, sparkline e dimensão D4 | Ordenação por |Δ7| |
| 4 | 7 a 10 s | Lê 3 linhas de "O que mudou" e 3 linhas da nota executiva | Itens de impacto ≥ 0,7 nas últimas 24 h |
| 5 | Depois | Clica na linha de Macaé | S2 com nota completa e sinais |
| Alt | Nada mudou | Frase "Nada relevante mudou..." e tabela estável | Sem alarme falso |
| Alt | STT de hoje não publicado | "O STT de hoje ainda não foi publicado. Último: ontem 17h." | Nunca mostra rascunho |

Critério de aceite: teste de 10 segundos com 5 pessoas C-level ou proxy (T08): todas respondem "qual território mudou mais e por quê" sem rolar a página.

### 5.c Operador revisa e publica o STT do dia

| # | Operador | Tela | Sistema |
|---|---|---|---|
| 1 | Entra | M0, depois M1 | M1 mostra "Faltam 9 STT para publicar e 2 fontes mudas." |
| 2 | Clica **Publicar os STT pendentes** | M2 | Tabela ordenada por |Δ| desc; linhas com Δ > 5 ou troca de faixa vêm marcadas "Revisar" |
| 3 | Seleciona a primeira linha | M2 painel lateral | Mostra nota, dimensões anterior x atual, sinais causais, confiança |
| 4 | Conferência: se a dimensão tem `score: null` ou confiança baixa, o painel avisa e sugere **Segurar até amanhã** | M2 | Regra de código |
| 5 | Edita a nota se precisar (exige **Motivo da edição**) | M2 | Registra autor, antes e depois |
| 6 | Linhas sem alerta de revisão: seleciona em lote, clica **Publicar selecionados** | M2 | Confirma "Vai aparecer para {k} assinantes" |
| 7 | Confirma | M2 | `published=true`, `publishedAt`, `publishedBy`; invalida cache do portal; dispara digest se ligado |
| 8 | Linha com dado errado: **Devolver ao motor** com motivo | M2 | Recoloca em recálculo e registra motivo no caderno |
| 9 | Fim | M1 | "Tudo publicado às 09h12. Próxima rodada às 13h." |

Falhas: publicação falha por linha (o restante continua) com motivo e sem efeito para o assinante; dois operadores na mesma linha: o segundo vê "Publicado por {outro} às {hora}" e a ação some.

### 5.d Operador vê a saúde dos agentes de fonte e o que está mudo

| # | Operador | Tela | Sistema |
|---|---|---|---|
| 1 | No M1, vê "2 fontes mudas" ou abre o menu Fontes | M3 | Tabela ordenada: Muda, Falhando, Lenta, OK |
| 2 | Lê o resumo: "2 mudas há mais de 24 h; 3 degradaram; 31 ok (ontem: 1 muda)" | M3 | Comparação com o dia anterior |
| 3 | Abre a primeira muda (ex.: `cemaden`, D1) | M3 linha expandida | Último sucesso, último erro completo, territórios que dependem dela, impacto no STT (peso da dimensão) |
| 4 | Decide: **Reexecutar fonte** | M3 | `scheduler.runNow` escopado à fonte; estado muda para "Executando", depois resultado |
| 5 | Se continua muda: marca "Conhecida: {motivo}" | M3 | Silencia o alerta por 24 h e mostra na publicação (M2) "D1 sem dado de CEMADEN", para o operador não aprovar STT cego |
| 6 | Filtra por dimensão D4 para ver o buraco | M3 | Linha do tempo de coleta das últimas 24 h |

Regra de produto: fonte muda nunca é lida como "sem risco". Em M2, S2, P5 e no relatório, a dimensão sem dado aparece como "sem dado ({fonte} fora do ar desde {data})".

---

## 6. Microcopy (atual → novo)

Sem travessão. Títulos afirmam conclusão (T11). Botões têm verbo (E13).

| Onde | Atual | Novo |
|---|---|---|
| Landing H1 (`LandingSimple.tsx:163`) | "Conheça o território em que você está inserido." | "Toda operação tem um CEP." |
| Landing subtítulo | "Inteligência territorial direta e precisa. O diagnóstico antes da decisão." | "O território decide. O DIT mede a tensão do seu CEP em 6 dimensões e diz o que mudou." |
| Landing busca, botão (`:196`) | "Pesquisar" / "Processando..." | "Ver leitura do território" / "Lendo o território" |
| Landing placeholder (`:181`) | "Pesquisar território (ex: Baía de Guanabara, Macaé...)" | "Município e UF, por exemplo Macaé RJ" |
| Landing badge (`:205`) | "DIT Engine ativado e monitorando 47 territórios estratégicos" | (removido; se houver número, "{n} territórios com leitura publicada") |
| Loading (`:19-25`) | "Ativando 32 agentes PRINT", emojis | "Buscando em IBGE, IBAMA, CEMADEN e mais {k} fontes" (k real) |
| Bloco feed (`:293-295`) | "Live Engine Feed / Inteligência em Tempo Real" | (removido; vira "Territórios com leitura publicada") |
| Prova social (`:319-322`) | "Prova Social / Casos de Sucesso DIT" | "Leituras publicadas esta semana" |
| Ecossistema (`:360`) | "Ecossistema de Inteligência" | "Dois jeitos de usar o DIT: Diagnóstico e Radar" |
| Card (`:379`) | "SAIBA MAIS" | "Ver o Radar" / "Pedir o Diagnóstico" |
| CTA (`:392-399`) | "Pronto para inteligenciar seu território? / Agendar Conversa Estratégica" | "Decida com a leitura do território na mão. / Pedir Diagnóstico" |
| Rodapé | "A inteligência que precede a operação." | "Toda operação tem um CEP." |
| Header | "Territórios, SSE™, Metodologia, Radar™, Sobre, DEV, Dashboard, Agendar conversa" | "Radar, Metodologia, Entrar, Pedir Diagnóstico" |
| Erro da isca (`LandingSimple.tsx:263`) | "Não foi possível gerar o diagnóstico" + "Tente novamente em alguns instantes ou ajuste o nome" | "Não achamos esse território. Use município e UF (Macaé RJ) ou peça o Diagnóstico e nós localizamos." + botão "Pedir Diagnóstico" |
| Metodologia H1 (`:126`) | "Como calculamos o STT" | "O STT soma 6 dimensões, e um analista publica cada número" |
| Sigla (`Methodology.tsx:131`, `DiagnosisReport.tsx:504`, `RadarTerritorial.tsx:53`) | "Score de Território Total" | "Score de Tensão Territorial (STT)" |
| Metodologia pesos | "D7 10%, D1 20%..." | pesos lidos da constante do motor (D1 22%, D2 15%, D3 15%, D4 22%, D5 15%, D6 11%) |
| Radar H1 (`RadarTerritorial.tsx:221-228`) | "Radar / Territorial™" (2 h1) | "Saiba o que mudou no seu CEP antes do jornal." (1 h1) |
| Radar form (`:894`) | "Cadastrar para alerta gratuito" | "Pedir acesso ao Radar" |
| Radar confirmação | (`setSubmitted` sem rede) | "Pedido recebido. Retornamos até {data}." |
| Ficha pública H1 (`TerritoryDetail.tsx:156`) | "Diagnóstico: {nome}" | "{nome}: tensão {n}, {subiu/caiu} {Δ} em 30 dias" |
| Ficha badge (`:154`) | "Output 100% Dinâmico" | "Publicado por analista PRINT em {data}" |
| Ficha seções | "Dimensões de Inteligência", "Análise Geopolítica e Hotspots", "SCAN PROFUNDO ATIVADO" | "{dimensão} pesa mais: {n}", "Riscos que a leitura encontrou", (removido) |
| Ficha métricas (`:184,188`) | "Fontes Locais / Confiança Preditiva" (aleatórios) | "Confiança {n}% · faixa {a} a {b}" (de `leitura`) |
| Ficha paywall (`:333,362`) | "Inteligência Restrita / Agendar Conversa Estratégica" | "O Diagnóstico completo acrescenta atores, cenários e projeção de 36 meses. / Pedir Diagnóstico deste território" |
| Ficha erro (`:74`) | "Território não processado" | "Este território ainda não tem leitura publicada." + "Pedir leitura deste território" |
| Ficha voltar (`:148`) | "Nova Pesquisa" | "Buscar outro território" |
| Portal título (`RadarPortal.tsx:326`) | "Territórios Monitorados" | "{N} dos seus {M} territórios mudaram desde ontem" |
| Portal eyebrow (`:324`) | "Portal do Assinante" | (removido; o Header diz "Radar") |
| Portal card CTA (`:384`) | "Ver detalhe" | "Abrir leitura" |
| Portal escalada (`EscalationBanner.tsx:109,120`) | "ESCALADA ... está em cenário de escalada." | Linha da tabela com ícone e "Escalada (acima de 75)" |
| Portal pill (`RadarPortal.tsx:289`) | "escalada / pressao / estabilidade" | "Escalada / Pressão / Estabilidade" |
| Portal delta | "+2.3" | "+2,3 em 7 dias" (vírgula, janela explícita) |
| Portal vazio | (nada) | "Você ainda não tem territórios no Radar. Falar com a PRINT." |
| Detalhe histórico (`RadarTerritoryPage.tsx:77`) | "Histórico STT" | "O STT subiu {n} pontos em 30 dias, puxado por {dimensão}" |
| Detalhe erro (`:42`) | "Território não encontrado." | "Este território não está no seu Radar." + "Voltar para Hoje" |
| Alertas título (`RadarAlertas.tsx:73`) | "Histórico de Alertas" | "{n} alertas em 7 dias, {k} não abertos" |
| Alertas vazio (`:99`) | "Nenhum alerta registrado para este território." | "Nenhum alerta em 7 dias. Alerta dispara acima de impacto 0,7." + "Ajustar limite de alerta" |
| Alertas status (`:134-137`) | "aberto / entregue / falha" | "Aberto / Entregue / Falhou" com ícone |
| Config título (`RadarConfiguracoes.tsx:40`) | "Configurações de Alertas" | "Defina quando e por onde o Radar avisa" |
| Config botão | (Salvar genérico do painel) | "Salvar preferências" |
| Mesa header (`Dashboard.tsx:1296`) | "Radar Territorial™, Curadoria" | "Mesa PRINT" |
| Mesa botão (`:1318`) | "Abrir Command Center Premium" | "Abrir análise do território" |
| Mesa acesso (`:1268-1278`) | "Acesso Restrito / Entrar no Dashboard" | "Acesso da equipe PRINT / Entrar" |
| Mesa abas (`:1353-1409`) | "Sinais, STT, Publicar, Feed, Agentes, Analytics, One-pager, Assinantes" | Menu: "Hoje, Publicação, Fontes, Sinais, Territórios, Assinantes" |
| Publicação título (`SttPublishPanel.tsx:52,70`) | "Publicação Pendente (n)" | "{n} STT aguardam sua revisão" |
| Publicação vazio (`:58`) | "Nenhum STT aguardando publicação." | "Nada pendente. Último publicado por {nome} às {hora}. Próxima rodada às {hora}." |
| Publicação botão (`:105`) | "Publicar" | "Publicar STT de {território}" (linha) e "Publicar selecionados" (lote) |
| Publicação sucesso (`:41`) | "STT publicado com sucesso" | "STT de {território} publicado. Visível para {k} assinantes." |
| Publicação erro (`:42`) | "Erro ao publicar: {message}" | "Não publicamos {território}: {motivo}. Nada mudou para os assinantes." + "Publicar de novo" |
| Nota (`:126,133`) | "Nota Executiva / Nota executiva para publicação…" | "Nota executiva (o assinante lê isto primeiro)" / "Em 2 frases: o que mudou, por que, o que observar." |
| Fontes título (`AgentHealthPanel.tsx:105`) | "Saúde dos Agentes (39)" | "{m} fontes mudas há mais de 24 h" |
| Fontes estados (`:109-118`) | "ok / degraded / failing" | "OK / Lenta / Falhando / Muda" (com ícone) |
| Fontes vazio (`:181`) | "Nenhum agente executado ainda nesta sessão." | "O motor reiniciou às {hora}. Mostrando o histórico gravado." |
| Fontes última execução (`:35`) | "nunca" | "Nunca respondeu. Criada em {data}." |
| Fontes erro (`:151`) | "traço + erro cortado em 30 caracteres" | "Último erro: {texto completo, expansível}" + "Reexecutar fonte" |
| Command center (`DITCommandCenter.tsx:59`) | "Sincronizando Inteligência DIT PRINT..." | "Carregando a análise de {território}" |
| Command center (`:203`) | "O motor não gerou rationale para este período." | "Sem justificativa gravada para {período}. Reexecute o cálculo." + "Recalcular" |
| Login mesa (`DashboardLogin.tsx:46,66`) | "Radar Territorial™" / placeholder "admin@print.com" | "Acesso da equipe PRINT" / "voce@printrio.net" |
| Wizard (`TerritoryWizard.tsx:174,384,391`) | "Novo Território", "Aplicando Metodologia DIT", "Calculando ITT, ICS, IVS, IVE, ICI..." | "Criar território", "Calculando as 6 dimensões", "Lendo D1 a D6 nas fontes oficiais" |
| Bloqueio genérico | "Agendar Conversa Estratégica" (9 botões) | um único CTA por contexto: "Pedir Diagnóstico" ou "Pedir acesso ao Radar" |

---

## 7. Dependências de backend e dados que o redesign exige

Sem isto a nova IA de informação fica só visual (lei 3 da cidade: a trava tem de existir no código).

| # | Item | Motivo | Onde |
|---|---|---|---|
| B1 | **Gate real de publicação.** Tudo que é público ou do portal lê `stt_scores.published = true` (ou `index_history` ganha `published` e o orquestrador não o marca). `publishedBy` novo. | Seção 0, item 1 | `orchestrator.ts:480-545`, `db.ts:470-550`, schema |
| B2 | **Autenticação de assinante** por link mágico e tabela `subscriber_territories` (assinante x território). `alertPreferences.*` e `alertLog.recent` passam a usar a sessão e ignoram e-mail do cliente. | Seção 0, item 3 | `routers.ts:757-880`, novo `portalAuth` |
| B3 | Expor nota executiva publicada, `leitura` (tensão, confiança, faixa, dimensões com `null`) e Δ7/Δ30/sparkline em `portal.hoje`, `portal.territorio` e `publicData.territoryDetail`. | T03, promessa do Radar | `shared/leitura.ts` (já existe, contrato do backend) |
| B4 | **Persistir saúde das fontes** (por fonte e por território: último sucesso, último erro, contagem 7 dias, "conhecida até"). Hoje é memória do processo (`orchestrator.getAgentHealth`). | Fluxo 5.d | `orchestrator.ts:418` |
| B5 | `mesa.resumo`, `mesa.filaPublicacao` (todos os territórios), `mesa.devolverAoMotor`; um único caminho de publicação (`publishSttScore`); remover o `stt.upsert published` do painel. | Fluxo 5.c | `routers.ts` |
| B6 | `leads` (tabela) com status, e `POST /api/dit/lead` estendido (nome, empresa, momento, decisão); `leads.list/updateStatus`; e-mail de confirmação. | Fluxo 5.a | `ditLanding.ts:149`, novo `leads` |
| B7 | `publicData.territoriosPublicados` (só publicados, com Δ30 e confiança) para Landing e `/radar`. | P1, P3 | `db.ts` |
| B8 | Constantes compartilhadas: pesos das 6 dimensões e faixas 75/50 em `shared/const.ts`; o motor e `/metodologia` importam de lá. | Seção 0, item 5 | `calculator.ts:32`, `consolidator.ts:64` |
| B9 | `/api/alerts/stream`: exigir sessão e filtrar por território ou desligar. | Vazamento de inteligência paga | `_core/index.ts:67` |
| B10 | `system.health` (chamada pelo DevHub e inexistente) e `ai.chat` (chamada por componentes mortos): apagar os consumidores. | Código morto | DevHub, AIChatBox |
| B11 | Conferir custo de `/api/dit/analyze` (coleta e LLM por chamada pública, 30 a 60 s); a landing passa a usar `/isca`. Rate limit por IP já existe. | Custo | `ditLanding.ts:1508` |

Ordem sugerida com feature flag e comparação antes/depois (T18): (1) B1, B8 e B3 (corrigem integridade sem mudar telas); (2) Mesa M2 e M3 (o operador ganha a fila única e as fontes mudas); (3) Portal S1 e S2 com B2; (4) Pública P1 a P5 com B6 e B7; (5) remover arquivos mortos e redirecionar rotas antigas.

---

## 8. Critérios de aceite verificáveis (substituem adjetivos, E18)

1. Nenhum `Math.random` renderizado em `client/src` (`grep -rn "Math.random" client/src` só em `key`/id).
2. Nenhum número de território, agente ou fonte escrito em JSX; todo número vem de procedure ou constante.
3. `grep -rnE "STTGauge|EscalationBanner|text-glow|scanline|glass|hover:scale|transition-all" client/src` retorna zero fora de `components/ui` depois do redesign.
4. Portal só mostra STT de linha com `published=true`: teste de integração que insere um rascunho e confirma que `portal.hoje` não o devolve.
5. `portal.hoje` sem sessão devolve 401; com sessão, só territórios vinculados.
6. Todo botão "Pedir Diagnóstico" grava um `lead` (teste e2e no `/diagnostico`).
7. Toda tela tem os três estados (vazio, erro, carregando) com motivo e próximo passo (checklist por tela na PR).
8. Toda tabela tem 1ª coluna com nome legível, números tabulares à direita, ordem pelo valor que importa e filtro ativo visível (T06).
9. Toda cor de status acompanha ícone e rótulo (T07); contraste testado em claro e escuro.
10. Página mede 375 px sem rolagem horizontal (T16); tabela do portal vira lista de cartões em largura menor que 640 px.
11. `/metodologia` lê os pesos da mesma constante que o motor (teste que compara).
12. Teste dos 10 segundos (fluxo 5.b) com 5 pessoas antes de liberar o Portal.
