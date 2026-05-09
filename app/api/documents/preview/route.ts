import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse, AppError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Body schema. `affidavitData` is an opaque blob shaped by the editor; the
 * preview renderer just inspects `state`, `county`, `affiantName`, and
 * `facts`. We `.passthrough()` so unknown editor fields propagate without
 * Zod stripping them.
 */
const previewSchema = z.object({
  affidavitData: z
    .object({
      state: z.string().optional(),
      county: z.string().optional(),
      affiantName: z.string().optional(),
      facts: z.array(z.unknown()).optional(),
    })
    .passthrough(),
});

/**
 * POST /api/documents/preview
 *
 * Renders a deterministic HTML preview from the editor's affidavit blob via
 * `services/previewRenderer`. Ported from routes/documents.js POST /preview
 * (legacy lines ~363–554). Unlike the legacy endpoint we stick to the simple
 * `previewRenderer.generateFormattedString()` contract instead of falling back
 * to StateTemplateManager.generate*() — the more elaborate template flow
 * lives in /api/documents/generate, which is the authoritative renderer.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('documents-preview', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const { affidavitData } = previewSchema.parse(json);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const previewRenderer = require('@/services/previewRenderer');

    let formatted: string;
    try {
      formatted = previewRenderer.generateFormattedString(affidavitData);
    } catch (renderErr) {
      logger.error('preview_render_failed', {
        userId: user.id,
        error: renderErr instanceof Error ? renderErr.message : String(renderErr),
      });
      throw new AppError('Failed to render preview', 500, 'PreviewRenderError');
    }

    // Wrap the formatted plain-text in minimal HTML — `<pre>` preserves the
    // newlines and column alignment that previewRenderer emits without
    // requiring the client to do its own escaping.
    const escaped = formatted
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const html = `<pre class="affidavit-preview">${escaped}</pre>`;

    logger.info('preview_generated', {
      userId: user.id,
      factCount: Array.isArray(affidavitData.facts) ? affidavitData.facts.length : 0,
      bytes: html.length,
    });

    return NextResponse.json({
      success: true,
      html,
      format: 'html',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
