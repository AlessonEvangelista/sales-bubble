# Governança e Boas Práticas - Bolha Venda (Sales Bubble)

Este documento estabelece as regras de governança, padrões de desenvolvimento, estratégia de ramificação no Git e fluxo de colaboração no projeto Bolha Venda.

---

## 1. Estratégia de Ramificação (Gitflow Adaptado)

O repositório adota uma versão simplificada e rigorosa do Gitflow:

- **`main`**: Branch de produção. Código sempre estável e pronto para deploy.
- **`develop`**: Branch de integração para novas funcionalidades.
- **`feature/<nome-da-feature>`**: Branches temporárias criadas a partir de `develop` para desenvolvimento de requisitos específicos.
  - Exemplo: `feature/canvas-zoom`, `feature/bubble-timer`.
- **`fix/<nome-do-bug>`**: Branches para correção de problemas.
- **`docs/<nome-da-doc>`**: Branches destinadas a atualizações da documentação em `002-llm`.

---

## 2. Padrões de Commit (Conventional Commits)

Todos os commits devem seguir a convenção de **Conventional Commits**:

```text
<tipo>(<escopo>): <descrição curta no imperativo>

[corpo opcional]
```

### Tipos Aceitos:
- **`feat`**: Nova funcionalidade no sistema.
- **`fix`**: Correção de bug.
- **`docs`**: Alterações exclusivamente em arquivos de documentação.
- **`style`**: Ajustes de formatação ou visual (sem alterar lógica).
- **`refactor`**: Reestruturação de código sem alteração funcional.
- **`test`**: Adição ou ajuste de testes.
- **`chore`**: Atualizações de tarefas de build, dependências ou configs.

### Exemplos:
- `feat(bubble): adiciona validação de limite de 1 cota por usuário`
- `docs(llm): cria documentação de viabilidade jurídica`
- `fix(canvas): corrige travamento de pan em telas touch`

---

## 3. Processo de Code Review e Pull Requests (PR)

1. Nenhum commit deve ser realizado diretamente na branch `main` ou `develop`.
2. Todo Pull Request exige:
   - Descrição clara da alteração realizada.
   - Referência à tarefa/requisito correspondente.
   - Aprovação de pelo menos 1 revisor.
   - Passagem com sucesso no pipeline de integração contínua (CI).

---

## 4. Política para a Pasta Read-Only `001-brain`

- A pasta `001-brain` é restrita para alterações.
- Qualquer alteração conceitual de produto deve ser debatida com o Product Owner antes de qualquer modificação nos arquivos de `001-brain`.
- Modificações técnicas ou adições de requisitos devem ser registradas exclusivamente em `002-llm`.

---

## 5. Registros de Log em `002-llm/001 log/`

Sempre que uma etapa significativa da arquitetura, documentação ou decisão de projeto for concluída, deve-se gerar um arquivo de log com o nome no formato:
`DD-MM-YYYY_HH-MM.md` (ou `DD-MM-YYYY HH-MM.md`).

O arquivo deve conter:
- Data e hora da atualização.
- Resumo executivo do que foi definido/desenvolvido.
- Lista de arquivos alterados ou criados.
- Próximos passos previstos.

---

## 6. Fluxo de Tarefas no Jira (desenvolvimento com múltiplas LLMs)

O board **BV** (Jira) é a fonte de verdade de quem está fazendo o quê. Como várias LLMs (Claude, Gemini, GPT etc.) podem trabalhar no projeto ao mesmo tempo, **toda LLM deve mover e marcar a tarefa no Jira antes de escrever qualquer código**.

### 6.1 Colunas do board

| Coluna | Significado |
| :--- | :--- |
| `tasks` | Backlog geral. Não pegar daqui sem pedido do usuário. |
| `sprintAtual` | Tarefas liberadas para a sprint corrente. **É daqui que a LLM pega trabalho.** |
| `working` | Em desenvolvimento por uma LLM identificada. |
| `teste` | Desenvolvimento concluído, aguardando validação por **outra** LLM. |
| `hitl` | Bloqueada aguardando o usuário (*human in the loop*). |
| `Feito` | Validada e integrada. |

### 6.2 Antes de iniciar o desenvolvimento (obrigatório)

1. Escolher uma tarefa em `sprintAtual` que **não** tenha label `llm-*` de outra LLM.
2. Mover a tarefa para `working`.
3. Marcar a tarefa:
   - adicionar a label `llm-<nome>` (ex.: `llm-claude`, `llm-gemini`, `llm-gpt`);
   - comentar: `[<nome-da-llm>] Iniciando — branch feature/<id>-<slug>`.
4. Só então criar a branch e começar a implementar.

Se a tarefa já estiver em `working` com label de outra LLM, ela está ocupada: **não mexer**, escolher outra.

### 6.3 Ao concluir o desenvolvimento

1. Abrir o PR referenciando a chave do Jira (ex.: `BV-100`).
2. Comentar na tarefa o resumo do que foi feito e o link do PR.
3. Mover a tarefa para `teste`.

### 6.4 Coluna `teste` — validação cruzada

- A coluna `teste` é **cruzada**: uma LLM só pega para testar tarefas desenvolvidas por **outra** LLM (label `llm-*` diferente da sua).
- Uma LLM **nunca** testa a própria tarefa, a não ser que o usuário peça explicitamente.
- Ao testar, comentar `[<nome-da-llm>] Testando` e adicionar a label `teste-<nome>`.
- Aprovado → comentar o resultado e mover para `Feito`.
- Reprovado → comentar os problemas encontrados e devolver para `working` (a LLM autora corrige).

### 6.5 Coluna `hitl` — bloqueios e pedidos ao usuário

- **Qualquer** bloqueio (credencial, acesso, decisão de produto, dúvida de requisito, dependência externa) ou qualquer solicitação ao usuário leva a tarefa para `hitl`.
- Ao mover, comentar obrigatoriamente:
  - `[<nome-da-llm>] HITL — <o que está bloqueando>`
  - **O que é necessário** do usuário, de forma objetiva (ex.: "token do Pagar.me sandbox no .env", "decidir entre opção A e B").
- A tarefa permanece em `hitl` **até o usuário desbloquear**. Nenhuma LLM retira tarefa de `hitl` por conta própria.
- Após o desbloqueio, o usuário (ou a LLM, por instrução dele) devolve a tarefa para `working` e o trabalho continua.
