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
import { ALL_STATES, ALL_PROVINCES, isInternationalEnabled } from '@/lib/api/catalog-data';
import { paymentsEnabled } from '@/lib/api/stripe';
import {
  buildDocumentStructure,
  assertGenerationTypeAllowed,
  type TemplateManager,
  type AffidavitData,
} from '@/lib/api/documentStructure';
import { readJsonBody } from '@/lib/api/requestBody';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Body schema. `affidavitData` is the editor blob; we only inspect
 * `state` (required for templating) and `affiantName` (filename), and
 * `.passthrough()` everything else so unknown editor fields propagate
 * to the template + pdfService unchanged.
 *
 * `documentId` is optional at the schema level: with payments enabled it is
 * required at runtime (generation renders the owned, saved record); with the
 * PAYMENTS_ENABLED kill-switch off, ad-hoc generation from editor content is
 * the documented free path.
 */
export const generateSchema = z.object({
  affidavitData: z
    .object({
      state: z.string().optional(),
      affiantName: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      documentType: z.string().optional(),
      activeSubDocument: z.string().nullable().optional(),
      facts: z.array(z.unknown()).optional(),
    })
    .passthrough(),
  documentId: z.union([
    z.number().int().positive().max(2_147_483_647),
    z
      .string()
      .regex(/^[1-9]\d{0,9}$/)
      .refine((value) => Number(value) <= 2_147_483_647, 'Document ID is too large'),
  ]).optional(),
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


/**
 * POST /api/documents/generate
 *
 * Ports routes/documents.js POST /generate (legacy lines ~559–922) to a
 * Next.js Route Handler. Flow:
 *
 *   1. Verify the document is paid (or free / completed / succeeded). 402 if
 *      not — matches the legacy guard at routes/documents.js ~line 700.
 *      Skipped entirely when the PAYMENTS_ENABLED kill-switch is off.
 *   2. Build the document structure via StateTemplateManager, routing divorce
 *      packages to their selected jurisdiction-specific petition or decree.
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
    const limit = await checkRateLimit('documents-generate', user.id, RATE_LIMITS.pdf);
    const dailyLimit = await checkRateLimit(
      'documents-generate-daily',
      user.id,
      RATE_LIMITS.pdfDaily ?? RATE_LIMITS.pdf,
    );
    if (!limit.ok || !dailyLimit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', errorType: 'RateLimitError' },
        { status: 429 },
      );
    }

    const json = await readJsonBody(req);
    const body = generateSchema.parse(json);
    let affidavitData: AffidavitData = { ...body.affidavitData };
    const documentId = body.documentId !== undefined ? String(body.documentId) : undefined;
    const requestedFormat =
      (req.nextUrl.searchParams.get('format') ?? body.format ?? 'pdf').toLowerCase();
    const isDocx = requestedFormat === 'docx' || requestedFormat === 'word';

    // Render the owned, saved record—not caller-supplied replacement content.
    // Material edits reset payment_status in documents/save, so a paid ID
    // cannot be replayed for unrelated documents or a more expensive SKU.
    if (!documentId && paymentsEnabled()) {
      throw new ValidationError('documentId is required to generate a document');
    }
    if (documentId) {
      const saved = await query<{
        content: unknown;
        document_type: string | null;
        payment_status: string | null;
      }>(
        `SELECT content, document_type, payment_status
           FROM documents WHERE id = $1 AND user_id = $2`,
        [documentId, user.id],
      );
      if (saved.rows.length === 0) throw new NotFoundError('Document not found');
      const record = saved.rows[0];
      if (paymentsEnabled() && !VALID_PAYMENT_STATUSES.has(record.payment_status ?? '')) {
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
      const parsedContent = typeof record.content === 'string'
        ? JSON.parse(record.content)
        : record.content;
      // The caller may choose which sub-document of an owned package to
      // render (petition vs decree) — that choice is entitlement-neutral.
      // Everything else comes from the saved record.
      const callerActive = body.affidavitData.activeSubDocument;
      affidavitData = generateSchema.shape.affidavitData.parse({
        ...(parsedContent as Record<string, unknown>),
        documentType: record.document_type ?? undefined,
        ...(callerActive !== undefined ? { activeSubDocument: callerActive } : {}),
      });
      assertGenerationTypeAllowed(
        record.document_type,
        affidavitData.documentType,
        affidavitData.activeSubDocument,
      );
    }

    if (!affidavitData.state || affidavitData.state.trim() === '') {
      throw new ValidationError('State selection is required before generating a document');
    }
    // Allow-list check. The user-supplied state code is used to drive
    // template loading; restrict to known jurisdictions so a request can't
    // ask the template manager to load an unexpected path. International
    // jurisdictions are gated by the same feature flag the rest of the app
    // uses for them.
    const stateCode = affidavitData.state.toUpperCase();
    const allowed = new Set<string>([...ALL_STATES, ...ALL_PROVINCES]);
    if (isInternationalEnabled()) {
      // International codes are short (2-5 chars). Re-import here to avoid
      // a circular import in the catalog module; the catalog already vets
      // its own list, so we trust whatever getAllJurisdictions returns.
      const { getAllJurisdictions } = require('@/lib/api/catalog-data') as {
        getAllJurisdictions: () => string[];
      };
      for (const j of getAllJurisdictions()) allowed.add(j);
    }
    if (!allowed.has(stateCode)) {
      throw new ValidationError('Unsupported state / province');
    }
    affidavitData.state = stateCode;

    // ── STEP 1: Payment gate ────────────────────────────────────────────────
    // Handled above when loading the saved record. With the kill-switch off,
    // generation is free — log the bypass for auditability.
    if (documentId && !paymentsEnabled()) {
      logger.info('document_generate_payment_gate_bypassed', {
        userId: user.id,
        documentId,
        reason: 'PAYMENTS_ENABLED=false',
      });
    }

    // ── STEP 2: Build document structure via the template manager ─────────
    const services = await getServices();
    const templateManager = services.templateManager as TemplateManager | null;
    if (!templateManager) {
      throw new AppError('Template manager unavailable', 503, 'ServiceUnavailable');
    }

    let documentStructure: unknown;
    try {
      documentStructure = buildDocumentStructure(templateManager, affidavitData.state, affidavitData);
    } catch (templateErr) {
      if (templateErr instanceof ValidationError) throw templateErr;
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
    const fs = require('fs') as typeof import('fs');
    const fsPromises = fs.promises;
    const fileBuffer = await fsPromises.readFile(/* turbopackIgnore: true */ pdfFilepath);

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
