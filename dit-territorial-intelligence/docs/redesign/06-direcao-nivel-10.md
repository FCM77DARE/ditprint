# 06 · Direção nível 10 do Marco

Diretor: ag_diretor_design (p_design) · 30/09/2026 · revisão 3 (incorpora as quatro correções do Felipe de hoje).

Por que existe: o Felipe deu nota 1 a 3 ao redesign em produção: "muito fraco, sem motion, o fluxo você errou", e depois "você pegou a nossa identidade e fez uma gambiarra para aparecer". Este documento troca o fluxo, dá ao Marco uma identidade própria de tecnologia, dirige imagem, motion e microinteração no nível do ditoo, dirige o relatório do Diagnóstico completo e fixa a régua de 0 a 10.

As ordens curtas por time estão em `06-ordens.md`.

---

## 0. Premissas que mandam neste documento

### 0.1 O que o Felipe corrigiu hoje, em ordem (a última prevalece)

1. **A escada**: (1) Leitura gratuita = o DIT real rodando ao vivo para qualquer território, com notícias e sinais aparecendo enquanto os agentes respondem; (2) Diagnóstico completo, pago; (3) Marco Radar, acompanhamento; (4) contratar a PRINT para um diagnóstico no local.
2. **O ditoo é a MAIOR referência**, a próxima; as de fora complementam. O Marco precisa ser **uma tecnologia com identidade própria**, não a identidade da PRINT adaptada. A PRINT só assina "powered by PRINT".
3. Em linguagem simples: **imagens na tela, design com motion, botões que se mexem**.
4. **O básico bem feito primeiro.** "Não pedi 3D, não pedi território sendo destruído e construído, nem vídeo; estou indo pelo mais básico para ver se aprendem." É a **ordem de aprendizado**, não proibição: esta rodada entrega imagem real, motion limpo e botões que reagem no nível do ditoo. WebGL, 3D, vídeo, cena cinematográfica, território se desenhando e cursor customizado ficam registrados como **próxima camada (§4.6)**, para quando o básico estiver 10 na régua.

### 0.2 A escada de valor

| Degrau | O que é | Preço | O que a página faz com ele |
|---|---|---|---|
| 1 · **Leitura gratuita** | o DIT real rodando ao vivo para o território pesquisado | zero | é o hero e é a isca. Nada de formulário antes dela |
| 2 · **Diagnóstico completo** | o relatório inteiro, com tudo o que a leitura mediu | pago (sem tabela canônica: não escrever número) | conversão principal depois da leitura |
| 3 · **Marco Radar** | acompanhamento contínuo, alerta quando o território muda | assinatura | oferecido no fim do Diagnóstico |
| 4 · **PRINT no local** | equipe da PRINT em campo | proposta | aparece uma vez, no fim, com a assinatura |

Verbo único (landing-conversao, técnica 12): **Ler**. "Ler este território" no hero e entre blocos; "Quero o Diagnóstico completo" no ponto de maior desejo. "Pedir diagnóstico" deixa de ser CTA de topo.

### 0.3 O que é PROVISÓRIO

A identidade do §3 e os tokens de motion do §4 são **PROVISÓRIOS**: valem para construir agora (tudo é reversível) e serão conferidos contra a escola `direcao-de-arte-e-motion-web` quando o coordenador repassar os padrões. O fluxo (§2) e a régua (§6) não dependem dela.

### 0.4 Regras duras herdadas

- Nunca travessão. Nunca número sem fonte. Nunca case de cliente. Crise só no momento Responder (dit-institucional §2 e §9).
- A estrutural sai sempre; a leitura ao vivo pode cair em `sem_leitura`, e a tela diz o motivo e o próximo passo (escola T12).
- Gauge, velocímetro e disco com ponteiro são proibidos (escola, erro de amador 1). O disco do /marco não sobe para o produto: Tensão é barra horizontal com a faixa (T05).

---

## 1. Referências

### 1.1 O ditoo destrinchado (a referência principal)

Fontes lidas: `auditia/identidade/ditoo/README.md` (a tese da marca), `auditia/ai-audit/client/src/pages/Home.tsx`, `home-ditoo.css`, `Leitura.tsx`, `leitura-ditoo.css`, `components/MarcaDitoo.tsx`, a prévia `identidade/ditoo/estudos/site-redesign-previa-4.html` e o site no ar em https://ditoo.ai (capturas `telas/nivel10/ditoo-d-dobra.jpg`, `ditoo-d-rolado.jpg`, `ditoo-m-dobra.jpg`; medido: h1 Archivo 99 px, 1 campo na dobra, Lenis ativo, LCP 1,8 s, CLS 0,001).

**A lógica que o ditoo mudou** (é isso que o Marco precisa fazer igual):

