import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withBasicAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { getClientIp } from '@/lib/util/clientIp';
import { TOS_VERSION } from '@/lib/content/termsOfService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  tosVersion: z.string().min(1).max(32),
  researchConsent: z.boolean().default(false),
});

/**
 * POST /api/auth/accept-tos
 *
 * Records the user's acceptance of the current Terms of Service. Updates the
 * `users` row + appends to the `tos_acceptance_log` audit table inside the
 * withAuth-managed transaction (rollbacks on error). Mirrors the legacy
 * routes/auth.js POST /accept-tos endpoint.
 */
export const POST = withBasicAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = await checkRateLimit('auth', user.id, RATE_LIMITS.auth);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    if (body.tosVersion !== TOS_VERSION) {
      throw new ValidationError('You must accept the current Terms of Service');
    }

    // Use the trusted-edge IP. The leftmost X-Forwarded-For is client-set
    // and would let users plant arbitrary values in their own audit row.
    const ip = getClientIp(req) ?? 'unknown';
    const userAgent = req.headers.get('user-agent') ?? 'unknown';

    // One statement makes the legal state and its audit record indivisible,
    // while retaining the short per-query RLS transaction used by withAuth.
    await query(
      `WITH accepted AS (
         UPDATE users
          SET tos_accepted = true,
              tos_accepted_at = NOW(),
              tos_version_accepted = $1,
              tos_ip_address = $2,
              research_consent = $3,
              research_consent_at = CASE WHEN $3 = true THEN NOW() ELSE NULL END,
              updated_at = NOW()
        WHERE id = $4
        RETURNING id
       )
       INSERT INTO tos_acceptance_log
         (user_id, tos_version, ip_address, user_agent, research_consent, accepted_at)
       SELECT id, $1, $2, $5, $3, NOW() FROM accepted
       ON CONFLICT (user_id, tos_version) DO UPDATE
         SET research_consent = EXCLUDED.research_consent,
             ip_address = EXCLUDED.ip_address,
             user_agent = EXCLUDED.user_agent,
             accepted_at = NOW()`,
      [body.tosVersion, ip, body.researchConsent, user.id, userAgent],
    );

    logger.info('tos_accepted', {
      userId: user.id,
      tosVersion: body.tosVersion,
      researchConsent: body.researchConsent,
    });

    return NextResponse.json({
      success: true,
      message: 'Terms of Service accepted',
      tosAccepted: true,
      tosVersion: body.tosVersion,
      researchConsent: body.researchConsent,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
