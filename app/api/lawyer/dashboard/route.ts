import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { toErrorResponse } from '@/lib/api/errors';
import { requireProviderApi } from '@/lib/marketplace/guards';
import { getLawyerDashboard } from '@/lib/marketplace/lawyerRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/lawyer/dashboard — aggregate stats + recent templates for the lawyer. */
export const GET = withAuth(async (_req, { user }) => {
  try {
    requireProviderApi(user);
    const dashboard = await getLawyerDashboard(user.id);
    return ok(dashboard);
  } catch (err) {
    return toErrorResponse(err);
  }
});
