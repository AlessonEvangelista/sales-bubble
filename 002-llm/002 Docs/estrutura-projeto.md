# Estrutura do Projeto - Bolha Venda (Sales Bubble)

Este documento define a organização de pastas e arquivos do ecossistema do repositório Bolha Venda.

---

## 1. Visão Geral da Árvore Raiz

O repositório é organizado em 3 diretórios fundamentais:

```text
sales-bubble/
├── README.md               # Documentação principal da raiz do repositório
├── 001-brain/              # Diretório READ-ONLY com o conceito e visão do produto
│   ├── README.md           # Guia de navegação do 001-brain
│   ├── 001 product.md      # Visão geral da evolução da compra coletiva
│   └── 002 concept.md      # Conceito operacional (B2B, B2C, C2B, C2C, canvas, cotas)
├── 002-llm/                # Documentação técnica, arquitetura, diagramas e logs
│   ├── README.md           # Índice e guia da documentação técnica
│   ├── 001 log/            # Histórico de decisões e alterações de documentação
│   │   └── DD-MM-YYYY_HH-MM.md
│   ├── 002 Docs/           # Especificações funcionais, técnicas, de governança e estilo
│   │   ├── mvp.md
│   │   ├── requirements.md
│   │   ├── estrutura-projeto.md
│   │   ├── tecnologias.md
│   │   ├── governance.md
│   │   ├── judicial-viability.md
│   │   ├── arquitetura.md
│   │   ├── planing-project.md
│   │   └── style-guide.md
│   └── 003 diagrams/       # Diagramas de arquitetura (Mermaid / MD)
│       ├── use-case.md
│       ├── class.md
│       ├── requirements.md
│       ├── use-flows.md
│       ├── activities.md
│       └── sequence.md
└── 003-project/            # Código fonte da aplicação (Frontend, Backend, Services)
    ├── README.md           # Guia de desenvolvimento e execução do software
    ├── apps/               # Aplicações principais
    │   ├── web/            # Frontend (React/Next.js Canvas Interface)
    │   └── api/            # Backend REST & WebSocket Server (Node.js/FastAPI)
    └── packages/           # Pacotes reutilizáveis e código compartilhado
        ├── core-domain/    # Regras de negócio puras (Bubble, Quota, Score)
        ├── ui-components/  # Design System e componentes visuais do canvas
        └── database/       # Migrations, schemas de banco e ORM
```

---

## 2. Descrição das Pastas Principais

### `001-brain` (Read-Only)
- Contém a ideia original, conceitos de mercado, premissas de negócio e visão estratégica.
- **Regra**: Arquivos nesta pasta não devem ser modificados durante a execução do desenvolvimento, funcionando como a "fonte única de verdade do produto".

### `002-llm` (Documentação e Engenharia de LLM)
- Contém todo o detalhamento técnico do projeto.
- Divide-se em:
  - `001 log`: Registro histórico temporal de mudanças e logs de sprint/prompting.
  - `002 Docs`: Documentos descritivos (Requisitos, Arquitetura, Estilo, Jurídico, MVP).
  - `003 diagrams`: Diagramas visuais em formato Mermaid.

### `003-project` (Código-Fonte de Desenvolvimento)
- Estruturado em padrão Monorepo para facilitar o compartilhamento de tipos de dados (TypeScript/Schemas) entre Frontend e Backend.
- `apps/web`: Aplicação web visual com Canvas interativo.
- `apps/api`: Servidor HTTP/WebSocket com serviços de temporizador e leilão/lances.
- `packages/core-domain`: Módulo encapsulado com as regras de fechamento de bolhas, limites de cotas e score de reputação.
