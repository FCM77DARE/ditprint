# Brainstorming de Design – DIT (Print Territorial Intelligence™)

## Objetivo
Landing page premium para plataforma de análise de complexidade territorial estratégica, direcionada a executivos de infraestrutura, energia e fundos de investimento.

---

<response>
<text>
**Design Movement**: Brutalismo Suíço Digital

**Core Principles**:
- Geometria rígida e assimetria intencional
- Hierarquia tipográfica extrema com contraste de peso
- Uso de espaços negativos como elemento estrutural
- Cores saturadas em blocos sólidos contra fundos neutros

**Color Philosophy**: 
Paleta de alto contraste inspirada em mapas topográficos e sinalização industrial: azul petróleo profundo (oklch(0.35 0.08 240)), laranja de alerta (oklch(0.68 0.18 45)), cinza concreto (oklch(0.25 0.01 270)), branco técnico. A intenção é transmitir autoridade técnica e urgência estratégica.

**Layout Paradigm**: 
Grid assimétrico quebrado – seções em ângulos de 3-5 graus, sobreposições de camadas com z-index visível, elementos que "vazam" para fora dos containers. Hero ocupa 70% da viewport à esquerda, CTA em coluna fixa à direita.

**Signature Elements**:
- Linhas diagonais finas (1px) que cortam seções
- Números grandes em stencil font como elementos decorativos de fundo
- Bordas sólidas de 3-4px em elementos interativos

**Interaction Philosophy**: 
Transições abruptas e intencionais – sem easing suave. Hover states com mudanças de cor instantâneas. Scroll snap entre seções. Micro-interações minimalistas que reforçam a sensação de precisão técnica.

**Animation**:
Entrada de elementos com `transform: translateX()` em 200ms linear. Números do gauge animam com counter effect. Carrossel com snap points e sem loop infinito – movimento deliberado, não automático.

**Typography System**:
- Display: Space Grotesk Bold (títulos, números grandes) – peso 700, tracking apertado (-0.02em)
- Body: IBM Plex Mono Regular (texto corrido, labels) – peso 400, line-height 1.6
- Accent: Space Grotesk Medium para CTAs e destaques – peso 500
</text>
<probability>0.07</probability>
</response>

<response>
<text>
**Design Movement**: Minimalismo Japonês Contemporâneo (Ma 間)

**Core Principles**:
- Espaço vazio como protagonista visual
- Ritmo vertical com respiração generosa entre seções
- Sutileza cromática e transições quase imperceptíveis
- Precisão geométrica com cantos suaves

**Color Philosophy**:
Paleta monocromática expandida: tons de cinza aquecido (oklch(0.92 0.005 80) a oklch(0.15 0.01 80)), com um único acento em verde jade profundo (oklch(0.45 0.12 165)) para elementos críticos. A cor é escassa e intencional, criando pontos de foco sem competição visual. Evoca confiança, sofisticação e clareza analítica.

**Layout Paradigm**:
Sistema de grid vertical com proporções 2:3:2 – coluna central dominante para conteúdo principal, colunas laterais para elementos auxiliares. Hero centralizado com gauge flutuante. Carrossel horizontal com scroll suave e indicadores discretos.

**Signature Elements**:
- Linhas horizontais hairline (0.5px) como separadores de seção
- Sombras difusas e sutis (blur 40px, opacity 0.03)
- Ícones em line-art com peso de 1.5px

**Interaction Philosophy**:
Movimentos orgânicos e fluidos – easing cubic-bezier(0.4, 0, 0.2, 1). Hover states com elevação sutil (shadow lift). Estados de loading com skeleton screens minimalistas. Feedback tátil através de micro-animações de escala (0.98).

**Animation**:
Fade-in com `opacity` e `translateY(20px)` em 600ms ease-out. Gauge anima com spring physics (react-spring). Transições de página com crossfade de 400ms. Parallax sutil no hero (0.3x scroll speed).

**Typography System**:
- Display: Sohne Breit (títulos principais) – peso 600, tracking normal
- Body: Inter Variable (texto corrido) – peso 400-500, line-height 1.7
- Data: JetBrains Mono (números, scores) – peso 500, tabular-nums
</text>
<probability>0.09</probability>
</response>

<response>
<text>
**Design Movement**: Neo-Modernismo Cartográfico

**Core Principles**:
- Inspiração em atlas técnicos e documentos de engenharia
- Camadas de informação com transparências controladas
- Grid modular com subdivisões visíveis
- Textura sutil através de padrões topográficos

**Color Philosophy**:
Paleta de mapa geológico: azul cobalto profundo (oklch(0.38 0.15 250)) como base, terracota queimado (oklch(0.52 0.14 35)) para alertas, bege cartográfico (oklch(0.88 0.03 85)) para fundos, preto grafite (oklch(0.18 0.01 270)). Cores evocam mapas históricos e relatórios técnicos, transmitindo seriedade institucional e profundidade analítica.

**Layout Paradigm**:
Sistema de grid 12 colunas com subdivisões visíveis (linhas guia em 5% opacity). Hero em formato widescreen (21:9) com gauge posicionado no terço direito. Seções alternadas com fundos texturizados (contour lines pattern em SVG).

**Signature Elements**:
- Padrão de linhas de contorno topográfico como background sutil
- Badges com bordas chanfradas (clip-path polygon)
- Indicadores de coordenadas geográficas como elementos decorativos

**Interaction Philosophy**:
Transições que simulam zoom de mapa – scale transform com origin point dinâmico. Hover states revelam camadas adicionais de informação (overlay fade-in). Scroll com parallax em múltiplas camadas (foreground, midground, background).

**Animation**:
Entrada de seções com clip-path reveal (de baixo para cima, 500ms ease-in-out). Gauge anima com stroke-dashoffset em SVG. Carrossel com momentum scrolling e snap points. Loading states com shimmer effect diagonal.

**Typography System**:
- Display: Archivo Black (headlines) – peso 900, all-caps para títulos principais
- Body: Manrope Variable (texto corrido) – peso 400-600, line-height 1.65
- Technical: Roboto Mono (scores, dados técnicos) – peso 500, letter-spacing 0.02em
</text>
<probability>0.08</probability>
</response>

---

## Decisão Final

**Escolhido: Neo-Modernismo Cartográfico**

Justificativa: A estética cartográfica reforça diretamente a proposta de valor do DIT (análise territorial), cria diferenciação visual forte no mercado B2B, e transmite autoridade técnica sem frieza corporativa. O sistema de camadas permite hierarquizar informação complexa de forma elegante, e a paleta de cores evoca confiabilidade institucional.
