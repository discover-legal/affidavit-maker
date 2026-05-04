import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { query } from '@/lib/db';

// Auth0 webhook: handles user create/update events. Verifies the
// `auth0-signature` header (HMAC-SHA256 of the raw request body keyed by
// AUTH0_WEBHOOK_SECRET) before doing anything.

export const runtime = 'nodejs';

type Auth0WebhookEvent = 'user-update' | 'email-update';

type Auth0User = {
  user_id: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
};

type Auth0WebhookBody = {
  user?: Auth0User;
  updateTime?: string;
  event?: Auth0WebhookEvent;
};

/**
 * Auth0 IDs are: provider|userid (e.g., "auth0|123abc"). Validate to prevent
 * injection of arbitrary strings into queries / log fields.
 */
function isValidAuth0Id(id: unknown): id is string {
  if (typeof id !== 'string' || id.length > 128) return false;
  return /^[a-z0-9-]+\|[a-zA-Z0-9_-]+$/.test(id);
}

function constantTimeEqualsHex(a: string, b: string): boolean {
  let aBuf: Buffer;
  let bBuf: Buffer;
  try {
    aBuf = Buffer.from(a, 'hex');
    bBuf = Buffer.from(b, 'hex');
  } catch {
    return false;
  }
  if (aBuf.length === 0 || aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function verifySignature(req: NextRequest): Promise<{ ok: true; body: string } | { ok: false; status: number; error: string }> {
  const secret = process.env.AUTH0_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[auth0-webhook] AUTH0_WEBHOOK_SECRET not configured');
    return { ok: false, status: 500, error: 'Webhook verification not configured' };
  }

  const signature = req.headers.get('auth0-signature');
  if (!signature) {
    return { ok: false, status: 401, error: 'Missing signature' };
  }

  const body = await req.text();
  if (!body) {
    return { ok: false, status: 400, error: 'Invalid request - empty body' };
  }

  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  if (!constantTimeEqualsHex(signature, expected)) {
    return { ok: false, status: 401, error: 'Invalid signature' };
  }
  return { ok: true, body };
}

async function handleUserUpsert(user: Auth0User): Promise<NextResponse> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE auth0_id = $1',
    [user.user_id],
  );

  const now = new Date();
  const displayName = user.name ?? user.nickname ?? user.email;
  const verified = Boolean(user.email_verified);

  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO users (auth0_id, email, name, email_verified, created_at, updated_at, last_login)
       VALUES ($1, $2, $3, $4, $5, $5, $5)`,
      [user.user_id, user.email, displayName, verified, now],
    );
  } else {
    await query(
      `UPDATE users
         SET email = $1,
             name = $2,
             email_verified = $3,
             updated_at = $4
       WHERE auth0_id = $5`,
      [user.email, displayName, verified, now, user.user_id],
    );
  }

  return NextResponse.json({ success: true });
}

async function handleEmailUpdate(user: Auth0User): Promise<NextResponse> {
  if (!user.email) {
    return NextResponse.json(
      { success: false, error: 'Invalid webhook payload' },
      { status: 400 },
    );
  }

  const result = await query(
    `UPDATE users
        SET email = $1,
            email_verified = $2,
            updated_at = $3
      WHERE auth0_id = $4`,
    [user.email, Boolean(user.email_verified), new Date(), user.user_id],
  );

  if (result.rowCount === 0) {
    console.warn('[auth0-webhook] email-update for unknown user', { auth0Id: user.user_id });
  }
  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const verification = await verifySignature(req);
  if (!verification.ok) {
    return NextResponse.json(
      { success: false, error: verification.error },
      { status: verification.status },
    );
  }

  let payload: Auth0WebhookBody;
  try {
    payload = JSON.parse(verification.body) as Auth0WebhookBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400 },
    );
  }

  const user = payload.user;
  if (!user || !isValidAuth0Id(user.user_id)) {
    return NextResponse.json(
      { success: false, error: 'Invalid webhook payload' },
      { status: 400 },
    );
  }

  // The original Express version split into two routes (/user-update and /email-update).
  // We collapse them into one and dispatch on payload.event for Auth0 Actions to call.
  // Default to user-update behavior to preserve existing webhook URLs.
  const event: Auth0WebhookEvent = payload.event === 'email-update' ? 'email-update' : 'user-update';

  try {
    if (event === 'email-update') {
      return await handleEmailUpdate(user);
    }
    return await handleUserUpsert(user);
  } catch (err) {
    console.error('[auth0-webhook] processing failed', err);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 },
    );
  }
}
