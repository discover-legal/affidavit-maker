import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { RateLimitError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { requireProviderApi } from '@/lib/marketplace/guards';
import { createTemplateSchema } from '@/lib/marketplace/schemas';
import { createTemplate, listLawyerTemplates } from '@/lib/marketplace/lawyerRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuerySchema = z.object({
  status: z
    .enum(['draft', 'pending_review', 'published', 'suspended', 'archived', 'deleted'])
    .optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** GET /api/lawyer/templates — the calling lawyer's own templates (any status). */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  try {
    requireProviderApi(user);
    const params = listQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const page = await listLawyerTemplates(user.id, params);
    return ok(page);
  } catch (err) {
    return toErrorResponse(err);
  }
});

/** POST /api/lawyer/templates — create a new draft template. */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    requireProviderApi(user);
    const limit = checkRateLimit('lawyer-write', user.id, RATE_LIMITS.strict);
    if (!limit.ok) throw new RateLimitError();

    const body = createTemplateSchema.parse(await req.json());
    const template = await createTemplate(user.id, body);
    return ok({ template }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
});
