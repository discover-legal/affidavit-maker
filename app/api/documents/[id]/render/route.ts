import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AppError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/documents/[id]/render
 *
 * Re-renders the formatted preview for a stored document (used by the
 * editor's `renderFormattedPreview` for on-demand re-render after edits).
 *
 * Loads the document, verifies ownership, runs `services/previewRenderer.
 * generateFormattedString(content)`, and returns `{ formatted, items }`.
 *
 * Idempotent and side-effect-free; rate-limited like other read endpoints.
 */
export const POST = withAuth<{ id: string | string[] }>(async (
  _req: NextRequest,
  { user, params },
) => {
  try {
    const limit = checkRateLimit('documents-render', user.id, RATE_LIMITS.standard);
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

    const row = await query<{ id: string; user_id: number; content: unknown }>(
      'SELECT id, user_id, content FROM documents WHERE id = $1 AND user_id = $2',
      [id, user.id],
    );
    if (!row.rows.length) throw new NotFoundError('Document not found');
    void AuthorizationError;

    const content = row.rows[0].content as Record<string, unknown> | null;
    if (!content) {
      throw new ValidationError('Document has no renderable content');
    }

    let formatted: string;
    let items: unknown[] | undefined;
    try {
      const previewRenderer = require('@/services/previewRenderer') as {
        generateFormattedString: (data: unknown) => string;
        generateFormattedItems?: (data: unknown) => unknown[];
      };
      formatted = previewRenderer.generateFormattedString(content);
      items =
        typeof previewRenderer.generateFormattedItems === 'function'
          ? previewRenderer.generateFormattedItems(content)
          : undefined;
    } catch (renderErr) {
      logger.error('document_render_failed', {
        userId: user.id,
        documentId: id,
        error: renderErr instanceof Error ? renderErr.message : String(renderErr),
      });
      throw new AppError('Failed to render document', 500, 'RenderError');
    }

    logger.info('document_rendered', {
      userId: user.id,
      documentId: id,
      bytes: formatted.length,
    });

    return NextResponse.json({
      success: true,
      formatted,
      items,
      fromCache: false,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
