# Planejamento do Projeto - Bolha Venda (Sales Bubble)

Este documento estabelece o cronograma de desenvolvimento, as fases de entrega e a matriz de riscos do projeto.

---

## 1. Cronograma Geral e Sprints (MVP)

O plano de entrega está dividido em **4 Sprints de 2 semanas**:

```text
Sprint 1: Fundações, Setup & Canvas Base
Sprint 2: Motor de Bolhas & Cotas (B2C / B2B)
Sprint 3: Lances C2B, Temporizadores & Explosão
Sprint 4: Triagem, Score & Polimento Final
```

### Sprint 1: Fundações & Canvas Visual (Semanas 1 e 2)
- Configuração do Monorepo (`003-project/apps/web`, `003-project/apps/api`).
- Autenticação e Perfis (PF / PJ).
- Desenvolvimento do Canvas 2D com Pan (drag) e Zoom (scroll/touch).
- Renderização visual das primeiras bolhas estáticas no canvas.

### Sprint 2: Motor de Bolhas & Gestão de Cotas (Semanas 3 e 4)
- Formulario de criação de Bolhas de Venda e Bolhas de Compra.
- Lógica de entrada em cotas (1 cota para PF, N cotas para PJ).
- Mecanismo de concorrência atômica no banco de dados.
- Recálculo dinâmico da curva de desconto.

### Sprint 3: Lances Comerciais, WebSockets & Explosão (Semanas 5 e 6)
- Módulo de lances de empresas para bolhas de compra de usuários.
- Integração do Redis + BullMQ para temporizadores de expiração.
- Transmissão de atualizações do canvas em tempo real via WebSockets (Socket.io).
- Notificações de explosão da bolha.

### Sprint 4: Triagem, Score de Reputação & Testes (Semanas 7 e 8)
- Interface visual pós-encerramento (Painel de Triagem).
- Formulário de confirmação de entrega/aceite e cálculo do Score.
- Testes automatizados de carga no canvas e concorrência de cotas.
- Deploy do ambiente Staging / Produção.

---

## 2. Matriz de Gestão de Riscos

| Risco Mapeado | Impacto | Probabilidade | Mitigação Proposta |
| :--- | :--- | :--- | :--- |
| **Lentidão na navegação do Canvas com centenas de bolhas** | Alto | Média | Uso de engine gráfica dedicada (PixiJS/WebGL) e Culling espacial (QuadTree) para renderizar apenas a área visível. |
| **Race Condition na compra da última cota disponível** | Alto | Média | Uso de transações com Lock pessimista (`SELECT FOR UPDATE`) ou contador atômico no Redis/PostgreSQL. |
| **Atraso na execução do temporizador de explosão** | Médio | Baixa | Agendador de tarefas resiliente com Redis/BullMQ e workers dedicados com redundância. |
| **Baixa adesão inicial de empresas no modelo C2B** | Médio | Média | Notificação direta e convites por indicação quando usuários marcarem fornecedores recomendados na bolha. |
