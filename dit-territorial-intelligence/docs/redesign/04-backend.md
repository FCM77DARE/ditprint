# 04 Backend do redesign (B1 a B9)

Escrito em 30/09/2026 pelos postos d_dev_back e d_seguranca. Cobre o que entrou em `server/` e `shared/`
para as dependências B1 a B9 da seção 7 de `01-ux-arquitetura.md`. B10 e B11 ficaram de fora (não pedidos).

Tudo funciona nos dois modos de produção (skill dit-institucional, seção 7):

| Modo | Como persiste |
|---|---|
| Com MySQL (`DATABASE_URL`) | Tabelas existentes (`stt_scores`, `index_history`, `territories`, `subscribers`) mais UMA tabela nova, `dit_docs (colecao, chave, payload, updatedAt)`, criada sozinha na primeira escrita com `CREATE TABLE IF NOT EXISTS`. Não entrou em `drizzle/schema.ts` de propósito, para não conflitar com o journal de migrações. |
| Sem MySQL (Railway hoje) | Um JSON por coleção em `DATA_DIR` (`/data` no volume). Escrita atômica (arquivo temporário e rename) e serializada por fila. |

Arquivos em `DATA_DIR`, todos JSON objeto `{ chave: documento }`:
`publicacoes.json`, `rascunhos.json`, `devolucoes.json`, `leads.json`, `assinantes.json`,
`portal-solicitacoes.json`, `saude-fontes.json`. O volume é o único lugar desses dados: incluir na rotina de backup do volume.

A abstração é `server/_core/colecao.ts` (`colecao<T>(nome)` com `listar`, `entradas`, `obter`, `gravar`, `remover`).

## Flags (env, sem deploy de código)

| Flag | Padrão | Efeito ao desligar (`false`, `0`, `off`) |
|---|---|---|
| `DIT_GATE_PUBLICACAO` | `true` | As leituras públicas voltam ao caminho antigo (`index_history` e snapshot do motor). É o botão de volta. |
| `DIT_PORTAL_AUTH` | `true` | `alertPreferences.*` e `alertLog.recent` voltam a aceitar o e-mail do cliente; `portal.hoje/territorio/historico` ficam abertos; `/api/alerts/stream` abre sem sessão. |
| `RESEND_API_KEY` | ausente | Sem a chave nenhum e-mail sai e nenhuma rede é chamada. Com a chave, o gancho envia confirmação de lead e o link de acesso. |
| `DIT_EMAIL_FROM` | `DIT PRINT <dit@printrio.net>` | Remetente do gancho. |
| `PUBLIC_BASE_URL` | host da requisição | Base do link gerado em `assinantes.gerarLink`. |
| `DATA_DIR` | `./data` | Onde ficam os JSON. |
| `JWT_SECRET` | obrigatório (já era) | Raiz da chave do token do portal (derivada, veja B2). |

## Como o portão (B1) funciona, nos dois modos

1. O orquestrador continua calculando tudo e não decide nada público. A cada rodada ele grava um **rascunho**
   (`registrarRascunho`, coleção `rascunhos`, chave `slug|periodo`) com STT, dimensões, nota, leitura (tensão,
   confiança, faixa) e nº de sinais. Em modo MySQL continua gravando `stt_scores` e `index_history` como antes,
   exceto que **não reescreve mais uma linha de `stt_scores` já publicada** (antes o `onDuplicateKeyUpdate` trocava o
   número por baixo de quem tinha publicado).
2. **Publicar** (`dashboard.publishSttScore`) é o único caminho: congela tensão e confiança do momento, grava
   `publishedBy` e `publishedAt`, atualiza `stt_scores` (MySQL) e acrescenta ao **livro de publicações**
   (coleção `publicacoes`, uma entrada por publicação). O livro é a série para delta 7/30 e sparkline.
3. Toda leitura pública lê só o livro, mais as linhas antigas de `stt_scores` com `published=true` que ainda não
   têm entrada no livro (legado; o livro vence quando o período coincide). Nenhuma leitura pública toca
   `index_history`, snapshot do motor nem rascunho.
4. `upsertSttScore` (db.ts) passou a nunca despublicar: só escreve `published` quando é `true`.

