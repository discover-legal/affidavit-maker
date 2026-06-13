import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok } from '@/lib/responses';
import { NotFoundError, RateLimitError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';
import { isMarketplaceEnabled } from '@/lib/marketplace/flag';
import { searchTemplates } from '@/lib/marketplace/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/templates
 *
 * Public, unauthenticated search/listing of PUBLISHED marketplace templates.
 * Gated behind ENABLE_MARKETPLACE — returns 404 when the marketplace is off, so
 * the route is indistinguishable from one that doesn't exist. IP rate-limited
 * (no auth principal to key on).
 */
const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  matter_type: z.string().trim().max(50).optional(),
  practice_area: z.enum(['family', 'civil']).optional(),
  jurisdiction: z
    .string()
    .trim()
    .regex(/^[A-Za-z_]{2,10}$/, 'invalid jurisdiction code')
    .optional(),
  min_price: z.coerce.number().int().min(0).optional(),
  max_price: z.coerce.number().int().min(0).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['popular', 'newest', 'rating', 'price_asc', 'price_desc']).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: NextRequest) {
  try {
    if (!isMarketplaceEnabled()) throw new NotFoundError();

    const limit = checkRateLimit('marketplace', rateLimitKey(req, 'marketplace'), RATE_LIMITS.standard);
    if (!limit.ok) throw new RateLimitError();

    const raw = Object.fromEntries(req.nextUrl.searchParams);
    const params = querySchema.parse(raw);

    const page = await searchTemplates({
      q: params.q,
      matterType: params.matter_type,
      practiceArea: params.practice_area,
      jurisdiction: params.jurisdiction,
      minPrice: params.min_price,
      maxPrice: params.max_price,
      minRating: params.min_rating,
      sortBy: params.sort,
      cursor: params.cursor,
      limit: params.limit,
    });

    return ok(page);
  } catch (err) {
    return toErrorResponse(err);
  }
}
