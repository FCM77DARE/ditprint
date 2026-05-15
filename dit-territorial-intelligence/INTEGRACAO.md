# DIT — Guia de Integração no Site da Print

## Visão Geral

Este pacote contém o código completo do **DIT (Print Territorial Intelligence™)**, desenvolvido em **React 19 + Tailwind CSS 4 + TypeScript**. Todas as páginas e componentes estão prontos para integração em outro projeto Manus com a mesma stack.

---

## Estrutura de Arquivos Relevantes

```
client/src/
├── pages/
│   ├── Home.tsx              → Landing principal do DIT
│   ├── TerritoryDetail.tsx   → Página da Baía de Guanabara (STT 78)
│   ├── TelesPires.tsx        → Página da Bacia do Rio Teles Pires (STT 84)
│   ├── SSE.tsx               → Página do produto SSE™
│   ├── Methodology.tsx       → Página de Metodologia STT
│   └── RadarTerritorial.tsx  → Página do Radar Territorial™ (assinatura)
├── components/
│   ├── Header.tsx            → Navegação principal com toggle de tema
│   └── STTGauge.tsx          → Componente do gauge circular STT
└── index.css                 → Paleta de cores, fontes e utilitários globais
```

---

## Passo a Passo de Integração

### 1. Copiar os arquivos de páginas

Copie todos os arquivos de `client/src/pages/` do DIT para o diretório `client/src/pages/` do site da Print.

> **Atenção:** Se o site da Print já tiver um `Home.tsx`, renomeie o do DIT para `DitHome.tsx` e ajuste as rotas.

### 2. Copiar os componentes

Copie `Header.tsx` e `STTGauge.tsx` de `client/src/components/` para o projeto da Print.

> Se o site da Print já tiver um `Header.tsx` próprio, **não substitua**. Em vez disso, adicione os links do DIT ao menu existente (ver seção "Rotas" abaixo).

### 3. Adicionar as rotas no App.tsx

No `App.tsx` do site da Print, adicione as rotas do DIT:

```tsx
import DitHome from "@/pages/DitHome";           // ou Home se não houver conflito
import TerritoryDetail from "@/pages/TerritoryDetail";
import TelesPires from "@/pages/TelesPires";
import SSE from "@/pages/SSE";
import Methodology from "@/pages/Methodology";
import RadarTerritorial from "@/pages/RadarTerritorial";

// Dentro do <Switch>:
<Route path={"/dit"} component={DitHome} />
<Route path={"/dit/territorio/baia-guanabara"} component={TerritoryDetail} />
<Route path={"/dit/territorio/teles-pires"} component={TelesPires} />
<Route path={"/dit/sse"} component={SSE} />
<Route path={"/dit/metodologia"} component={Methodology} />
<Route path={"/dit/radar"} component={RadarTerritorial} />
```

> Prefixe todas as rotas com `/dit/` para não conflitar com as rotas do site principal da Print.

### 4. Atualizar os links internos das páginas DIT

Após prefixar as rotas, atualize os `<Link href="...">` dentro das páginas do DIT:

| Antes | Depois |
|---|---|
| `href="/"` | `href="/dit"` |
| `href="/sse"` | `href="/dit/sse"` |
| `href="/metodologia"` | `href="/dit/metodologia"` |
| `href="/radar"` | `href="/dit/radar"` |
| `href="/territorio/baia-guanabara"` | `href="/dit/territorio/baia-guanabara"` |
| `href="/territorio/teles-pires"` | `href="/dit/territorio/teles-pires"` |

### 5. Mesclar o CSS global

Abra o `client/src/index.css` deste pacote e copie os seguintes blocos para o `index.css` do site da Print:

- As variáveis de fonte: `--font-display`, `--font-body`, `--font-mono`
- As classes utilitárias: `.glass`, `.glow`, `.text-glow`, `.bg-neural-pattern`
- As classes de fonte: `.font-display`, `.font-body`, `.font-mono`

> **Atenção:** Não substitua as variáveis de cor (`:root` e `.dark`) do site da Print. O DIT usa as mesmas variáveis semânticas do Tailwind (`--primary`, `--foreground`, etc.) e vai herdar automaticamente a paleta do site principal.

### 6. Adicionar as fontes no index.html

No `client/index.html` do site da Print, adicione as fontes do DIT caso ainda não estejam presentes:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

### 7. Adicionar link no menu do site da Print

No Header do site da Print, adicione uma entrada para o DIT:

```tsx
<Link href="/dit">DIT™</Link>
// ou como CTA destacado:
<Button>Acessar DIT™</Button>
```

---

## Dependências Necessárias

Todas as dependências abaixo já fazem parte do template padrão Manus. Verifique se estão no `package.json` do site da Print:

```json
"recharts": "^2.15.2",
"framer-motion": "^12.23.22",
"lucide-react": "^0.453.0",
"embla-carousel-react": "^8.6.0"
```

Se alguma estiver faltando, instale com:
```bash
pnpm add recharts framer-motion lucide-react embla-carousel-react
```

---

## Imagens (CDN)

Todas as imagens do DIT já estão hospedadas em CDN e referenciadas por URL diretamente no código. Não é necessário copiar nenhum arquivo de imagem.

---

## Dúvidas

Em caso de conflito de componentes ou estilos, a regra é: **o Header e o CSS global do site da Print têm prioridade**. As páginas do DIT são auto-contidas e funcionam com qualquer paleta de cores que siga as variáveis semânticas do Tailwind.
