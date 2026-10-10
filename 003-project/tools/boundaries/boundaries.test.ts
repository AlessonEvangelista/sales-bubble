/**
 * Teste das regras de fronteira (BV-101): roda o dependency-cruiser com a configuração real
 * (`.dependency-cruiser.cjs`) sobre um monorepo de mentira em `fixtures/`, que contém de
 * propósito uma violação de cada regra, e confere que cada uma é detectada — e que os imports
 * permitidos passam.
 *
 * As fixtures são copiadas (com o `tsconfig.depcruise.json`) para um diretório temporário fora
 * do monorepo, para que os `@bolha/*` sejam resolvidos para o `src/` das próprias fixtures e não
 * para os pacotes reais.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface Violation {
  from: string;
  to: string;
  rule: { name: string; severity: string };
  cycle?: { name: string }[];
}

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..');
const configPath = join(projectRoot, '.dependency-cruiser.cjs');
const depcruiseBin = join(
  projectRoot,
  'node_modules',
  'dependency-cruiser',
  'bin',
  'dependency-cruiser.mjs',
);

let workDir: string;
let violations: Violation[];

function runDepcruise(cwd: string): Violation[] {
  const args = [
    depcruiseBin,
    '{apps,packages}/*/src',
    '--config',
    configPath,
    '--output-type',
    'json',
  ];
  let stdout: string;
  try {
    stdout = execFileSync(process.execPath, args, { cwd, encoding: 'utf8' });
  } catch (error) {
    // Com violações de severidade "error" o depcruise sai com código != 0, mas imprime o JSON.
    stdout = (error as { stdout: string }).stdout;
  }
  return (JSON.parse(stdout) as { summary: { violations: Violation[] } }).summary.violations;
}

/** `@bolha/x` pode aparecer como especificador (não resolvido) ou como `packages|apps/x/src/...`. */
const targetMatches = (actual: string, expected: string) => {
  const workspace = /^@bolha\/(.+)$/.exec(expected)?.[1];
  return (
    actual.includes(expected) ||
    (workspace !== undefined &&
      (actual.startsWith(`packages/${workspace}/`) || actual.startsWith(`apps/${workspace}/`)))
  );
};

const has = (rule: string, from: string, to?: string) =>
  violations.some(
    (v) =>
      v.rule.name === rule &&
      v.from.endsWith(from) &&
      (to === undefined || targetMatches(v.to, to)),
  );

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'bolha-boundaries-'));
  cpSync(join(here, 'fixtures'), workDir, { recursive: true });
  cpSync(join(projectRoot, 'tsconfig.depcruise.json'), join(workDir, 'tsconfig.depcruise.json'));
  violations = runDepcruise(workDir);
}, 120_000);

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('regras de fronteira entre pacotes (dependency-cruiser)', () => {
  it('core-domain não importa infraestrutura nem outros pacotes internos', () => {
    const file = 'packages/core-domain/src/bad-infra.ts';
    expect(has('core-domain-no-outward-deps', file, '@bolha/database')).toBe(true);
    expect(has('core-domain-no-outward-deps', file, '@nestjs/common')).toBe(true);
    expect(has('core-domain-no-outward-deps', file, 'fs')).toBe(true);
  });

  it('core-domain usa contracts só como tipo e pode usar bibliotecas puras permitidas', () => {
    expect(
      has('core-domain-contracts-type-only', 'packages/core-domain/src/bad-contracts-value.ts'),
    ).toBe(true);
    expect(violations.some((v) => v.from.endsWith('packages/core-domain/src/good.ts'))).toBe(false);
  });

  it('bounded contexts do core-domain se falam só pelo index.ts público', () => {
    const file = 'packages/core-domain/src/bubble/acquire-quota.ts';
    expect(has('core-domain-context-public-api', file, 'payment/internal')).toBe(true);
    expect(has('core-domain-context-public-api', file, 'payment/index')).toBe(false);
  });

  it('não há ciclos', () => {
    expect(has('no-circular', 'packages/core-domain/src/shared/a.ts')).toBe(true);
  });

  it('contracts não importa outros pacotes do monorepo', () => {
    expect(has('contracts-only-zod', 'packages/contracts/src/index.ts', '@bolha/core-domain')).toBe(
      true,
    );
  });

  it('database não importa apps nem ui-components, nem repositórios de outro contexto', () => {
    const index = 'packages/database/src/index.ts';
    expect(has('packages-not-to-apps', index, '@bolha/web')).toBe(true);
    expect(has('database-allowed-deps', index, '@bolha/ui-components')).toBe(true);
    expect(
      has(
        'database-no-cross-context-repositories',
        'packages/database/src/bubble/quota-repo.ts',
        'payment/payment-repo',
      ),
    ).toBe(true);
  });

  it('ui-components não importa core-domain', () => {
    expect(
      has('ui-components-only-contracts', 'packages/ui-components/src/index.ts', 'core-domain'),
    ).toBe(true);
  });

  it('web não importa pacotes de servidor, outros apps nem caminhos relativos de outro workspace', () => {
    const page = 'apps/web/src/page.ts';
    expect(has('web-not-to-server-packages', page, '@bolha/database')).toBe(true);
    expect(has('app-not-to-other-app', page, '@bolha/api')).toBe(true);
    expect(has('no-relative-cross-workspace', page, 'packages/contracts')).toBe(true);
    expect(has('web-observability-browser-only', page, 'observability/node')).toBe(true);
  });

  it('api não importa ui-components e módulos Nest se falam pela fachada', () => {
    expect(has('server-apps-not-to-ui-components', 'apps/api/src/main.ts')).toBe(true);
    const bubble = 'apps/api/src/modules/bubble/bubble.module.ts';
    expect(has('nest-module-public-api', bubble, 'payment.repository')).toBe(true);
    expect(has('nest-module-public-api', bubble, 'payment.module')).toBe(false);
  });

  it('a árvore real do monorepo respeita todas as regras', () => {
    expect(runDepcruise(projectRoot)).toEqual([]);
  }, 120_000);
});
