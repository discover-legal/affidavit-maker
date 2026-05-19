import { getSession, type Session } from '@auth0/nextjs-auth0';
import { query, withRLSBypass } from './db';

export type AppUser = {
  /** Internal numeric primary key (SERIAL). */
  id: number;
  auth0Id: string;
  email: string;
  name: string | null;
};

type UserRow = {
  id: number;
  auth0_id: string;
  email: string;
  name: string | null;
};

/** Read the Auth0 session for the current request (server components and route handlers). */
export async function getCurrentSession(): Promise<Session | null | undefined> {
  return getSession();
}

/**
 * Resolve the local DB row for the currently logged-in user. Auto-provisions a
 * row on first sign-in (the Auth0 webhook usually does this first, but this
 * handles the race where a user hits an authed endpoint before the webhook
 * fires). Idempotent under concurrent first-time logins thanks to the UNIQUE
 * constraint on users.auth0_id (migration 000_initial_schema.sql).
 *
 * Returns null when the request is unauthenticated.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSession();
  if (!session?.user?.sub) return null;

  const auth0Id = session.user.sub as string;
  if (!isPlausibleAuth0Id(auth0Id)) return null;
  const email = (session.user.email as string) ?? '';
  const name = (session.user.name as string) ?? (session.user.nickname as string) ?? email;

  // This runs BEFORE withRLSContext sets app.user_id, so any query against
  // a FORCE-RLS-protected `users` table would see zero rows / be rejected
  // on insert. The user upsert is a system-level operation (we're literally
  // identifying *which* user this request is), so it runs under
  // withRLSBypass — analogous to the Stripe / Auth0 webhook flow.
  //
  // The bypass is scoped to this transaction only (set_config is_local=true
  // inside withRLSBypass), so the handler that follows still gets a normal
  // user-scoped transaction.
  return withRLSBypass(async () => {
    const existing = await query<UserRow>(
      'SELECT id, auth0_id, email, name FROM users WHERE auth0_id = $1',
      [auth0Id],
    );

    if (existing.rows[0]) {
      const row = existing.rows[0];
      return { id: row.id, auth0Id: row.auth0_id, email: row.email, name: row.name };
    }

    // First-time provision (race with the Auth0 webhook is possible). ON CONFLICT
    // is safe because users.auth0_id is UNIQUE NOT NULL — see
    // migrations/000_initial_schema.sql line 13.
    const inserted = await query<UserRow>(
      `INSERT INTO users (auth0_id, email, name, email_verified, created_at, updated_at, last_login)
       VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
       ON CONFLICT (auth0_id) DO UPDATE SET last_login = NOW()
       RETURNING id, auth0_id, email, name`,
      [auth0Id, email, name, Boolean(session.user.email_verified)],
    );

    const row = inserted.rows[0];
    return { id: row.id, auth0Id: row.auth0_id, email: row.email, name: row.name };
  });
}

/**
 * Auth0 sub format is `<provider>|<id>` (or `<provider>|<external-id>|<sub>`
 * for some legacy connections). The provider piece is always lowercased
 * alphanumerics + hyphens; the id piece is alphanumerics/underscores/hyphens.
 * Reject anything else so a malformed session token can't reach the SQL
 * layer with `auth0_id` set to something exotic.
 */
function isPlausibleAuth0Id(value: string): boolean {
  if (typeof value !== 'string') return false;
  if (value.length < 3 || value.length > 128) return false;
  return /^[a-z0-9-]+\|[a-zA-Z0-9_|.@:-]+$/.test(value);
}

/** 401 helper for Route Handlers when there's no session. */
export function unauthorized() {
  return new Response(
    JSON.stringify({ success: false, error: 'Authentication required' }),
    { status: 401, headers: { 'content-type': 'application/json' } },
  );
}
