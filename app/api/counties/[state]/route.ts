import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse, ValidationError } from '@/lib/api/errors';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/counties/[state]
 *
 * Returns a (curated) list of counties for the given state. Used by the SPA's
 * UnsupportedStateMessage and CountyValidationInput components for the
 * county dropdown.
 *
 * The legacy backend never persisted a per-state county list — clients fell
 * back to user free-text input on miss. We preserve that behavior here:
 * when we have a curated list we return it, otherwise we return an empty
 * array with `success: true` so the SPA degrades gracefully (CountyValidationInput
 * already handles empty lists).
 */

const STATE_CODE = /^[A-Za-z]{2}$/;

// Curated lists kept tight (services/courtNameService has the same coverage).
// Other states return an empty list and the client falls back to free text.
const COUNTIES: Record<string, string[]> = {
  AZ: [
    'Apache', 'Cochise', 'Coconino', 'Gila', 'Graham', 'Greenlee', 'La Paz',
    'Maricopa', 'Mohave', 'Navajo', 'Pima', 'Pinal', 'Santa Cruz', 'Yavapai', 'Yuma',
  ],
};

export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ state: string }> }) {
  const params = await paramsPromise;
  try {
    const limit = await checkRateLimit('counties', rateLimitKey(req, 'counties'), RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    if (!params.state || !STATE_CODE.test(params.state)) {
      throw new ValidationError('Invalid state code');
    }
    const state = params.state.toUpperCase();
    return NextResponse.json({
      success: true,
      state,
      counties: COUNTIES[state] ?? [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
