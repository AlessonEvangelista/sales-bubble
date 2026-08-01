# Fluxo do Usuário (Use Flows) - Bolha Venda (Sales Bubble)

> 🎨 **Diagrama Interativo Archify**: [Visualizar Diagrama Interativo HTML (Archify)](file:///c:/Users/al_ja/OneDrive/Documents/work/Pessoal/IA/Vault/bolha-venda/002-llm/003%20diagrams/html/use-flows.html)

Este diagrama representa a jornada do usuário navegando no canvas até o encerramento da bolha e triagem.

```mermaid
flowchart TD
    Start([Início / Acesso à Plataforma]) --> Canvas[Visualizar Canvas Interativo com Bolhas]
    
    Canvas --> Choice{Ação Desejada}
    
    %% Fluxo de Navegação e Compra de Cota
    Choice -->|Explorar Canvas| Navigate[Pan / Zoom no Canvas]
    Navigate --> ClickBubble[Clicar na Bolha de Interesse]
    ClickBubble --> ModalDetails[Abrir Drawer de Detalhes da Bolha]
    
    ModalDetails --> CheckUserType{Tipo de Conta?}
    CheckUserType -->|PF| RulePF[Permitir apenas 1 Cota]
    CheckUserType -->|PJ| RulePJ[Permitir N Cotas]
    
    RulePF --> ConfirmQuota[Confirmar Entrada na Cota]
    RulePJ --> ConfirmQuota
    
    ConfirmQuota --> UpdateCanvas[Atualizar Progresso no Canvas via WebSocket]
    
    %% Fluxo de Criação de Bolha
    Choice -->|Criar Nova Bolha| CreateBubbleType{Qual Tipo?}
    CreateBubbleType -->|Empresa: Venda| FormSale[Preencher Lote, Preços e Expiração]
    CreateBubbleType -->|Usuário: Compra| FormPurchase[Preencher Demanda e Fornecedores]
    
    FormSale --> PublishBubble[Publicar Bolha no Canvas]
    FormPurchase --> PublishBubble
    PublishBubble --> Canvas
    
    %% Fluxo de Expiração e Triagem
    UpdateCanvas --> TimerCheck{Tempo Expirou ou Cotas 100%?}
    TimerCheck -->|Não| Canvas
    TimerCheck -->|Sim| Explode[💥 Explosão da Bolha / Encerramento]
    
    Explode --> TriagePhase[Início da Fase de Triagem]
    TriagePhase --> ConfirmFulfillment[Criador e Compradores confirmam cumprimento]
    ConfirmFulfillment --> ScoreUpdate[Atualização Recíproca do Score de Confiabilidade]
    ScoreUpdate --> End([Fim do Ciclo])
```
