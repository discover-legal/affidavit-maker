import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse } from '@/lib/api/errors';
import { getCurrentSession } from '@/lib/auth';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/validate/county
 *
 * Lightweight county-name validator. Optional auth — public/unauth callers
 * still get a result so unauthenticated users can pre-populate the editor.
 *
 * Accepts `{ county, state }` and returns `{ isValid, county, normalizedCounty,
 * confidence, reasoning }` matching the SPA's `useCountyValidation` shape.
 *
 * The legacy backend never had a dedicated route for this; CountyValidationInput
 * handled errors gracefully. We return a sensible normalized form (Title Case,
 * trimmed) and `confidence: 0.7` so the SPA accepts the input without nagging.
 */

const bodySchema = z.object({
  county: z.string().min(1).max(100),
  state: z.string().regex(/^[A-Za-z]{2}$/),
});

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    const sub = session?.user?.sub as string | undefined;
    const key = sub ? `auth:${sub}` : rateLimitKey(req, 'validate-county');
    const limit = await checkRateLimit('validate-county', key, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const trimmed = body.county.trim();
    const normalized = titleCase(trimmed.replace(/\bcounty\b/gi, '').trim());

    // `useCountyValidation` reads the result off `data.validation` (matches
    // the legacy shape). The earlier draft returned the fields at the top
    // level so the hook always read `undefined` and treated every county as
    // failed. Keep top-level fields too for any direct API consumer.
    if (!normalized || normalized.length < 2) {
      const validation = {
        isValid: false,
        county: trimmed,
        normalizedCounty: trimmed,
        confidence: 0,
        reasoning: 'County name appears empty or too short',
        suggestions: [],
      };
      return NextResponse.json({ success: true, validation, ...validation });
    }

    const validation = {
      isValid: true,
      county: trimmed,
      normalizedCounty: normalized,
      state: body.state.toUpperCase(),
      confidence: 0.85,
      reasoning: 'Accepted (deterministic normalization)',
      suggestions: [],
    };
    return NextResponse.json({ success: true, validation, ...validation });
  } catch (err) {
    return toErrorResponse(err);
  }
}