| # | O que o ditoo fez | Onde está | O que o Marco copia (a lógica, não a cara) |
|---|---|---|---|
| D1 | **Identidade construída do zero a partir de uma tese do produto**, sem herdar nada do AuditIA nem da PRINT. A tese: o produto não acha que algo foi dito, acha que foi "dito de novo, e de novo", até virar verdade; o nome soletra isso no segundo `o` | README, "A tese" e "Construída sem herdar nada do VEREDITO" | o Marco nasce da tese dele (§3.1), e sai tudo o que é da PRINT: curvas de nível decorativas, sálvia, papel quente, verde |
| D2 | **A PRINT só assina a origem**: "powered by" mais a logo HD a 15 px, separada por um filete, nunca no peso do wordmark | README, "Assinatura de origem"; `home-ditoo.css` `.origem` | idem, com a mesma altura e a mesma ordem |
| D3 | **Um gesto só, que é o produto**: o anel vira disco em 620 ms, uma vez, nunca em loop ("loop vira spinner") | README, "Gesto"; `home-ditoo.css` `@keyframes hd-fixar` | o Marco ganha o gesto dele (§3.3) e usa só esse |
| D4 | **O mesmo gesto em toda microinteração**: marca na entrada (`.topo .marca .d`), ícone do botão (`.acao .g` preenche no hover e no foco), grade dos 16 modelos (`li.fixou`), lista de respostas da demonstração, FAQ aberto (`details[open] .o`), bancada da leitura. Identidade, motion e botão são a mesma coisa | `home-ditoo.css` linhas do `.acao`, `.grade16`, `summary .o` | o gesto do vértice no botão, no FAQ, na lista de fontes e na marca |
| D5 | **O acento tem um trabalho só**: ultramar marca o que a repetição fixou; nota alta é tinta cheia, não verde | README, "As três regras" e "Cores" | a cor de acento do Marco marca só o que foi fixado; Tensão alta é tinta cheia |
| D6 | **Imagem de verdade em tela cheia, tratada em duotone da paleta**: fotografias próprias (guilhoche, estratos de papel, curvas) convertidas para a paleta por `duotone.py`, com véu em gradiente para o texto ler, e movimento só por rolagem (`data-paralaxe`, `data-escala`) | `public/home/*.jpg`; prévia 4, comentário do topo; `Home.tsx` 441 e 442 | fotografia e imagem de satélite reais do território, em duotone da paleta Marco, com o mesmo véu e o mesmo parallax leve |
| D7 | **Hero escuro de altura total com a busca como peça principal**: campo branco com sombra profunda (`0 30px 80px -30px`), anel de foco de 4 px, botão "Rodar a leitura" | `Home.tsx` 509 a 523; `.busca` | o campo "Ler este território" no mesmo lugar e com o mesmo peso |
| D8 | **Motion limpo**: título em cortina (`clip-path`) sem desfoque ("o borrão cansava a vista", Felipe 24/09), blocos sobem 20 px, listas entram em sequência, Lenis como único motor, rede de segurança que mostra o hero aos 2,5 s | `Home.tsx` 384 a 455 | a mesma receita, com os tokens do §4 |
| D9 | **A leitura é o produto ao vivo, com vocabulário de redação**: "Edição em fechamento", contador `05/16`, "No fio, agora" com trecho real datilografado, a bancada dos 16 anéis que viram disco quando cada modelo responde, carimbo "EDIÇÃO FECHADA", e frases de espera que dizem a verdade ("Nenhum trecho é pré-gravado: o que aparecer, apareceu") | `Leitura.tsx` 180 a 186 e 635 a 695 | o vocabulário do Marco é de levantamento de campo (§3.5): "Em campo", "Visada", "Ponto fixado", "Levantamento fechado" |
| D10 | **Número gigante condensado** para o que conta (contador a 260 px, `wdth 70`, algarismo tabular) e demonstração que toca sozinha em três cenas, clicável por passo | `.dezesseis .contador`; `Home.tsx` 339 a 364 e 424 a 434 | contador de sinais verificados e a demonstração dos três passos |
| D11 | **A fala da máquina em serifa e sempre literal**: um invariante do produto virou regra tipográfica | README, regra 3 | a manchete da imprensa aparece literal em serifa; o dado oficial em mono (§3.4) |

### 1.2 As de fora (complemento, citadas onde entram)

Capturadas em Chromium sem interface a 1440×900 e 390×844, sem aceitar cookie. Arquivos em `docs/redesign/telas/nivel10/`.

| # | Referência | Captura | O gesto que complementa o ditoo |
|---|---|---|---|
| M1 | Stripe | `stripe-d-dobra.jpg` | número vivo na primeira dobra ("PIB global em execução na Stripe: 1,72453278%"): prova de motor rodando sem depoimento |
| M2 | Windward | `windward-d-dobra.jpg`, `windward-d-rolado.jpg` | lista de anomalias com variação e rótulo técnico em mono; a sala da leitura ao vivo |
| M3 | Linear | `linear-d-dobra.jpg`, `linear-d-rolado.jpg` | feed de atividade com carimbo de tempo ("2min ago"): a gramática da linha de sinal |
| M4 | Palantir | `palantir-d-t0.jpg`, `palantir-d-dobra.jpg`, `palantir-d-rolado.jpg` | lista numerada com nome enorme ("/0.2 Gotham"): índice do relatório e bloco da escada |
| M5 | Felt | `felt-d-dobra.jpg`, `felt-d-rolado.jpg` | cartografia aberta com atribuição visível dentro do quadro do produto |
| M6 | Global Nature Watch | `gfw-d-dobra.jpg`, `gfw-d-rolado.jpg` | imagem de satélite real no hero e alerta como ponto num território real |
| M7 | Locomotive | `locomotive-d-dobra.jpg`, `locomotive-d-rolado.jpg` | grade deslocada e linha de texto do tamanho da tela |
| M8 | The Pudding | `pudding-d-dobra.jpg` | edição numerada e datada: modelo do relatório |
| M9 | Mapbox | `mapbox-d-dobra.jpg` | Lenis em site corporativo de dado geográfico |

Lidas e **guardadas para a próxima camada** (§4.6), fora desta rodada do básico: Planet (vídeo de satélite no hero), Vercel (símbolo com luz), Resend (objeto 3D em luz rasante), Lusion (WebGL e preloader contado). Descartadas por não abrir: Descartes Labs (domínio à venda), Cloudflare Radar (bloqueio anti-robô, não contornado), Basement, Active Theory, Igloo (WebGL sem GPU).

