import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse } from '@/lib/api/errors';
import { getCurrentSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  state: z.string().regex(/^[A-Za-z]{2}$/),
  counties: z.array(z.string().min(1).max(100)).min(1).max(100),
});

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
    .trim();
}

/**
 * POST /api/validate/counties/batch
 *
 * Validates a list of county names for a state in one call. Used by
 * `useCountyValidation` when the SPA prefetches counties for a dropdown.
 * Same normalization rules as POST /api/validate/county.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    const ipKey =
      (session?.user?.sub as string | undefined) ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'anonymous';
    const limit = checkRateLimit('validate-county-batch', ipKey, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const state = body.state.toUpperCase();

    const results = body.counties.map((raw) => {
      const trimmed = raw.trim();
      const normalized = titleCase(trimmed.replace(/\bcounty\b/gi, '').trim());
      if (!normalized || normalized.length < 2) {
        return {
          isValid: false,
          county: trimmed,
          normalizedCounty: trimmed,
          confidence: 0,
        };
      }
      return {
        isValid: true,
        county: trimmed,
        normalizedCounty: normalized,
        confidence: 0.85,
      };
    });

    return NextResponse.json({ success: true, state, results });
  } catch (err) {
    return toErrorResponse(err);
  }
}
