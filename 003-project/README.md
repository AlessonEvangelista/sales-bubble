# 💻 003-project - Ambiente de Desenvolvimento de Código-Fonte

Este diretório contém os códigos-fonte das aplicações web, serviços de backend e pacotes reutilizáveis do Bolha Venda.

---

## 🏗️ Estrutura do Monorepo

```text
003-project/
├── apps/
│   ├── web/        # Frontend em React / Next.js (Canvas Interativo)
│   └── api/        # Servidor Backend REST / WebSockets
└── packages/
    ├── core-domain/# Regras de negócio puras (Cotas, Explosão, Score)
    ├── ui-components/# Biblioteca de componentes visuais do Canvas
    └── database/   # Schemas, Migrations e ORM
```

---

## 🛠️ Instruções de Execução Local (Dev Setup)

1. Instalar as dependências do monorepo:
   ```bash
   npm install
   ```
2. Iniciar os serviços de suporte (PostgreSQL e Redis via Docker):
   ```bash
   docker-compose up -d
   ```
3. Executar o ambiente de desenvolvimento em paralelo:
   ```bash
   npm run dev
   ```