---

## 2. O fluxo certo, por público

### 2.1 Visitante: do campo ao lead na mesa

O contrato técnico já existe em `server/routes/leitura-stream.ts`: `inicio → resolvido → estrutural → etapa | fonte | sinal | dimensao → teaser | sem_leitura → fim`. Cada passo abaixo casa com um evento.

| Passo | Objetivo | O que a tela mostra | Motion | Pronto quando |
|---|---|---|---|---|
| **V1 · Hero com o campo** (`/`) | fazer a pessoa digitar em 8 segundos | hero de altura total com **imagem real** de território em duotone (D6, M6) e véu; h1 de dois tempos pela dor (proposta: "Toda operação tem um CEP. / Veja agora o que o seu está dizendo."); o **campo** `BuscaLeitura variante="hero"` com "Ler este território" (D7); a nota "Se você sabe o nome do município, você lê o território. Sem cadastro."; na base, o **contador vivo do dia** (M1): "Hoje o Marco consultou N fontes e verificou N sinais", número real; legenda da imagem em mono ("Sentinel-2 · 12/08/2026 · Macaé, RJ") | entrada do §4.2 | campo visível e usável antes de qualquer animação; nenhum formulário de contato na dobra |
| **V2 · Resolução** | homônimo sem atrito | combobox com município e UF (pronto em `BuscaLeitura.tsx`) | lista abre em 180 ms | Enter leva a `/leitura/:slug`; homônimo nunca adivinha |
| **V3 · Estrutural na hora** (`resolvido`, `estrutural`) | valor em menos de 1 s | faixa de imagem do território (satélite em duotone, ou a foto de contexto quando não houver recorte) com o nome em display, código IBGE e coordenada em mono; a silhueta do município (malha do IBGE, **parada**, sem desenhar); D2, D3 e D4 como barras com percentil nacional e fonte; faixa "O que falta: socioambiental, governança, reputação e os sinais dos últimos 24 meses. Estamos buscando agora." | título em cortina; barras enchem em sequência (0,08 s) | primeiro dado real em até 1 s; nenhum número sem fonte |
| **V4 · Leitura ao vivo: o momento mais forte** (`etapa`, `fonte`, `sinal`, `dimensao`) | provar que o Marco é um sistema rodando | palco escuro desde a chegada, como o `palco-escuro` do ditoo (D9): à esquerda "Em campo", a frase da etapa, o **contador de sinais verificados** em número gigante condensado (D10) e a **lista das fontes**, cada uma com o vértice vazado que se fixa quando ela responde (D4); à direita "Na visada, agora": cada sinal entra no topo como linha de feed (M3) com dimensão, fonte, data, manchete literal e impacto; embaixo, frases de espera que dizem a verdade ("Nenhum sinal é pré-gravado: o que aparecer, apareceu.") | §4.3 | cada evento vira mudança visível em até 400 ms; nada anima sem evento; cache diz "Leitura de hoje, 07:12, reproduzida"; `sem_leitura` tem motivo e próximo passo |
| **V5 · Teaser** (`teaser`) | querer o resto | carimbo "LEVANTAMENTO FECHADO · 14:32" (D9); Tensão com faixa e Confiança em barra; síntese; 3 sinais; 1 risco; 1 oportunidade; o índice do Diagnóstico completo numerado (M4) com a contagem real do que ficou de fora ("Dimensão socioambiental · 7 sinais"), capítulos bloqueados em cinza | carimbo entra uma vez; índice em sequência | só o que veio no `teaser`; contagem real; um CTA: "Quero o Diagnóstico completo" |
| **V6 · Captura curta** | lead qualificado | painel na própria página: e-mail corporativo e empresa, decisão em um toque (Entrar, Operar, Responder); nome e cargo opcionais | painel sobe 20 px e aparece (0,5 s) | 2 campos e 1 toque; erro diz o que fazer |
| **V7 · Confirmação com prazo honesto** | dizer o que acontece e quando | "Pedido registrado. Um analista da PRINT confere a leitura de Altamira e manda o Diagnóstico completo para o seu e-mail." Prazo **PROVISÓRIO, confirmar com o CEO: até 1 dia útil**. Link permanente da leitura e o próximo degrau em uma linha | o vértice do ícone se fixa (gesto único) | prazo que a mesa cumpre; sem envio real ligado, a tela não diz que enviou |
| **V8 · Lead na mesa** (`/mesa/leads`) | comercial agir no dia | território, decisão, teaser, link da leitura, UTM do bloco | nenhum | aparece com link e UTM |

Abaixo da dobra, a landing segue a espinha de 11 blocos (landing-conversao §2), cada bloco devolvendo ao campo, **cada um com a sua imagem**: 2 reconhecimento (as fontes oficiais que o motor lê, IBGE, INPE, IBAMA, ANA, Querido Diário, e a assinatura PRINT com número canônico); 3 três passos com a demonstração que toca sozinha (D10), com dado real de leitura publicada; 4 os três momentos em abas, cada aba com uma foto de contexto (§3.6); 5 antes e depois espelhado sobre faixa de imagem com parallax (D6, `estratos` do ditoo); 6 nomes próprios (Tensão, Confiança, Marco Radar, as 6 dimensões com peso); 7 prova operacional real (fontes que respondem hoje, conferido no código); 8 a escada dos 4 degraus em lista numerada (M4); 9 urgência sobre imagem de tela cheia; 10 FAQ de objeção com JSON-LD; 11 rodapé de uma linha com "powered by PRINT".