Regra de delta: variação entre a última publicação e a publicada há N dias **ou antes** (um ponto por dia, a última
do dia). Sem publicação tão antiga o delta é `null`: o backend não inventa base de comparação. O valor
comparado é a tensão publicada, ou o STT quando a publicação é legada e não tem tensão.

**Fora do portão, por decisão a confirmar:** `POST /api/dit/analyze` e `POST /api/dit/isca` continuam devolvendo a leitura
automática de um território digitado (é a isca gratuita do funil, e B11 manda a landing usar `/isca`). Elas não são
"score publicado por humano". Se a decisão for que nem isso saia sem publicação, o portão entra ali depois.

## Procedures e rotas

Convenção: "público" = sem sessão; "operador" = cookie do dashboard; "assinante" = token do portal.
Entradas em zod. Saídas descritas pelos campos relevantes (campos antigos de cada retorno foram mantidos).

### B1 e B3 Leituras públicas (mudaram, mesmo nome)

**`publicData.territories`** (público, flag `DIT_GATE_PUBLICACAO`)
- Entrada: nenhuma.
- Saída: por território ativo (em modo disco, só os publicados), os campos antigos
  `id, slug, name, region, state, stt, scenario, period, sttDelta, activatedIndex, leitura` agora vindos do **último publicado**
  (`stt` e `leitura` congelados na publicação; `null` se nunca publicado), mais os novos
  `notaExecutiva` (só o primeiro parágrafo), `delta7`, `delta30`, `serie` (até 12 pontos `{data, valor}`),
  `publicado`, `publishedAt`, `publishedBy`. `sttDelta` = diferença para a publicação anterior.

**`publicData.territoryDetail`** (público, `{ slug }`, flag `DIT_GATE_PUBLICACAO`)
- Saída: campos antigos (`d1Score..d7Score`, `contextData`, `leitura`) do último publicado, mais
  `notaExecutiva` (primeiro parágrafo), `delta7`, `delta30`, `serie`, `publicado`, `publishedAt`, `publishedBy`.
  `NOT_FOUND` se o território não existe (nem no MySQL nem no livro). Território existente sem publicação devolve `stt: null` e `publicado: false`.

**`stt.latest`** (público, flag `DIT_GATE_PUBLICACAO`)
- Entrada: `{ territoryId?: number, slug?: string }` (pelo menos um; `slug` funciona sem MySQL).
- Saída: `null` sem publicação; senão o formato antigo de linha (`id, territoryId, period, stt, d1Score..d7Score,
  executiveNote, scenario, published, publishedAt, variation, itt..ici = null, leitura`) mais `publishedBy`, `notaExecutiva`
  (primeiro parágrafo; `executiveNote` também vem truncado na área pública), `delta7`, `delta30`, `serie`, `publicado`.

**`stt.history`** e **`territories.history`** (públicos, flag `DIT_GATE_PUBLICACAO`)
- Entrada: `stt.history` aceita `{ territoryId? , slug?, limit? }`; `territories.history` segue `{ slug, limit? }`.
- Saída: um item por período (a publicação mais recente do período), do mais novo ao mais antigo, no formato de `stt.latest`.

**`publicData.territoriosPublicados`** (público, B7)
- Entrada: nenhuma. Saída: só territórios com publicação:
  `{ slug, nome, estado, regiao, tensao, confianca, stt, scenario, period, delta30, publishedAt }[]`.

**`GET /api/dit/history/:slug`** e **`GET /api/dit/monitored`** (públicos, flag `DIT_GATE_PUBLICACAO`)
- `history`: `{ slug, history: [{ date, stt, tensao, confianca, scenario, signalsCount, computedAt }] }`, um ponto por dia publicado.
- `monitored`: `{ count, territories: [{ slug, latestStt, latestScenario, latestDate, totalDays }] }`, só quem tem publicação.

### B5 Mesa do operador (`dashboard.*`, exigem operador)

Nomes seguem o pedido do backend (`dashboard.*`). O documento 01 chama a fila de `mesa.*` e o login de `portalAuth.*`:
o front deve usar os nomes abaixo (`dashboard.filaPublicacao`, `dashboard.devolverAoMotor`, `portal.solicitarAcesso`, `portal.sessao`).

