// Regras de fronteira entre pacotes do monorepo (BV-101 / EN-021).
//
// Fonte das regras:
// - guia de desenvolvimento §2.1 (tabela "pode importar / não pode importar") e §2.2 (grafo);
// - c4.md §4.3 (domínio sem dependências para fora; módulos não acessam repositórios de outros);
// - ADR-0001 item 5 (fronteiras verificadas na CI) e pipeline-ci-cd.md §2 (gate "Fronteiras").
//
// Execução: `npm run lint:boundaries` (também incluído em `npm run lint`).
// Teste das próprias regras: `npm run test:boundaries` (fixtures em tools/boundaries/).
//
// Cada import de workspace pode aparecer de duas formas no grafo:
// - resolvido (pacote já compilado): caminho real, ex. `packages/database/dist/index.js`;
// - não resolvido (antes do build): o especificador, ex. `@bolha/database`.
// Os helpers abaixo casam as duas formas, então a regra vale com ou sem `dist/`.

/** @param {string} name nome da pasta em packages/ */
const pkg = (name) => `^(packages/${name}/|@bolha/${name}(/|$))`;

/** @param {string} lib dependência npm (resolvida em node_modules ou não resolvida) */
const npm = (lib) => `((^|/)node_modules/${lib}/|^${lib}(/|$))`;

const ANY_APP = '^(apps/|@bolha/(web|api|worker)(/|$))';
const TEST_FILE = '\\.(test|spec)\\.tsx?$';

/**
 * Bibliotecas puras que o core-domain pode importar (guia §2.1: "bibliotecas puras, ex.: uuid").
 * Ampliar esta lista exige revisão do tech lead no PR.
 */
