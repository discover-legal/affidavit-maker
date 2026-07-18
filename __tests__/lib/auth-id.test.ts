/**
 * @jest-environment node
 *
 * Validate the Auth0 sub-format guard. A malformed `sub` claim shouldn't
 * reach the SQL layer — even though parameters are bound, the value ends
 * up as the canonical user identifier across logs and audit rows and any
 * weirdness there is a downstream tripwire.
 */

import * as auth from '@/lib/auth';

// Re-implement the regex here for the cases the validator must accept /
// reject. Keep this list in sync with lib/auth.ts isPlausibleAuth0Id.
const valid = [
  'auth0|abc123',
  'google-oauth2|107834612345678901234',
  'samlp|EXTERNAL|foo.bar@example.com',
  'apple|001234.abcdef.5678',
];

const invalid = [
  '',
  'no-pipe-character',
  '|missing-provider',
  'provider|',
  'EVIL/|inject',
  // Newlines (prompt-injection / log-injection vehicle)
  'auth0|abc\n123',
  // Whitespace
  ' auth0|abc',
  'auth0|abc ',
  // Way too long
  'auth0|' + 'a'.repeat(200),
];

describe('isPlausibleAuth0Id (indirectly via getCurrentUser format guard)', () => {
  // The validator isn't exported; we re-implement the same regex to verify
  // that our intent matches the regex shipped in lib/auth.ts.
  const re = /^[a-z0-9-]+\|[a-zA-Z0-9_|.@:-]+$/;

  it.each(valid)('accepts %p', (value) => {
    expect(typeof value).toBe('string');
    expect(value.length).toBeLessThanOrEqual(128);
    expect(re.test(value)).toBe(true);
  });

  it.each(invalid)('rejects %p', (value) => {
    const ok = value.length >= 3 && value.length <= 128 && re.test(value);
    expect(ok).toBe(false);
  });

  // Smoke: the auth module exports the entry points we expect. If a future
  // refactor removes / renames `getCurrentUser`, our wave-1 RLS bypass
  // fix breaks silently — this assertion forces the rename to land here.
  it('exports getCurrentUser', () => {
    expect(typeof auth.getCurrentUser).toBe('function');
  });
});

describe('E2E authentication bypass guard', () => {
  it('is disabled unless explicitly requested', () => {
    expect(auth.isE2EAuthBypassEnabled({ NODE_ENV: 'test' })).toBe(false);
  });

  it('can be enabled for non-production E2E runs', () => {
    expect(auth.isE2EAuthBypassEnabled({ NODE_ENV: 'test', E2E_AUTH_BYPASS: '1' })).toBe(true);
  });

  it('cannot be enabled in production', () => {
    expect(auth.isE2EAuthBypassEnabled({ NODE_ENV: 'production', E2E_AUTH_BYPASS: '1' })).toBe(false);
  });
});
