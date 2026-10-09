// Conventional Commits (governance.md §2), validado no CI (BV-103) e, futuramente, no hook do Husky.
// Tipos: os de governance.md §2 + os padrão do Conventional Commits usados em CI/CD e release
// (ci, build, perf, revert), necessários para o release-please (pipeline-ci-cd.md §7).
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'ci',
        'build',
        'perf',
        'revert',
      ],
    ],
    // Assuntos em pt-BR começam com a chave do Jira (ex.: "BV-103 ..."); não forçar caixa.
    'subject-case': [0],
  },
};
