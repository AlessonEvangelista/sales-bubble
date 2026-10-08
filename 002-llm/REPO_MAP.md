# REPO_MAP — onde fica o quê (Bolha Venda / Sales Bubble)

> **Por quê este arquivo existe:** é a fonte única de verdade sobre repositório, branch, Jira e
> caminhos do projeto. Os demais docs (README, [PRD.MD](PRD.MD), [SPEC.md](SPEC.md),
> [002 Docs/](002%20Docs/)) devem linkar aqui em vez de repetir caminhos ou URLs.

## Repositório e rastreamento (2026-10-07)

| O quê | Valor |
|---|---|
| **GitHub** | [`AlessonEvangelista/sales-bubble`](https://github.com/AlessonEvangelista/sales-bubble) |
| **Branch principal** | `main` |
| **Jira** | [alessonevangelista.atlassian.net](https://alessonevangelista.atlassian.net) |
| **Projeto Jira** | `BV` (tickets `BV-###`) |
| **Variáveis/credenciais** | `003-project/.env` — `GITHUB_REPO`, `GITHUB_BRANCH`, `JIRA_DOMAIN`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `IRA_PROJECT_KEY` (nunca versionar; está no `.gitignore`) |

## Mapeamento de diretórios

Raiz local: `C:\Users\al_ja\OneDrive\Documents\work\Pessoal\IA\Vault\bolha-venda\`

| O quê | Caminho |
|---|---|
| **Visão de produto / conceito** (read-only) | `001-brain/` |
| **Documentação técnica** (este diretório) | `002-llm/` |
| ↳ PRD e SPEC | [PRD.MD](PRD.MD) · [SPEC.md](SPEC.md) |
| ↳ Docs por disciplina (negócio → operação) | [002 Docs/](002%20Docs/) (`01-negocio/` … `09-operacao/`) |
| ↳ Diagramas (classes, sequência, casos de uso, fluxos) | [003 diagrams/](003%20diagrams/) |
| ↳ Log de sessões | [001 log/](001%20log/) |
| **Código-fonte** | `003-project/` |
| ↳ Protótipo Gemini (HTML/JS estático) | `003-project/prototipacao-gemini/` |
| ↳ Protótipo Alter-Ego (telas HTML) | `003-project/prototipo-alterego/` |
| ↳ Monorepo planejado (ainda não criado) | `003-project/apps/{web,api}` · `003-project/packages/{core-domain,ui-components,database}` — ver [003-project/README.md](../003-project/README.md) |

---

## Regra de processo: consultar docs antes de implementar

**Toda alteração/implementação consulta primeiro os documentos deste diretório que têm relação
direta com a tarefa**, antes de tocar código em `003-project/`.

Para uma tarefa `BV-###`:

1. **Ler os requisitos** envolvidos no [PRD.MD](PRD.MD) e em
   [002 Docs/03-requisitos/](002%20Docs/03-requisitos/) — ler a definição completa, não só o número.
2. **Checar o [SPEC.md](SPEC.md)** e [002 Docs/05-arquitetura/](002%20Docs/05-arquitetura/) para
   confirmar em qual app/pacote a mudança cai (`web`, `api`, `core-domain`, `ui-components`,
   `database`).
3. **Checar os diagramas** relevantes em [003 diagrams/](003%20diagrams/) (sequência, classes,
   fluxos de uso).
4. **Checar design/estilo** em [002 Docs/04-design/](002%20Docs/04-design/) e
   [style-guide.md](002%20Docs/style-guide.md) quando a tarefa tocar UI/Canvas.
5. Se o código divergir da doc: o código é a verdade do *como*, o PRD é a verdade do *o quê* —
   anotar a divergência no log em [001 log/](001%20log/).

## Regra de processo: relacionar os docs no Jira ao abrir uma tarefa

Ao criar uma tarefa no projeto `BV`, o ticket deve linkar explicitamente os documentos
consultados no passo anterior:

- Requisito(s) do PRD / `03-requisitos` citados.
- Diagrama(s) de `003 diagrams/` aplicáveis.
- Seção do SPEC / doc de arquitetura que define o app/pacote afetado.
- Link para este arquivo quando houver dúvida sobre "em qual diretório/app isso entra".

## Fluxo Git por tarefa

`git pull` em `main` → branch `BV-###-descricao` → implementar → commit → push → PR para `main`
no [sales-bubble](https://github.com/AlessonEvangelista/sales-bubble) → merge.
