import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getServices } from '@/lib/api/services';
import { logger } from '@/lib/logger';
import {
  AppError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Body schema. `affidavitData` is the editor blob; we only inspect
 * `state` (required for templating) and `affiantName` (filename), and
 * `.passthrough()` everything else so unknown editor fields propagate
 * to the template + pdfService unchanged.
 */
const generateSchema = z.object({
  affidavitData: z
    .object({
      state: z.string().optional(),
      affiantName: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      documentType: z.string().optional(),
      activeSubDocument: z.string().optional(),
      facts: z.array(z.unknown()).optional(),
    })
    .passthrough(),
  documentId: z.union([z.string(), z.number()]).optional(),
  format: z.enum(['pdf', 'docx', 'word']).optional(),
});

const VALID_PAYMENT_STATUSES = new Set(['paid', 'completed', 'free', 'succeeded']);

/**
 * Sanitize a candidate filename — alphanumerics + dashes only, collapsed,
 * trimmed, length-capped. Defends against header injection (CR/LF, quotes)
 * and path traversal in `Content-Disposition`.
 */
function sanitizeFilename(input: string | undefined, fallback: string): string {
  const base = (input ?? '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/-+/g, '-');
  const trimmed = base.replace(/^-+|-+$/g, '').slice(0, 80);
  return trimmed || fallback;
}

type PdfServiceResult = {
  success: boolean;
  filepath?: string;
  filename?: string;
  pages?: number;
  documentType?: string;
};

type TemplateManager = {
  generateAffidavit: (state: string, data: unknown) => unknown;
  generateDocument?: (state: string, data: unknown, type: string) => unknown;
  generateDivorcePetition?: (state: string, data: unknown) => unknown;
  generateDivorceDecree?: (state: string, data: unknown) => unknown;
};

/**
 * POST /api/documents/generate
 *
 * Ports routes/documents.js POST /generate (legacy lines ~559–922) to a
 * Next.js Route Handler. Flow:
 *
 *   1. Verify the document is paid (or free / completed / succeeded). 402 if
 *      not — matches the legacy guard at routes/documents.js ~line 700.
 *   2. Build the document structure via StateTemplateManager
 *      (`generateAffidavit` for the standard path; we don't reproduce the
 *      DivorceDocumentGenerator branch here — that's a Phase-4 follow-up,
 *      tracked in the TODO below).
 *   3. Run services/pdfService two-pass generation, which writes to a
 *      temp file under `documents/`.
 *   4. Read the file, unlink it, and stream the bytes back as
 *      `application/pdf`.
 *
 * The file-on-disk hop is preserved because pdfService writes to a real
 * `WriteStream` for the two-pass page count + exhibit-append flow. Reading
 * it back into a Buffer is the simplest way to fit Next's
 * `new Response(body, ...)` contract without rewriting pdfService.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  let pdfFilepath: string | undefined;

  try {
    const limit = checkRateLimit('documents-generate', user.id, RATE_LIMITS.pdf);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', errorType: 'RateLimitError' },
        { status: 429 },
      );
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const body = generateSchema.parse(json);
    const { affidavitData } = body;
    const documentId = body.documentId !== undefined ? String(body.documentId) : undefined;
    const requestedFormat =
      (req.nextUrl.searchParams.get('format') ?? body.format ?? 'pdf').toLowerCase();
    const isDocx = requestedFormat === 'docx' || requestedFormat === 'word';

    if (!affidavitData.state || affidavitData.state.trim() === '') {
      throw new ValidationError('State selection is required before generating a document');
    }

    // ── STEP 1: Payment gate ────────────────────────────────────────────────
    // Reproduces the legacy guard: documents.payment_status must be one of
    // paid|completed|free|succeeded. We skip the legacy Stripe-fallback
    // branch — by the time the SPA hits /generate, the payment webhook
    // should have already flipped payment_status. If a race surfaces we'll
    // reintroduce the fallback in a follow-up.
    if (documentId) {
      const paymentCheck = await query<{ payment_status: string | null }>(
        'SELECT payment_status FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, user.id],
      );
      if (paymentCheck.rows.length === 0) {
        throw new NotFoundError('Document not found');
      }
      const paymentStatus = paymentCheck.rows[0].payment_status ?? '';
      if (!VALID_PAYMENT_STATUSES.has(paymentStatus)) {
        logger.warn('document_generate_payment_required', {
          userId: user.id,
          documentId,
          paymentStatus,
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Payment required',
            errorType: 'payment_required',
            documentId,
          },
          { status: 402 },
        );
      }
    }

    // ── STEP 2: Build document structure via the template manager ─────────
    const services = await getServices();
    const templateManager = services.templateManager as TemplateManager | null;
    if (!templateManager) {
      throw new AppError('Template manager unavailable', 503, 'ServiceUnavailable');
    }

    let documentStructure: unknown;
    try {
      // Standard affidavit path. The legacy route also has a divorce-document
      // branch (DivorceDocumentGenerator + generateDivorcePetition / Decree);
      // porting that is Phase-4 follow-up — tracked in CLAUDE.md.
      documentStructure = templateManager.generateAffidavit(affidavitData.state, affidavitData);
    } catch (templateErr) {
      logger.error('document_generate_template_failed', {
        userId: user.id,
        documentId,
        state: affidavitData.state,
        documentType: affidavitData.documentType ?? 'affidavit',
        error: templateErr instanceof Error ? templateErr.message : String(templateErr),
      });
      throw new AppError('Failed to generate document structure', 400, 'TemplateError');
    }

    // ── STEP 3: Run pdfService two-pass generation ───────────────────────
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFService = require('@/services/pdfService');
    const pdfService = new PDFService({ templateManager });

    let result: PdfServiceResult;
    try {
      if (isDocx) {
        result = (await pdfService.generateWordDoc(documentStructure, {
          documentId: documentId ?? Date.now(),
          userId: user.id,
        })) as PdfServiceResult;
      } else {
        result = (await pdfService.generatePDF(documentStructure, {
          documentId: documentId ?? Date.now(),
          userId: user.id,
        })) as PdfServiceResult;
      }
    } catch (pdfErr) {
      logger.error('document_generate_pdf_failed', {
        userId: user.id,
        documentId,
        error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
      });
      throw new AppError('Failed to generate document', 500, 'PDFGenerationError');
    }

    if (!result.success || !result.filepath) {
      throw new AppError('Document generation returned no filepath', 500, 'PDFGenerationError');
    }

    pdfFilepath = result.filepath;

    // ── STEP 4: Read file → buffer → unlink → respond ────────────────────
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    const fsPromises = fs.promises;
    const fileBuffer = await fsPromises.readFile(pdfFilepath);

    // Update document status (best-effort; don't fail the response on db error)
    if (documentId) {
      try {
        await query(
          `UPDATE documents
              SET status = 'completed',
                  updated_at = CURRENT_TIMESTAMP,
                  generation_metadata = jsonb_set(
                    COALESCE(generation_metadata, '{}'::jsonb),
                    '{pdfPages}',
                    $1::text::jsonb
                  )
            WHERE id = $2 AND user_id = $3`,
          [String(result.pages ?? 0), documentId, user.id],
        );
      } catch (dbErr) {
        logger.warn('document_generate_status_update_failed', {
          userId: user.id,
          documentId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
      }
    }

    // Cleanup — fire-and-forget. Don't block the response on the unlink.
    fsPromises.unlink(pdfFilepath).catch((cleanupErr: unknown) => {
      logger.warn('document_generate_cleanup_failed', {
        filepath: pdfFilepath,
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    });
    pdfFilepath = undefined;

    const baseName = sanitizeFilename(
      affidavitData.affiantName ??
        [affidavitData.firstName, affidavitData.lastName].filter(Boolean).join('-'),
      'document',
    );
    const prefix =
      result.documentType === 'petition'
        ? 'petition'
        : result.documentType === 'decree'
        ? 'decree'
        : 'affidavit';
    const ext = isDocx ? 'docx' : 'pdf';
    const safeFilename = `${prefix}-${baseName}.${ext}`;

    const contentType = isDocx
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';

    logger.info('document_generated', {
      userId: user.id,
      documentId,
      bytes: fileBuffer.length,
      pages: result.pages,
      format: ext,
    });

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'content-type': contentType,
        'content-disposition': `attachment; filename="${safeFilename}"`,
        'content-length': String(fileBuffer.length),
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    // Best-effort cleanup if we threw between writing the file and sending
    // the response.
    if (pdfFilepath) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('fs') as typeof import('fs');
        await fs.promises.unlink(pdfFilepath).catch(() => undefined);
      } catch {
        /* swallow — already in error path */
      }
    }
    logger.error('document_generate_failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return toErrorResponse(err);
  }
});
