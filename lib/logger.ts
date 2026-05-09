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
 */
const REDACT_KEYS = new Set([
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'stripe_secret_key',
  'auth0_secret',
]);

function sanitize(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
      continue;
    }
    if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message };
      continue;
    }
    out[key] = value;
  }
  return out;
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
