# 02. Lógica dos agentes: de onde vem o número e o que o front recebe

Data: 30/09/2026. Branch reversível `claude/redesign-agentes-dit-c3652b`. Nada publicado, nada commitado.
Caminhos relativos a `dit-territorial-intelligence/`.

## 1. Onde o "não sei" vira 100

| Onde | Arquivo:linha | O que acontece |
|---|---|---|
| Premissa | `server/stt/consolidator.ts:5-9` | "todo território começa em STT = 100 (complexidade máxima por desconhecimento)". |
| Acumulador | `server/stt/consolidator.ts:360-366` | cada dimensão D1..D7 parte de `score: 100`. Só sinal resolutivo subtrai. |
| Fecho | `server/stt/consolidator.ts:432-443` | "Sem sinais = score continua 100". O score de sinal de dimensão vazia é 100 e entra em `blendDimensionScore`. |
| Só estrutural | `server/stt/consolidator.ts:308-320` | território sem nenhum sinal: dimensões sem estrutura ficam 100, STT sai da soma com peso cheio. |
| Soma | `server/stt/consolidator.ts:448-451` | `stt = Σ dim × DIM_WEIGHTS`, sem distinguir medida de não medida. |
| Overwrite | `server/agents/orchestrator.ts:302-311` | o score consolidado substitui o do agente da dimensão e `consolidatedStt` vira o STT publicado (`:386`). |
| Relatório | `server/routes/ditLanding.ts:1109-1121` | `complexityFromScore(100)` rotula dimensão vazia como "Alta Complexidade" no prompt do LLM. |
| Agente de dimensão | `server/agents/base-dimension.ts:169-173` | `prevScore * 0.85 + newSignalsScore`: sem sinal novo o score só decai 15%, nunca marca "não medido". |

Efeito medido em Macaé: D1 (0,22) e D5 (0,15) sem evidência valiam 100 x 0,37 = 37 dos 84 pontos.

## 2. Como o STT final é montado

1. `orchestrator.run` roda as 7 dimensões em paralelo (`orchestrator.ts:115-117`), cada uma com suas fontes; o verificador (`agents/verificador.ts`, chamado em `base-dimension.ts:96`) descarta sinal que não cita o território antes de pontuar.
2. `calculateSttWithLLM` (`stt/calculator.ts:43`) calcula um STT determinístico com `calculateSTT` (`indicators.ts:935`) e pede só a nota executiva ao LLM. Esse STT NÃO é o publicado.
3. `_persist` grava em `stt_scores` e `index_history` os valores do passo 2 (`orchestrator.ts:247`, antes da consolidação). Ou seja, as linhas do MySQL são o snapshot pré-consolidação.
4. `consolidateSttFromHistory` (`consolidator.ts:200`) lê 24 meses de sinais (DB ou `.jsonl`), aplica decaimento (meia-vida 12 meses), polaridade por fonte, e mistura com a camada estrutural. Esse é o STT publicado em `result.stt` (`orchestrator.ts:386`).
5. Por dimensão: `score = estrutural x w + sinal x (1 - w)`, com `w = STRUCTURAL_WEIGHT (0,6) x confidence` (`structural/scoring.ts:357-372`). A camada estrutural só cobre D2, D3 e D4 (`scoring.ts:89-251`), por percentil nacional do município.
6. `stt = Σ score x peso`. Pesos de produção (`consolidator.ts:63`, `calculator.ts:31`): D1 0,22 / D2 0,15 / D3 0,15 / D4 0,22 / D5 0,15 / D6 0,11 / D7 0. Soma 1. Sem inversão de D3 e D5 (o score estrutural já é complexidade).

Duas inconsistências que o redesign precisa conhecer:
- `indicators.ts:140-820` carrega OUTRA tabela de pesos (0,20 / 0,14 / 0,14 / 0,20 / 0,12 / 0,10 / 0,10) e `calculateSTT` inverte D3 e D5 (`indicators.ts:941-946`). Só o passo 2 a usa. O número que o cliente vê segue o consolidador. O módulo novo usa os pesos do consolidador.
- Três cortes de cenário diferentes: `scoreToScenario` (`orchestrator.ts:659`, 75/50), `determineScenario` no calculator (por delta) e `scenarioFromStt` (`ditLanding.ts:1039`, 75/50).

