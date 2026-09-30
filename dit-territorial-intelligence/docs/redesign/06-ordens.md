# 06 · Ordens do diretor de design (30/09/2026)

Direção completa: `06-direcao-nivel-10.md`. Régua de aprovação no §6 dela: nada sobe abaixo de 8 de média nem abaixo de 6 em um critério. Nota de hoje: `/` 2,9 e `/leitura` 1,0. Coreografia é PROVISÓRIA até a escola de motion.
Escada: 1 Leitura gratuita ao vivo, 2 Diagnóstico completo (pago), 3 Marco Radar, 4 PRINT no local. Verbo único: **Ler** ("Ler este território"; no desejo, "Quero o Diagnóstico completo").

## dit_dev (fluxo, dados, Primeira leitura)

1. Hero de `/`: `BuscaLeitura variante="hero"` é a ação principal. Tirar "Pedir diagnóstico" da dobra e do cabeçalho; o CTA do cabeçalho vira "Ler um território" (rola até o campo).
2. Contador vivo na dobra: "Hoje o Marco consultou N fontes e verificou N sinais", número real do dia (livro de custo ou `/api/dit/ops`). Sem dado, o bloco não aparece.
3. `/leitura/:slug`: estrutural em até 1 s (`resolvido`, `estrutural`), com fonte ao lado de cada número e a faixa "O que falta".
4. Silhueta real do município pela API de malhas do IBGE (GeoJSON simplificado, menos de 60 KB, cache por código). Sinal com coordenada vira ponto nela.
5. Clímax: expor para o front, por evento, `etapa`, `fonte` (ok e brutos), `sinal` (dimensão, fonte, data, título, url, impacto) e `dimensao`. Acrescentar evento de **sinal rejeitado pelo verificador** (título e motivo) para a tela mostrar a limpeza.
6. `cache`: mandar a hora da leitura do dia para a tela dizer "Leitura de hoje, 07:12, reproduzida". Nunca fabricar evento.
7. Espera acima de 45 s: mandar quais fontes ainda faltam; aceitar e-mail opcional para mandar a leitura quando terminar.
8. `teaser`: Tensão, faixa, Confiança, síntese, 3 sinais, 1 risco, 1 oportunidade e a **contagem real por capítulo** do Diagnóstico que ficou de fora.
9. Captura: e-mail corporativo e empresa obrigatórios, decisão em um toque (Entrar, Operar, Responder), nome e cargo opcionais. Lead grava território, decisão, teaser, link da leitura e UTM do bloco.
10. Confirmação com prazo PROVISÓRIO de 1 dia útil (confirmar com o CEO). Se o e-mail não sai de verdade, a tela não diz que enviou.
11. Estados desenhados: `sem_leitura` (cada motivo com frase e próximo passo), `ambiguo`, `nao_encontrado`, erro de rede.
12. Relatório do Diagnóstico: seguir §5 (capítulos numerados, "O que não foi medido" sempre visível, `semLastro` publicado, A4 imprimível, tiles abertos com atribuição só no capítulo de lugares).
Pronto quando: R1, R2, R6 e R8 em 8 ou mais, conferidos no navegador a 1440 e 390 px, com screenshot.

## ag_ui_interacao (motion e arte)

1. Motor único: GSAP + ScrollTrigger + Lenis (`lerp 0.1`) no `gsap.ticker`; Lenis desligado em reduced-motion e em toque. Hoje a página servida não inicializa nenhum dos dois.
2. **Bug no celular**: `/` rola na horizontal a 390 px (424 px de largura) por causa do `div.w-[170vw]` com `svg.mo-camada`. Pai com `overflow: clip`. Conferir `/marco`, CLS 0,13 no celular.
3. Hero: curvas desenham (1,2 s), h1 em cortina por linha (`expo.out` 0,9 s, sem desfoque), campo e nota sobem aos 0,5 s, vértice com ponto bronze aos 0,9 s, contador conta em 1,4 s. Rede de segurança: tudo visível aos 2,5 s.
4. Escala: display do hero `clamp(56px, 8.5vw, 148px)`, peso 800, `wdth 125`, entrelinha 0,92; grade deslocada de 12 colunas (texto 1 a 6, objeto 7 a 12).
5. Clímax (§4.3): virada papel para tinta em 0,8 s no `etapa: coleta`; linha de sinal entra no topo (y −12, 0,5 s `expo.out`) com filete bronze que esmaece em 2 s; contador sobe de um em um, tabular; pulso de 4 a 18 px na silhueta; rejeitado aparece riscado 0,8 s e sai; carimbo "LEITURA FECHADA" e volta ao papel no `teaser`.
6. Fila de eventos com intervalo mínimo de 350 ms (120 ms acima de 12 na fila; 200 ms em cache). Animação só por evento real.
7. Seções da landing conforme a tabela §4.2 (revelação `top 82%`, uma vez; stagger 0,06 s em lista; demonstração dos três passos com dado real de leitura publicada).
8. Proibido: gauge (o `Disco` do /marco não sobe), desfoque animado em texto, `transition: all`, animação fora da tela, segundo motor de rolagem.
9. Reduced-motion: estado final na carga, sem Lenis, sem parallax, virada instantânea, pulso vira ponto fixo. Sem JS: título, campo e nota visíveis.
10. Desempenho no build: LCP abaixo de 2,5 s, CLS abaixo de 0,05; motion por import dinâmico; canvas com DPR até 2 e parado fora da tela.
Pronto quando: R3, R4, R5, R9 e R10 em 8 ou mais, com gravação ou sequência de screenshots do clímax e medição do build.
