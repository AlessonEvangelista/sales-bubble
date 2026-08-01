# Stack Tecnológica - Bolha Venda (Sales Bubble)

Este documento descreve as tecnologias escolhidas para o desenvolvimento da plataforma Bolha Venda, justificando as escolhas com base nos requisitos funcionais e não-funcionais.

---

## 1. Visão Geral da Stack

| Camada | Tecnologia Principal | Bibliotecas Complementares | Justificativa |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | **React / Next.js** | Tailwind CSS, Framer Motion, HTML5 Canvas / PixiJS | Suporte a renderização de alto desempenho para o Canvas com pan/zoom fluídos e suporte a SSR. |
| **Canvas Interativo** | **PixiJS ou React Flow / Canvas API** | `@use-gesture/react` | Altissima performance gráfica (WebGL/Canvas 2D) para navegar por centenas de bolhas a 60 FPS. |
| **Backend API** | **Node.js (TypeScript)** ou **FastAPI** | Express / NestJS ou FastAPI | I/O assíncrono de alto rendimento, gerenciamento eficiente de eventos em tempo real. |
| **Comunicação Real-time** | **WebSockets (Socket.io)** | Server-Sent Events (SSE) | Atualização instantânea do progresso das bolhas, tempo restante e entrada de novas cotas no canvas. |
| **Banco de Dados Relacional** | **PostgreSQL** | Prisma ORM / Drizzle ORM | Consistência ACID rigorosa para controle de cotas, transações financeiras e perfis. |
| **Cache & In-Memory Storage** | **Redis** | BullMQ / Redis PubSub | Armazenamento de temporizadores de explosão de bolhas e controle de concorrência de cotas. |
| **Infraestrutura & DevOps** | **Docker & Docker Compose** | GitHub Actions, Vercel / Railway | Conteinerização para garantir paridade entre ambientes de dev, staging e produção. |

---

## 2. Detalhamento por Camada

### 2.1 Frontend & Canvas Engine
- **Next.js (App Router)**: Framework React para roteamento otimizado, SEO e rendering híbrido.
- **Engine de Canvas (PixiJS / WebGL)**:
  - As bolhas no canvas não são elementos DOM tradicionais pesados, mas sim sprites WebGL/Canvas 2D de alta taxa de quadros.
  - Permite interações de zoom infinito, pan suave com arraste de mouse/touch e física de bolhas.
- **Framer Motion & Vanilla/Tailwind CSS**:
  - Para modais, gavetas laterais de detalhes da bolha e interface de triagem fora da área de canvas.

### 2.2 Backend & Micro-serviços
- **Node.js + NestJS/Express (TypeScript)**:
  - Tipagem estática fim a fim compartilhada com o Frontend.
  - Arquitetura baseada em módulos (Auth, BubbleService, QuotaService, TriageService, ScoreService).
- **Socket.io / WebSockets**:
  - Broadcast de alterações no estado visual das bolhas para todos os clientes conectados na mesma região do canvas.

### 2.3 Banco de Dados e Cache
- **PostgreSQL**:
  - Tabelas principais: `users`, `companies`, `bubbles`, `quotas`, `bids`, `triages`, `scores`.
  - Transações com isolamento `SERIALIZABLE` para evitar race conditions na última cota de uma bolha.
- **Redis & BullMQ**:
  - Gerenciamento dos temporizadores de explosão das bolhas (`scheduled jobs`).
  - Quando o job do Redis dispara ao atingir 0s, a bolha muda de estado para `EXPIRED` e a etapa de triagem é iniciada.

---

## 3. Ferramentas de Qualidade e Desenvolvimento
- **TypeScript**: Garantia de segurança de tipos.
- **ESLint & Prettier**: Padronização de código.
- **Vitest / Jest**: Testes unitários para regras de domínio (cálculo de descontos, limites de cotas e score).
- **Playwright**: Testes end-to-end do fluxo de navegação no canvas e entrada de cotas.