## 3. Onde a polaridade é atribuída

`server/stt/consolidator.ts:79-127`. Polaridade vem da FONTE, nunca do conteúdo:
- `RESOLUTIVE_SOURCES` (`:79`, 20 fontes): subtrai `impact x peso_temporal x 20` da dimensão.
- `TENSIONING_SOURCES` (`:107`, 9 fontes): soma `impact x peso x 4`.
- Qualquer outra fonte: `impact >= 0.7` vira tensionante, senão neutra, e neutra SUBTRAI 1/3 do fator resolutivo (`:412`).

Consequências: `src-google-news`, `src-secretarias-ma`, `src-cptec-inpe`, `src-inea` e as demais fora das duas listas abaixam a tensão mesmo quando a notícia é ruim. `src-ibama`, `src-mp-ambiental` etc. são busca aberta (SerpAPI), mas entram como "tensionantes" mesmo quando a manchete é boa. O nome do agente descreve o órgão, o dado é notícia.

Classificação de impacto por palavra-chave fica nos agentes de dimensão (`base-dimension.ts:212-244`) e não tem polaridade.

## 4. Agentes de fonte

46 arquivos em `server/agents/sources/` (d1: 11, d2: 4, d3: 11, d4: 8, d5: 4, d6: 7, estrutural: 1 arquivo com 3 classes, D2, D3, D4) = 48 classes. Bluesky e Reddit estão desligados (`dimensions/dim-reputacao.ts:31-32`), então 46 ativas. Registradas por dimensão: D1 11, D2 5, D3 13, D4 10, D5 6, D6 5, D7 2 (reuso de Google News e Universidades).

Dependem de SerpAPI (leem `SERPAPI_API_KEY` e devolvem `[]` sem ela): 30 dos 46 arquivos.
- Só SerpAPI (18): cnuc, cptec-inpe, fiocruz-clima, ibama, ibge-mapbiomas, inea, inpe-deter, mp-ambiental, secretarias-ma, inep, mapa-empresas, sinir, snis-sinasa, isp-ssp, judiciario, plano-diretor, unicamp-terr, google-trends.
- SerpAPI mais endpoint próprio (9): antt-portos, datasus-real, datasus, inep-ideb, snis, funai-iphan, geni-uff, audiencias, orcamento-participativo.
- Chamam `serpapi.com` direto, sem o wrapper de cota (`serpapi-quota.ts`) (3): aneel-siga, incra-sipra, redes-sociais.
- Sem SerpAPI (16 arquivos: 15 fontes e a estrutural com 3 classes): inmet, cemaden (RSS), ibge-censo, ibge-renda, ibge-habitacao, ipeadata, pnud-atlas (RSS), fogo-cruzado, querido-diario, conselhos e redes (Apify), google-news, universidades (RSS), youtube, bluesky, reddit, estrutural x3.

Sem chave SerpAPI (ou sem saldo), D1 e D5 ficam quase sem sinal e caem no "100".

## 5. O que o front recebe

Dois caminhos.

**REST público (o que a landing usa em produção, que roda sem MySQL):**
- `POST /api/dit/analyze` (`ditLanding.ts:1508`) devolve o relatório: campos do LLM (`territory`, `region`, `dimensions[]` com `code,name,complexity,complexityNote,insight,signals`, `keySignals`, `forecast`, `executiveSummary`, ...) mais o override canônico (`stt`, `scenario`, `scenarioLabel`, `gaugeColor`, `totalSignalsCount`, `alertsCount`), `resolution`, `territoryGeo`, `coverageScore`, `coverageDetail`, `dataIntegrity`, `sectors`, `resources`, `hotspots`, `strategicCases`.
- `POST /api/dit/isca` (`:1403`): versão resumida derivada do snapshot do dia.
- `GET /api/dit/history/:slug` e `/monitored` (`:1369`, `:1384`).

**tRPC (`server/routers.ts`, exige `DATABASE_URL`, senão devolve vazio):** linha do banco crua, `stt_scores` com `{id, territoryId, period, stt, d1Score..d7Score, itt..ici (legado), activatedIndex, variation, executiveNote, scenario, published, publishedAt}`; `index_history` com os mesmos mais `sttDelta`, `signalCount`.

## 6. Campo novo `leitura` (aditivo)

