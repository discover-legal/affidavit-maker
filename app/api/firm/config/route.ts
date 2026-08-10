import { NextResponse } from 'next/server';
import { withBasicAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse } from '@/lib/api/errors';
import { isFirmMode, firmName } from '@/lib/biglaw/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/firm/config — whether this deployment runs in firm mode, and the
// firm's display name. Not an error when firm mode is off: self-rep
// deployments get { firmMode: false } with a 200 so the client renders
// identically with zero firm UI.
//
// withBasicAuth (not withAuth): FirmContext probes this on every authed page
// load, including before the user has accepted the current TOS — the TOS gate
// would 403 that first load. The response carries deployment config only, no
// user data.
export const GET = withBasicAuth(async (_req, { user }) => {
  try {
    const limit = await checkRateLimit('firm-config', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const firmMode = isFirmMode();
    return NextResponse.json({
      success: true,
      data: {
        firmMode,
        firmName: firmMode ? firmName() : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