### 2.2 Assinante: link → Hoje → território

| Passo | Objetivo | O que a tela mostra | Motion | Pronto quando |
|---|---|---|---|---|
| A1 · Link do e-mail | entrar sem senha | abre direto em Hoje | nenhum | um clique até Hoje |
| A2 · Hoje (`/portal`) | saber em 10 s se algo mudou | territórios ordenados pelo que mudou contra a linha de base (T03), Tensão, faixa e Confiança em barra, sinal mais forte; alertas no topo com a **mesma linha de sinal** da leitura ao vivo | linhas entram uma vez | quem viu a leitura reconhece o produto |
| A3 · Território | decidir | o relatório vivo (§5), com o que mudou desde a última visita marcado pelo acento | barra de progresso só | "o que decide" sem rolar |

### 2.3 Operador: publicação

| Passo | Objetivo | O que a tela mostra | Motion | Pronto quando |
|---|---|---|---|---|
| O1 · Fila (`/mesa/publicacao`) | nada no ar sem humano | pendentes com Tensão, faixa, Confiança, sem lastro e diff | nenhum (T15) | ordem por mudança |
| O2 · Revisão | aprovar com evidência | sinais que sustentam, rejeitados e `semLastro` lado a lado (T13) | nenhum | aprovar exige ter aberto o sem lastro |
| O3 · Publicar | registrar quem aprovou | "Publicar leitura de Macaé" e o registro | confirmação em texto, sem modal sobre a tabela | portão real (já é) |

---

## 3. Identidade própria do Marco como tecnologia (PROVISÓRIA)

### 3.1 A tese

**Um ponto só se fixa quando várias visadas concordam.** É assim que o marco geodésico nasce: o topógrafo mira o mesmo ponto de lugares diferentes, e onde as linhas se cruzam o ponto fica fixado e ganha coordenada. O Marco faz o mesmo com um território: dado oficial, diário oficial e imprensa miram o mesmo lugar, o verificador descarta o que não é de lá, e o que concorda vira leitura.

Daí sai o sistema inteiro, como no ditoo (D1): o símbolo é o vértice, o gesto é o ponto se fixando, o acento marca o que foi fixado, o vocabulário é de levantamento de campo.

### 3.2 O que sai (era da PRINT)

Curvas de nível como enfeite, sálvia, verde floresta, papel quente `#ECEBE3`, bronze `#9A6224`, o disco com ponteiro, "Inteligência territorial da PRINT" como subtítulo da marca. A PRINT fica só em "powered by" (D2).

### 3.3 Símbolo, wordmark e o gesto único

- **Símbolo:** triângulo equilátero vazado com ponto sólido no centro, a convenção das cartas do IBGE para vértice de triangulação. O triângulo em tinta, o ponto na cor de acento. Nunca redesenhar depois de fechado; nunca girar; nunca preencher o triângulo.
- **Wordmark:** `MARCO` em caixa alta, Archivo 800 `wdth 125`, entreletra 0,02 em: a caixa alta é a da chapa gravada do marco de concreto. Lockup: símbolo à esquerda, respiro de 0,34 em (como D2).
- **O gesto único:** **o ponto se fixa**. O ponto começa vazado (anel fino) e preenche em 600 ms, uma vez, `cubic-bezier(.22,.61,.36,1)`. Nunca em loop (a mesma regra do ditoo, D3: loop vira spinner). O mesmo gesto, e só ele, aparece em: a marca na entrada da página; o ícone dos botões no hover e no foco; cada fonte da lista ao vivo quando responde; o FAQ aberto; a confirmação da captura; o carimbo de levantamento fechado (D4).

### 3.4 Tipografia (família IBM Plex mais Archivo expandido)

| Papel | Fonte | Regra |
|---|---|---|
| Display e wordmark | Archivo 700 e 800, `wdth 125` | hero `clamp(48px, 7.5vw, 128px)`, entrelinha 0,94, entreletra −0,03 em; H2 `clamp(34px, 4.4vw, 68px)` `wdth 118`. O ditoo usa Archivo estreito; o Marco usa o eixo oposto, largo |
| Número que conta | Archivo 800, `wdth 125`, tabular | contador ao vivo e Tensão; algarismo tabular sempre (escola, erro 16) |
| Texto e interface | IBM Plex Sans 400, 500, 600 | 17/1,6; até 70 caracteres por linha |
| Dado oficial, coordenada, fonte, hora | IBM Plex Mono 400 e 500 | carimbo de procedência; `tabular-nums` |
| Manchete da imprensa | IBM Plex Serif 400 | **sempre literal, nunca parafraseada**: a serifa avisa que aquilo não fomos nós que escrevemos (a lógica de D11 aplicada ao Marco) |

### 3.5 Cor e vocabulário

| Token | Hex | Papel |
|---|---|---|
| `--m-papel` | `#F3F2EE` | fundo base, neutro (não é o papel quente da PRINT) |
| `--m-superficie` | `#FFFFFF` | painéis |
| `--m-elevacao` | `#E9E8E3` | faixa, hover, trilho de barra |
| `--m-linha` | `#D9D8D2` | bordas e réguas |
| `--m-tinta` | `#0F1214` | texto, palco escuro, **Tensão alta** |
| `--m-apoio` | `#5E6366` | texto de apoio |
| `--m-rotulo` | `#8A8F92` | rótulo, numeração |
| **`--m-baliza`** | **`#FF5A1F`** | **acento, o laranja de baliza de campo. Um trabalho só: o que foi fixado agora** (o ponto do símbolo, o filete do sinal que acabou de chegar, o ponto do território, o ícone no hover). Nunca cor de texto, nunca fundo de bloco grande |

