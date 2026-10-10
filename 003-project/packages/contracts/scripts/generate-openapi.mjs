#!/usr/bin/env node
/* global process, console, URL */
// Gera `packages/contracts/openapi.yaml` (OpenAPI 3.1) a partir dos schemas Zod e do
// registro `ROUTES` de @bolha/contracts (BV-111 / EN-031).
//
// Usa só `zod` (`z.toJSONSchema`, nativo no Zod 4 — JSON Schema 2020-12, o dialeto do
// OpenAPI 3.1) + `yaml` (devDependency, apenas para serializar). Roda sobre o `dist/`
// compilado, então o código de runtime do pacote continua dependendo só de `zod`.
//
// Uso:
//   node scripts/generate-openapi.mjs           # escreve openapi.yaml
//   node scripts/generate-openapi.mjs --check   # falha se o arquivo versionado estiver desatualizado
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { z } from 'zod';

const pkgDir = fileURLToPath(new URL('..', import.meta.url));
const outFile = `${pkgDir}openapi.yaml`;
const distEntry = new URL('../dist/index.js', import.meta.url);

if (!existsSync(fileURLToPath(distEntry))) {
  console.error('dist/ não encontrado — rode `npm run build --workspace @bolha/contracts` antes.');
  process.exit(2);
}

const c = await import(distEntry.href);

// ------------------------------------------------------------------ conversão Zod → JSON Schema

/** Componentes coletados: id → { input, output } (JSON Schema). */
const components = new Map();

/**
 * Converte um schema Zod e move os sub-schemas com `meta({ id })` para `components.schemas`.
 * Quando a forma de entrada difere da de saída (defaults/preprocess), o componente de
 * entrada recebe o sufixo `Input`.
 */
function toSchema(schema, io) {
  const raw = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io,
    unrepresentable: 'any',
    reused: 'inline',
    cycles: 'ref',
    metadata: z.globalRegistry,
  });
  // `#/$defs/X` → referência provisória por modo (entrada/saída), resolvida em finalizeRefs.
  const json = JSON.parse(
    JSON.stringify(raw).replaceAll('"#/$defs/', `"#/components/schemas/__${io}__`),
  );
  const defs = json.$defs ?? {};
  delete json.$defs;
  delete json.$schema;
  for (const [id, def] of Object.entries(defs)) {
    const entry = components.get(id) ?? {};
    entry[io] = def;
    components.set(id, entry);
  }
  const rootId = z.globalRegistry.get(schema)?.id;
  if (rootId && !json.$ref) {
    const entry = components.get(rootId) ?? {};
    entry[io] = json;
    components.set(rootId, entry);
    return { $ref: `#/components/schemas/__${io}__${rootId}` };
  }
  delete json.id;
  return json;
}

const stable = (v) => JSON.stringify(v);

/** Resolve os nomes finais dos componentes e reescreve os `$ref` provisórios. */
function finalizeRefs(doc) {
  const names = new Map(); // `__io__id` → nome final
  const schemas = {};
  for (const [id, entry] of [...components.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const { input, output } = entry;
    if (input && output && stable(stripIds(input)) !== stable(stripIds(output))) {
      names.set(`__input__${id}`, `${id}Input`);
      names.set(`__output__${id}`, id);
    } else {
      names.set(`__input__${id}`, id);
      names.set(`__output__${id}`, id);
    }
  }
  for (const [id, entry] of components) {
    for (const io of ['input', 'output']) {
      if (entry[io]) schemas[names.get(`__${io}__${id}`)] = stripIds(entry[io]);
    }
  }
  const rewrite = (node) => {
    if (Array.isArray(node)) return node.map(rewrite);
    if (node && typeof node === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/__')) {
          out[k] = `#/components/schemas/${names.get(v.slice('#/components/schemas/'.length))}`;
        } else {
          out[k] = rewrite(v);
        }
      }
      return out;
    }
    return node;
  };
  const sorted = Object.fromEntries(Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b)));
  return rewrite({ ...doc, components: { ...doc.components, schemas: sorted } });
}

function stripIds(node) {
  if (Array.isArray(node)) return node.map(stripIds);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) if (k !== 'id') out[k] = stripIds(v);
    return out;
  }
  return node;
}

// ------------------------------------------------------------------ parâmetros

/** Campos de um objeto (ou união de objetos) de query/params. */
function objectFields(schema) {
  const def = schema._zod.def;
  if (def.type === 'object') {
    return Object.entries(def.shape).map(([name, s]) => ({
      name,
      schema: s,
      required: !s.safeParse(undefined).success,
    }));
  }
  if (def.type === 'union') {
    const all = def.options.map(objectFields);
    const byName = new Map();
    for (const fields of all) {
      for (const f of fields) {
        const prev = byName.get(f.name);
        byName.set(f.name, prev ? { ...prev, required: prev.required && f.required } : f);
      }
    }
    for (const [name, f] of byName) {
      if (!all.every((fields) => fields.some((g) => g.name === name))) {
        byName.set(name, { ...f, required: false });
      }
    }
    return [...byName.values()];
  }
  throw new Error(`Query/params precisam ser objeto ou união de objetos (recebido ${def.type}).`);
}

