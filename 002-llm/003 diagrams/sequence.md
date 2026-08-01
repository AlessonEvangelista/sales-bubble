# Diagrama de Sequência - Bolha Venda (Sales Bubble)

> 🎨 **Diagrama Interativo Archify**: [Visualizar Diagrama Interativo HTML (Archify)](file:///c:/Users/al_ja/OneDrive/Documents/work/Pessoal/IA/Vault/bolha-venda/002-llm/003%20diagrams/html/sequence.html)

Este diagrama ilustra a sequência de chamadas entre o Usuário/Empresa, Frontend Canvas, Servidor Backend, Redis Timer e Banco de Dados.

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as 👤/🏢 Cliente (Web)
    participant Canvas as 🎨 Frontend Canvas
    participant API as ⚙️ API Backend
    participant Redis as ⚡ Redis (Jobs & Lock)
    participant DB as 🗄️ PostgreSQL
    participant WS as 📡 WebSocket Server

    %% 1. Criação da Bolha
    Cliente->>Canvas: Criar Bolha (Venda/Compra)
    Canvas->>API: POST /api/v1/bubbles
    API->>DB: INSERT INTO bubbles (status='ACTIVE')
    API->>Redis: Schedule Delayed Job (Expiration Timer)
    API-->>Canvas: 201 Created (Bubble ID)
    API->>WS: Broadcast EVENT_BUBBLE_CREATED
    WS-->>Canvas: Renderizar nova bolha no Canvas

    %% 2. Adesão de Cotas
    Cliente->>Canvas: Clicar "Comprar 1 Cota"
    Canvas->>API: POST /api/v1/bubbles/{id}/quotas
    API->>Redis: Acquire Lock (Redlock)
    API->>DB: SELECT FOR UPDATE / Verify Quota Limit
    API->>DB: INSERT INTO quotas & UPDATE bubble.filled_quotas
    API->>Redis: Release Lock
    API-->>Canvas: 200 OK (Cota Confirmada)
    API->>WS: Broadcast EVENT_QUOTA_UPDATED
    WS-->>Canvas: Atualizar preenchimento visual no Canvas

    %% 3. Explosão por Temporizador
    Redis->>API: Trigger Expiration Job (Tempo 0s)
    API->>DB: UPDATE bubble SET status='IN_TRIAGE'
    API->>WS: Broadcast EVENT_BUBBLE_EXPLODED
    WS-->>Canvas: Animar Explosão & Exibir Notificação de Triagem

    %% 4. Triagem e Score
    Cliente->>API: POST /api/v1/triages/{id}/confirm
    API->>DB: UPDATE triages & Calculate User/Company Score
    API-->>Cliente: 200 OK (Score Atualizado)
```
