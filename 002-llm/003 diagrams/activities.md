# Diagrama de Atividades - Bolha Venda (Sales Bubble)

> 🎨 **Diagrama Interativo Archify**: [Visualizar Diagrama Interativo HTML (Archify)](file:///c:/Users/al_ja/OneDrive/Documents/work/Pessoal/IA/Vault/bolha-venda/002-llm/003%20diagrams/html/activities.html)

Este diagrama detalha as atividades do ciclo de vida de uma bolha no sistema.

```mermaid
stateDiagram-v2
    [*] --> Criacao: Usuário/Empresa define parâmetros
    Criacao --> Ativa: Publicada no Canvas
    
    state Ativa {
        [*] --> AguardandoParticipantes
        AguardandoParticipantes --> EntradaCotaPF: Usuário entra (Max 1)
        AguardandoParticipantes --> EntradaCotaPJ: Empresa entra (N cotas)
        AguardandoParticipantes --> SubmissaoLance: Empresa envia proposta C2B
        
        EntradaCotaPF --> RecalculoDesconto
        EntradaCotaPJ --> RecalculoDesconto
        SubmissaoLance --> RecalculoDesconto
        RecalculoDesconto --> AguardandoParticipantes
    }
    
    Ativa --> Expirada: Temporizador atinge 00:00:00 ou Cotas = 100%
    
    state Expirada {
        [*] --> DisparoNotificacoes
        DisparoNotificacoes --> BloqueioNovasCotas
    }
    
    Expirada --> EmTriagem: Abertura do Painel de Triagem
    
    state EmTriagem {
        [*] --> AnaliseAcordo
        AnaliseAcordo --> ConfirmacaoSucesso: Ambas as partes confirmam
        AnaliseAcordo --> DisputaRegistrada: Falha ou divergência
        DisputaRegistrada --> ModeracaoAdmin: Suporte intercede
        ModeracaoAdmin --> ConfirmacaoSucesso
    }
    
    EmTriagem --> Concluida: Atribuição de Score +
    EmTriagem --> Cancelada: Atribuição de Score -
    
    Concluida --> [*]
    Cancelada --> [*]
```