Escala de Tensão: cinco degraus de `#CBCECF` a `#0F1214`: **alta é tinta cheia** (D5), sem vermelho de alarme. Distância verificada: não é o verde PRINT `#2D5340`, a sálvia, o ultramar do ditoo `#2E2A6B`, o ocre do DIT `#B07A2B` nem o bronze antigo.

Vocabulário da leitura (o equivalente ao "Edição em fechamento" do ditoo): **"Em campo"** (coleta rodando), **"Na visada, agora"** (o feed de sinais), **"Ponto fixado"** (fonte que respondeu), **"Fora do território"** (sinal rejeitado pelo verificador), **"Levantamento fechado"** (carimbo do fim).

### 3.6 Imagens: de verdade, com fonte e licença

| Uso | Fonte | Licença e crédito obrigatório |
|---|---|---|
| Hero e faixa do território (satélite) | **Copernicus Sentinel-2 L2A**, COG aberto no AWS Open Data (catálogo STAC `earth-search.aws.element84.com/v1`, sem conta) | uso livre inclusive comercial pelos termos Copernicus; crédito "Contém dados modificados do Copernicus Sentinel (2026)" |
| Alternativa de satélite de domínio público | **Landsat 8 e 9** (USGS e NASA) | domínio público; crédito "USGS/NASA Landsat" |
| Mapa no relatório | **OpenFreeMap** (tiles vetoriais, sem chave) em **MapLibre GL JS** (BSD-3) | uso comercial permitido; crédito visível "OpenFreeMap © OpenMapTiles, dados © colaboradores do OpenStreetMap" (ODbL) |
| Silhueta do município | **API de malhas do IBGE** (`servicodados.ibge.gov.br/api/v3/malhas/municipios/{id}`) | dado público; crédito "IBGE, malha municipal" |
| Foto de contexto (porto, estrada, audiência pública, rio, obra) | **Agência Brasil (EBC)** e **Wikimedia Commons** | Agência Brasil: Creative Commons Atribuição 3.0 Brasil, crédito com fotógrafo e "Agência Brasil"; Commons: conferir foto a foto, só CC BY ou CC BY-SA ou domínio público, com autor e licença na legenda |
| Não usar | mosaico Sentinel-2 cloudless da EOX de 2018 em diante | CC BY-NC-SA, não comercial |
| Imagem gerada por IA | só textura abstrata, nunca um território real específico nem pessoa | registrar a origem no código |

Tratamento, como o ditoo (D6): **duotone da paleta Marco** (sombras em `#0F1214`, luzes em `#F3F2EE`, sem a baliza), recorte deliberado por breakpoint, véu em gradiente para o texto ler, legenda em mono com fonte, data e lugar, `alt` descritivo, `loading="lazy"` abaixo da dobra, WebP e AVIF com largura por breakpoint. **Imagem parada**: o único movimento é o parallax leve na rolagem. Nenhuma imagem de cliente e nenhuma pessoa identificável sem licença.

Pipeline: um script em `scripts/` baixa o recorte Sentinel-2 com pouca nuvem de cada território do Radar de lançamento (20), aplica o duotone e grava em `client/public/territorio/<slug>.webp` com um `.json` de crédito; território sem recorte usa a foto de contexto do seu momento.

### 3.7 Proibido

1. Formulário de contato como ação principal em qualquer dobra.
2. Nesta rodada, nada de WebGL, 3D, vídeo, território se desenhando, inversão de tela ou cursor customizado: não por proibição, e sim porque o básico vem primeiro (correção 4). Entram na próxima camada (§4.6).
3. Gauge, disco com ponteiro, pizza, rosca, semáforo (escola, erro 1).
4. Curvas de nível procedurais como enfeite (eram a gambiarra da PRINT).
5. Ilustração vetorial feita à mão; foto de banco genérica; foto sem crédito.
6. Sinal ou número animado sem evento real; "ao vivo" que é gravação sem aviso.
7. Vermelho de alarme para tensão; crise fora do momento Responder.
8. Desfoque animado em texto; `transition: all`; animação em loop (fora o "consultando").
9. Elemento maior que a viewport sem `overflow: clip` no pai (defeito atual no celular, §7).

---

## 4. Motion e microinteração: o básico no nível do ditoo (PROVISÓRIO)

### 4.1 Tokens

| Token | Valor | Fonte |
|---|---|---|
| Motor | GSAP 3 + ScrollTrigger; **Lenis** único (`lerp 0.1`) no `gsap.ticker`, desligado em reduced-motion e em toque | ditoo D8 (`Home.tsx` 384 a 388); Mapbox M9 |
| Curva | `--curva: cubic-bezier(.22,.61,.36,1)` em CSS; `power4.out` em título, `power2.out` em bloco, `power3.out` em lista | ditoo `home-ditoo.css` e `Home.tsx` 403 a 440 |
| Durações | 0,2 s (cor de botão), 0,35 s (hover e estado), 0,6 s (gesto e bloco), 0,95 s (título), 1,1 s (título do hero) | ditoo |
| Stagger | lista 0,07 a 0,08 s | ditoo `.lista-sobe` |
| Gatilho | `start: "top 88%"` para bloco, `"top 85%"` para título e lista, uma vez | ditoo |
| Propriedades | só `transform`, `opacity` e `clip-path` | escola T15 |

