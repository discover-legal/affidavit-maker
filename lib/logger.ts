/**
 * Structured logger. Emits one JSON line per event so Render's log viewer
 * (and any log shipper) can parse fields directly. Falls back to a pretty
 * single-line format in development.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('payment_intent_created', { userId, amount });
 *   logger.error('webhook_verify_failed', { error });
 *
 * Levels (lowest → highest): debug, info, warn, error. Set LOG_LEVEL env to
 * filter (default: 'info' in production, 'debug' in development).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): number {
  const env = (process.env.LOG_LEVEL || '').toLowerCase();
  if (env in LEVELS) return LEVELS[env as LogLevel];
  return process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;
}

const minLevel = resolveMinLevel();
const isProd = process.env.NODE_ENV === 'production';

function emit(level: LogLevel, event: string, data?: Record<string, unknown>): void {
  if (LEVELS[level] < minLevel) return;

  const record = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitize(data),
  };

  const line = isProd ? JSON.stringify(record) : prettyFormat(record);

  switch (level) {
    case 'error':
      console.error(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

/**
 * Strip / redact common sensitive fields. Defense in depth — callers should
 * not pass secrets in the first place, but this catches accidents.
 *
 * The walk is recursive (with depth + cycle protection) so a nested shape
 * like { request: { headers: { authorization: '…' } } } still gets its
 * `authorization` field scrubbed.
 */
const REDACT_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'session',
  'sessionid',
  'jwt',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'set-cookie',
  'stripe_secret_key',
  'stripe-signature',
  'auth0_secret',
  'auth0-signature',
  'client_secret',
  'webhook_secret',
  'database_url',
  'connectionstring',
  'private_key',
  'privatekey',
  // PII we generally don't need to log
  'ssn',
  'social_security',
  'tax_id',
  'credit_card',
  'card_number',
  'cvv',
  'cvc',
]);

// Strings that look like a secret regardless of key name — JWTs, Stripe
// keys, OpenAI keys, GitHub tokens, etc. Conservative; only redacts when
// the pattern is very specific to avoid mangling random strings.
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bsk_(test|live)_[0-9a-zA-Z]{20,}\b/g,                  // Stripe secret
  /\brk_(test|live)_[0-9a-zA-Z]{20,}\b/g,                  // Stripe restricted
  /\bwhsec_[0-9a-zA-Z]{20,}\b/g,                            // Stripe webhook
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,                             // OpenAI
  /\bghp_[A-Za-z0-9]{30,}\b/g,                              // GitHub PAT
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,                      // Slack
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, // JWT
];

const MAX_DEPTH = 8;

function redactString(value: string): string {
  let out = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    out = out.replace(pattern, '[redacted-secret]');
  }
  return out;
}

function sanitizeValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[max-depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      // stack omitted at warn/error sites would lose triage info; keep it
      // but pass through the same redactor.
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer?.(value as Buffer)) return `[buffer ${(value as Buffer).length}b]`;

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[cycle]';
    seen.add(value);
    return value.map((item) => sanitizeValue(item, seen, depth + 1));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[cycle]';
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(key.toLowerCase())) {
        out[key] = '[redacted]';
        continue;
      }
      out[key] = sanitizeValue(child, seen, depth + 1);
    }
    return out;
  }

  return String(value);
}

function sanitize(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const result = sanitizeValue(data, new WeakSet(), 0);
  return (result && typeof result === 'object' && !Array.isArray(result))
    ? (result as Record<string, unknown>)
    : { value: result };
}

function prettyFormat(record: Record<string, unknown>): string {
  const { level, event, timestamp, ...rest } = record;
  const tag = `[${level}]`;
  const detail = Object.keys(rest).length ? ' ' + JSON.stringify(rest) : '';
  return `${timestamp} ${tag} ${event}${detail}`;
}

export const logger = {
  debug: (event: string, data?: Record<string, unknown>) => emit('debug', event, data),
  info: (event: string, data?: Record<string, unknown>) => emit('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => emit('error', event, data),
};
