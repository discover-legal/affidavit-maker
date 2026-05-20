import { NextRequest, NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getServices } from '@/lib/api/services';
import { rateLimitKey } from '@/lib/util/clientIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupportedState = { code: string; name: string; requirements?: unknown };

type TemplateManagerLike = {
  getSupportedStates: () => SupportedState[];
  getDocumentTypes: (stateCode: string) => string[];
};

/**
 * GET /api/templates/divorce/states
 * Returns the list of states/provinces with full divorce document support.
 */
export async function GET(req: NextRequest) {
  const limit = checkRateLimit('templates', rateLimitKey(req, 'templates'), RATE_LIMITS.standard);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const { templateManager } = await getServices();
    const tm = templateManager as TemplateManagerLike;
    const states = tm.getSupportedStates();

    const divorceStates = states.filter((state) => {
      const docTypes = tm.getDocumentTypes(state.code);
      return docTypes.includes('divorce_petition') || docTypes.includes('divorce_decree');
    });

    return NextResponse.json({
      success: true,
      data: {
        states: divorceStates.map((s) => s.code),
        stateDetails: divorceStates.map((s) => ({ code: s.code, name: s.name })),
        documentTypes: ['divorce_petition', 'divorce_decree'],
      },
    });
  } catch (err) {
    console.error('[templates/divorce/states] failed', err);
    return toErrorResponse(err);
  }
}
