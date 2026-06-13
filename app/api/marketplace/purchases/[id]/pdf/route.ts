import { withAuth } from '@/lib/api/auth';
import { NotFoundError, RateLimitError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { requireMarketplaceApi } from '@/lib/marketplace/guards';
import { getPurchaseDetail } from '@/lib/marketplace/purchaseRepository';
import { renderDocumentPdf } from '@/lib/marketplace/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

function safeFilename(title: string): string {
  const base = title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80);
  return `${base || 'document'}.pdf`;
}

/**
 * GET /api/marketplace/purchases/[id]/pdf
 *
 * Streams the generated document as a PDF. Requires a paid, owned purchase that
 * has already been generated (completed_document present).
 */
export const GET = withAuth<Params>(async (_req, { user, params }) => {
  try {
    requireMarketplaceApi();
    const limit = checkRateLimit('marketplace-generate', user.id, RATE_LIMITS.pdf);
    if (!limit.ok) throw new RateLimitError();

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Purchase not found');

    const detail = await getPurchaseDetail(user.id, id);
    if (!detail || detail.status !== 'paid' || detail.completedDocument == null) {
      throw new NotFoundError('No generated document available');
    }

    const pdf = await renderDocumentPdf({ title: detail.templateTitle, body: detail.completedDocument });

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename(detail.templateTitle)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