**`dashboard.filaPublicacao`**
- Entrada: `{ incluirDevolvidos?: boolean }` (padrão `false`).
- Saída: `ItemFila[]` ordenada por `|delta|` decrescente:
  `{ slug, territoryId, nome, estado, period, scoreId|null,
     rascunho: { stt, tensao, confianca, faixa, scenario, notaExecutiva, nSinais, geradoEm, dims },
     ultimaPublicada: { stt, tensao, confianca, scenario, notaExecutiva, publishedAt, publishedBy } | null,
     delta | null, devolvidoAntes: { motivo, por, em } | null }`.
  Entra na fila o território que nunca foi publicado ou cujo cálculo do motor é mais novo que a última publicação.
  Junta rascunhos do livro e, em modo MySQL, linhas pendentes de `stt_scores` anteriores ao livro.

**`dashboard.publishSttScore`** (existente, agora o ÚNICO caminho)
- Entrada: `{ scoreId?: int, slug?: string, period?: "YYYY-MM", executiveNote?: string }`. Use `scoreId` (linha do MySQL) ou `slug` + `period` (rascunho do motor, funciona sem MySQL).
- Saída: `{ success, publicacao: { slug, period, stt, tensao, confianca, publishedAt, publishedBy } }`. `publishedBy` é o e-mail do operador da sessão.
- Erros: `NOT_FOUND` (rascunho inexistente), `BAD_REQUEST` (sem referência).

**`dashboard.devolverAoMotor`**
- Entrada: `{ scoreId? , slug?, period?, motivo: string (5 a 500 caracteres) }`.
- Saída: `{ success, devolucao: { slug, period, motivo, por, em, rascunhoGeradoEm } }`. Sai da fila até o motor calcular de novo
  (cálculo novo reabre; `incluirDevolvidos` mostra os devolvidos). Nada vai ao público.

**`dashboard.getPendingScores`** (existente): em modo disco devolve os rascunhos do livro no formato de linha (`id` 0 quando não há linha no MySQL; use `slug` + `period` para publicar).

**`stt.upsert`** (existente): o campo `published` segue aceito mas é ignorado. Devolve `{ success: true, published: false }`. Publicar só por `dashboard.publishSttScore`.

### B4 Saúde das fontes

**`dashboard.saudeFontes`** (operador)
- Entrada: nenhuma.
- Saída: `{ cotaSerpapiEsgotada, resumo: { total, ok, mudas, falhando, porCota, porDefeito }, fontes: FonteClassificada[] }`, com
  `FonteClassificada = { id, nome, dimensao, ultimaRodada, ultimoSucesso, ultimoErro, ultimoErroMsg, ultimoSinal,
  dias: { "YYYY-MM-DD": { rodadas, ok, erro, sinais } }, estado: "ok"|"muda"|"falhando", motivo: "cota_serpapi"|"defeito"|"ok",
  sucessos7d, erros7d, sinais7d, rodadas7d, horasSemSinal }`, ordenada por gravidade.
- Gravação: a cada rodada do orquestrador (`registrarRodadaDeFontes`), em `saude-fontes` (MySQL ou `DATA_DIR/saude-fontes.json`). Erro da fonte = `errorCount` subiu durante a rodada.
- Classificação: `falhando` se o último erro é posterior ao último sucesso; `muda` se houve rodada em 7 dias e nenhum sinal.
  `cota_serpapi` quando a fonte consulta o SerpAPI (lista `FONTES_SERPAPI`, 30 agentes levantados do código) e a cota está esgotada
  ou o erro cita cota/429; o resto é `defeito`. Limite conhecido: a saúde é por fonte, não por fonte e território (o doc 01 pede por território também).

### B6 Leads

**`POST /api/dit/lead`** (público, rate limit por IP que já existia)
- Corpo (zod): `{ nome?, empresa?, email (obrigatório), territorio?, momento?: "entrar"|"operar"|"responder", decisao?, observacao? }`.
  `territory` (campo do formulário antigo) segue aceito como `territorio`. Limites: nome 120, empresa 160, território 120, decisão 500, observação 2000.
