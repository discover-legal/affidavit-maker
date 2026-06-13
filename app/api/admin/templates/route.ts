import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { ok } from '@/lib/responses';
import { toErrorResponse } from '@/lib/api/errors';
import { requireAdminApi } from '@/lib/marketplace/guards';
import { listAdminTemplates } from '@/lib/marketplace/adminRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z
    .enum(['draft', 'pending_review', 'published', 'suspended', 'archived', 'deleted'])
    .optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** GET /api/admin/templates — moderation list across all providers. */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  try {
    requireAdminApi(user);
    const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return ok(await listAdminTemplates(params));
  } catch (err) {
    return toErrorResponse(err);
  }
});
