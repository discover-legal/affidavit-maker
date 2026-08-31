import { NextResponse } from 'next/server';
import { MATTER_MAP, DOCS_BY_MATTER, SUPPORTED_STATES, getAllJurisdictions } from '@/lib/api/catalog-data';
import { NotFoundError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';

export async function GET(req: Request, { params: paramsPromise }: { params: Promise<{ code: string }> }) {
  const params = await paramsPromise;
  const limit = await checkRateLimit('catalog', rateLimitKey(req, 'catalog'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const matter = MATTER_MAP[params.code];
    if (!matter) {
      throw new NotFoundError(`Matter type "${params.code}" not found`);
    }
    const documents = DOCS_BY_MATTER[params.code] ?? [];
    const rawSupported = SUPPORTED_STATES[params.code] ?? getAllJurisdictions();
    // Cross-filter through the active-jurisdictions allowlist so
    // JURISDICTION_ALLOWLIST=ON,UT hides everything else on the matter card.
    const active = new Set(getAllJurisdictions());
    const supported_states = rawSupported.filter((s) => active.has(s));
    return NextResponse.json({
      success: true,
      data: { matter: { ...matter, documents, supported_states } },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