- Saída 200: `{ saved: true, isNew, captured: true, leadId }`. 400: `{ error: "Email inválido" | "Dados inválidos", campos }`.
- Idempotente: mesmo e-mail, território e momento é o mesmo lead (`reenvios` sobe). Grava em `leads` (MySQL ou `DATA_DIR/leads.json`), sem IP nem user agent.
  Com MySQL também insere em `subscribers` como antes (compatibilidade com alertas).
- Gancho de e-mail: `confirmarPorEmailSeHouverChave` só envia se `RESEND_API_KEY` existir.

**`dashboard.leads.list`** (operador): entrada `{ status?: "novo"|"em_contato"|"proposta"|"ganho"|"perdido" }`; saída `Lead[]` mais novos primeiro:
`{ id, nome, empresa, email, territorio, momento, decisao, observacao, status, notaInterna, criadoEm, atualizadoEm, reenvios, confirmacaoEnviada }`.

**`dashboard.leads.updateStatus`** (operador): entrada `{ id, status, notaInterna? }`; saída `{ success, lead }`; `NOT_FOUND` se o id não existe.

### B2 Assinantes e portal

Fluxo sem e-mail (RESEND_API_KEY não existe hoje):
1. `portal.solicitarAcesso(email)`: resposta idêntica para e-mail conhecido ou não, **nunca devolve o link**. Só registra o pedido.
2. O operador vê o pedido em `dashboard.assinantes.list` e gera o link em `dashboard.assinantes.gerarLink`, que devolve o link **ao operador**.
3. O assinante abre `/entrar?token=...`; o front chama `portal.sessao({ token })`, que valida e grava o cookie httpOnly `dit_portal_token` (7 dias).

Token: JWT HS256, 7 dias, `{ type: "assinante", email, v }`. A chave é `HMAC-SHA256(JWT_SECRET, "dit-portal-assinante-v1")`: um token de
assinante não vale como token de operador e o inverso também não (o verificador do operador já conferia `type`). `v` é a versão
do registro do assinante; `assinantes.upsert({ revogarLinks: true })` invalida todos os links já emitidos.
O token é lido do cookie `dit_portal_token`, do cabeçalho `x-dit-portal-token` ou de `Authorization: Bearer`. Nunca por query string
(só o link de acesso inicial carrega o token na URL, uma vez).

**`portal.solicitarAcesso`** (público): `{ email }` -> `{ ok: true, mensagem }`. Pedidos repetidos em 10 minutos não geram novo registro.

**`portal.sessao`** (público, mutation): `{ token? }` (sem `token` lê do cookie/cabeçalho) -> `{ email, nome, territorios: string[], expiraEm }` ou `null`.

**`portal.sair`** (público, mutation): limpa o cookie.

**`portal.hoje`** (assinante ou operador, flag `DIT_PORTAL_AUTH`): `void` -> lista só dos territórios do contrato:
`{ slug, nome, estado, stt, scenario, period, leitura, notaExecutiva (inteira), delta7, delta30, serie, publicado, publishedAt, publishedBy }[]`.

**`portal.territorio`** (idem): `{ slug, limit?: 1..24 (12) }` -> `{ slug, nome, estado, regiao, atual, historico, notaExecutiva, delta7, delta30, serie, ... }`.
`FORBIDDEN` fora do contrato; `NOT_FOUND` sem publicação.

**`portal.historico`** (idem): `{ slug, limit? }` -> linhas publicadas com nota inteira; `FORBIDDEN` fora do contrato.

**`alertPreferences.list | upsert | deactivate`** (flag `DIT_PORTAL_AUTH`): `subscriberEmail` virou opcional. Com a flag ligada o e-mail vem da
SESSÃO e o enviado pelo cliente é ignorado; sem sessão `UNAUTHORIZED`; `upsert` e `deactivate` em território fora do contrato dão `FORBIDDEN`;
`list` filtra pelos territórios do assinante. Operador pode informar o e-mail de quem atende. Flag desligada: comportamento antigo.

