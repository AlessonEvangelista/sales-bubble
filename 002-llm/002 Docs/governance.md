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
