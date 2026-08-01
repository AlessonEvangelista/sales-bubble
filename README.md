# 🫧 Bolha Venda (Sales Bubble)

> **A Evolução da Compra e Venda Coletiva Interativa**

O **Bolha Venda (Sales Bubble)** é uma plataforma inovadora de comércio eletrônico coletivo (B2B, B2C, C2B e C2C) baseada em uma interface visual de **Canvas Interativo (Whiteboard)**. 

No sistema, empresas e usuários criam "bolhas" de ofertas ou demandas com preços dinâmicos por cotas, onde participantes se unem em tempo real para destravar descontos progressivos antes que as bolhas "explodam" com o término do temporizador.

---

## 📁 Arquitetura do Repositório

O projeto é estruturado em três pilares fundamentais:

```text
bolha-venda/
├── 001-brain/      # 🧠 Visão de Produto e Conceito Inicial (Read-Only)
├── 002-llm/        # 📑 Documentação Técnica, Requisitos, Arquitetura e Diagramas
└── 003-project/    # 💻 Código-fonte de Desenvolvimento (Frontend, Backend, Packages)
```

- [🧠 Visão de Produto (001-brain)](file:///c:/Users/al_ja/OneDrive/Documents/work/Pessoal/IA/Vault/bolha-venda/001-brain/README.md)
- [📑 Documentação Técnica e Diagramas (002-llm)](file:///c:/Users/al_ja/OneDrive/Documents/work/Pessoal/IA/Vault/bolha-venda/002-llm/README.md)
- [💻 Guia do Desenvolvedor (003-project)](file:///c:/Users/al_ja/OneDrive/Documents/work/Pessoal/IA/Vault/bolha-venda/003-project/README.md)

---

## 🚀 Principais Funcionalidades do Ecossistema

1. **Canvas Visual Navegável**: Interface com Pan (arraste) e Zoom (escala) para visualizar bolhas em tempo real.
2. **Modelos Flexíveis (B2B / B2C / C2B / C2C)**:
   - **Bolhas de Venda**: Empresas ofertam lotes com desconto progressivo.
   - **Bolhas de Compra**: Usuários agrupam pedidos e atraem lances competitivos de fornecedores.
3. **Regras de Cotas Ajustadas**:
   - Pessoas Físicas (CPF): limite de **1 cota por bolha**.
   - Pessoas Jurídicas (CNPJ): compra de **múltiplas cotas**.
4. **Explosão por Temporizador**: Encerramento automático de bolhas gerenciado por Redis / Workers em tempo real.
5. **Triagem Pós-Encerramento e Score**: Processo de liquidação/confirmação e atribuição de Score de Confiabilidade para compradores e vendedores.

---

## 🔗 Repositório Oficial
- **GitHub**: [https://github.com/AlessonEvangelista/sales-bubble.git](https://github.com/AlessonEvangelista/sales-bubble.git)
