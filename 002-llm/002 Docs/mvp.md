# Produto Mínimo Viável (MVP) - Bolha Venda (Sales Bubble)

## 1. Visão Geral do MVP
O **Bolha Venda (Sales Bubble)** é uma plataforma inovadora de venda e compra coletiva interativa com suporte a múltiplos modelos de transação (**B2B, B2C, C2B, C2C**). 

A proposta central do MVP é validar o conceito de **"Bolhas de Oferta e Pedido"** navegáveis em um **canvas interativo (Whiteboard Visual)**, permitindo que compradores se unam em cotas para baratear produtos e que vendedores (empresas) ofereçam lotes de produtos com descontos progressivos ou deem lances em demandas agregadas por usuários.

---

## 2. Objetivos Principais do MVP
1. **Validar a Interface Visual de Bolhas**: Testar a usabilidade do canvas navegável (drag, hold, zoom) com bolhas interativas.
2. **Validar os Modelos de Venda e Compra Coletiva**:
   - **Bolha de Venda (Empresas -> Usuários/Empresas)**: Lote de produtos com preço inicial, preço-alvo de desconto e data/hora de encerramento ("explosão da bolha").
   - **Bolha de Compra/Pedido (Usuários/Empresas -> Vendedores)**: Agrupamento de intenção de compra com cotas para atrair lances de empresas fornecedoras.
3. **Mecanismo de Cotas**:
   - Pessoas físicas (usuários) podem adquirir no máximo **1 cota por bolha**.
   - Pessoas jurídicas (empresas) podem adquirir **múltiplas cotas por bolha**.
4. **Ciclo de Vida e Explosão da Bolha**:
   - Encerramento automático por temporizador pré-definido.
   - Disparo de notificações para participantes envolvidos.
5. **Etapa de Triagem e Sistema de Score/Reputação**:
   - Mecanismo pós-encerramento para confirmação do cumprimento dos acordos entre criador e compradores de cotas.
   - Cálculo de **Score de Confiabilidade** para usuários e empresas.

---

## 3. Escopo Funcional do MVP

### 3.1 Funcionalidades Incluídas (In-Scope)
- **Autenticação e Perfis**:
  - Cadastro e login para Usuário Comum (CPF) e Empresa (CNPJ).
- **Canvas Interativo de Bolhas**:
  - Tela infinita com zoom (scroll/pinch) e pan (clicar, segurar e arrastar).
  - Exibição visual de bolhas ativas, com diferenciação visual entre Venda e Compra.
- **Criação de Bolhas**:
  - **Bolha de Venda (B2C/B2B)**: Produto, imagem, preço inicial, preço de interesse (mínimo com desconto), quantidade total de cotas e temporizador de expiração.
  - **Bolha de Compra (C2B/C2C)**: Item desejado, quantidade de cotas necessárias, preço alvo e temporizador.
- **Participação em Cotas**:
  - Usuários: Entrada em 1 cota.
  - Empresas: Compra de N cotas.
- **Sistema de Lances para Empresas**:
  - Empresas podem visualizar bolhas de compra de usuários e submeter lances comerciais para suprir o pedido.
- **Encerramento e Explosão**:
  - Encerramento automático quando o tempo expira ou quando todas as cotas são atingidas.
- **Triagem e Validação Pós-Encerramento**:
  - Interface simples de confirmação do aceite e conclusão entre as partes.
- **Sistema de Score**:
  - Avaliação recíproca e atualização do Score do Usuário/Empresa após a triagem.

### 3.2 Fora do Escopo do MVP (Out-of-Scope)
- Gateway de pagamento com escrow completo integrado (o encerramento nesta fase pode ser liquidado internamente por confirmação manual ou link direto de checkout conforme triagem).
- Aplicativo móvel nativo (o MVP será web responsivo com suporte a toque).
- Integração profunda com sistemas ERP/WMS de grandes varejistas.

---

## 4. Métricas de Sucesso do MVP (KPIs)
- **Engajamento no Canvas**: Tempo médio de permanência navegando no canvas de bolhas.
- **Taxa de Conversão de Cotas**: Porcentagem de bolhas criadas que atingem o objetivo de cotas antes da explosão.
- **Participação B2B/C2B**: Número de lances submetidos por empresas em bolhas de compra de usuários.
- **Índice de Conclusão na Triagem**: Porcentagem de bolhas encerradas que finalizaram a triagem com score positivo.
