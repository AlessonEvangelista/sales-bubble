# Guia de Estilo e UI/UX (Style Guide) - Bolha Venda

Este documento estabelece as diretrizes de design, paleta de cores, tipografia e identidade visual para a interface da plataforma Bolha Venda.

---

## 1. Conceito Estético e Identidade

A interface do Bolha Venda é desenhada para ser **viva, fluida e visualmente estimulante**. 
Utiliza o conceito de **Glassmorphism (Vidro Fosco)** combinado com elementos orgânicos em forma de bolha que pulsam e reagem ao progresso das cotas e do tempo.

### Pilares Visuais:
- **Canvas Infinito**: Fundo limpo, neutro e minimalista com uma grade sutil.
- **Bolhas Dinâmicas**: Bolhas com brilhos internos, gradientes vibrantes e indicador circular de preenchimento de cotas.
- **Interatividade Tátil**: Feedback visual em hover, expansão ao clicar e física suave de flutuação.

---

## 2. Paleta de Cores (Design Tokens)

### 2.1 Cores Base do Canvas
- **Fundo do Canvas (Dark Mode)**: `#0B0F19` (Azul Profundo Noturno)
- **Fundo do Canvas (Light Mode)**: `#F8FAFC` (Cinza Névoa Suave)
- **Grade Guia (Grid Line)**: `rgba(255, 255, 255, 0.05)`

### 2.2 Cores Funcionais das Bolhas

| Tipo / Status da Bolha | Gradiente de Origem | Gradiente de Destino | Significado Visual |
| :--- | :--- | :--- | :--- |
| **Bolha de Venda (B2C/B2B)** | `#3B82F6` (Royal Blue) | `#8B5CF6` (Purple Neon) | Representa oferta criada por empresa com desconto. |
| **Bolha de Compra (C2B/C2C)** | `#10B981` (Emerald Green)| `#06B6D4` (Cyan Energy) | Representa intenção de compra criada por usuários. |
| **Bolha Próxima da Explosão**| `#F59E0B` (Amber Warning)| `#EF4444` (Coral Red) | Alerta que o tempo ou cotas estão prestes a esgotar. |
| **Bolha Encerrada (Explodida)**| `#64748B` (Slate Gray) | `#475569` (Dark Slate) | Bolha em fase de triagem. |

---

## 3. Tipografia

- **Fonte Principal (UI & Textos)**: `Inter`, `Roboto` ou `Outfit` (sans-serif moderna, altamente legível em telas e elementos gráficos).
- **Fonte Numérica (Valores & Contadores)**: `JetBrains Mono` ou `Space Grotesk` (ideal para temporizadores regressivos e contagem de cotas).

### Escala Tipográfica:
- **Título da Bolha**: `16px` / `Font-Weight: 600`
- **Preço Alvo / Desconto**: `20px` / `Font-Weight: 700`
- **Contador Regressivo**: `14px` / `Font-Weight: 500` (Monospaced)
- **Labels Secundários**: `12px` / `Font-Weight: 400`

---

## 4. Animações e Micro-interações

- **Hover sobre a Bolha**: Aumento de escala suave (`transform: scale(1.05)` em `200ms ease-out`) e ampliação da sombra fluorescente.
- **Entrada de Nova Cota**: Efeito de pulso aquático (onda circular de choque expandindo a partir do centro da bolha).
- **Explosão da Bolha (Encerramento)**: Animação de desintegração suave em partículas e transição para o estado de triagem.
