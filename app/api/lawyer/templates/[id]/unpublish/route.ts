import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { NotFoundError, RateLimitError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { requireProviderApi } from '@/lib/marketplace/guards';
import { setTemplateStatus } from '@/lib/marketplace/lawyerRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

/** POST /api/lawyer/templates/[id]/unpublish — pull a live template back to draft. */
export const POST = withAuth<Params>(async (_req, { user, params }) => {
  try {
    requireProviderApi(user);
    const limit = checkRateLimit('lawyer-write', user.id, RATE_LIMITS.strict);
    if (!limit.ok) throw new RateLimitError();

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Template not found');

    const template = await setTemplateStatus(user.id, id, 'draft');
    if (!template) throw new NotFoundError('Template not found');
    return ok({ template });
  } catch (err) {
    return toErrorResponse(err);
  }
});