### 4.2 Entrada e rolagem da landing

| Seção | O que acontece |
|---|---|
| Cabeçalho | fixo; transparente sobre o hero escuro, fica sólido (papel a 92% com desfoque de fundo) ao sair do hero, em 0,35 s (ditoo `.topo.solido`); a marca faz o gesto único aos 0,9 s |
| Hero | imagem já na tela no primeiro quadro (sem esperar script), escala 1,06; h1 em cortina de baixo para cima (`clip-path inset(0 0 100% 0)` para `inset(0 0 -20% 0)`, 1,1 s, `power4.out`, atraso 0,15 s); selo, campo, nota e base sobem 14 px em sequência (0,7 s, stagger 0,07 s, a partir de 0,5 s); contador conta até o valor real em 1,4 s. **Rede de segurança aos 2,5 s** |
| Hero ao rolar | a imagem desce 12% e escala a 1,12 (scrub), como o `.hero .fundo` do ditoo |
| Títulos de seção | cortina de 0,95 s ao entrar |
| Blocos e listas | sobem 20 px (0,7 s) ou entram da esquerda 24 px em sequência (0,8 s, stagger 0,08 s) |
| Faixas de imagem | parallax de ±14% (`data-paralaxe`) ou escala de 1,25 a 1 (`data-escala`), como D6 |
| Números | contam uma vez quando entram |
| Três passos | a demonstração toca sozinha uma vez (9 s), clicável por passo; no celular, as três cenas empilhadas e paradas |
| FAQ | abre por altura; o vértice do item se fixa |

### 4.3 A leitura ao vivo (o momento mais forte, feito com o básico)

**Princípio:** é o momento mais forte porque é verdadeiro. A animação nunca adianta o motor; cada movimento é consequência de um evento SSE.

| Evento | O que acontece |
|---|---|
| `resolvido`, `estrutural` | título do território em cortina; barras enchem em sequência (0,08 s) |
| `etapa` | a frase da etapa troca em cortina (0,6 s) |
| `fonte` | a fonte da lista passa de "consultando" (vértice vazado que respira só em opacidade, 1,6 s) para **"ponto fixado · 12 brutos"** (o gesto único, 0,6 s) ou para "sem resposta" (cinza, sem drama) |
| `sinal` | a linha entra no topo do feed (sobe 12 px e aparece, 0,5 s, `power2.out`) com um filete baliza à esquerda que esmaece em 2 s; o contador sobe de um em um, tabular; se o sinal tem lugar, um ponto baliza aparece na silhueta parada (0,3 s, sem pulso); depois da quinta linha as antigas ficam a 45% |
| rejeitado pelo verificador (evento a criar) | a linha entra riscada com "fora do território" e sai em 0,8 s: mostrar a limpeza é prova |
| `dimensao` | a barra da dimensão enche até o número de sinais, com "4 de 6 fontes" |
| `teaser` | carimbo "LEVANTAMENTO FECHADO · 14:32" aparece (0,5 s) e o teaser monta abaixo; o feed recolhe em "ver os 23 sinais" |
| `sem_leitura` | frase com o motivo e o próximo passo; a estrutural continua |

**Cadência:** fila com intervalo mínimo de 350 ms para o olho ler; acima de 12 na fila, 120 ms. **Cache:** a tela diz "Leitura de hoje, 07:12, reproduzida" e toca a 200 ms. Nunca se gera evento que o servidor não mandou.

**Espera longa:** sem evento por 45 s, a etapa ganha a linha "Ainda esperando 3 fontes: IBAMA, Querido Diário, INPE" e o convite "Pode fechar: mandamos a leitura para o seu e-mail quando terminar" com um campo só.

### 4.4 Botões que se mexem

| Peça | Repouso | Hover | Clique | Foco | Fonte |
|---|---|---|---|---|---|
| **Primário** ("Ler este território", "Quero o Diagnóstico completo") | fundo tinta, texto papel, 58 px de altura, raio 4 px, ícone do vértice com o ponto vazado | fundo clareia para `#1E2326` em 0,2 s; **o ponto do ícone se fixa em baliza** (0,3 s); a seta do rótulo anda 4 px; **magnético leve**: o botão segue o ponteiro até 6 px e volta em 0,5 s `power3.out`, só em ponteiro fino e fora do reduced-motion | desce 1 px e escala a 0,98 por 0,12 s | anel de 3 px em baliza com respiro de 3 px, e o ponto já fixado | ditoo `.acao` e `.acao .g`; skill cinematic-gsap (`data-magnetic`) |
| Primário sobre escuro | fundo papel, texto tinta | fundo branco; ponto fixa em baliza | idem | idem | ditoo `.acao.clara` |
| Secundário | contorno 1 px na cor do texto | fundo `--m-elevacao`; seta anda 4 px | idem | idem | ditoo `nav a.pedir` |
| Link de texto | sublinhado a 30% | sublinhado cresce da esquerda para a direita em 0,35 s até 100% | nenhum | anel | Locomotive M7 (links de navegação) |
| Aba | rótulo em cinza | rótulo em tinta em 0,2 s | a régua de baixo desliza até a aba (0,35 s) | anel | ditoo `.abas` |
| Item de FAQ | vértice vazado | título em tinta mais forte | abre por altura, vértice se fixa | anel | ditoo `summary .o` |
| Card com imagem (momentos, escada) | imagem em escala 1 | imagem em escala 1,04 em 0,6 s; título sobe 2 px | nenhum | anel no card | ditoo `.etapas li` e padrão de card editorial |
| Campo de busca | sombra `0 30px 80px -30px` | nenhum | nenhum | anel de 4 px em baliza a 45% | ditoo `.busca:focus-within` |
| Estado desabilitado e carregando | opacidade 0,45 | nenhum | nenhum | nenhum | ditoo `.acao:disabled`; carregando troca o rótulo ("Procurando") e mantém o ícone parado, nunca spinner |

