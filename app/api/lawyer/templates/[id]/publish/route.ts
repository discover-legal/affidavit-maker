import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { NotFoundError, RateLimitError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { requireProviderApi } from '@/lib/marketplace/guards';
import { setTemplateStatus } from '@/lib/marketplace/lawyerRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

/**
 * POST /api/lawyer/templates/[id]/publish — submit a draft for review. Sets
 * status to 'pending_review'; an admin approves it to 'published' via
 * /api/admin/templates/[id]/approve (the moderation gate). The lawyer can pull
 * it back to draft any time via /unpublish.
 */
export const POST = withAuth<Params>(async (_req, { user, params }) => {
  try {
    requireProviderApi(user);
    const limit = checkRateLimit('lawyer-write', user.id, RATE_LIMITS.strict);
    if (!limit.ok) throw new RateLimitError();

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Template not found');

    const template = await setTemplateStatus(user.id, id, 'pending_review');
    if (!template) throw new NotFoundError('Template not found');
    return ok({ template });
  } catch (err) {
    return toErrorResponse(err);
  }
});
