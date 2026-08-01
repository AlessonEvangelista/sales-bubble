# Mapa Mental de Requisitos - Bolha Venda (Sales Bubble)

> 🎨 **Diagrama Interativo Archify**: [Visualizar Diagrama Interativo HTML (Archify)](file:///c:/Users/al_ja/OneDrive/Documents/work/Pessoal/IA/Vault/bolha-venda/002-llm/003%20diagrams/html/requirements.html)

Este diagrama sintetiza o mapeamento de módulos e requisitos funcionais do ecossistema.

```mermaid
mindmap
  root((Bolha Venda))
    Navegacao Canvas
      Pan E Arraste
      Zoom In Out
      Grade Espacial
      Renderizacao Bolhas
    Gestao de Bolhas
      Bolha de Venda B2C B2B
        Preco Inicial Final
        Cotas Totais
        Temporizador Expiracao
      Bolha de Compra C2B C2C
        Intencao de Compra
        Indicacao de Fornecedores
    Regras de Cotas
      Usuario PF
        Limite 1 Cota por Bolha
      Empresa PJ
        Multiplas Cotas por Bolha
      Desconto Dinamico Progressivo
    Lances Comerciais
      Oferta de Empresas C2B
      Comparacao de Preco e Prazo
    Explosao e Encerramento
      Timer Redis Job
      Disparo WebSockets
      Bloqueio de Novas Cotas
    Triagem e Score
      Painel Pos Encerramento
      Confirmacao Reciproca
      Score de Reputacao
```
