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
import { readJsonBody } from '@/lib/api/requestBody';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Body schema. `affidavitData` is the editor blob; we only inspect
 * `state` (required for templating) and `affiantName` (filename), and
 * `.passthrough()` everything else so unknown editor fields propagate
 * to the template + pdfService unchanged.
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
  ]),
  format: z.enum(['pdf', 'docx', 'word']).optional(),
});

const VALID_PAYMENT_STATUSES = new Set(['paid', 'completed', 'free', 'succeeded']);
const LAUNCH_JURISDICTIONS = new Set(['AZ', 'CA', 'FL', 'IL', 'NY', 'TX', 'UT']);

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
  hasDocumentType: (state: string, type: string) => boolean;
  generateAffidavit: (state: string, data: unknown) => unknown;
  generateDivorcePetition: (state: string, data: unknown) => unknown;
  generateDivorceDecree: (state: string, data: unknown) => unknown;
};

type AffidavitData = Record<string, unknown> & {
  state?: string;
  affiantName?: string;
  firstName?: string;
  lastName?: string;
  documentType?: string;
  activeSubDocument?: string | null;
  petitionerName?: string;
  petitionerFirstName?: string;
  petitionerLastName?: string;
  respondentName?: string;
  respondentFirstName?: string;
  respondentLastName?: string;
};

const DIVORCE_TYPE_ALIASES: Readonly<Record<string, 'divorce_petition' | 'divorce_decree'>> = {
  divorce_petition: 'divorce_petition',
  petition: 'divorce_petition',
  petition_dissolution: 'divorce_petition',
  divorce_decree: 'divorce_decree',
  decree: 'divorce_decree',
  judgment_dissolution: 'divorce_decree',
  final_judgment: 'divorce_decree',
  proposed_judgment: 'divorce_decree',
};

/**
 * Resolve the editor's umbrella divorce-package type to the concrete document
 * selected in the editor. Packages default to the petition, which is the first
 * document in the workflow. Direct petition/decree aliases are also accepted
 * for compatibility with older saved documents and matter orchestrators.
 */
export function resolveGenerationDocumentType(
  documentType: string | undefined,
  activeSubDocument: string | null | undefined,
): 'affidavit' | 'divorce_petition' | 'divorce_decree' {
  const requestedType = (documentType ?? 'affidavit').trim().toLowerCase();
  const effectiveType =
    requestedType === 'divorce_package'
      ? (activeSubDocument ?? 'divorce_petition').trim().toLowerCase()
      : requestedType;

  if (requestedType === 'divorce_package' && !effectiveType) {
    return 'divorce_petition';
  }

  const resolved = DIVORCE_TYPE_ALIASES[effectiveType];
  if (requestedType === 'divorce_package' && !resolved) {
    throw new ValidationError('Unsupported divorce package document selection');
  }
  return resolved ?? 'affidavit';
}

/**
 * Bind generation to the immutable type on the paid document row. Editor
 * content is user-controlled and must not be able to upgrade an affidavit
 * entitlement into a divorce package.
 */
export function assertGenerationTypeAllowed(
  persistedType: string | null | undefined,
  requestedType: string | undefined,
  activeSubDocument: string | null | undefined,
): void {
  const stored = (persistedType ?? 'affidavit').trim().toLowerCase();
  const storedIsDivorce = ['divorce_package', 'divorce_petition', 'divorce_decree'].includes(stored);
  const requested = resolveGenerationDocumentType(requestedType, activeSubDocument);
  const requestedIsDivorce = requested !== 'affidavit';

  if (storedIsDivorce !== requestedIsDivorce) {
    throw new ValidationError('Requested output does not match the saved document type');
  }
  if (
    (stored === 'divorce_petition' || stored === 'divorce_decree') &&
    requested !== stored
  ) {
    throw new ValidationError('Requested output does not match the saved document type');
  }
}

function mapDivorceDataFields(data: AffidavitData): AffidavitData {
  const mapped = { ...data };
  if (!mapped.petitionerName && (mapped.petitionerFirstName || mapped.petitionerLastName)) {
    mapped.petitionerName = [mapped.petitionerFirstName, mapped.petitionerLastName]
      .filter(Boolean)
      .join(' ');
  }
  if (!mapped.respondentName && (mapped.respondentFirstName || mapped.respondentLastName)) {
    mapped.respondentName = [mapped.respondentFirstName, mapped.respondentLastName]
      .filter(Boolean)
      .join(' ');
  }
  return mapped;
}

