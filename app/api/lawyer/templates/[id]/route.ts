import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { NotFoundError, RateLimitError, toErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { requireProviderApi } from '@/lib/marketplace/guards';
import { updateTemplateSchema } from '@/lib/marketplace/schemas';
import {
  getLawyerTemplate,
  updateTemplate,
  softDeleteTemplate,
} from '@/lib/marketplace/lawyerRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

/** Parse a positive-integer id from the route, else 404. */
function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Template not found');
  return id;
}

/** GET /api/lawyer/templates/[id] — the owner's full template (any status). */
export const GET = withAuth<Params>(async (_req, { user, params }) => {
  try {
    requireProviderApi(user);
    const template = await getLawyerTemplate(user.id, parseId(params.id));
    if (!template) throw new NotFoundError('Template not found');
    return ok({ template });
  } catch (err) {
    return toErrorResponse(err);
  }
});

/** PUT /api/lawyer/templates/[id] — update editable fields. */
export const PUT = withAuth<Params>(async (req: NextRequest, { user, params }) => {
  try {
    requireProviderApi(user);
    const limit = checkRateLimit('lawyer-write', user.id, RATE_LIMITS.strict);
    if (!limit.ok) throw new RateLimitError();

    const id = parseId(params.id);
    const patch = updateTemplateSchema.parse(await req.json());
    const template = await updateTemplate(user.id, id, patch);
    if (!template) throw new NotFoundError('Template not found');
    return ok({ template });
  } catch (err) {
    return toErrorResponse(err);
  }
});

/** DELETE /api/lawyer/templates/[id] — soft-delete (status='deleted'). */
export const DELETE = withAuth<Params>(async (_req, { user, params }) => {
  try {
    requireProviderApi(user);
    const limit = checkRateLimit('lawyer-write', user.id, RATE_LIMITS.strict);
    if (!limit.ok) throw new RateLimitError();

    const id = parseId(params.id);
    const deleted = await softDeleteTemplate(user.id, id);
    if (!deleted) throw new NotFoundError('Template not found');
    return ok({ id });
  } catch (err) {
    return toErrorResponse(err);
  }
});
