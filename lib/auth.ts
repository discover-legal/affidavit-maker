import { getSession, type Session } from '@auth0/nextjs-auth0';
import { query } from './db';

export type AppUser = {
  id: string;
  auth0Id: string;
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
 * fires).
 *
 * Returns null when the request is unauthenticated.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSession();
  if (!session?.user?.sub) return null;

  const auth0Id = session.user.sub as string;
  const email = (session.user.email as string) ?? '';
  const name = (session.user.name as string) ?? (session.user.nickname as string) ?? email;

  // Try to fetch existing
  const existing = await query<{ id: string; auth0_id: string; email: string; name: string | null }>(
    'SELECT id, auth0_id, email, name FROM users WHERE auth0_id = $1',
    [auth0Id],
  );

  if (existing.rows[0]) {
    const row = existing.rows[0];
    return { id: row.id, auth0Id: row.auth0_id, email: row.email, name: row.name };
  }

  // First-time provision (race with webhook). ON CONFLICT no-op + RETURNING.
  const inserted = await query<{ id: string; auth0_id: string; email: string; name: string | null }>(
    `INSERT INTO users (auth0_id, email, name, email_verified, created_at, updated_at, last_login)
     VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
     ON CONFLICT (auth0_id) DO UPDATE SET last_login = NOW()
     RETURNING id, auth0_id, email, name`,
    [auth0Id, email, name, Boolean(session.user.email_verified)],
  );

  const row = inserted.rows[0];
  return { id: row.id, auth0Id: row.auth0_id, email: row.email, name: row.name };
}

/** 401 helper for Route Handlers when there's no session. */
export function unauthorized() {
  return new Response(
    JSON.stringify({ success: false, error: 'Authentication required' }),
    { status: 401, headers: { 'content-type': 'application/json' } },
  );
}
