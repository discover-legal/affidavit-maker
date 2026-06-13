import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { NotFoundError, toErrorResponse } from '@/lib/api/errors';
import { requireAdminApi } from '@/lib/marketplace/guards';
import { reinstateTemplate } from '@/lib/marketplace/adminRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

/** POST /api/admin/templates/[id]/reinstate — restore a suspended listing. */
export const POST = withAuth<Params>(async (_req, { user, params }) => {
  try {
    requireAdminApi(user);
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Template not found');
    const template = await reinstateTemplate(id);
    if (!template) throw new NotFoundError('Template not found');
    return ok({ template });
  } catch (err) {
    return toErrorResponse(err);
  }
});
