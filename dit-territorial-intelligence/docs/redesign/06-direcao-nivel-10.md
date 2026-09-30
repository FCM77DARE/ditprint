# 06 · Direção nível 10 do Marco

Diretor: ag_diretor_design (p_design) · 30/09/2026 · status: **direção aprovada para execução**, com uma parte **PROVISÓRIA** (ver §0.3).

Por que existe: o Felipe deu nota 1 a 3 ao redesign em produção. Três defeitos, nas palavras dele: "muito fraco, sem motion, o fluxo você errou". O fluxo errado era a landing ter "Pedir diagnóstico" (formulário) como ação principal. Este documento troca o fluxo, dá a direção de arte e de motion com fonte externa para cada decisão, dirige o relatório do Diagnóstico completo e fixa a régua de 0 a 10 com que tudo vai ser aprovado.

Leitura obrigatória antes de mexer: §2 (fluxo), §4 (coreografia, principalmente o clímax), §6 (régua). As ordens curtas por time estão em `06-ordens.md`.

---

## 0. Premissas que mandam neste documento

### 0.1 A escada de valor (correção do Felipe, 30/09)

| Degrau | O que é | Preço | O que a página faz com ele |
|---|---|---|---|
| 1 · **Leitura gratuita** | o DIT real rodando ao vivo para qualquer território pesquisado; as fontes respondem e as notícias e sinais aparecem em tempo real | zero | é o hero e é a isca. Nada de formulário antes dela |
| 2 · **Diagnóstico completo** | o relatório inteiro, com tudo o que a leitura mediu | pago (sem tabela canônica: não escrever número) | é a conversão principal depois da leitura |
| 3 · **Marco Radar** | acompanhamento contínuo, alerta quando o território muda | assinatura | é o passo seguinte de quem comprou o Diagnóstico, e o upsell no fim do relatório |
| 4 · **PRINT no local** | contratar a equipe da PRINT para um diagnóstico em campo | proposta | é o topo; aparece uma vez, no fim, com a assinatura institucional |

Verbo único da página (landing-conversao, técnica 12): **Ler**. "Ler este território" no hero e entre blocos; "Quero o Diagnóstico completo" no ponto de maior desejo (primeira pessoa). "Pedir diagnóstico" deixa de existir como CTA de topo.

### 0.2 A direção vem de fora

Correção do Felipe: a casa (ditoo, /marco, site da PRINT) serve só como vocabulário e marca. **Cada decisão de arte e de motion abaixo cita a referência externa que a sustenta** (coluna "Fonte"). Onde a decisão vem da escola `design-de-produto` (PADROES-TRANSVERSAIS.md), cito o código do padrão (T01 a T18) ou o erro de amador.

### 0.3 O que é PROVISÓRIO

A reitoria está abrindo a escola `direcao-de-arte-e-motion-web` (10 estúdios, 10 lugares, 100 obras). Até os padrões dela saírem, a coreografia (§4) e os tokens de motion são **PROVISÓRIOS**: valem para construir agora e serão conferidos contra a escola quando o coordenador repassar. O fluxo (§2) e a régua (§6) não dependem dela.

### 0.4 Regras duras herdadas (não se discute)

- Nunca travessão. Nunca número sem fonte. Nunca case de cliente. Crise só no momento Responder (dit-institucional §2 e §9).
- Nunca vender "qualquer território na hora" como promessa se a leitura ao vivo cair em `sem_leitura`: a estrutural sai sempre, a ao vivo pode não sair, e a tela diz por quê (T12).
- Gauge, velocímetro e disco de ponteiro são proibidos (escola, erro de amador 1). **O disco com ponteiro do /marco não sobe para o produto**: Tensão é barra horizontal com a faixa desenhada (T05).

---

## 1. Estudo de referências

Método: cada site aberto em navegador sem interface (Chromium, 1440×900 e 390×844), capturado aos 0,4 s (entrada), aos 3,4 s (dobra assentada) e depois de rolar 3.000 px; medidos no DOM a fonte e o tamanho do h1, campos de texto na dobra, canvas, vídeo, Lenis e altura da página. Nenhum cookie aceito (só leitura; banners aparecem nas capturas e foram ignorados). Screenshots em `docs/redesign/telas/nivel10/`.

### 1.1 Mercado: o eixo (12 referências lidas, 3 descartadas)

