import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { toErrorResponse } from '@/lib/api/errors';
import { requireAdminApi } from '@/lib/marketplace/guards';
import { getAdminStats } from '@/lib/marketplace/adminRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/stats — platform-wide marketplace counts. */
export const GET = withAuth(async (_req, { user }) => {
  try {
    requireAdminApi(user);
    return ok(await getAdminStats());
  } catch (err) {
    return toErrorResponse(err);
  }
});
