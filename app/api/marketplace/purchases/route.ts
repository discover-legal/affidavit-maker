import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { toErrorResponse } from '@/lib/api/errors';
import { requireMarketplaceApi } from '@/lib/marketplace/guards';
import { listPurchases } from '@/lib/marketplace/purchaseRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** GET /api/marketplace/purchases — the buyer's own purchases (newest first). */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  try {
    requireMarketplaceApi();
    const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const page = await listPurchases(user.id, params);
    return ok(page);
  } catch (err) {
    return toErrorResponse(err);
  }
});
