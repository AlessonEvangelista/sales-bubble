import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { FEATURE_FLAGS, FLAG_KEYS, isFlagKey, type FlagKey } from '@bolha/contracts';
import { clearFlag, createRedisFeatureFlags, setFlag } from './factory.js';
import type { FlagAuditEntry } from './store.js';

const USAGE = `Uso (a partir de 003-project/):
  npm run flags -- list
  npm run flags -- set <flag> on|off --by <quem> [--reason "<motivo>"]
  npm run flags -- clear <flag> --by <quem> [--reason "<motivo>"]
  npm run flags -- audit [--limit 20]

Kill switches: plano de release §3 (002-llm/002 Docs/09-operacao/plano-release.md).`;

function describe(entry: FlagAuditEntry): string {
  const state = (o: FlagAuditEntry['after']): string => (o ? (o.enabled ? 'on' : 'off') : '—');
  return `${entry.at}  ${entry.key}: ${state(entry.before)} → ${state(entry.after)}  por ${entry.actor}${
    entry.reason ? ` (${entry.reason})` : ''
  }`;
}

function requireKey(value: string | undefined): FlagKey {
  if (!value || !isFlagKey(value)) {
    throw new Error(`Flag desconhecida "${value ?? ''}". Válidas: ${FLAG_KEYS.join(', ')}.`);
  }
  return value;
}

/** CLI de on-call: altera kill switches sem deploy (efeito ≤ 10 s; pub/sub invalida na hora). */
async function main(): Promise<void> {
  const envFile = resolve(process.cwd(), '../../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      by: { type: 'string' },
      reason: { type: 'string' },
      limit: { type: 'string', default: '20' },
    },
  });
  const [command, rawKey, rawState] = positionals;
  if (!command || command === 'help') {
    console.log(USAGE);
    return;
  }

  const redisUrl = process.env['REDIS_URL'];
  if (!redisUrl) throw new Error('REDIS_URL não definida (ver 003-project/.env.example).');
  const handle = createRedisFeatureFlags({
    redisUrl,
    flagsDefaults: process.env['FLAGS_DEFAULTS'],
    onStoreError: (error) => {
      throw error;
    },
  });

  try {
    if (!(await handle.ready(5_000))) throw new Error('Redis inacessível em REDIS_URL.');
    const reason = values.reason ? { reason: values.reason } : {};
    switch (command) {
      case 'list': {
        const overrides = await handle.store.readAll();
        for (const key of FLAG_KEYS) {
          const value = await handle.flags.isEnabled(key);
          const override = overrides[key];
          const source = override
            ? `override por ${override.updatedBy} em ${override.updatedAt}`
            : 'padrão';
          const def = FEATURE_FLAGS[key];
          console.log(`${value ? 'on ' : 'off'}  ${key.padEnd(28)} [${def.kind}] ${source}`);
        }
        break;
      }
      case 'set': {
        const key = requireKey(rawKey);
        if (rawState !== 'on' && rawState !== 'off') throw new Error('Estado deve ser on ou off.');
        const entry = await setFlag(handle.store, {
          key,
          enabled: rawState === 'on',
          actor: values.by ?? '',
          ...reason,
        });
        console.log(describe(entry));
        break;
      }
      case 'clear': {
        const entry = await clearFlag(
          handle.store,
          requireKey(rawKey),
          values.by ?? '',
          values.reason,
        );
        console.log(describe(entry));
        break;
      }
      case 'audit': {
        for (const entry of await handle.store.history(Number(values.limit))) {
          console.log(describe(entry));
        }
        break;
      }
      default:
        console.log(USAGE);
        process.exitCode = 2;
    }
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => {
  console.error('[flags] falhou:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
