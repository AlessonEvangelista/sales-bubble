/**
 * Redaction de PII em logs, atributos de span e eventos de telemetria (ADR-0012 item 4;
 * slo-observabilidade.md §5; threat model TM-13 / SEC-05).
 *
 * Módulo PURO (sem dependências e sem APIs do Node): é usado pela api e pelo worker
 * (logger pino, processador de spans) e pode ser usado pelo `apps/web`. Duas camadas, sempre juntas:
 *
 * 1. **Por nome de campo** — qualquer chave sensível (e-mail, CPF, CNPJ, documento, telefone,
 *    nome, endereço, senha, tokens, Authorization, cookies, cartão, Idempotency-Key, segredos)
 *    tem o valor inteiro trocado por `[REDACTED]`, em qualquer profundidade.
 * 2. **Por padrão no texto** — e-mails, CPFs, CNPJs, telefones BR, JWTs e credenciais `Bearer`
 *    que escapem dentro de strings livres (mensagens de erro, URLs, stack traces) são mascarados.
 *
 * O que é permitido continua passando: UUIDs, pseudônimos, códigos de erro, estados, valores em
 * centavos, trace/span ids (slo-observabilidade.md §5, "Permitido").
 */

export const REDACTED = '[REDACTED]';

/**
 * Nomes (normalizados: minúsculas, sem `_`, `-`, `.`) cujo valor é sempre removido.
 * Casam por igualdade OU por sufixo (ex.: `customerEmail`, `user_cpf`, `x-api-key`).
 */
const SENSITIVE_KEY_SUFFIXES = [
  // Identificação pessoal (RNF03, ADR-0012 §1)
  'email',
  'emailenc',
  'cpf',
  'cnpj',
  'document',
  'documentnumber',
  'documentenc',
  'phone',
  'phonenumber',
  'phoneenc',
  'telefone',
  'celular',
  'fullname',
  'nome',
  'nameenc',
  'legalname',
  'address',
  'endereco',
  'shippingaddress',
  'shippingaddressenc',
  'zipcode',
  'cep',
  'birthdate',
  'ip',
  'ipaddress',
  'remoteaddress',
  'xforwardedfor',
  // Credenciais e segredos
  'password',
  'senha',
  'passwd',
  'secret',
  'clientsecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'pepper',
  'authorization',
  'proxyauthorization',
  'cookie',
  'cookies',
  'setcookie',
  'idempotencykey',
  'otp',
  // Dados de cartão (nunca trafegam pelo backend, mas por garantia)
  'card',
  'cardnumber',
  'cardholder',
  'cardholdername',
  'pan',
  'cvv',
  'cvc',
  'securitycode',
] as const;

/**
 * Substrings que tornam a chave sensível em qualquer posição (ex.: `passwordConfirmation`,
 * `x-refresh-token-hint`, `cardExpiry`). Mantidas curtas e inequívocas para não apagar
 * campos técnicos (ex.: `ip` NÃO entra aqui, senão apagaria `description`/`zip`).
 */
const SENSITIVE_KEY_FRAGMENTS = [
  'email',
  'cpf',
  'cnpj',
  'document',
  'phone',
  'password',
  'senha',
  'secret',
  'token',
  'cookie',
  'authorization',
  'telefone',
  'endereco',
  'card',
] as const;

/** Nomes técnicos que contêm um fragmento sensível mas não carregam PII. */
const SAFE_KEYS = new Set([
  'tokentype',
  'tokenexpiresin',
  'tokencount',
  'cardinality',
  'emailverified',
  'hascpf',
  'hascnpj',
]);

const SUFFIXES: readonly string[] = SENSITIVE_KEY_SUFFIXES;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** `true` se o valor associado a esta chave nunca pode ir para log/span. */
export function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (normalized.length === 0 || SAFE_KEYS.has(normalized)) return false;
  if (SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment))) return true;
  // Sufixo só conta em fronteira de palavra do nome original (ex.: `customerPhone`,
  // `user_cep`), para que `zip` em `gzip` ou `pan` em `company` não sejam apagados.
  return SUFFIXES.some(
    (suffix) =>
      normalized === suffix ||
      (normalized.endsWith(suffix) && endsWithWord(key, suffix.length, normalized)),
  );
}

/** A parte final de `key` que corresponde ao sufixo começa em maiúscula ou após separador. */
function endsWithWord(key: string, suffixLength: number, normalized: string): boolean {
  // Reconstrói o índice no nome original contando só caracteres alfanuméricos.
  let alnumSeen = 0;
  const target = normalized.length - suffixLength;
  for (let i = 0; i < key.length; i += 1) {
    const ch = key.charAt(i);
    if (!/[a-z0-9]/i.test(ch)) continue;
    if (alnumSeen === target) {
      const previous = key.charAt(i - 1);
      return /[^a-z0-9]/i.test(previous) || (/[A-Z]/.test(ch) && /[a-z0-9]/.test(previous));
    }
    alnumSeen += 1;
  }
  return false;
}

/**
 * Padrões de PII em texto livre. A ordem importa: tokens primeiro (contêm dígitos e pontos),
 * depois CNPJ (14 dígitos) antes de CPF (11) e telefone.
 */
