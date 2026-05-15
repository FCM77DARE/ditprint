# DIT - Print Territorial Intelligence™

O DIT é um motor avançado de inteligência artificial projetado para gerar panoramas profundos sobre territórios, analisando dados socioambientais, econômicos, de infraestrutura e reputacionais. Ele não apenas fornece indicadores estáticos, mas sintetiza um relatório analítico (Executive Note) por meio de LLM.

## 📚 Sequência Lógica da Documentação

Para compreender, manter e evoluir o sistema, a documentação está dividida na seguinte sequência estrutural:

### 1. Visão Geral e Inicialização (Você está aqui)
O guia básico de como o sistema funciona, como instalar as dependências e como ligar os motores.

### 2. [Arquitetura e Orquestração (ARCHITECTURE.md)](./ARCHITECTURE.md)
*Em desenvolvimento.* Documentação focada no coração do sistema:
- Como funcionam as 6 Dimensões.
- Como o `Orchestrator` dispara os 32 agentes simultaneamente.
- O pipeline de cálculo do STT (Score de Tensão Territorial).
- A integração final com a Inteligência Artificial (OpenAI).

### 3. [Catálogo de Agentes e Fontes (AGENTS.md)](./AGENTS.md)
*A ser criado.* O mapeamento completo das fontes de dados:
- **Tipo A:** APIs Abertas (IBGE, INMET, INPE).
- **Tipo B:** APIs Fechadas (Fogo Cruzado, SerpAPI).
- **Tipo C:** Web Scraping via Apify (Diários Oficiais, Secretarias, Conselhos).

### 4. [Guia de Chaves e Integração (INTEGRACAO.md)](./INTEGRACAO.md)
Instruções técnicas para DevOps/Desenvolvedores sobre como plugar, renovar ou monitorar as chaves de API necessárias para o funcionamento do sistema.

---

## 🚀 Como Rodar o Projeto

1. **Instale as dependências:**
   ```bash
   pnpm install
   ```

2. **Configure o Banco de Dados e Chaves:**
   - Copie o arquivo `.env.example` para `.env`.
   - Adicione suas chaves (OpenAI, Apify, SerpAPI, Fogo Cruzado).
   - O projeto requer o MySQL rodando (ex: XAMPP).

3. **Inicie o Servidor Local:**
   ```bash
   pnpm dev
   ```

O painel Front-end estará disponível em `http://localhost:5000` (ou a porta configurada).