Tipo: `shared/leitura.ts` (contrato que o front importa). Cálculo: `server/stt/tensao-confianca.ts`.

```ts
interface Leitura {
  tensao: number | null;        // 0-100, só com o que foi medido; null se nada foi medido
  confianca: number;            // 0-100, % do peso da metodologia medido
  faixa: { min: number; max: number }; // não medidas = 0 (min) ou 100 (max)
  dimensoes: Array<{
    id: string;                 // "D1".."D6"
    nome: string;
    score: number | null;       // null quando não medida (nunca 100 de enfeite)
    peso: number;               // 0-1, pesos do consolidador
    medida: boolean;            // estrutural OU >= 1 sinal verificado
    fonte: "estrutural" | "sinal" | "ambos" | "nenhuma";
  }>;
  stt_legado?: number;          // o STT antigo, para comparar na transição
}
```

Regra: `medida` = camada estrutural cobre a dimensão (ou há sinal de fonte estrutural) OU pelo menos 1 sinal verificado de fonte não estrutural. Sem número utilizável, não é medida.
Caso Macaé coberto em teste: tensão 74, faixa 47 a 84, confiança 63%, D1 e D5 sem score.

Onde aparece (todos mantêm os campos antigos intactos):
- `POST /api/dit/analyze` e `POST /api/dit/isca`: `leitura` (`ditLanding.ts:1856`, `:1959`); vem de `OrchestratorResult.leitura` (`orchestrator.ts:371-378`, `:406`), calculada do mesmo consolidado que gera o `stt`. Entra também no snapshot diário em disco.
- tRPC portal: `stt.latest`, `stt.history`, `territories.history` (`routers.ts:296-302`, `:98`).
- tRPC dashboard: `stt.all`, `dashboard.getPendingScores`, `publicData.territoriesComparison` (`:305`, `:768`, `:707`).
- tRPC público: `publicData.territoryDetail`, `publicData.territories` (`:693-697`, `:682`).

Limites conhecidos:
- No tRPC, os scores vêm da linha do banco (pré-consolidação, ver seção 2 passo 3) e a evidência vem do consolidado de agora (cache de 10 min em `stt/leitura.ts`). Em linha de período antigo a confiança é aproximada. Para não mentir, o front deve mostrar `leitura` só do último período.
- Sem `DATABASE_URL` e sem sinais em disco, `consolidateSttFromHistory` devolve null, a evidência fica vazia e a `leitura` sai com tensão `null` e confiança 0. É o comportamento honesto.
- D7 tem peso 0 e fica fora da leitura.
- Resultado em cache diário anterior a este deploy não traz `leitura` (vem `null`).

## 7. Polaridade por conteúdo (pronta, desligada)

`server/agents/polaridade.ts`, heurística determinística pt-BR (listas de fato negativo e positivo, negação e redução invertem o termo seguinte, empate é neutro). Sem LLM.

Flag: `DIT_POLARIDADE_CONTEUDO`. Só liga com a string exata `true`; ausente ou `false` é desligada. Nada em produção chama o módulo.

Onde plugar quando for a hora:
1. `consolidator.ts:396`, trocar `signalPolarity(row.source, weightedImpact)` por `polaridadeDoSinal(`${row.title} ${row.summary ?? ""}`, signalPolarity(row.source, weightedImpact))`. A função devolve a polaridade da fonte intacta com a flag desligada.
2. Para isso o `rows` do consolidador precisa carregar `title` e `summary`: o select do DB já traz as colunas (`consolidator.ts:237`, mapeamento em `:246`), e o fallback em disco tem `StoredSignal.title/summary` (`signal-store.ts`). Hoje o mapeamento descarta os dois campos; é só incluí-los.
3. Antes de ligar: rodar em Macaé e em mais 3 territórios com a flag `true` e comparar `stt_legado` contra o número novo; revisar as listas com a escola (provisório, vem da cabeça do Claude, precisa de auditoria da banca da escola risco-territorial).
4. Sugestão de ordem de entrega: primeiro publicar Tensão/Confiança (a leitura), depois a polaridade, para não mudar dois números ao mesmo tempo.

## 8. Testes

`server/stt/tensao-confianca.test.ts` (9), `server/stt/leitura.test.ts` (5), `server/agents/polaridade.test.ts` (14).