Área de clique mínima de 44 px no celular (T09). No toque, o hover não existe: o clique mostra o gesto do ponto.

### 4.5 Desempenho e reduced-motion

- LCP abaixo de 2,5 s e CLS abaixo de 0,05 no build de produção em 4G simulado; imagem do hero com `fetchpriority="high"` e dimensão fixa; demais imagens preguiçosas; motion por import dinâmico; nada animando fora da tela.
- `prefers-reduced-motion: reduce`: sem Lenis, sem parallax, sem cortina, sem magnético; tudo no estado final; o gesto do ponto aparece já fixado; as linhas do feed aparecem sem deslocamento; o contador mostra o valor direto.
- Sem JavaScript: imagem, título, campo (GET para `/leitura?q=`) e nota visíveis.

### 4.6 Próxima camada (quando o básico estiver 10)

Registrada para não se perder, **não entra nesta rodada**. Gatilho: média 8 ou mais e R4, R5 e R6 em 10 na régua, conferidos pelo diretor. Candidatos, cada um só se tiver função e sem piorar o desempenho:
1. vídeo curto de satélite em tela cheia no hero, com pôster parado e desligado em reduced-motion (Planet M7 na leitura de hoje);
2. o vértice em 3D com luz, como objeto do hero (Vercel e Resend);
3. relevo real do território a partir do Copernicus DEM, em WebGL, com pôster estático de fallback;
4. cursor de mira sobre a silhueta mostrando a coordenada real;
5. transição de página com máscara saindo do botão.
Antes de qualquer um: conferir contra a escola `direcao-de-arte-e-motion-web` e medir LCP e CLS de novo.

---

## 5. Direção do relatório do Diagnóstico completo

Para o time que constrói agora. Dados: `shared/relatorio-marco/tipos.ts` (`DadosRelatorio`); render em `shared/relatorio-marco/render.ts`.

**Conceito:** um levantamento publicado como edição numerada e datada, que se lê no navegador e se imprime em A4 sem perder nada, na identidade do §3. Fontes: vocabulário e ritmo do ditoo (número gigante, lista numerada, fala literal em serifa), The Pudding M8 (edição numerada), Palantir M4 (capítulo numerado), escola T01, T03, T05, T06, T11.

| Parte | Conteúdo (`DadosRelatorio`) | Direção |
|---|---|---|
| Capa | `territorio`, `geradoEm`, `leitura` | imagem de satélite do território em duotone em página cheia com crédito; nome em display `wdth 125`; coordenada e código IBGE em mono; "Diagnóstico Marco nº 0017 · 30/09/2026"; Tensão em barra com faixa e a frase da Confiança |
| Índice fixo | capítulos | coluna lateral fixa com "/01" a "/15" em mono e barra de progresso; no celular, recolhido no topo |
| /01 O que decide | `decide[]`, `sintese[]` | título que afirma a conclusão (T11); até 3 decisões com urgência |
| /02 O que mudou | `mudou` | comparação com a linha de base (T03); sem ela, diz que é a primeira leitura |
| /03 Identidade | `identidade`, indicadores estruturais | fila de números grandes com percentil nacional e fonte |
| /04 a /09 As 6 dimensões | `dimensoes[]` | um capítulo por dimensão com foto de contexto licenciada no topo; barra do zero com peso declarado (T05); a leitura; os sinais que sustentam na **mesma linha do feed ao vivo** (fonte em mono, manchete literal em serifa, data, link); "O que não foi medido" sempre visível |
| /10 Sinais no tempo | `sinaisChave[]` | linha do tempo horizontal com rótulo direto |
| /11 Lugares | `pontos` com `lat/lng` | mapa OpenFreeMap em MapLibre com crédito visível, carregado só quando o capítulo entra; pontos em baliza |
| /12 Previsão | `previsao` | riscos e oportunidades em colunas espelhadas |
| /13 Recomendações | `recomendacoes[]` | Entrar, Operar, Responder; crise só em Responder |
| /14 Leitura estratégica | `estrategica`, `casos[]` | tese, evidências, riscos, fontes |
| /15 Fontes e método | `fontes[]`, `semLastro[]`, `coleta` | tabela de consulta (T06) ordenada por sinais, número à direita; `semLastro` com o título "Afirmações que não conseguimos comprovar" |
| Fecho | escada | Marco Radar e PRINT no local; "powered by PRINT" com a logo original |

Motion do relatório: só barra de progresso, número do capítulo em cortina uma vez e barras enchendo uma vez (T15, T17). Impressão: `@page A4`, quebra antes de cada capítulo, links viram nota com URL, índice some, créditos de imagem mantidos.

---

## 6. A régua de 0 a 10

Nota final = média dos 10 critérios. Nada sobe abaixo de 8 de média nem abaixo de 6 num critério. **O 10 de quase todos é o ditoo**, que já mostrou ao Felipe o nível.

