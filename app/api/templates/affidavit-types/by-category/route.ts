import { NextRequest, NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AffidavitTypeRegistry = {
  getTypesByCategory: (stateCode: string | null) => Record<string, unknown[]>;
};

function loadRegistry(): AffidavitTypeRegistry | null {
  try {
    return require('@/services/affidavits/AffidavitTypeRegistry') as AffidavitTypeRegistry;
  } catch {
    return null;
  }
}

/**
 * GET /api/templates/affidavit-types/by-category
 * Returns all types grouped by category for the type-picker UI.
 * Optional ?state=TX to filter to state-applicable types.
 */
export async function GET(req: NextRequest) {
  const limit = await checkRateLimit('templates', rateLimitKey(req, 'templates'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const state = req.nextUrl.searchParams.get('state');

    if (state && !/^[A-Za-z]{2}$/.test(state)) {
      throw new ValidationError('Invalid state code format.');
    }

    const registry = loadRegistry();
    if (!registry) {
      return NextResponse.json({ success: true, categories: {} });
    }

    const categories = registry.getTypesByCategory(state || null);
    return NextResponse.json({ success: true, categories });
  } catch (err) {
    return toErrorResponse(err);
  }
}