const TEXT_PATTERNS: readonly { name: string; pattern: RegExp; replacement: string }[] = [
  // JWT (header.payload.signature em base64url, header começa com `eyJ`)
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g,
    replacement: REDACTED,
  },
  // Credencial em cabeçalho/URL: `Bearer xxx`, `Basic xxx`
  {
    name: 'bearer',
    pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    replacement: `$1 ${REDACTED}`,
  },
  // Parâmetros de query com nome sensível: `?token=...&email=...`
  {
    name: 'query-param',
    pattern:
      /([?&;](?:code|[a-z_]*?(?:email|cpf|cnpj|document|phone|telefone|password|senha|token|secret|api_?key)[a-z_]*)=)[^&#\s"']+/gi,
    replacement: `$1${REDACTED}`,
  },
  // E-mail
  {
    name: 'email',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    replacement: REDACTED,
  },
  // CNPJ formatado (00.000.000/0000-00) ou 14 dígitos isolados
  {
    name: 'cnpj',
    pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
    replacement: REDACTED,
  },
  // CPF formatado (000.000.000-00) ou 11 dígitos isolados
  {
    name: 'cpf',
    pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
    replacement: REDACTED,
  },
  // Telefone BR: +55 (11) 91234-5678, (11) 1234-5678, 11 91234-5678
  {
    name: 'phone',
    pattern: /(?:\+?55[\s-]?)?\(?\b\d{2}\)?[\s-]?9?\d{4}[\s-]\d{4}\b/g,
    replacement: REDACTED,
  },
];

/** Regex de detecção (sem substituição) usadas pelos testes de "não vaza" e pelo detector AL-21. */
export const PII_DETECTORS: Readonly<Record<'email' | 'cpf' | 'cnpj' | 'jwt', RegExp>> = {
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/,
  cpf: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/,
  cnpj: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/,
  jwt: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\./,
};

/** Lista os detectores de PII que casam com o texto (vazio = nada encontrado). */
export function findPii(text: string): string[] {
  return Object.entries(PII_DETECTORS)
    .filter(([, regex]) => regex.test(text))
    .map(([name]) => name);
}

/** Mascara e-mails, CPFs, CNPJs, telefones, JWTs e credenciais dentro de um texto livre. */
export function redactString(text: string): string {
  let result = text;
  for (const { pattern, replacement } of TEXT_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export interface RedactOptions {
  /** Profundidade máxima percorrida; abaixo dela o valor vira `[Truncated]`. */
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 12;

/**
 * Cópia profunda de `value` sem PII: chaves sensíveis viram `[REDACTED]` e strings passam por
 * {@link redactString}. Preserva números, booleanos, `null`, datas (ISO) e trata ciclos.
 * Erros viram `{ type, message, stack }` já mascarados.
 */
export function redactDeep<T>(value: T, options: RedactOptions = {}): T {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const seen = new WeakSet<object>();

  const walk = (current: unknown, depth: number): unknown => {
    if (typeof current === 'string') return redactString(current);
    if (current === null || typeof current !== 'object') return current;
    if (current instanceof Date) return current.toISOString();
    if (seen.has(current)) return '[Circular]';
    if (depth >= maxDepth) return '[Truncated]';
    seen.add(current);

    if (Array.isArray(current)) return current.map((item) => walk(item, depth + 1));

    const source: Record<string, unknown> =
      current instanceof Error
        ? {
            type: current.name,
            message: current.message,
            stack: current.stack,
            ...(current as unknown as Record<string, unknown>),
          }
        : (current as Record<string, unknown>);

    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      output[key] = isSensitiveKey(key) ? REDACTED : walk(item, depth + 1);
    }
    return output;
  };

  return walk(value, 0) as T;
}

/**
 * Atributos (span, métrica, evento) sem PII: mesma regra de {@link redactDeep}, aplicada
 * a um mapa plano de valores primitivos ou arrays de primitivos (modelo de atributos do OTel).
 */
export function redactAttributes<T extends Record<string, unknown>>(attributes: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (isSensitiveKey(key) || isSensitiveAttributeName(key)) {
      output[key] = REDACTED;
    } else if (typeof value === 'string') {
      output[key] = redactString(value);
    } else if (Array.isArray(value)) {
      output[key] = value.map((item: unknown) =>
        typeof item === 'string' ? redactString(item) : item,
      );
    } else {
      output[key] = value;
    }
  }
  return output as T;
}

/**
 * Atributos semânticos do OTel que carregam PII mesmo com nome "técnico":
 * cabeçalhos capturados (`http.request.header.authorization`), IP do cliente e user-agent
 * (slo-observabilidade.md §5: IP completo e user-agent completo são proibidos).
 */
function isSensitiveAttributeName(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    /^http\.(request|response)\.header\.(authorization|cookie|set-cookie|proxy-authorization|x-api-key|idempotency-key)$/.test(
      lower,
    ) ||
    lower === 'client.address' ||
    lower === 'net.peer.ip' ||
    lower === 'http.client_ip' ||
    lower === 'enduser.id' ||
    lower === 'user_agent.original' ||
    lower === 'http.user_agent'
  );
}
