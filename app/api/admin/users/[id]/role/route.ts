import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { NotFoundError, toErrorResponse } from '@/lib/api/errors';
import { requireAdminApi } from '@/lib/marketplace/guards';
import { setUserRole } from '@/lib/marketplace/adminRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

const bodySchema = z.object({ role: z.enum(['client', 'lawyer', 'admin']) });

/** PUT /api/admin/users/[id]/role — grant/change a user's marketplace role. */
export const PUT = withAuth<Params>(async (req: NextRequest, { user, params }) => {
  try {
    requireAdminApi(user);
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NotFoundError('User not found');

    const { role } = bodySchema.parse(await req.json());
    const updated = await setUserRole(id, role);
    if (!updated) throw new NotFoundError('User not found');
    return ok({ user: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
});
