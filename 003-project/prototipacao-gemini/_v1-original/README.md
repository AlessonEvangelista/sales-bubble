# 🎨 Protótipo Hi-Fi Navegável — Bolha Venda (Gemini)

Protótipo interativo de alta fidelidade desenvolvido em conformidade rigorosa com o **PRD v2.1**, **Spec do Produto (F1–F10)**, **Guia de Estilo (Style Guide)**, **Arquitetura de Informação** e **Especificação de Telas (04-design)** para homologação no **Gate A (Sprint 0)**.

---

## 🚀 Como Executar

O protótipo é 100% autônomo (Zero-Install), podendo ser aberto diretamente em qualquer navegador moderno:

1. **Execução Direta:**
   - Dê um duplo-clique no arquivo `index.html` no Windows Explorer.
2. **Ou via Servidor Local (Recomendado):**
   ```bash
   # Opção 1: Node.js / npx
   npx serve .
   
   # Opção 2: Python
   python -m http.server 8080
   ```
   Acesse: `http://localhost:8080`

---

## 🗺️ Cobertura Completa de Telas & Fluxos

| Tela | Componente / Fluxo Implementado | Destaque Técnico |
| :--- | :--- | :--- |
| **T01** | **Canvas Infinito & Interativo** | Pan, zoom espacial (0.25x–2.2x), **LOD Dinâmico** (Macro, Médio, Micro), anel de progresso de cotas, gradientes oficiais (Venda `#3B82F6 → #8B5CF6`, Compra `#10B981 → #06B6D4` com contorno tracejado), minimapa em tempo real e física suave de flutuação. |
| **T02** | **Lista Alternativa Linear** | Alternância instantânea no header (`🗺 Canvas \| 📋 Lista`), ordenação por urgência, preço ou progresso, cards estruturados com conformidade de acessibilidade. |
| **T03 / T03b** | **Detalhe da Bolha (Drawer Desktop / Bottom Sheet)** | Galeria, cálculo "Se fechar agora", indicador de próximo degrau, **Escada de Degraus interativa**, marcador de meta mínima no anel, regras de reserva clara e aba de Lances para bolhas de compra. |
| **T12 / T12b** | **Entrar & Sair da Bolha** | Seleção de cotas (1 cota fixa PF vs. stepper PJ com teto), esclarecimento de pré-autorização/reserva, confirmação com desbloqueio e diálogo de saída com proteção de última hora. |
| **T12p** | **Pagamento Pix com Reserva** | QR Code gerado, copia-e-cola, contador regressivo de 15:00 (`min(15min, tempo_restante)`) e botão de simulação de confirmação bancária. |
| **T10** | **Criação de Bolha de Venda (Wizard 4 Passos)** | Formulário com cálculo de capacidade, meta e **Editor de Degraus com Curva SVG Interativa reativa** em tempo real, cálculo transparente de 6% de taxa e publicação direta no Canvas. |
| **T17** | **Triagem do Vendedor (Pós-Explosão)** | Dashboard de pedidos com abas por status (Aguardando Envio, Atrasados, Enviados, Casos), registro de código de rastreio e proteção de dados LGPD no endereço. |
| **T18 / T19 / T25** | **Triagem do Comprador** | Timeline vertical (Pago → Enviado → Entregue), transparência financeira (Reservado R$ 100 → Pago R$ 80 → Liberado R$ 20), ações de arrependimento e contestação. |
| **T20** | **Score de Reputação** | Régua visual 0–1000 com decaimento de 180 dias e histórico de eventos auditáveis. |

---

## 🎛️ Painel do Moderador (Barra Inferior para Testes de Usabilidade)

Na barra inferior fixa, foram disponibilizados atalhos para os moderadores do teste de usabilidade (S0):
- **Alternar Personas:** Carlos Silva (PF), TecnoLotes (PJ) e Juliana Rocha (Organizadora).
- **⚡ Cota Entrando (Live):** Simula um evento de WebSocket com incremento de cota e recálculo dinâmico da escada de preço.
- **💥 Simular Explosão:** Encerra a bolha selecionada no preço do degrau atual e libera o fluxo de triagem.
- **♿ Acessibilidade & Tema:** Alternador de movimento reduzido (elimina animações físicas) e Dark/Light mode.