| # | Critério | 3 | 6 | 10 | Referência do 10 |
|---|---|---|---|---|---|
| R1 | **Fluxo pela escada** | CTA principal é formulário; sem leitura gratuita | leitura existe, mas o hero vende outra coisa ou a captura vem antes do valor | campo no hero, estrutural em 1 s, leitura ao vivo, teaser, captura de 2 campos, confirmação com prazo, lead na mesa; Diagnóstico, Radar e PRINT no local em sequência; um verbo | ditoo (home → leitura → completa); Gaio técnicas 1 e 18 |
| R2 | **Hero que executa o produto** | hero descreve | campo no hero sem prova de motor rodando | campo como peça principal e contador real do dia | ditoo D7; Stripe M1 |
| R3 | **Identidade própria** | cara da PRINT adaptada (curvas, sálvia, bronze) | marca própria, mas o gesto não aparece no produto | tese, símbolo, gesto único, acento de um trabalho só e vocabulário próprio, repetidos em marca, botão e leitura; PRINT só em "powered by" | ditoo D1 a D5 |
| R4 | **Imagens na tela** | nenhuma imagem, ou foto de banco | imagens reais, sem tratamento ou sem crédito | satélite e foto de contexto reais, duotone da paleta, véu, legenda com fonte, data e licença, uma por seção | ditoo D6; Global Nature Watch M6 |
| R5 | **Motion de entrada e rolagem** | nada anima, ou anima sem função | revelação por seção sem entrada composta do hero | entrada do hero, cortina nos títulos, listas em sequência, parallax leve nas imagens, leitura ao vivo dirigida por evento, rede de segurança e reduced-motion completo | ditoo D8 e D9 |
| R6 | **Botões e microinteração** | botão estático | hover de cor só | hover, clique, foco e desabilitado desenhados, o gesto do ponto no ícone, magnético leve no primário, links e abas com movimento | ditoo `.acao` e `.acao .g` |
| R7 | **Qualidade da Primeira leitura** | página inexistente ou um número | estrutural com fonte, sem ao vivo | estrutural em 1 s, feed ao vivo verdadeiro, teaser, estados de cache, espera e `sem_leitura` | ditoo `Leitura.tsx`; Windward M2 |
| R8 | **Copy pela dor e prova** | abre explicando o produto; número sem fonte | abre pela dor, explica demais abaixo | primeira frase é a dor, blocos de até 3 linhas, fonte ao lado de cada número, verificador visível, "o que não foi medido" explícito | comecar-pela-dor; ditoo (frases de espera verdadeiras) |
| R9 | **Celular** | rolagem lateral, campo fora da dobra | funciona, mas é o desktop encolhido | campo e contador na primeira tela a 390 px, feed em coluna única, área de toque de 44 px, imagem recortada para o celular | ditoo a 390 px (`ditoo-m-dobra.jpg`) |
| R10 | **Desempenho** | LCP acima de 4 s ou CLS acima de 0,25 | LCP até 2,5 s, CLS até 0,1 | LCP abaixo de 2,5 s e CLS abaixo de 0,05 em 4G, imagens em WebP e AVIF por breakpoint | ditoo medido hoje: LCP 1,8 s, CLS 0,001 |

---

## 7. Nota atual (30/09/2026, localhost:4100, servidor de desenvolvimento)

Capturas: `marco-home-d-dobra.jpg`, `marco-home-d-rolado.jpg`, `marco-home-m-dobra.jpg`, `marco-leitura-d-dobra.jpg`. Medido no DOM: GSAP e Lenis não inicializados em `/`; zero campo na dobra; zero imagem; h1 95 px; **`/` rola na horizontal a 390 px** (424 px de largura) por causa de `div.absolute.w-[170vw]` com `svg.mo-camada` sem `overflow: clip` no pai; `/leitura` responde "Esta página não existe ou mudou de endereço"; LCP 1,8 s e CLS 0,011 no dev (medir o build).

| Critério | `/` | `/leitura` | Por quê |
|---|---|---|---|
| R1 Fluxo | 2 | 0 | "Pedir diagnóstico" é o CTA do topo, três vezes; leitura inexistente na rota |
| R2 Hero executa | 1 | n/a | nenhum campo |
| R3 Identidade própria | 2 | n/a | papel quente, bronze, curvas e "Inteligência territorial da PRINT" sob a marca: é a PRINT adaptada |
| R4 Imagens | 0 | 0 | nenhuma imagem |
| R5 Motion | 1 | 0 | só as ondas de fundo; GSAP e Lenis instalados e não ligados |
| R6 Botões | 2 | n/a | botões retos, só troca de cor |
| R7 Primeira leitura | 0 | 0 | rota 404 no servidor de agora (o time está construindo) |
| R8 Copy e prova | 4 | n/a | o subtítulo toca a dor; o bloco seguinte explica ("Reunimos e cruzamos dados..."); nenhuma fonte na dobra |
| R9 Celular | 3 | 2 | rolagem lateral a 390 px |
| R10 Desempenho | 7 | 7 | bom no dev; falta o build |
| **Média** | **2,2** | **1,0** | |

### 7.1 As 5 mudanças que mais sobem a nota

1. **Campo `BuscaLeitura` no hero e fim do "Pedir diagnóstico" no topo** (R1, R2).
2. **`/leitura/:slug` com estrutural em 1 s e o feed ao vivo dirigido por evento** (R7, R5, R8).
3. **Identidade própria do §3**: trocar tokens, símbolo com o gesto do ponto, vocabulário de campo, PRINT só em "powered by" (R3).
4. **Imagens reais com crédito**: pipeline Sentinel-2 em duotone para os 20 do Radar, fotos de contexto licenciadas, uma por seção (R4).
5. **Motion e botões na receita do ditoo**, mais o conserto do celular (`overflow: clip`) (R5, R6, R9).
