import { NextRequest, NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AffidavitTypeRegistry = {
  getTypes: (stateCode: string | null, includeFamily: boolean) => unknown[];
};

function loadRegistry(): AffidavitTypeRegistry | null {
  try {
    return require('@/services/affidavits/AffidavitTypeRegistry') as AffidavitTypeRegistry;
  } catch {
    return null;
  }
}

/**
 * GET /api/templates/affidavit-types
 * Returns all available affidavit types, optionally filtered by ?state=TX
 * and ?includeFamily=true to include divorce_package.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = checkRateLimit('templates', ip, RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const state = req.nextUrl.searchParams.get('state');
    const includeFamily = req.nextUrl.searchParams.get('includeFamily');

    if (state && !/^[A-Za-z]{2}$/.test(state)) {
      throw new ValidationError('Invalid state code format.');
    }

    const registry = loadRegistry();
    if (!registry) {
      return NextResponse.json({ success: true, types: [], count: 0 });
    }

    const types = registry.getTypes(state || null, includeFamily === 'true');
    return NextResponse.json({ success: true, types, count: types.length });
  } catch (err) {
    return toErrorResponse(err);
  }
}
