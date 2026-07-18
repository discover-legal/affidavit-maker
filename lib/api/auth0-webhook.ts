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

export async function handleUserUpsert(
  user: Auth0User,
  eventTime: Date,
): Promise<NextResponse> {
  const now = new Date();
  const displayName = user.name ?? user.nickname ?? user.email;
  const verified = Boolean(user.email_verified);
  const result = await query<{ id: string }>(
    `INSERT INTO users
       (auth0_id, email, name, email_verified, created_at, updated_at, last_login, auth0_updated_at)
     VALUES ($1, $2, $3, $4, $5, $5, $5, $6)
     ON CONFLICT (auth0_id) DO UPDATE
       SET email = EXCLUDED.email,
           name = EXCLUDED.name,
           email_verified = EXCLUDED.email_verified,
           updated_at = EXCLUDED.updated_at,
           auth0_updated_at = EXCLUDED.auth0_updated_at
       WHERE users.auth0_updated_at IS NULL
          OR users.auth0_updated_at < EXCLUDED.auth0_updated_at
     RETURNING id`,
    [user.user_id, user.email, displayName, verified, now, eventTime],
  );

  return NextResponse.json({ success: true, ignored: result.rowCount === 0 });
}

export async function handleEmailUpdate(
  user: Auth0User,
  eventTime: Date,
): Promise<NextResponse> {
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
            updated_at = $3,
            auth0_updated_at = $4
      WHERE auth0_id = $5
        AND (auth0_updated_at IS NULL OR auth0_updated_at < $4)`,
    [user.email, Boolean(user.email_verified), new Date(), eventTime, user.user_id],
  );

  if (result.rowCount === 0) {
    logger.info('auth0_webhook_email_update_ignored', { auth0Id: user.user_id });
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
  handler: (user: Auth0User, eventTime: Date) => Promise<NextResponse>,
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

  const eventMs = typeof payload.updateTime === 'string' ? Date.parse(payload.updateTime) : NaN;
  if (!Number.isFinite(eventMs)) {
    return NextResponse.json(
      { success: false, error: 'Webhook updateTime is required' },
      { status: 400 },
    );
  }
  const now = Date.now();
  if (eventMs > now + 5 * 60 * 1000) {
    return NextResponse.json(
      { success: false, error: 'Webhook updateTime is in the future' },
      { status: 400 },
    );
  }
  // Reject captured pre-deployment payloads while allowing ordinary Auth0
  // retries. Return 200 so an old signed delivery is not retried forever.
  if (eventMs < now - 24 * 60 * 60 * 1000) {
    return NextResponse.json({ success: true, ignored: true, reason: 'stale_event' });
  }

  try {
    return await withRLSBypass(() => handler(user, new Date(eventMs)));
  } catch (err) {
    logger.error('auth0_webhook_processing_failed', { error: err });
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 },
    );
  }
}