function parameters(route) {
  const out = [];
  if (route.params) {
    for (const f of objectFields(route.params)) {
      out.push({ name: f.name, in: 'path', required: true, schema: toSchema(f.schema, 'output') });
    }
  }
  if (route.query) {
    for (const f of objectFields(route.query)) {
      const schema = toSchema(f.schema, 'output');
      const p = { name: f.name, in: 'query', required: f.required, schema };
      if (schema.type === 'array' || schema.anyOf?.some((s) => s.type === 'array')) {
        Object.assign(p, { style: 'form', explode: false });
      }
      out.push(p);
    }
  }
  if (route.idempotency) {
    out.push({
      $ref: `#/components/parameters/IdempotencyKey${route.idempotency === 'required' ? 'Required' : 'Optional'}`,
    });
  }
  if (route.ifMatch) out.push({ $ref: '#/components/parameters/IfMatch' });
  if (route.csrf) out.push({ $ref: '#/components/parameters/CsrfToken' });
  return out;
}

// ------------------------------------------------------------------ respostas

const PROBLEM_REF = { $ref: '#/components/schemas/ProblemDetails' };

function responses(route) {
  const out = {};
  for (const [status, r] of Object.entries(route.responses)) {
    out[status] = r.schema
      ? {
          description: r.description,
          content: { 'application/json': { schema: toSchema(r.schema, 'output') } },
        }
      : { description: r.description };
  }
  const byStatus = new Map();
  for (const code of route.errors) {
    const { status } = c.ERROR_CATALOG[code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }
  for (const [status, codes] of [...byStatus.entries()].sort(([a], [b]) => a - b)) {
    out[String(status)] = {
      description: `Erro (problem+json). Códigos: ${codes.join(', ')}`,
      'x-error-codes': codes,
      content: { [c.PROBLEM_JSON_MEDIA_TYPE]: { schema: PROBLEM_REF } },
    };
  }
  out.default = {
    description: 'Erro não previsto (INTERNAL_ERROR) ou de plataforma (SERVICE_UNAVAILABLE)',
    content: { [c.PROBLEM_JSON_MEDIA_TYPE]: { schema: PROBLEM_REF } },
  };
  return out;
}

const SECURITY = {
  public: [],
  gateway: [],
  'refresh-cookie': [{ refreshCookie: [] }],
};

// ------------------------------------------------------------------ documento

toSchema(c.ProblemDetails, 'output');
toSchema(
  c.ErrorCode.meta({
    id: 'ErrorCode',
    description: 'Catálogo de códigos (api-rest.md §1.4.1). Novos códigos são aditivos.',
  }),
  'output',
);

const paths = {};
for (const route of c.ROUTES) {
  const op = {
    operationId: route.operationId,
    tags: [route.tag],
    summary: route.summary,
    'x-auth': route.auth,
    security: SECURITY[route.auth] ?? [{ bearerAuth: [] }],
  };
  const params = parameters(route);
  if (params.length) op.parameters = params;
  if (route.body) {
    op.requestBody = {
      required: true,
      content: { 'application/json': { schema: toSchema(route.body, 'input') } },
    };
  }
  op.responses = responses(route);
  paths[route.path] = { ...(paths[route.path] ?? {}), [route.method]: op };
}

const doc = finalizeRefs({
  openapi: '3.1.0',
  info: {
    title: 'Bolha Venda API',
    version: c.CONTRACT_VERSION,
    description:
      'Contrato REST gerado de @bolha/contracts (Zod) — NÃO EDITE À MÃO: rode `npm run openapi --workspace @bolha/contracts`. Fonte normativa: 002-llm/002 Docs/05-arquitetura/api-rest.md.',
  },
  servers: [
    { url: 'https://api.bolhavenda.com.br/api/v1', description: 'Produção' },
    { url: 'https://api.staging.bolhavenda.com.br/api/v1', description: 'Staging' },
  ],
  tags: [
    { name: 'identity', description: 'Identidade e LGPD (F1)' },
    { name: 'bubbles', description: 'Bolhas e canvas (F2–F4)' },
    { name: 'quotas', description: 'Cotas (F5, F6)' },
    { name: 'payments', description: 'Pagamentos e repasses (F5)' },
    { name: 'bids', description: 'Lances C2B (F8)' },
    { name: 'notifications', description: 'Notificações (F11)' },
    { name: 'webhooks', description: 'Webhooks de provedores' },
  ],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: '__Host-bv_rt' },
    },
    parameters: {
      IdempotencyKeyRequired: {
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        description: 'UUID por intenção do usuário (api-rest §1.3).',
        schema: { type: 'string', format: 'uuid' },
      },
      IdempotencyKeyOptional: {
        name: 'Idempotency-Key',
        in: 'header',
        required: false,
        description: 'Recomendado (api-rest §1.3).',
        schema: { type: 'string', format: 'uuid' },
      },
      IfMatch: {
        name: 'If-Match',
        in: 'header',
        required: true,
        description: 'ETag "v{version}" (concorrência otimista).',
        schema: { type: 'string' },
      },
      CsrfToken: {
        name: 'X-CSRF-Token',
        in: 'header',
        required: true,
        description: 'Double-submit do cookie bv_csrf.',
        schema: { type: 'string' },
      },
    },
  },
});

const yaml =
  '# Arquivo GERADO por packages/contracts/scripts/generate-openapi.mjs — não edite à mão.\n' +
  stringify(doc, { lineWidth: 0, aliasDuplicateObjects: false, sortMapEntries: false });

if (process.argv.includes('--check')) {
  const current = existsSync(outFile) ? readFileSync(outFile, 'utf8').replaceAll('\r\n', '\n') : '';
  if (current !== yaml) {
    console.error(
      'openapi.yaml está desatualizado em relação aos schemas Zod.\n' +
        'Rode `npm run openapi --workspace @bolha/contracts` e commite o resultado.',
    );
    process.exit(1);
  }
  console.log('openapi.yaml em dia com os schemas.');
} else {
  writeFileSync(outFile, yaml);
  console.log(`openapi.yaml gerado (${Object.keys(paths).length} caminhos).`);
}