const CORE_DOMAIN_ALLOWED_NPM = ['uuid'];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ---------------------------------------------------------------- gerais
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Ciclos de dependência são proibidos (entre pacotes e dentro deles).',
      from: {},
      to: { circular: true },
    },
    {
      name: 'packages-not-to-apps',
      severity: 'error',
      comment: 'Pacotes (packages/*) nunca importam aplicações (apps/*) — guia §2.1.',
      from: { path: '^packages/' },
      to: { path: ANY_APP },
    },
    {
      name: 'app-not-to-other-app',
      severity: 'error',
      comment:
        'Uma aplicação não importa outra (web, api e worker são processos distintos) — guia §2.1, pipeline §2.',
      from: { path: '^apps/([^/]+)/' },
      to: { path: ANY_APP, pathNot: '^apps/$1/' },
    },
    {
      name: 'no-relative-cross-workspace',
      severity: 'error',
      comment:
        'Entre workspaces, importe pelo nome do pacote (@bolha/...), nunca por caminho relativo.',
      from: { path: '^(apps|packages)/([^/]+)/' },
      to: {
        dependencyTypes: ['local'],
        // `@bolha/x` resolvido pelo tsconfig.depcruise.json também é "local", mas é "aliased".
        dependencyTypesNot: ['aliased'],
        path: '^(apps|packages)/',
        pathNot: '^$1/$2/',
      },
    },

    // ---------------------------------------------------------------- core-domain
    {
      name: 'core-domain-no-outward-deps',
      severity: 'error',
      comment:
        'core-domain só importa a si mesmo, @bolha/contracts (tipos) e bibliotecas puras da lista — c4 §4.3 (no-outward-deps), guia §2.1.',
      from: { path: '^packages/core-domain/', pathNot: TEST_FILE },
      to: {
        pathNot: [
          '^packages/core-domain/(?!node_modules/)',
          pkg('contracts'),
          ...CORE_DOMAIN_ALLOWED_NPM.map(npm),
        ],
      },
    },
    {
      name: 'core-domain-contracts-type-only',
      severity: 'error',
      comment:
        'core-domain usa @bolha/contracts somente como tipos: use `import type { ... }` — guia §2.1.',
      from: { path: '^packages/core-domain/', pathNot: TEST_FILE },
      to: { path: pkg('contracts'), dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'core-domain-context-public-api',
      severity: 'error',
      comment:
        'Dentro do core-domain, um bounded context só usa outro pelo index.ts público (ou por shared/) — guia §2.2.',
      from: { path: '^packages/core-domain/src/([^/]+)/' },
      to: {
        path: '^packages/core-domain/src/[^/]+/',
        pathNot: [
          '^packages/core-domain/src/$1/',
          '^packages/core-domain/src/shared/',
          '^packages/core-domain/src/[^/]+/index\\.ts$',
        ],
      },
    },

    // ---------------------------------------------------------------- contracts
    {
      name: 'contracts-only-zod',
      severity: 'error',
      comment: 'contracts não importa nenhum outro pacote do monorepo, só `zod` — guia §2.1.',
      from: { path: '^packages/contracts/', pathNot: TEST_FILE },
      to: { pathNot: ['^packages/contracts/(?!node_modules/)', npm('zod')] },
    },

    // ---------------------------------------------------------------- database
    {
      name: 'database-allowed-deps',
      severity: 'error',
      comment:
        'database importa core-domain, contracts e Prisma; nunca ui-components nem apps — guia §2.1.',
      from: { path: '^packages/database/' },
      to: { path: pkg('ui-components') },
    },
    {
      name: 'database-no-cross-context-repositories',
      severity: 'error',
      comment:
        'Adapters de um bounded context não chamam repositórios de outro (comunicação por caso de uso ou evento via outbox) — guia §2.2, c4 §4.3. shared/ e platform/ (outbox) são permitidos.',
      from: { path: '^packages/database/src/([^/]+)/' },
      to: {
        path: '^packages/database/src/[^/]+/',
        pathNot: [
          '^packages/database/src/$1/',
          '^packages/database/src/shared/',
          '^packages/database/src/platform/',
        ],
      },
    },

    // ---------------------------------------------------------------- ui-components
    {
      name: 'ui-components-only-contracts',
      severity: 'error',
      comment: 'ui-components importa apenas contracts entre os pacotes internos — guia §2.1.',
      from: { path: '^packages/ui-components/' },
      to: { path: `${pkg('core-domain')}|${pkg('database')}` },
    },

    // ---------------------------------------------------------------- apps
    {
      name: 'web-not-to-server-packages',
      severity: 'error',
      comment:
        'apps/web importa apenas contracts e ui-components; nunca core-domain nem database — guia §2.1.',
      from: { path: '^apps/web/' },
      to: { path: `${pkg('core-domain')}|${pkg('database')}` },
    },
    {
      name: 'web-observability-browser-only',
      severity: 'error',
      comment:
        'apps/web usa só a entrada pura de @bolha/observability (redaction); a parte Node (OTel SDK, pino, Sentry Node) é de api/worker — BV-108.',
      from: { path: '^apps/web/' },
      to: {
        path: [
          '^packages/observability/src/node/',
          '^packages/observability/dist/node/',
          '@bolha/observability/(node|telemetry)',
        ],
      },
    },
    {
      name: 'server-apps-not-to-ui-components',
      severity: 'error',
      comment:
        'apps/api e apps/worker importam todos os packages exceto ui-components — guia §2.1.',
      from: { path: '^apps/(api|worker)/' },
      to: { path: pkg('ui-components') },
    },
    {
      name: 'nest-module-public-api',
      severity: 'error',
      comment:
        'Um módulo NestJS (src/modules/<contexto>) só usa outro módulo pelo *.module.ts ou index.ts dele — guia §2.2/§6.',
      from: { path: '^apps/(api|worker)/src/modules/([^/]+)/' },
      to: {
        path: '^apps/$1/src/modules/[^/]+/',
        pathNot: [
          '^apps/$1/src/modules/$2/',
          '^apps/$1/src/modules/[^/]+/[^/]+\\.module\\.ts$',
          '^apps/$1/src/modules/[^/]+/index\\.ts$',
        ],
      },
    },
  ],

  options: {
    // Não usar `exclude` para node_modules/dist: isso apagaria do grafo justamente as arestas
    // que as regras precisam ver (ex.: core-domain -> @nestjs/common, web -> packages/database/dist).
    // Os pontos de partida são só as pastas `src/` (ver script `lint:boundaries`); o que está em
    // node_modules e nos artefatos de build aparece como destino, mas não é percorrido.
    doNotFollow: {
      path: [
        '(^|/)node_modules/',
        '(^|/)dist/',
        '(^|/)\\.next/',
        '(^|/)\\.turbo/',
        '(^|/)coverage/',
      ],
    },
    // Enxerga imports `import type` (necessário para core-domain-contracts-type-only).
    tsPreCompilationDeps: true,
    // Resolve `@bolha/*` para `packages/<nome>/src/index.ts` (relativo ao diretório de execução),
    // assim o resultado não depende de o build já ter gerado `dist/` e o `import type` é preservado.
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
      // Imports ESM com sufixo `.js` apontando para fontes `.ts` (NodeNext) já são resolvidos
      // nativamente pelo dependency-cruiser.
      extensions: ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
