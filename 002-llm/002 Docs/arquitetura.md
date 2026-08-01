# Arquitetura do Sistema - Bolha Venda (Sales Bubble)

Este documento descreve a arquitetura lógica, os componentes do sistema, a infraestrutura e os fluxos de comunicação em tempo real da plataforma Bolha Venda.

---

## 1. Visão Geral da Arquitetura

A plataforma utiliza uma **Arquitetura Orientada a Eventos (Event-Driven Architecture)** combinada com um **Frontend Visual de Alto Desempenho** para gerenciar o estado dinâmico do canvas de bolhas e os temporizadores de expiração.

```text
[ Web Client / Mobile Browser ]
       |         ^
       | HTTP    | WebSockets (Socket.io)
       v         |
[ API Gateway / Load Balancer ]
       |
       +-----------------------+-----------------------+
       |                       |                       |
       v                       v                       v
[ Auth & User Service ]  [ Bubble Core Engine ]  [ Triage & Score Service ]
       |                       |                       |
       +-----------------------+-----------------------+
                               |
                   +-----------+-----------+
                   |                       |
                   v                       v
           [ PostgreSQL DB ]        [ Redis Cache & BullMQ ]
          (Persistência ACID)       (Timers & WS PubSub)
```

---

## 2. Componentes Principais

### 2.1 Frontend Visual (Canvas Interativo)
- **Viewport Controller**: Gerencia o zoom, pan e coordenadas virtuais do canvas ($X, Y, ZoomLevel$).
- **Spatial Grid Index (QuadTree)**: Divide a área do canvas em quadras para renderizar apenas as bolhas visíveis na tela do usuário (culling), otimizando a performance.
- **WebSocket Listener**: Recebe mutações em tempo real (ex: nova cota comprada, bolha prestes a explodir) e atualiza o estado local das bolhas sem recarregar a página.

### 2.2 Motor Core de Bolhas (Bubble Core Engine)
- **Bubble State Manager**: Controla a transição de estados da bolha:
  `DRAFT -> ACTIVE -> NEAR_FULL / EXPIRING -> EXPIRED (Exploded) -> IN_TRIAGE -> COMPLETED / CANCELLED`.
- **Cota Validator**: Aplica a regra de limite de 1 cota para PF (CPF) e N cotas para PJ (CNPJ).
- **Price Calculation Engine**: Recalcula dinamicamente o valor unitário da cota à medida que o volume de cotas preenchidas aumenta em direção ao preço alvo de desconto.

### 2.3 Sistema de Temporizadores e Explosão (Timer & Schedule Engine)
- Utiliza **Redis + BullMQ**.
- Ao criar uma bolha com expiração programada para $T_{final}$, um Job atrasado (Delayed Job) é agendado no Redis.
- Ao atingir o timestamp limite, o Worker consome o evento de expiração, executa a mudança atômica no banco de dados e envia um evento via WebSocket `BUBBLE_EXPLODED` para os clientes.

### 2.4 Módulo de Triagem e Reputação (Triage & Score Service)
- **Triage Manager**: Instancia a conversa/painel de validação entre o criador da bolha e cada um dos detentores de cotas.
- **Score Calculator**: Executa o algoritmo de pontuação baseado no histórico de transações bem-sucedidas, rapidez na entrega e cumprimento dos termos.

---

## 3. Estratégia de Persistência e Concorrência

Para garantir que a última cota de uma bolha não seja vendida simultaneamente para dois usuários diferentes:

1. **Lock Distribuído via Redis (Redlock)** ou **Isolamento de Transação no PostgreSQL** (`SELECT FOR UPDATE` na linha da bolha).
2. O contador de cotas disponíveis é decrementado atomicamente:
   ```sql
   UPDATE bubbles 
   SET current_quotas = current_quotas + 1 
   WHERE id = $1 AND current_quotas < max_quotas;
   ```
3. Se o número de linhas afetadas for 0, a requisição de cota é rejeitada com mensagem de "Cotas Esgotadas".
