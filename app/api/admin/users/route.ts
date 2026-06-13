import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { toErrorResponse } from '@/lib/api/errors';
import { requireAdminApi } from '@/lib/marketplace/guards';
import { listUsers } from '@/lib/marketplace/adminRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  role: z.enum(['client', 'lawyer', 'admin']).optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** GET /api/admin/users — list/search users by role. */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  try {
    requireAdminApi(user);
    const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return ok(await listUsers(params));
  } catch (err) {
    return toErrorResponse(err);
  }
});
