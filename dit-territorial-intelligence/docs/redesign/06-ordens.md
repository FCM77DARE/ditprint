# 06 · Ordens do diretor de design (30/09/2026, revisão 3)

Direção completa: `06-direcao-nivel-10.md`. Régua no §6: nada sobe abaixo de 8 de média nem abaixo de 6 num critério. Nota de hoje: `/` 2,2 e `/leitura` 1,0.
**O ditoo é a referência principal** (código em `auditia/ai-audit/client/src`, marca em `auditia/identidade/ditoo/README.md`). **O básico bem feito**: imagens de verdade, motion limpo de entrada e rolagem, botões que se mexem. **Ordem de aprendizado, não proibição**: nesta rodada, sem WebGL, 3D, vídeo, território se desenhando ou cursor customizado; isso é a próxima camada (§4.6 da direção), quando o básico estiver 10.
Escada: 1 Leitura gratuita ao vivo, 2 Diagnóstico completo, 3 Marco Radar, 4 PRINT no local. Verbo único: **Ler**.

## dit_dev (fluxo, dados, Primeira leitura, imagens)

1. Hero de `/`: `BuscaLeitura variante="hero"` é a peça principal (como `.busca` do ditoo). Tirar "Pedir diagnóstico" da dobra e do cabeçalho.
2. Contador real na base do hero: "Hoje o Marco consultou N fontes e verificou N sinais". Sem dado, o bloco some.
3. `/leitura/:slug`: estrutural em até 1 s com fonte ao lado de cada número; silhueta do IBGE **parada**; faixa "O que falta".
4. Leitura ao vivo: expor `etapa`, `fonte`, `sinal` (com manchete literal) e `dimensao`; criar o evento de sinal rejeitado pelo verificador; `cache` com a hora da leitura; fontes pendentes após 45 s; e-mail opcional durante a espera.
5. `teaser` com a contagem real por capítulo do Diagnóstico. Captura: e-mail corporativo e empresa, decisão em um toque. Lead com território, decisão, teaser, link e UTM.
6. Confirmação com prazo PROVISÓRIO de 1 dia útil (confirmar com o CEO); sem envio real, não dizer que enviou.
7. Imagens (§3.6): script que baixa Sentinel-2 L2A do AWS Open Data (STAC Element84, sem conta) para os 20 do Radar, aplica duotone `#0F1214`/`#F3F2EE`, grava `client/public/territorio/<slug>.webp` e `.json` de crédito. Fotos de contexto só da Agência Brasil (CC BY 3.0 BR) ou Commons com licença conferida. Crédito visível sempre.
8. Relatório do Diagnóstico (§5): capítulos numerados, capa com satélite, "O que não foi medido" visível, `semLastro` publicado, mapa OpenFreeMap em MapLibre só no capítulo de lugares, A4 imprimível.
Pronto quando: R1, R2, R4, R7 e R8 em 8 ou mais, conferidos a 1440 e 390 px, com screenshot.

## ag_ui_interacao (identidade, motion, botões)

1. Identidade própria (§3): tokens `--m-*` (papel `#F3F2EE`, tinta `#0F1214`, baliza `#FF5A1F` só para o que foi fixado), fora bronze, sálvia, curvas decorativas e "Inteligência territorial da PRINT" sob a marca. PRINT só em "powered by" a 15 px.
2. Fontes: Archivo `wdth 125` (display e números), IBM Plex Sans (texto), Plex Mono (dado, fonte, coordenada), Plex Serif (manchete literal).
3. Gesto único: o ponto do vértice se fixa (anel vira ponto cheio, 600 ms, uma vez, nunca em loop) na marca, no ícone do botão, na fonte que responde, no FAQ e na confirmação.
4. Motor: GSAP + ScrollTrigger + Lenis (`lerp 0.1`) no `gsap.ticker`, desligado em reduced-motion e toque. Receita do ditoo (`Home.tsx` 384 a 455): cortina nos títulos sem desfoque, blocos sobem 20 px, listas em sequência, parallax leve das imagens, rede de segurança aos 2,5 s.
5. Hero: imagem já no primeiro quadro, h1 em cortina 1,1 s, campo e nota sobem em sequência, contador conta em 1,4 s, imagem com parallax ao rolar.
6. Botões (§4.4): primário tinta com ícone do vértice; hover clareia, ponto fixa em baliza, seta anda 4 px, magnético até 6 px só em ponteiro fino; clique desce 1 px e escala 0,98; foco com anel baliza; links com sublinhado que cresce; abas com régua que desliza; cards com imagem a 1,04.
7. Leitura ao vivo (§4.3): palco escuro desde a chegada; fonte vira "ponto fixado"; sinal entra no topo com filete baliza de 2 s; contador de um em um; fila de 350 ms; carimbo "LEVANTAMENTO FECHADO". Animação só por evento real.
8. **Bug no celular**: `/` rola na horizontal a 390 px por `div.w-[170vw]` com `svg.mo-camada`; pai com `overflow: clip`. Com a troca de identidade, essas camadas de curva saem.
9. Reduced-motion: estado final na carga, gesto já fixado, sem Lenis, parallax e magnético. Sem JS: imagem, título, campo e nota visíveis.
10. Desempenho no build: LCP abaixo de 2,5 s, CLS abaixo de 0,05, imagem do hero com `fetchpriority="high"`, motion por import dinâmico.
Pronto quando: R3, R5, R6, R9 e R10 em 8 ou mais, com sequência de screenshots da entrada, do hover e da leitura ao vivo.
