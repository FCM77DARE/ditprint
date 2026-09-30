# Sistema visual do DIT

Base: escola design-de-produto (T01 a T18 e os 20 erros de amador). Identidade derivada do estudo "marco geodésico" de 24/09. O nome continua DIT. Vitrine viva em `/sistema` (claro e escuro, dados marcados EXEMPLO).

## Tokens (client/src/index.css)

Nenhum valor solto de cor, espaço ou raio fora destes nomes. Os nomes shadcn (`--background`, `--primary` etc.) apontam para o sistema, então as telas antigas seguem funcionando.

| Token | Claro | Escuro | Papel |
|---|---|---|---|
| `--papel` | #ECEBE3 | #141A16 | fundo |
| `--superficie` | #F4F3EE | #1B221D | card, tabela, popover |
| `--tinta` | #18201B | #ECEBE3 | texto |
| `--tinta-2` | #4A524C | #B4BBAE | texto secundário |
| `--linha` | #CFCDC2 | #2E372F | bordas, separadores |
| `--curva` | #A9B2A3 | #3C473E | grade, curvas de nível |
| `--acento` | #9A6224 | #D39A52 | bronze, acento único |
| `--acento-texto` | #7F501D | #D39A52 | bronze em texto pequeno sobre papel |
| `--tensao-1..5` | #6F8C6F, #8A8A48, #A67A35, #B0582D, #8A3F22 | #8FA58F, #B5B07A, #C99A5B, #D08A5E, #D9785A | escala de tensão |
| `--confianca-faixa` | #B9B8AE | #4A544C | intervalo min-max |
| `--status-ok/atencao/mudo` | #4F7A5A, #A67A35, #7A807B | #8FB79A, #C99A5B, #8A918B | saúde de agentes |

Espaço `--espaco-1..16` = 4, 8, 12, 16, 24, 32, 48, 64 px. Raio `--raio-1` 2px (tudo) e `--raio-2` 6px (card, bloco); pill só em Chip. Duração única `--dur` 160ms, `--ease` curva única. Fontes: `--font-display` e `--font-body` (Archivo), `--font-mono` (IBM Plex Mono).

Utilitários Tailwind expostos: `bg-papel`, `bg-superficie`, `text-tinta`, `text-tinta-2`, `text-acento-texto`, `bg-tensao-3`, `bg-confianca-faixa` etc.

Removidos do sistema: glass, glow, sombra decorativa, gradiente, scanline. As classes `.glass`, `.glow*`, `.text-glow*` e `.bg-topo-pattern`/`.bg-neural-pattern` continuam existindo só como alias neutro (superfície plana, sem efeito) para as telas antigas não quebrarem; a nova tela não as usa. Quando as telas forem refeitas, apagar os aliases.

Contraste (WCAG): texto `--tinta` 13,9:1 e `--tinta-2` 6,8:1 sobre o papel; botão primário 4,6:1. Os cinco passos de tensão no claro têm 3:1 ou mais contra o papel (o passo 1 do estudo, #8FA58F, dava 2,2:1 e foi escurecido; no escuro vale o tom claro original). Nenhum vermelho de alarme.

## Uso de cor (o que cada cor significa)

- Bronze: ação principal e o que responde à pergunta da tela. Nada mais é bronze.
- Escala de tensão: só quantidade de tensão (faixa e barras de dimensão). Nunca decoração, nunca categoria.
- Cinza (tinta-2, linha, curva, confiança): tudo o resto. Confiança nunca usa cor forte.
- Cor nunca é o único sinal: toda faixa tem rótulo (Baixa, Moderada, Elevada, Alta, Crítica) e a marca `MarcaFaixa` (cinco traços, N preenchidos); status tem forma (círculo cheio, triângulo, círculo vazado) e texto; delta tem sinal + ou −.

## Tipografia

Archivo em largura expandida (`wdth` 125) nos títulos h1 a h6 e em `.font-display`; Archivo normal no texto; IBM Plex Mono só em código, coordenada e número tabular (`.num`). Carregadas por `<link>` em `client/index.html`. Texto de apoio (fonte, definição, legenda): `.nota`, 12px.

## Componentes (client/src/components/dit, import de `@/components/dit`)

Tipo de entrada vem de `shared/leitura.ts` (`Leitura`, `DimensaoLeitura`, `FaixaLeitura`). Todos têm nome acessível; os que carregam dado têm estado vazio e de carregamento.

- `DitMark`, `DitLogo`, `PoweredByPrint`: símbolo (triângulo com ponto), logo com descrição opcional, assinatura que usa o arquivo original em `/brand/print-logo*.png`.
- `TensaoBar`: substitui o gauge. Valor em comprimento a partir do zero, faixa min-max em cinza, marcador do valor, rótulo da faixa, "confiança N%", delta com sinal. Confiança baixa (abaixo de 60) vira hachura e opacidade menor. `tensao` null mostra "Não medida".
- `DimensoesTable` / `DimensaoRow`: tabela densa ordenada pelo maior valor. Score null ou `medida` false vira "não medida" (nunca 100) e não tem barra. Fonte com ícone e texto.
- `Sparkline`: linha sem eixo, último ponto em bronze, rótulo acessível com início e fim.
- `KpiTile`: número grande, unidade, comparação obrigatória; sem ela escreve "sem base de comparação".
- `StatusDot`: ok, atencao, mudo, por forma e texto.
- `EmptyState`, `ErrorState` (motivo e próximo passo com verbo), `LoadingBlock` (esqueleto estático, sem spinner), `Secao` (título que afirma a conclusão, nota pequena).
- `PageShell` (público: header com DitLogo e nav Como funciona, Metodologia, Pedir diagnóstico; footer com assinatura; prop `hero` liga as curvas de nível) e `AppShell` (portal e mesa: barra lateral leve em cinza, área de trabalho dominante; vira faixa no topo em tela estreita).
- `Chip` (único pill), `Button` com variantes `primario` (bronze), `secundario` (contorno), `fantasma`.

## Regras

1. Quantidade em comprimento e posição a partir do zero. Sem gauge, velocímetro, semáforo, pizza, rosca, radar, 3D.
2. Todo número vem com comparação e unidade, ou diz que não há base.
3. Botão com verbo (Pedir diagnóstico, Coletar sinais), nunca "Ok" ou "Continuar".
4. Tabela: nome legível na primeira coluna, número à direita em tabular, ordem pelo valor que importa.
5. Foco visível em tudo que é interativo (contorno bronze de 2px); área de clique mínima de 44px nos controles do shell.
6. Movimento só com função, só `transform` e `opacity` (ou cor em botão), duração `--dur`; `prefers-reduced-motion` zera transições e animações.
7. Curvas de nível só no hero público, nunca atrás de dado.
8. Cards: borda fina, sem sombra, sem fundo colorido, sem zebra.
9. Layout pela largura da janela, conferido em 375px antes de entregar.
10. Estado vazio, erro e carregamento desenhados no lugar do dado, com motivo e próximo passo.
