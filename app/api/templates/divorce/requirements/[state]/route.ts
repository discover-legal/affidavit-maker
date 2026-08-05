import { NextRequest, NextResponse } from 'next/server';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getServices } from '@/lib/api/services';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupportedState = { code: string; name: string; requirements?: unknown };

type DivorceMetadata = {
  residencyRequirements?: unknown;
  waitingPeriod?: unknown;
  groundsForDivorce?: unknown;
  requiredForms?: unknown[];
  terminology?: Record<string, unknown>;
  fees?: unknown;
  specialRequirements?: unknown[];
  legalCitations?: unknown[];
};

type TemplateManagerLike = {
  getSupportedStates: () => SupportedState[];
  getDocumentTypes: (stateCode: string) => string[];
  getMetadata: (stateCode: string, documentType: string) => DivorceMetadata | null | undefined;
};

const SUPPORTED_DIVORCE_STATES =
  'TX, UT, AZ, CA, FL, IL, NY, CO, GA, MA, MI, NC, NJ, OH, PA, VA, WA, ON, BC, AB, QC, MB, NB, NL, NS, PE, SK';

/**
 * GET /api/templates/divorce/requirements/:state
 * Per-state divorce requirements (residency, waiting periods, grounds, etc.).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { state: string } },
) {
  const limit = await checkRateLimit('templates', rateLimitKey(req, 'templates'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const { state } = params;

    if (!state || !/^[A-Za-z]{2}$/.test(state)) {
      throw new ValidationError('Invalid state code format. Must be a 2-letter state code.');
    }

    const stateCode = state.toUpperCase();
    const { templateManager } = await getServices();
    const tm = templateManager as TemplateManagerLike;

    const docTypes = tm.getDocumentTypes(stateCode);
    if (!docTypes.includes('divorce_petition') && !docTypes.includes('divorce_decree')) {
      throw new ValidationError(
        `State does not support divorce documents. Supported states: ${SUPPORTED_DIVORCE_STATES}`,
      );
    }

    const metadata = tm.getMetadata(stateCode, 'divorce_petition') ?? null;
    const states = tm.getSupportedStates();
    const stateInfo = states.find((s) => s.code === stateCode);

    return NextResponse.json({
      success: true,
      data: {
        stateCode,
        stateName: stateInfo?.name || stateCode,
        residencyRequirements: metadata?.residencyRequirements ?? null,
        waitingPeriod: metadata?.waitingPeriod ?? null,
        groundsForDivorce: metadata?.groundsForDivorce ?? null,
        requiredForms: metadata?.requiredForms ?? [],
        terminology: metadata?.terminology ?? {},
        fees: metadata?.fees ?? null,
        specialRequirements: metadata?.specialRequirements ?? [],
        legalCitations: metadata?.legalCitations ?? [],
      },
    });
  } catch (err) {
    console.error('[templates/divorce/requirements] failed', err);
    return toErrorResponse(err);
  }
}
