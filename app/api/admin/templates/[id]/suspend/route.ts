import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { NotFoundError, toErrorResponse } from '@/lib/api/errors';
import { requireAdminApi } from '@/lib/marketplace/guards';
import { suspendTemplate } from '@/lib/marketplace/adminRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

const bodySchema = z.object({ reason: z.string().trim().min(1).max(1000) });

/** POST /api/admin/templates/[id]/suspend — take a listing down with a reason. */
export const POST = withAuth<Params>(async (req: NextRequest, { user, params }) => {
  try {
    requireAdminApi(user);
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('Template not found');
    const { reason } = bodySchema.parse(await req.json());
    const template = await suspendTemplate(id, reason);
    if (!template) throw new NotFoundError('Template not found');
    return ok({ template });
  } catch (err) {
    return toErrorResponse(err);
  }
});
