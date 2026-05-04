import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  title: z.string().trim().min(1).max(255),
});

export const PUT = withAuth<{ id: string | string[] }>(async (req: NextRequest, { user, params }) => {
  try {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { title } = bodySchema.parse(await req.json().catch(() => ({})));

    const row = await query<{ user_id: string }>(
      'SELECT user_id FROM documents WHERE id = $1',
      [id],
    );
    if (!row.rows.length) throw new NotFoundError('Document not found');
    if (row.rows[0].user_id !== user.id) throw new AuthorizationError('Access denied');

    await query(
      'UPDATE documents SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [title, id],
    );
    return NextResponse.json({ success: true, id, title });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return toErrorResponse(new ValidationError('Invalid title'));
    }
    return toErrorResponse(err);
  }
});
