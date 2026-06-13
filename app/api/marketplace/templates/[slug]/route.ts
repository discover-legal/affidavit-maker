import { NextRequest } from 'next/server';
import { ok } from '@/lib/responses';
import { NotFoundError, RateLimitError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { rateLimitKey } from '@/lib/util/clientIp';
import { isMarketplaceEnabled } from '@/lib/marketplace/flag';
import { getTemplateBySlug } from '@/lib/marketplace/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/templates/[slug]
 *
 * Public, unauthenticated read of a single PUBLISHED template by slug. Gated
 * behind ENABLE_MARKETPLACE (404 when off). A missing or unpublished slug also
 * 404s — the two are deliberately indistinguishable so draft slugs can't be
 * probed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    if (!isMarketplaceEnabled()) throw new NotFoundError();

    const limit = checkRateLimit('marketplace', rateLimitKey(req, 'marketplace'), RATE_LIMITS.standard);
    if (!limit.ok) throw new RateLimitError();

    const slug = params.slug?.trim();
    if (!slug) throw new NotFoundError('Template not found');

    const template = await getTemplateBySlug(slug);
    if (!template) throw new NotFoundError('Template not found');

    return ok({ template });
  } catch (err) {
    return toErrorResponse(err);
  }
}
