import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import {
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { requireMarketplaceApi } from '@/lib/marketplace/guards';
import { getPurchaseDetail, saveGeneratedDocument } from '@/lib/marketplace/purchaseRepository';
import { renderTemplate } from '@/lib/marketplace/renderTemplate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

/**
 * POST /api/marketplace/purchases/[id]/generate
 *
 * Renders the purchased template against the saved interview answers and stores
 * the completed document. Requires a PAID purchase. Refuses if required
 * questions are unanswered (returns 400 with the missing ids).
 */
export const POST = withAuth<Params>(async (_req, { user, params }) => {
  try {
    requireMarketplaceApi();
    const limit = checkRateLimit('marketplace-generate', user.id, RATE_LIMITS.pdf);
    if (!limit.ok) throw new RateLimitError();

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Purchase not found');

    const detail = await getPurchaseDetail(user.id, id);
    if (!detail) throw new NotFoundError('Purchase not found');
    if (detail.status !== 'paid') {
      throw new AuthorizationError('Complete payment before generating this document.');
    }

    const { document, missingRequired } = renderTemplate(detail.templateConfig, detail.interviewAnswers);
    if (missingRequired.length > 0) {
      throw new ValidationError(
        `Please answer all required questions first: ${missingRequired.join(', ')}`,
      );
    }

    const updated = await saveGeneratedDocument(user.id, id, document);
    if (!updated) throw new NotFoundError('Purchase not found');
    return ok({ purchase: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
});