export function buildDocumentStructure(
  templateManager: TemplateManager,
  state: string,
  data: AffidavitData,
): unknown {
  const resolvedType = resolveGenerationDocumentType(
    data.documentType,
    data.activeSubDocument,
  );
  if (resolvedType === 'affidavit') {
    return templateManager.generateAffidavit(state, data);
  }

  if (!templateManager.hasDocumentType(state, resolvedType)) {
    throw new ValidationError(
      `No ${resolvedType === 'divorce_petition' ? 'divorce petition' : 'divorce decree'} template is available for this jurisdiction`,
    );
  }

  const divorceData = mapDivorceDataFields(data);
  return resolvedType === 'divorce_petition'
    ? templateManager.generateDivorcePetition(state, divorceData)
    : templateManager.generateDivorceDecree(state, divorceData);
}

/**
 * POST /api/documents/generate
 *
 * Ports routes/documents.js POST /generate (legacy lines ~559–922) to a
 * Next.js Route Handler. Flow:
 *
 *   1. Verify the document is paid (or free / completed / succeeded). 402 if
 *      not — matches the legacy guard at routes/documents.js ~line 700.
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
    const dailyLimit = await checkRateLimit('documents-generate-daily', user.id, RATE_LIMITS.pdfDaily);
    if (!limit.ok || !dailyLimit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', errorType: 'RateLimitError' },
        { status: 429 },
      );
    }

    const json = await readJsonBody(req);
    const body = generateSchema.parse(json);
    const { affidavitData } = body;
    const documentId = String(body.documentId);
    const requestedFormat =
      (req.nextUrl.searchParams.get('format') ?? body.format ?? 'pdf').toLowerCase();
    const isDocx = requestedFormat === 'docx' || requestedFormat === 'word';

    if (!affidavitData.state || affidavitData.state.trim() === '') {
      throw new ValidationError('State selection is required before generating a document');
    }
    // Enforce the same launch scope advertised and selectable in the editor.
    // Registered templates outside this list are not a promise of end-to-end
    // product readiness.
    const stateCode = affidavitData.state.toUpperCase();
    if (!LAUNCH_JURISDICTIONS.has(stateCode)) {
      throw new ValidationError('This jurisdiction is not available at launch');
    }
    affidavitData.state = stateCode;

    // ── STEP 1: Payment gate ────────────────────────────────────────────────
    // Reproduces the legacy guard: documents.payment_status must be one of
    // paid|completed|free|succeeded. We skip the legacy Stripe-fallback
    // branch — by the time the SPA hits /generate, the payment webhook
    // should have already flipped payment_status. If a race surfaces we'll
    // reintroduce the fallback in a follow-up.
    const paymentCheck = await query<{
      payment_status: string | null;
      document_type: string | null;
      template_state: string | null;
    }>(
      `SELECT payment_status, document_type, template_state
         FROM documents WHERE id = $1 AND user_id = $2`,
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
    assertGenerationTypeAllowed(
      paymentCheck.rows[0].document_type,
      affidavitData.documentType,
      affidavitData.activeSubDocument,
    );
    const persistedState = paymentCheck.rows[0].template_state?.toUpperCase();
    if (persistedState && persistedState !== stateCode) {
      throw new ValidationError('Requested jurisdiction does not match the saved document');
    }

    // ── STEP 2: Build document structure via the template manager ─────────
    const services = await getServices();
    const templateManager = services.templateManager as TemplateManager | null;
    if (!templateManager) {
      throw new AppError('Template manager unavailable', 503, 'ServiceUnavailable');
    }

    let documentStructure: unknown;
    try {
      documentStructure = buildDocumentStructure(
        templateManager,
        affidavitData.state,
        affidavitData as AffidavitData,
      );
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
    const PDFService = require('@/services/pdfService');
    const pdfService = new PDFService({ templateManager });

    let result: PdfServiceResult;
    try {
      if (isDocx) {
        result = (await pdfService.generateWordDoc(documentStructure, {
          documentId,
          userId: user.id,
        })) as PdfServiceResult;
      } else {
        result = (await pdfService.generatePDF(documentStructure, {
          documentId,
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
    const fileBuffer = await fsPromises.readFile(pdfFilepath);

    // Update document status (best-effort; don't fail the response on db error)
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

    // Generation uses a private per-request directory. Remove the whole
    // directory before returning so partially-created work files cannot
    // accumulate on a long-running production instance.
    const generationDir = require('path').dirname(pdfFilepath);
    await fsPromises.rm(generationDir, { recursive: true, force: true }).catch((cleanupErr: unknown) => {
      logger.warn('document_generate_cleanup_failed', {
        generationDir,
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    });
    pdfFilepath = undefined;

    const petitionerName =
      typeof affidavitData.petitionerName === 'string'
        ? affidavitData.petitionerName
        : [affidavitData.petitionerFirstName, affidavitData.petitionerLastName]
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .join('-');
    const standardName = [affidavitData.firstName, affidavitData.lastName]
      .filter(Boolean)
      .join('-');
    const baseName = sanitizeFilename(
      affidavitData.affiantName || petitionerName || standardName,
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
        const generationDir = require('path').dirname(pdfFilepath);
        await fs.promises.rm(generationDir, { recursive: true, force: true }).catch(() => undefined);
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