| # | Referência | Captura | O que medi | O gesto que vale para o Marco |
|---|---|---|---|---|
| M1 | **Stripe** stripe.com | `stripe-d-dobra.jpg`, `stripe-d-rolado.jpg` | h1 Söhne 44px peso 300; canvas 1; página de 15.033 px | **Número vivo na primeira dobra**: "PIB global em execução na Stripe: 1,72453278%" acima do h1, com casas decimais andando. É prova de que o motor está rodando agora, sem depoimento. No Marco: um contador real, na dobra, do que o motor está fazendo hoje (fontes consultadas hoje, sinais verificados hoje). Mais abaixo, a **fila de números com comparação** ("Mais de 135", "US$ 1,9 tri", "99,999%") |
| M2 | **Windward** windward.ai | `windward-d-dobra.jpg`, `windward-d-rolado.jpg` | h1 Inter 48px caixa alta; faixa "MONITOR LIVE" no topo | **Quadro operacional escuro**: mapa real ao fundo, janelas de evidência com rótulo técnico em mono ("DARK ACTIVITY · EO", "GPS JAMMING · RF"), e uma **lista de anomalias com variação** ("111% increase in vessel count", "32% decrease"). É o modelo da sala da leitura ao vivo: palco escuro, sinal com fonte e tipo, lista que cresce |
| M3 | **Linear** linear.app | `linear-d-dobra.jpg`, `linear-d-rolado.jpg` | h1 Inter 64px peso 510; produto real na dobra | **O produto de verdade é a imagem do hero**, sem ilustração. E o **feed de atividade com carimbo de tempo** ("Linear created the issue via Slack · 2min ago"): cada linha é quem, o quê, quando. É a gramática da linha de sinal no clímax |
| M4 | **Palantir** palantir.com | `palantir-d-t0.jpg`, `palantir-d-dobra.jpg`, `palantir-d-rolado.jpg` | h1 "Alliance" 80px peso 400; tela branca aos 0,4 s, título assentado aos 3,4 s; 6 vídeos | **Entrada em silêncio e título sozinho no centro**: a primeira dobra é uma frase grande e nada mais. E a **lista de produtos numerada** ("/0.2 Gotham", "/0.3 Foundry"), nome enorme e uma linha de função embaixo. É o índice dos capítulos do relatório e o bloco dos 4 degraus da escada |
| M5 | **Felt** felt.com | `felt-d-dobra.jpg`, `felt-d-rolado.jpg` | serif display; faixa de coordenadas correndo no topo; mapa com atribuição "© MapTiler © OpenStreetMap" | **Cartografia real dentro do quadro do produto** (lotes, rede, legenda, escala) e a **faixa de coordenadas** em mono correndo no topo da página. Prova que mapa aberto com atribuição é premium quando é dado e não enfeite |
| M6 | **Global Nature Watch (ex-Global Forest Watch)** globalforestwatch.org | `gfw-d-dobra.jpg`, `gfw-d-rolado.jpg` | h1 Fira Sans 48px; foto de satélite no hero; mapa-múndi com camada de perda florestal atrás dos cards | **Mapa com camada de dado real como fundo de seção**, e o produto se chama pelo que faz ("Be the first to see new tropical deforestation"). É a referência de monitoramento territorial mais próxima do Marco: o alerta é um ponto num território real |
| M7 | **Planet** planet.com | `planet-d-dobra.jpg` | h1 Montserrat 80px peso 200; vídeo de satélite no hero | **Imagem de observação da Terra em movimento lento** como fundo do hero, com tipografia fina por cima. Serve para dizer o que **não** fazer no Marco: o gesto é bonito, mas o hero é vitrine, não executa nada (o CTA é "Learn More") |
| M8 | **Vercel** vercel.com | `vercel-d-dobra.jpg` | h1 Geist 64px peso 400; canvas 1; triângulo no centro | **Um símbolo geométrico como protagonista do hero, com luz e sombra**, e três linhas de função à direita. O Marco tem o vértice geodésico (triângulo com ponto): ele pode ser o objeto do hero da mesma forma, desde que o campo continue sendo a ação |
| M9 | **Mapbox** mapbox.com | `mapbox-d-dobra.jpg` | h1 Cera 68px; Lenis ativo; página de 15.985 px | **Rolagem suave (Lenis) em site corporativo de dado geográfico**: mostra que smooth scroll não é coisa só de estúdio. Hero em si é genérico (título central e dois botões): não copiar |
| M10 | **Locomotive** locomotive.ca (estúdio, Montreal) | `locomotive-d-dobra.jpg`, `locomotive-d-rolado.jpg` | display próprio 70px; Lenis ativo; 2 canvas, 1 vídeo | **Linha de texto do tamanho da tela** entrando em máscara, e **grade deslocada**: imagem na coluna 2, texto na coluna 3, nada centralizado. É a escala e o ritmo editorial que faltam ao Marco |
| M11 | **Resend** resend.com | `resend-d-dobra.jpg` | h1 Domaine 96px; canvas 1; 5 vídeos | **Objeto 3D único em luz rasante** sobre fundo escuro, título grande à esquerda, dois botões pequenos. Contenção: um objeto, uma frase, nada mais na dobra |
| M12 | **Lusion** lusion.co (estúdio, Bristol) | vista no navegador embutido (preloader) | WebGL; carregamento com contador numérico ("087") | **Espera contada em número**, não em spinner. É a regra da espera narrada: o número sobe de verdade e diz quanto falta |
| M13 | **The Pudding** pudding.cool | `pudding-d-dobra.jpg` | edições numeradas (#224, #223) com data | **Ensaio visual numerado e datado**: cada peça é uma edição. É o modelo editorial do relatório do Diagnóstico (§5) |

Descartadas (não entram como fonte): **Descartes Labs** (domínio à venda, `descartes-d-dobra.jpg`); **Cloudflare Radar** (verificação anti-robô, não contornada); **Basement, Active Theory, Igloo** (WebGL não renderiza sem GPU; sem captura, sem citação).

### 1.2 O que o mercado ensina em cinco frases

1. Produto de dado nível 10 mostra **o motor rodando agora** na primeira dobra (Stripe M1, Windward M2), não uma frase sobre o motor.
2. A imagem do hero é **o produto de verdade ou o dado de verdade** (Linear M3, Felt M5, GFW M6), nunca ilustração.
3. Escala tipográfica **grande e contida**: uma família, 64 a 96 px no desktop, peso médio (Linear 510, Palantir 400, Resend 400). Grito é tamanho, não peso.
4. Motion serve à leitura: **entrada em silêncio, título assentando, lista crescendo** (Palantir M4, Linear M3, Lusion M12). Nada quica.
5. Mapa aberto com atribuição **é premium quando é evidência** (Felt M5, GFW M6).

### 1.3 A casa: só vocabulário e marca

| Peça | Arquivo e trecho | O que se aproveita (vocabulário) | O que não se aproveita |
|---|---|---|---|
| ditoo.ai, home | `auditia/ai-audit/client/src/pages/Home.tsx` 509 a 523: o `<form className="busca">` com "Rodar a leitura" está **dentro** do hero; linha 384: `new Lenis({ lerp: .1 })` ligado ao `gsap.ticker`; 401 a 406: título revelado por `clipPath: inset(0 0 100% 0)` com `power4.out`, sem desfoque ("o borrão cansava a vista, Felipe 24/09"); 445 a 455: rede de segurança que força o hero visível aos 2,5 s | o campo no hero; a cortina sem desfoque; a rede de segurança; Lenis só fora do reduced-motion | a paleta ultramar e o guilhoche (marca do ditoo) |
| ditoo.ai, leitura | `Leitura.tsx` 635 a 687: etapa "rodando" com contador `05/16` em display, **"No fio, agora"** com trecho real datilografado e a bancada de 16 anéis que viram disco quando o modelo responde; 689: carimbo "EDIÇÃO FECHADA" antes do resultado | o fio (trecho real chegando), o contador, o carimbo de fechamento | lead antes da rodada (no Marco a leitura é livre; a captura vem depois do teaser) |
| /marco | `client/src/pages/Marco.tsx` 43 a 110: `CurvasDeNivel()` em canvas por marching squares, curva mestra a cada 5 com traço mais forte; 265 a 298: "MARCO" em Archivo `wdth 125` peso 850 a 122 px | curvas de nível como textura, a curva mestra, Archivo expandido, coordenada em mono | o disco com ponteiro (gauge proibido); o wordmark como h1 (o h1 tem que ser a frase da dor ou do gesto) |
| Site PRINT | `Site print/site/index.html` 532 a 578: foto de campo com legenda ("Gruta Kamukuwaká · Mato Grosso · 2024"); 712 a 740: mapa SVG do Brasil com pulso nos pontos; `styles.css` 292: `@keyframes pulse` | a legenda de lugar e ano; o pulso no ponto como "aqui aconteceu" | Fraunces itálico e Barlow (outra marca) |
| Gaio (teardown) | `landing-conversao/references/gaio-teardown.md` §3: o hero é um `textbox` real mais botão; §10 e §12: um verbo só e FAQ de objeção | a espinha de 11 blocos e o verbo único | o tom de creator |

---

## 2. O fluxo certo, por público

### 2.1 Visitante: do campo ao lead na mesa

A página inteira existe para uma frase: **digite o território e veja o Marco lendo ao vivo**. O contrato técnico já existe em `server/routes/leitura-stream.ts` (`inicio → resolvido → estrutural → etapa | fonte | sinal | dimensao → teaser | sem_leitura → fim`). O fluxo abaixo casa cada passo com um evento.

| Passo | Objetivo | O que a tela mostra | Motion | Pronto quando |
|---|---|---|---|---|
| **V1 · Hero com o campo** (`/`) | fazer a pessoa digitar em 8 segundos | h1 de dois tempos pela dor: linha 1 literal, linha 2 consequência (proposta: "Toda operação tem um CEP. / Veja agora o que o seu está dizendo."). Abaixo, o **campo** `BuscaLeitura variante="hero"` com "Ler este território", a nota de qualificação ("Se você sabe o nome do município, você lê o território. Sem cadastro.") e o **contador vivo** do motor (M1): "Hoje o Marco consultou N fontes e verificou N sinais", número real de `/api/dit/ops` ou do livro do dia. À direita (desktop), o vértice geodésico sobre as curvas de nível (M8). Nada de "Pedir diagnóstico" na dobra | entrada em silêncio (M4): curvas desenham 0 a 1,2 s; h1 em cortina por linha; campo e nota sobem; contador conta até o valor | campo visível e utilizável antes de qualquer animação terminar; foco do teclado no campo por Tab em 1 passo; zero formulário de contato acima da dobra |
| **V2 · Resolução** (autocomplete) | tirar a dúvida de homônimo sem atrito | lista de municípios com UF (combobox ARIA, já feito); homônimo pede o estado; nome inexistente mostra "Você quis dizer" | lista abre em 180 ms, sem deslizar a página | Enter com 2 letras leva a `/leitura/:slug`; homônimo nunca adivinha |
| **V3 · Leitura estrutural na hora** (`/leitura/:slug`, eventos `resolvido` e `estrutural`) | entregar valor em menos de 1 segundo | cabeçalho do território em Archivo expandido ("Altamira, PA"), código IBGE e coordenada em mono, **silhueta real do município** (malha do IBGE) desenhando-se; as dimensões que o dado oficial já responde (D2, D3, D4) como barras com percentil nacional e fonte ("Censo 2022", "CEMPRE 2021"); faixa "O que falta: socioambiental, governança, reputação e os sinais dos últimos 24 meses. Estamos buscando agora." | transição de página: o campo "voa" e vira o título do território (FLIP, 0,6 s); silhueta em traço (stroke-dashoffset, 1,2 s); barras enchem em sequência, 0,08 s de intervalo | primeiro dado real na tela em até 1 s depois do Enter (medir); nenhum número sem fonte ao lado |
| **V4 · A leitura ao vivo: o CLÍMAX** (eventos `etapa`, `fonte`, `sinal`, `dimensao`) | provar, na frente da pessoa, que o Marco é um sistema rodando e não um PDF | a página escurece para o **palco da leitura** (tinta `#18201B`, M2): à esquerda, a etapa corrente em frase ("Consultando as fontes oficiais e a imprensa", "Conferindo se cada sinal é mesmo deste território"), o **contador de sinais verificados** em display tabular (M12) e a lista das fontes, cada uma virando de "consultando" para "respondeu · 12 brutos" ou "sem resposta"; à direita, **o fio**: cada sinal entra no topo como linha de feed (M3), com dimensão, fonte, data, título e selo de impacto; quando o sinal tem lugar, um ponto bronze pulsa na silhueta (M6, pulso do site da PRINT como vocabulário); os rejeitados pelo verificador aparecem riscados por um instante e saem ("não é deste território"), porque mostrar a limpeza é prova | ver §4.3, a partitura do clímax | cada evento vira mudança visível em até 400 ms; nenhum sinal é inventado ou animado sem evento; em cache a tela diz "Leitura de hoje, 07:12, reproduzida" e toca mais rápido; `sem_leitura` mostra o motivo e o próximo passo |
| **V5 · Teaser da leitura completa** (evento `teaser`) | fazer a pessoa querer o resto | o palco clareia de volta para o papel, o "carimbo" de fechamento (vocabulário ditoo) e o teaser: **Tensão com faixa e Confiança** em barra (nunca disco), a síntese, **3 sinais**, **1 risco**, **1 oportunidade**; embaixo, o índice do Diagnóstico completo com os capítulos que ficaram de fora, numerados à maneira de M4, os bloqueados em cinza com o número de itens de cada um ("Dimensão socioambiental · 7 sinais", "Recomendações por momento · 3") | o índice entra em lista (stagger 0,06 s); os capítulos bloqueados têm um véu parado, sem desfoque animado | teaser só com o que veio do `teaser`; a contagem por capítulo é real; um CTA só: "Quero o Diagnóstico completo" |
| **V6 · Captura curta** | virar lead qualificado com o menor atrito | painel na própria página, sem trocar de rota: **e-mail corporativo** e **empresa**, mais a decisão em um toque (Entrar, Operar, Responder); nome e cargo opcionais. A leitura fica salva no link | o painel desliza da direita no desktop e sobe de baixo no celular (0,5 s, `power3.out`) | 2 campos obrigatórios e 1 toque; validação na hora; erro diz o que fazer |
| **V7 · Confirmação com prazo honesto** | dizer o que acontece e quando | "Pedido registrado. Um analista da PRINT confere a leitura de Altamira e manda o Diagnóstico completo para felipe@empresa.com." Prazo: **PROVISÓRIO, confirmar com o CEO: até 1 dia útil**. Mais o link permanente da leitura e o próximo degrau em uma linha (Marco Radar) | carimbo de confirmação; nada de confete | prazo que a mesa cumpre; se o envio de e-mail não estiver ligado, a tela não diz que enviou (T12, lição do /marco atual) |
| **V8 · Lead na mesa** (`/mesa/leads`) | o comercial agir no mesmo dia | lead com território, decisão escolhida, teaser gerado, origem (UTM por bloco) e o link da leitura | nenhum | o lead aparece na mesa com o link da leitura; UTM por bloco gravado |

Depois do V8, a escada continua fora da página: **Diagnóstico completo** entregue como relatório (§5), com o **Marco Radar** oferecido no fim dele, e **PRINT no local** como última linha do relatório e do rodapé da landing.

Os blocos da landing abaixo da dobra seguem a espinha de 11 blocos (landing-conversao §2), cada um devolvendo ao campo: 2 reconhecimento (escala institucional da PRINT com número canônico e as fontes oficiais que o motor lê, como nomes reconhecíveis: IBGE, INPE, IBAMA, ANA, Querido Diário), 3 três passos (você digita, os agentes leem, você recebe), 4 os três momentos como abas, 5 antes e depois espelhado (saber depois × saber antes), 6 nomes próprios (Tensão, Confiança, Marco Radar, as 6 dimensões com peso), 7 prova operacional real (quantas fontes respondem hoje, conferido no código), 8 a escada dos 4 degraus em lista numerada (M4), 9 urgência do relógio real, 10 FAQ de objeção com JSON-LD, 11 rodapé de uma linha.

### 2.2 Assinante: link → Hoje → território

| Passo | Objetivo | O que a tela mostra | Motion | Pronto quando |
|---|---|---|---|---|
| A1 · Link de acesso (e-mail) | entrar sem senha | a página abre direto em Hoje, com "Olá, empresa" e a data | nenhuma animação de boas-vindas | um clique do e-mail até Hoje |
| A2 · Hoje (`/portal`) | saber em 10 s se algo mudou | lista dos territórios ordenada pelo que **mudou** (variação contra a linha de base, T03), com Tensão, faixa e Confiança em barra, e o sinal mais forte de cada um; alertas no topo | as linhas entram uma vez (stagger 0,05 s); o feed SSE de alertas usa a **mesma linha de sinal do clímax** | mesma gramática visual da leitura pública: quem viu a leitura reconhece o produto |
| A3 · Território (`/portal/territorio/:slug`) | decidir | o relatório vivo do território (§5 em versão contínua), com o que mudou desde a última visita marcado em bronze | nenhuma animação de rolagem além da barra de progresso | a pessoa chega ao "o que decide" sem rolar |

### 2.3 Operador: publicação

| Passo | Objetivo | O que a tela mostra | Motion | Pronto quando |
|---|---|---|---|---|
| O1 · Fila (`/mesa/publicacao`) | nada vai ao ar sem humano | fila de leituras pendentes com Tensão, faixa, Confiança, afirmações sem lastro e o diff contra a última publicada | nenhuma (T15: tela de ferramenta não anima) | contagem de pendentes visível; ordem por mudança |
| O2 · Revisão | aprovar com evidência | sinais que sustentam cada dimensão, rejeitados pelo verificador e `semLastro` lado a lado (T13) | nenhuma | aprovar exige ter aberto a lista de sem lastro |
| O3 · Publicar | registrar quem aprovou | botão "Publicar leitura de Macaé" (verbo mais objeto) e o registro de quem e quando | confirmação textual, sem modal sobre a tabela (erro de amador 15) | o portão de publicação é real (já é, `docs/redesign/04-backend.md`) |

---

## 3. Direção de arte

### 3.1 Conceito em uma frase

**O Marco é um levantamento topográfico acontecendo na frente de quem pergunta: o papel da carta, a tinta do traço e o vértice geodésico que fixa o ponto, com o território real desenhado por dado oficial.**

### 3.2 Decisões, cada uma com a fonte

| Decisão | Regra | Fonte externa |
|---|---|---|
| Grid | 12 colunas, gutter `clamp(16px, 2.5vw, 44px)`, largura útil até 1.600 px; composição **deslocada**: texto começa na coluna 1 ou 2, objeto ocupa 7 a 12; nada centralizado exceto a frase de urgência | Locomotive M10 (grade deslocada), Linear M3 (texto à esquerda, produto largo) |
| Escala tipográfica | uma família, **Archivo**, com o eixo de largura fazendo o contraste. Display do hero: `clamp(56px, 8.5vw, 148px)`, peso 800, `wdth 125`, entrelinha 0,92, espaçamento −0,02 em. H2: `clamp(36px, 4.6vw, 72px)`, peso 700, `wdth 118`. H3: `clamp(22px, 2vw, 30px)`, peso 650, `wdth 110`. Texto: 18/1,5, peso 400, `wdth 100`. Rótulo: 13 px caixa alta, espaçamento 0,12 em. **IBM Plex Mono** só para coordenada, código IBGE, hora, id de fonte, contador | Palantir M4 e Resend M11 (título grande em peso médio), Linear M3 (uma família), Windward M2 (mono nos rótulos técnicos) |
| Número | algarismo tabular em todo número que muda; contador em display `wdth 70` (condensado) para caber | Stripe M1 (número vivo com casas fixas), Lusion M12 (contador) ; escola: erro de amador 16 (número que salta) |
| Cor | papel `#ECEBE3`, tinta `#18201B`, curva `#A9B2A3`. **Bronze `#9A6224` só em três papéis**: o CTA, o "agora" (sinal que acabou de chegar, ponto que pulsa) e o ponto do vértice. Tensão na régua sálvia a óxido, sem vermelho de alarme. Palco da leitura ao vivo em tinta, texto em papel | Windward M2 (uma cor quente só para o que está vivo), GFW M6 (cor forte só na camada do dado); escola T04 |
| Curvas de nível | textura, nunca dado: traço fino `#A9B2A3` a 0,75 px, **curva mestra a cada 5** a 1,3 px (convenção cartográfica). No palco escuro, curvas a 12% de opacidade | Felt M5 e GFW M6 (a carta por baixo do dado) |
| Vértice geodésico | é o objeto do hero e o marcador de "ponto fixado": triângulo com ponto bronze. Aparece em três lugares: hero, ponto do território na silhueta, carimbo de fechamento da leitura | Vercel M8 (um símbolo geométrico protagonista) |
| Cartografia | **silhueta real do município** em SVG, da API de malhas do IBGE (`servicodados.ibge.gov.br/api/v3/malhas/municipios/{id}`, GeoJSON, aberta), desenhada em traço tinta; sinais com coordenada viram pontos nela. **Tiles raster abertos** (OpenStreetMap via MapLibre, com atribuição) só dentro do relatório do Diagnóstico, no capítulo de lugares, e carregados sob demanda. **Sem mapa-múndi decorativo e sem biblioteca de mapa na landing** | Felt M5 (mapa real com atribuição), GFW M6 (o território é o dado) |
| Fotografia | nenhuma foto de banco. Se entrar imagem, é satélite aberto do próprio território (Sentinel-2, Copernicus, com crédito) no relatório | Planet M7 (satélite como imagem), com a ressalva de M7: nunca no lugar do campo |
| Três dimensões | **sem Three.js na v1**. A profundidade vem da silhueta e das curvas. Reavaliar só se a escola nova mandar | build-awwwards §5 (WebGL só com função); Resend M11 mostra que um objeto só basta |

### 3.3 Proibido

1. Formulário de contato como ação principal em qualquer dobra.
2. Gauge, disco com ponteiro, velocímetro, semáforo, pizza, rosca (escola, erro 1). O `Disco` do /marco fica só no /marco.
3. Ilustração vetorial feita à mão (pessoas, prédios, ícones decorativos grandes); o que é desenhado é dado ou marca.
4. Gradiente em bolha, vidro fosco em tudo, card com sombra como efeito dominante (escola, erro 9).
5. Sinal, fonte ou número animado sem evento real por trás; "ao vivo" que é gravação sem aviso.
6. Vermelho de alarme para tensão alta; crise como argumento fora do momento Responder.
7. Mais de uma família tipográfica de display; itálico serifado de outra marca.
8. Desfoque animado em texto (o Felipe já vetou no ditoo, 24/09).
9. Mais de um motor de rolagem suave; `transition: all`.
10. Elemento decorativo maior que a viewport sem `overflow: clip` no pai (é o defeito atual no celular, §7).

---

## 4. Coreografia de motion (PROVISÓRIA até a escola de motion)

### 4.1 Tokens

| Token | Valor | Fonte |
|---|---|---|
| Motor | GSAP 3 + ScrollTrigger; **Lenis** como único motor de rolagem suave (`lerp 0.1`), ligado ao `gsap.ticker`, desligado em reduced-motion e em ponteiro grosso (toque) | Mapbox M9 e Locomotive M10 (Lenis em produção); skill cinematic-gsap-lenis |
| Eases | `expo.out` para entrada de título; `power3.out` para bloco; `power2.inOut` para contador; `none` só em scrub | cinematic-gsap-lenis (tokens base) |
| Durações | 0,35 s (hover, estado), 0,6 s (bloco), 0,9 s (título), 1,2 s (traço de silhueta e curvas) | Palantir M4 (entrada longa e calma) |
| Stagger | palavras 0,05 s; linhas 0,1 s; itens de lista 0,06 s | Linear M3 (lista em sequência) |
| Gatilho | `start: "top 82%"`, uma vez (`once: true`) para revelação; scrub só no parallax das curvas (`scrub: 1`) | cinematic-gsap-lenis |
| Propriedades | só `transform`, `opacity` e `clip-path`; nunca `filter: blur` em texto | escola T15 |

### 4.2 Landing, seção por seção

| Seção | O que entra, em que ordem | Duração e ease | Gatilho |
|---|---|---|---|
| Cabeçalho | fixo desde o primeiro quadro; ganha fundo papel e régua de 1 px depois de 80 px de rolagem | 0,35 s `power3.out` | posição da rolagem |
| Hero | (1) curvas de nível desenham de dentro para fora, 0 a 1,2 s; (2) h1 em cortina por linha (`clip-path inset(0 0 100% 0)` para `inset(0 0 -20% 0)`), linha 1 aos 0,15 s, linha 2 aos 0,25 s; (3) campo e nota sobem 14 px, aos 0,5 s; (4) o vértice aparece com o ponto bronze por último, aos 0,9 s; (5) o contador do dia conta de 0 ao valor real em 1,4 s. **Rede de segurança: aos 2,5 s tudo visível**, mesmo com aba em segundo plano | 0,9 s `expo.out` para o título; 0,6 s `power3.out` para o resto | carga da página |
| Hero ao rolar | curvas sobem 12% e escalam 1,06 (parallax), o vértice fica | scrub 1 | rolagem do hero |
| Reconhecimento | números da PRINT e nomes das fontes oficiais entram em fila; cada número conta uma vez | 0,6 s, stagger 0,08 s | `top 82%`, uma vez |
| Três passos | uma demonstração que toca sozinha: o campo digita "Macaé", a silhueta desenha, três sinais caem no fio, a barra de Tensão enche. É a leitura ao vivo em miniatura, **com dado real de uma leitura publicada** | 9 s linear, clicável por passo | `top 75%`, uma vez |
| Três momentos | abas; a troca desliza o conteúdo 16 px e troca opacidade | 0,35 s | clique |
| Antes e depois | as linhas espelhadas entram par a par, esquerda e direita juntas | 0,6 s, stagger 0,1 s | `top 82%` |
| Escada de 4 degraus | lista numerada à maneira de M4; cada degrau com o número "/1" a "/4" em mono e o nome em H2 | 0,9 s `expo.out`, stagger 0,1 s | `top 82%` |
| Urgência | a frase grande centralizada entra palavra por palavra | stagger 0,05 s | `top 82%` |
| FAQ | acordeão com altura animada por `grid-template-rows` | 0,35 s | clique |

### 4.3 A partitura do clímax: a leitura ao vivo

Referências: Windward M2 (palco operacional e lista de anomalias), Linear M3 (linha de feed com carimbo de tempo), Stripe M1 (número vivo), Lusion M12 (espera contada), GFW M6 (o ponto no território). Vocabulário da casa: "No fio, agora" e o carimbo do ditoo.

**Princípio:** o clímax é o momento mais forte do produto porque é **verdadeiro**. A animação nunca adianta o motor. Cada movimento é consequência de um evento SSE.

| Tempo | Evento | O que acontece na tela |
|---|---|---|
| 0 | Enter no campo | o campo vira o título do território (FLIP 0,6 s `power3.out`); a rota muda para `/leitura/:slug` |
| até 1 s | `resolvido`, `estrutural` | silhueta do IBGE desenha em 1,2 s; as barras estruturais enchem, stagger 0,08 s; a faixa "O que falta" entra por último |
| 1 a 2 s | `etapa: coleta` | **a virada**: o fundo passa de papel para tinta em 0,8 s (`power2.inOut`), as curvas ficam a 12%, o cabeçalho do território encolhe para o topo; à esquerda aparece a frase da etapa e o contador `00` de sinais verificados |
| ao vivo | `fonte` | a fonte muda de estado na lista: "consultando" (ponto que respira, 1,6 s em loop, só opacidade) para "respondeu · 12 brutos" (ponto fixo) ou "sem resposta" (texto em cinza, sem drama) |
| ao vivo | `sinal` | **o gesto principal**: a linha entra no topo do fio (y −12 para 0, opacidade 0 para 1, 0,5 s `expo.out`), com um filete bronze à esquerda que esmaece em 2 s (o "agora"); o contador sobe **de um em um**, tabular; se o sinal tem lugar, um ponto bronze pulsa na silhueta (anel de 4 para 18 px, 1,2 s, uma vez); as linhas antigas descem e esmaecem até 45% depois da quinta |
| ao vivo | rejeitado pelo verificador (quando o evento existir) | a linha entra, fica riscada 0,8 s com o rótulo "não é deste território" e sai. Mostrar a limpeza é a prova de rigor |
| ao vivo | `etapa: verificacao`, `consolidacao`, `redacao` | a frase da etapa troca em cortina (0,6 s); a barra de progresso da etapa anda por etapa, nunca por tempo inventado |
| ao vivo | `dimensao` | a linha da dimensão na lista enche a barra até o número de sinais e mostra "4 de 6 fontes" |
| fim | `teaser` | o carimbo "LEITURA FECHADA · 14:32" entra (escala 1,08 para 1, 0,5 s); o fundo volta de tinta para papel em 0,8 s; o teaser monta em cima do fio, que fica recolhido e disponível ("ver os 23 sinais") |
| fim | `sem_leitura` | o palco volta para o papel sem carimbo; a tela diz o motivo em frase ("A cota de leituras novas de hoje acabou") e o próximo passo (deixar o e-mail para receber a leitura quando rodar; ou pedir o Diagnóstico). A estrutural continua na tela |

**Cadência:** os eventos entram numa fila e saem com intervalo mínimo de 350 ms, para o olho conseguir ler cada linha. Se a fila passar de 12, o intervalo cai para 120 ms. **Em cache** (evento `cache`), a tela diz "Leitura de hoje, 07:12, reproduzida" e toca a 200 ms por evento. Nunca se gera evento que o servidor não mandou.

**Espera longa:** se a coleta passar de 45 s sem evento, a frase da etapa ganha uma segunda linha com o que está sendo feito de verdade ("Ainda esperando 3 fontes: IBAMA, Querido Diário, INPE") e aparece o convite "Pode fechar: mandamos a leitura para o seu e-mail quando terminar" com um campo só (captura opcional durante a espera).

### 4.4 Desempenho e reduced-motion

- **Desempenho:** LCP abaixo de 2,5 s e CLS abaixo de 0,05 no build de produção, em 4G simulado; o módulo de motion carrega depois do primeiro quadro (import dinâmico); curvas de nível em canvas com DPR limitado a 2 e redesenho parado fora da tela e com a aba oculta; zero animação rodando fora da viewport; a silhueta do IBGE vem em GeoJSON simplificado (menos de 60 KB).
- **Reduced-motion (`prefers-reduced-motion: reduce`):** sem Lenis, sem parallax, sem cortina; tudo no estado final ao carregar. No clímax, as linhas de sinal aparecem sem deslocamento, o contador mostra o valor direto, a virada papel para tinta vira troca instantânea e o pulso na silhueta vira ponto fixo. O conteúdo é o mesmo; só o movimento sai.
- **Sem JavaScript:** o hero mostra título, campo (o formulário faz GET para `/leitura?q=`) e nota. Nada fica invisível esperando script.

---

## 5. Direção do relatório do Diagnóstico completo

Para o time que constrói agora. Dados: `shared/relatorio-marco/tipos.ts` (`DadosRelatorio`); render em `shared/relatorio-marco/render.ts`.

**Conceito:** um ensaio de inteligência territorial, numerado e datado como edição, que se lê no navegador e se imprime em A4 sem perder nada. Fonte: The Pudding M13 (edição numerada e datada, visual essay), Palantir M4 (capítulo numerado com nome grande), GFW M6 (o mapa como evidência), escola T01, T03, T05, T11.

| Parte | Conteúdo (campo de `DadosRelatorio`) | Direção |
|---|---|---|
| Capa | `territorio`, `geradoEm`, `leitura` (Tensão, faixa, Confiança) | nome do território em display 148 px `wdth 125`; coordenada e código IBGE em mono; silhueta do IBGE grande à direita; "Diagnóstico Marco nº 0017 · 30/09/2026"; Tensão em barra com a faixa desenhada e a frase da Confiança ("63% da metodologia foi medida") |
| Índice fixo | os capítulos | coluna lateral fixa no desktop com "/01" a "/10" em mono e barra de progresso de leitura; no celular, índice recolhido no topo |
| /01 O que decide | `decide[]`, `sintese[]` | título que afirma a conclusão (T11), não "Resumo executivo"; até 3 decisões com urgência |
| /02 O que mudou | `mudou` | comparação com a linha de base (T03); sem linha de base, a tela diz que é a primeira leitura |
| /03 Identidade do território | `identidade`, indicadores estruturais | fila de números com comparação nacional (percentil) à maneira de Stripe M1 |
| /04 a /09 As 6 dimensões | `dimensoes[]`: `score`, `peso`, `leitura`, `sustentam[]`, `naoMedido[]`, `fontesConsultadas` | um capítulo por dimensão: barra do zero (T05) com peso declarado; a leitura em texto; os sinais que sustentam como a **mesma linha do fio** (fonte, data, link, impacto); "O que não foi medido" sempre visível, nunca escondido |
| /10 Sinais-chave no tempo | `sinaisChave[]` | linha do tempo horizontal, pontos por data, rótulo direto (T11) |
| /11 Lugares | `pontos` com `lat/lng` | mapa com tiles abertos (MapLibre + OpenStreetMap, atribuição visível) carregado só quando o capítulo entra na tela; pontos em bronze |
| /12 Previsão | `previsao` (horizonte, riscos, oportunidades) | duas colunas espelhadas, mesma quantidade de linhas |
| /13 Recomendações por momento | `recomendacoes[]` por Entrar, Operar, Responder | três blocos com o momento como título; crise só em Responder |
| /14 Leitura estratégica | `estrategica`, `casos[]` | tese, evidências, riscos, fontes |
| /15 Fontes e método | `fontes[]`, `semLastro[]`, `coleta` | tabela de consulta (T06): fonte, dimensão, sinais, rejeitados, status, número à direita e ordenado por sinais; `semLastro` listado com o título "Afirmações que não conseguimos comprovar": transparência vende |
| Fecho | escada | Marco Radar (acompanhar este território) e PRINT no local (equipe em campo), com a assinatura "Inteligência territorial da PRINT" e a logo original |

Motion do relatório: quase nenhum (T15, T17: tela de leitura). Só a barra de progresso, o número do capítulo entrando em cortina uma vez e as barras enchendo uma vez. Impressão: `@page A4`, quebra antes de cada capítulo, links viram nota com a URL, fundo papel desligado na impressão, índice lateral some.

---

## 6. A régua de 0 a 10

Nota final = média simples dos 10 critérios. Nada sobe para produção abaixo de 8 em média e abaixo de 6 em qualquer critério.

| # | Critério | 3 | 6 | 10 | Referência do 10 |
|---|---|---|---|---|---|
| R1 | **Fluxo pela escada** | CTA principal é formulário; a leitura gratuita não existe ou está escondida | a leitura existe e está linkada, mas o hero ainda vende outra coisa; a captura vem antes do valor | campo no hero, estrutural em 1 s, leitura ao vivo, teaser, captura de 2 campos, confirmação com prazo, lead na mesa com link; Diagnóstico, Radar e PRINT no local em sequência, um verbo só | Gaio (técnicas 1 e 18) e ditoo `Leitura.tsx` (vocabulário) |
| R2 | **Hero que executa o produto** | hero descreve o produto | campo no hero, mas sem prova de motor rodando | campo como foco da dobra e o motor visivelmente vivo (contador real do dia) | Stripe M1, Windward M2 |
| R3 | **Primeira dobra** | título e botões sobre fundo genérico, metade da tela vazia | composição correta, sem objeto memorável | frase grande, campo, contador vivo e o vértice sobre as curvas numa grade deslocada; lembra-se da página no dia seguinte | Vercel M8, Locomotive M10, Resend M11 |
| R4 | **Motion** | sem GSAP e sem Lenis, ou animação decorativa sem função | entradas e revelações por seção, sem clímax | entrada composta do hero, revelações por seção e o **clímax ao vivo** dirigido por evento, com reduced-motion completo | Palantir M4, Linear M3, Lusion M12 |
| R5 | **Tipografia e ritmo** | título tímido (até 60 px), uma única largura de coluna, seções todas iguais | escala boa, ritmo ainda uniforme | Archivo expandido de 148 px no hero, contraste por eixo de largura, mono só no técnico, seções alternando densidade e cor (papel, tinta) | Palantir M4, Locomotive M10, Linear M3 |
| R6 | **Qualidade da Primeira leitura** | página inexistente ou só um número | estrutural com fonte, sem ao vivo, ou ao vivo sem teaser | estrutural com fonte em 1 s, fio ao vivo verdadeiro, teaser completo, estados de cache, espera e `sem_leitura` desenhados | Windward M2, GFW M6 |
| R7 | **Copy pela dor** | abre explicando o que é o produto | abre pela dor, mas explica demais abaixo | primeira frase é a dor do C-level, cada bloco com até 3 linhas, prova no lugar de adjetivo, um verbo | comecar-pela-dor; Gaio (técnica 2) |
| R8 | **Confiança e prova** | nenhuma fonte visível; número sem origem | fontes citadas em texto | fonte ao lado de cada número, o verificador visível no clímax, "o que não foi medido" explícito, JSON-LD | GFW M6, Stripe M1 (números com contexto) ; escola T03 |
| R9 | **Celular** | rolagem horizontal, campo fora da dobra | funciona, mas é o desktop encolhido | campo e contador na primeira tela a 390 px, clímax em coluna única com o fio em cima, área de toque de 44 px, sem rolagem lateral | Linear M3 e Resend M11 a 390 px (capturas `-m-dobra.jpg`) |
| R10 | **Desempenho** | LCP acima de 4 s ou CLS acima de 0,25 | LCP até 2,5 s, CLS até 0,1 | LCP abaixo de 2,5 s e CLS abaixo de 0,05 em 4G, motion carregado depois do primeiro quadro, nada animando fora da tela | ditoo.ai medido hoje: LCP 1,8 s, CLS 0,001 (vocabulário da casa como piso) |

---

## 7. Nota atual (30/09/2026, localhost:4100, dev server)

Capturas: `marco-home-d-dobra.jpg`, `marco-home-d-rolado.jpg`, `marco-home-m-dobra.jpg`, `marco-leitura-d-dobra.jpg`. Medições no DOM: `gsap` e Lenis não inicializados em `/`; zero campo de texto na dobra; h1 95 px (desktop) e 44 px (celular); **`/` tem rolagem horizontal a 390 px** (largura 424 px), causada por `div.absolute.w-[170vw]` com o `svg.mo-camada` do motion novo sem `overflow: clip` no pai; `/leitura` responde "Esta página não existe ou mudou de endereço". LCP 1,8 s e CLS 0,011 no dev server (o build de produção precisa ser medido de novo).

| Critério | `/` | `/leitura` | Por quê |
|---|---|---|---|
| R1 Fluxo | 2 | 0 | "Pedir diagnóstico" é o CTA do topo, repetido 3 vezes; a leitura não existe na rota |
| R2 Hero executa | 1 | n/a | nenhum campo; o hero descreve |
| R3 Primeira dobra | 3 | 0 | título forte, mas metade direita vazia, curvas quase invisíveis, nenhum objeto |
| R4 Motion | 1 | 0 | nada anima além das ondas de fundo; GSAP e Lenis instalados e não ligados na página servida |
| R5 Tipografia e ritmo | 4 | 1 | Archivo expandido certo; escala tímida para a direção (95 px contra 148 px), seções iguais, coluna estreita |
| R6 Primeira leitura | 0 | 0 | rota 404 no servidor de agora (o time está construindo) |
| R7 Copy pela dor | 5 | n/a | subtítulo toca a dor; o bloco seguinte volta a explicar ("Reunimos e cruzamos dados...") |
| R8 Confiança e prova | 3 | 0 | FAQ de objeção existe; nenhuma fonte ou número vivo visível na dobra |
| R9 Celular | 3 | 2 | rolagem horizontal a 390 px; campo inexistente |
| R10 Desempenho | 7 | 7 | LCP 1,8 s e CLS 0,011 no dev; falta medir o build |
| **Média** | **2,9** | **1,0** | |

Referência da casa para calibrar: `/marco` mediu LCP 1,4 s, mas **CLS 0,13 no celular**, e usa gauge: ele não é modelo, é vocabulário.

### 7.1 As 5 mudanças que mais sobem a nota

1. **Trocar o CTA de topo pelo campo `BuscaLeitura` no hero** e apagar "Pedir diagnóstico" da dobra e do cabeçalho (sobe R1, R2, R3).
2. **Publicar `/leitura/:slug` com a estrutural em 1 s e o clímax ao vivo** dirigido pelos eventos SSE, na partitura do §4.3 (sobe R6, R4, R8; é o maior salto da régua).
3. **Ligar o motor de motion** (GSAP, Lenis, rede de segurança, reduced-motion) e a entrada composta do hero (sobe R4, R3).
4. **Teaser, captura de 2 campos e confirmação com prazo honesto**, com lead na mesa e UTM por bloco (fecha R1).
5. **Consertar o celular e a escala**: `overflow: clip` no pai das camadas de motion, display do hero no token de 148 px, grade deslocada (sobe R9, R5).
