import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
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
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('auth', user.id, RATE_LIMITS.auth);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    if (body.tosVersion !== TOS_VERSION) {
      throw new ValidationError('The current Terms of Service version must be accepted');
    }

    // Use the trusted-edge IP. The leftmost X-Forwarded-For is client-set
    // and would let users plant arbitrary values in their own audit row.
    const ip = getClientIp(req) ?? 'unknown';
    const userAgent = req.headers.get('user-agent') ?? 'unknown';

    await query(
      `UPDATE users
          SET tos_accepted = true,
              tos_accepted_at = NOW(),
              tos_version_accepted = $1,
              tos_ip_address = $2,
              research_consent = $3,
              research_consent_at = CASE WHEN $3 = true THEN NOW() ELSE NULL END,
              updated_at = NOW()
        WHERE id = $4`,
      [TOS_VERSION, ip, body.researchConsent, user.id],
    );

    await query(
      `INSERT INTO tos_acceptance_log
         (user_id, tos_version, ip_address, user_agent, research_consent, accepted_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, tos_version) DO UPDATE
         SET research_consent = EXCLUDED.research_consent,
             ip_address = EXCLUDED.ip_address,
             user_agent = EXCLUDED.user_agent,
             accepted_at = NOW()`,
      [user.id, TOS_VERSION, ip, userAgent, body.researchConsent],
    );

    logger.info('tos_accepted', {
      userId: user.id,
      tosVersion: TOS_VERSION,
      researchConsent: body.researchConsent,
    });

    return NextResponse.json({
      success: true,
      message: 'Terms of Service accepted',
      tosAccepted: true,
      tosVersion: TOS_VERSION,
      researchConsent: body.researchConsent,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}, { requireCurrentTos: false });
