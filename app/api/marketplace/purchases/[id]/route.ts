import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { NotFoundError, toErrorResponse } from '@/lib/api/errors';
import { requireMarketplaceApi } from '@/lib/marketplace/guards';
import { getPurchaseDetail } from '@/lib/marketplace/purchaseRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Purchase not found');
  return id;
}

/** GET /api/marketplace/purchases/[id] — purchase + interview config (buyer-owned). */
export const GET = withAuth<Params>(async (_req, { user, params }) => {
  try {
    requireMarketplaceApi();
    const detail = await getPurchaseDetail(user.id, parseId(params.id));
    if (!detail) throw new NotFoundError('Purchase not found');
    return ok({ purchase: detail });
  } catch (err) {
    return toErrorResponse(err);
  }
});
