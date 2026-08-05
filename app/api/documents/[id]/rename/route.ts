import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// UserDashboard.js submits `{ newName }`, matching the legacy Express route.
// Accept either key so existing clients keep working and `title` stays the
// canonical name for future callers.
const bodySchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    newName: z.string().trim().min(1).max(255).optional(),
  })
  .refine((v) => Boolean(v.title || v.newName), {
    message: 'title is required',
  });

export const PUT = withAuth<{ id: string | string[] }>(async (req: NextRequest, { user, params }) => {
  try {
    const limit = await checkRateLimit('documents-rename', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const idRaw = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!idRaw || !/^[1-9]\d{0,9}$/.test(String(idRaw).trim())) {
      throw new ValidationError('Invalid document ID');
    }
    const id = Number(idRaw);
    const parsed = bodySchema.parse(await req.json().catch(() => ({})));
    const title = (parsed.title ?? parsed.newName) as string;

    // Update + return: zero rows touched → 404 (no probe oracle).
    const updated = await query<{ id: number }>(
      'UPDATE documents SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING id',
      [title, id, user.id],
    );
    if (updated.rowCount === 0) throw new NotFoundError('Document not found');
    void AuthorizationError; // referenced for symmetry; runtime no-op
    return NextResponse.json({ success: true, id, title });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return toErrorResponse(new ValidationError('Invalid title'));
    }
    return toErrorResponse(err);
  }
});
