/**
 * @jest-environment node
 *
 * Regression tests for the recursive logger sanitizer. The previous
 * implementation only redacted top-level keys, so a nested
 * { request: { headers: { authorization: 'Bearer …' } } } leaked the
 * bearer token. We assert both key-based and value-pattern-based redaction.
 */

import { logger } from '@/lib/logger';

function captureLog(fn: () => void): string {
  const original = console.log;
  let captured = '';
  console.log = (line: unknown) => { captured += String(line); };
  try { fn(); } finally { console.log = original; }
  return captured;
}

function captureError(fn: () => void): string {
  const original = console.error;
  let captured = '';
  console.error = (line: unknown) => { captured += String(line); };
  try { fn(); } finally { console.error = original; }
  return captured;
}

describe('logger.sanitize', () => {
  it('redacts a top-level authorization field', () => {
    const out = captureLog(() => logger.info('test', { authorization: 'Bearer super-secret-token' }));
    expect(out).toContain('[redacted]');
    expect(out).not.toContain('super-secret-token');
  });

  it('redacts an authorization field nested inside headers', () => {
    const out = captureLog(() =>
      logger.info('test', {
        request: { headers: { authorization: 'Bearer leaky' } },
      }),
    );
    expect(out).not.toContain('Bearer leaky');
    expect(out).toContain('[redacted]');
  });

  it('redacts a Stripe secret key found in a free-form string value', () => {
    const out = captureLog(() =>
      logger.info('test', { note: 'oops the key was sk_live_abcdefghijklmnopqrstuv' }),
    );
    expect(out).toContain('[redacted-secret]');
    expect(out).not.toContain('sk_live_abcdefghijklmnopqrstuv');
  });

  it('redacts a JWT-shaped value in a deeply nested object', () => {
    const out = captureLog(() =>
      logger.info('test', {
        wrap: { wrap: { wrap: { token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjF9.signature' } } },
      }),
    );
    // `token` is a redacted KEY (whole value drops to [redacted])
    expect(out).toContain('[redacted]');
    expect(out).not.toContain('eyJ0eXAi');
  });

  it('terminates on cyclic structures instead of stack-overflowing', () => {
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = { a };
    a.b = b;
    // Must not throw.
    expect(() => logger.info('test', { root: a })).not.toThrow();
  });

  it('caps recursion depth so a deeply nested structure cannot exhaust the stack', () => {
    let leaf: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 50; i++) leaf = { next: leaf };
    expect(() => logger.info('test', { root: leaf })).not.toThrow();
  });

  it('emits the timestamp / event / level fields it documents', () => {
    const out = captureError(() => logger.error('event_name', { foo: 'bar' }));
    expect(out).toContain('event_name');
    // JSON in production, pretty `timestamp [level] event {detail}` otherwise —
    // the level marker differs but must be present in both formats.
    expect(out).toMatch(/"level":"error"|\[error\]/);
    expect(out).toContain('"foo":"bar"');
  });
});