**`alertLog.recent`** (flag `DIT_PORTAL_AUTH`): exige sessão e `FORBIDDEN` para território fora do contrato. `markOpened` ficou público (pixel de e-mail).

**`stt.*` do portal:** `stt.latest` e `stt.history` seguem públicos e, por isso, só mostram o primeiro parágrafo da nota. A leitura
completa do assinante é `portal.hoje | territorio | historico`.

**`dashboard.assinantes.list`** (operador): -> `{ assinantes: [{ email, nome, territorios, tokenVersion, criadoEm, atualizadoEm, ultimoAcesso, pediuAcesso }], pedidosDeAcesso: [{ email, em, conhecido, atendida }], emailAtivo }`.

**`dashboard.assinantes.upsert`** (operador): `{ email, nome?, territorios: string[] (slugs), revogarLinks?: boolean }` -> `{ success, assinante }`.
Com MySQL também entra em `subscribers` (plano `radar`), que as preferências de alerta usam.

**`dashboard.assinantes.gerarLink`** (operador): `{ email, baseUrl? }` -> `{ success, link, expiraEm, emailEnviado }`.
`NOT_FOUND` se o assinante não existe; `BAD_REQUEST` se não tem território. Marca o pedido de acesso como atendido.
Com `RESEND_API_KEY` também envia o e-mail (`emailEnviado: true`).

### B9 Feed de alertas

**`GET /api/alerts/stream`** (SSE): sem sessão de operador ou assinante responde **401**. Assinante só recebe (ao vivo e no replay do buffer)
alertas dos territórios do contrato; `?territoryId=` continua valendo como filtro adicional. Flag `DIT_PORTAL_AUTH`. O cookie vai no
`EventSource` do mesmo domínio, sem precisar de cabeçalho.

### B8 Constantes compartilhadas

`shared/metodologia.ts` agora exporta `PESOS_POR_DIMENSAO`, `FAIXA_ESCALADA_MIN` (75), `FAIXA_PRESSAO_MIN` (50), `CenarioStt` e `cenarioDoStt`.
`calculator.ts`, `consolidator.ts`, `tensao-confianca.ts` e `orchestrator.ts` importam de lá. Valores idênticos aos de antes
(`server/stt/constantes-compartilhadas.test.ts` trava os números e falha se alguém redigitar os pesos nesses arquivos).
Não mexi em `alertEngine.ts` e `ditLanding.ts`, que têm os limiares 75 e 50 escritos em linha para rótulo de e-mail e de relatório.

## O que testa cada coisa

| Arquivo | Cobre |
|---|---|
| `server/stt/publicacao-logica.test.ts` | delta 7/30, série, nota pública, fila, flags |
| `server/stt/constantes-compartilhadas.test.ts` | B8 sem mudar número |
| `server/stt/saude-fontes.test.ts` | B4 registro, 7 dias, `cota_serpapi` / `defeito` / `ok` |
| `server/publicacao.test.ts` | B1, B3, B5, B7 em modo disco |
| `server/leads.test.ts` | B6 zod, idempotência, funil, gancho de e-mail |
| `server/portal.test.ts` | B2 token, expiração, revogação, confusão com token de operador |
| `server/alertas-sse.test.ts` | B9 filtro por território |
| `server/backend-redesign.test.ts` | router real: portão, mesa, leads, assinantes, portal, flags |
| `server/rotas-publicas.test.ts` | REST real: lead, history, monitored, SSE 401 |
| `server/publicacao-mysql.test.ts` | as mesmas regras em MySQL; só roda com `DIT_TEST_MYSQL_URL` apontando para banco descartável já migrado |

## Pontos abertos para decisão

1. `analyze` e `isca` sem portão (acima).
2. Saúde das fontes por território afetado (M3 do doc 01): hoje é por fonte.
3. `system.health` e `ai.chat` (B10) e custo de `analyze` (B11): não tratados aqui.
4. A nota pública é o primeiro parágrafo (doc 01, P5). Se o produto quiser a nota inteira na ficha pública, é trocar `notaCompleta` em `visao-publica`/`routers.ts`.
5. Enquanto `RESEND_API_KEY` não existir, todo link de acesso passa pela mão do operador (`gerarLink`).
