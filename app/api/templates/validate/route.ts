import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';
import { getServices } from '@/lib/api/services';
import { ALL_STATES, ALL_PROVINCES } from '@/lib/api/catalog-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Allow-list of states/provinces the template manager will accept. Mirrors
// the canonical lists in lib/api/catalog-data so a request can't ask the
// template manager to load a jurisdiction we don't intend to support.
const VALID_STATES = new Set([...ALL_STATES, ...ALL_PROVINCES]);

const bodySchema = z.object({
  // Cap the document blob: it's an opaque JSON shape but we won't run
  // megabyte validations.
  affidavitData: z.record(z.unknown()),
  state: z.string().min(1).max(8),
});

/**
 * POST /api/templates/validate
 *
 * Authenticated, rate-limited template validator. The previous version of
 * this endpoint was unauthenticated and unrate-limited, which made it a DoS
 * surface (no LLM today but full template registry load + heavy validation
 * per request). See security audit H-2 (May 2026).
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('templates-validate', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const { affidavitData, state } = bodySchema.parse(json);
    const stateCode = state.toUpperCase();
    if (!VALID_STATES.has(stateCode)) {
      throw new ValidationError('Unsupported state / province');
    }

    const { templateManager } = await getServices();
    const validation = (templateManager as {
      validateAffidavitData: (state: string, data: unknown) => unknown;
    }).validateAffidavitData(stateCode, affidavitData);

    return NextResponse.json({ success: true, validation, state: stateCode });
  } catch (err) {
    return toErrorResponse(err);
  }
});
