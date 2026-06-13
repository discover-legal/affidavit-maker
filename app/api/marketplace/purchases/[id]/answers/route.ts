import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { NotFoundError, RateLimitError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { requireMarketplaceApi } from '@/lib/marketplace/guards';
import { saveAnswers } from '@/lib/marketplace/purchaseRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

// Answers are an arbitrary id->value map; values are primitives or string lists.
const bodySchema = z.object({
  answers: z.record(
    z.string().max(60),
    z.union([z.string().max(20_000), z.number(), z.boolean(), z.array(z.string().max(500)).max(100), z.null()]),
  ),
});

/** PUT /api/marketplace/purchases/[id]/answers — save interview answers (paid only). */
export const PUT = withAuth<Params>(async (req: NextRequest, { user, params }) => {
  try {
    requireMarketplaceApi();
    const limit = checkRateLimit('marketplace-interview', user.id, RATE_LIMITS.standard);
    if (!limit.ok) throw new RateLimitError();

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Purchase not found');

    const { answers } = bodySchema.parse(await req.json());
    const purchase = await saveAnswers(user.id, id, answers);
    // null => not found, not owned, or not yet paid.
    if (!purchase) throw new NotFoundError('Purchase not found or not ready');
    return ok({ purchase });
  } catch (err) {
    return toErrorResponse(err);
  }
});
