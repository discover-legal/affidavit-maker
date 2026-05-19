import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { query, withRLSBypass } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';

// Shared helpers for the Auth0 webhook routes. The Auth0 dashboard posts to
// two separate URLs (user-update and email-update); each Route Handler
// imports verifySignature + the matching handler from this module.

export type Auth0User = {
  user_id: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
};

export type Auth0WebhookBody = {
  user?: Auth0User;
  updateTime?: string;
};

/**
 * Auth0 IDs are: provider|userid (e.g., "auth0|123abc"). Validate to prevent
 * injection of arbitrary strings into queries / log fields.
 */
export function isValidAuth0Id(id: unknown): id is string {
  if (typeof id !== 'string' || id.length > 128) return false;
  return /^[a-z0-9-]+\|[a-zA-Z0-9_-]+$/.test(id);
}

export function constantTimeEqualsHex(a: string, b: string): boolean {
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

export type VerifyResult =
  | { ok: true; body: string }
  | { ok: false; status: number; error: string };

export async function verifySignature(req: NextRequest): Promise<VerifyResult> {
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

export async function handleUserUpsert(user: Auth0User): Promise<NextResponse> {
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

export async function handleEmailUpdate(user: Auth0User): Promise<NextResponse> {
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
    logger.warn('auth0_webhook_email_update_unknown_user', { auth0Id: user.user_id });
  }
  return NextResponse.json({ success: true });
}

/**
 * Shared request shell: verify HMAC, parse JSON, validate Auth0 ID, then hand
 * the user object to the per-event handler inside an RLS-bypass transaction
 * (webhooks are system operations writing across users).
 */
export async function processAuth0Webhook(
  req: NextRequest,
  handler: (user: Auth0User) => Promise<NextResponse>,
): Promise<NextResponse> {
  // Per-IP rate limit on the webhook surface. HMAC verification is the
  // primary control — but if AUTH0_WEBHOOK_SECRET ever leaks we want a
  // throttle that contains the blast radius. `auth` bucket: 10 / 15min.
  const limit = checkRateLimit('auth0-webhook', rateLimitKey(req, 'auth0-webhook'), RATE_LIMITS.auth);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

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

  try {
    return await withRLSBypass(() => handler(user));
  } catch (err) {
    logger.error('auth0_webhook_processing_failed', { error: err });
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 },
    );
  }
}
