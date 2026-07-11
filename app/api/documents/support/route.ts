import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { getServices } from '@/lib/api/services';
import { getUserProfile } from '@/lib/api/profile';
import { logger } from '@/lib/logger';
import {
  AppError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPORT_DOC_KINDS = [
  'acceptance_of_service',
  'certificate_of_service',
  'financial_declaration',
  'default_package',
  'finalization_prep',
  'answer',
  'fee_waiver_motion',
  'lawyer_handoff',
] as const;

const supportSchema = z.object({
  kind: z.enum(SUPPORT_DOC_KINDS),
  state: z.string().length(2),
  documentId: z.union([z.string(), z.number()]).optional(),
  signatureStyle: z.enum(['unsworn', 'notary']).optional(),
  // Kind-specific user input (e.g. the answer's admit/deny positions),
  // merged over the profile + document data below — extra wins. Builders
  // sanitize and cap what they read from it.
  extra: z.record(z.unknown()).optional(),
});

type SupportDocBuilder = (
  data: Record<string, unknown>,
  opts?: { signatureStyle?: string },
) => unknown;

type SupportDocsModule = {
  getSupportDoc: (state: string, kind: string) => SupportDocBuilder | null;
  list: (state: string) => Array<{
    key: string;
    title: string;
    titleEs: string;
    description: string;
    descriptionEs: string;
  }>;
};

type PdfServiceResult = {
  success: boolean;
  filepath?: string;
  filename?: string;
  pages?: number;
  documentType?: string;
};

/**
 * Sanitize a candidate filename — alphanumerics + dashes only, collapsed,
 * trimmed, length-capped. Same defense as documents/generate/route.ts
 * (header injection / traversal in `Content-Disposition`).
 */
function sanitizeFilename(input: string | undefined, fallback: string): string {
  const base = (input ?? '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/-+/g, '-');
  const trimmed = base.replace(/^-+|-+$/g, '').slice(0, 80);
  return trimmed || fallback;
}

/**
 * GET /api/documents/support?state=UT
 *
 * Lists the supporting-document kinds available for a state, with human
 * titles + descriptions in English and Spanish. Empty list for states we
 * don't cover yet.
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('documents-support-list', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', errorType: 'RateLimitError' },
        { status: 429 },
      );
    }

    const state = (req.nextUrl.searchParams.get('state') ?? 'UT').toUpperCase();
    const { list } = require('@/services/supportDocs') as SupportDocsModule;
    return NextResponse.json({
      success: true,
      data: { kinds: list(state) },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});

/**
 * POST /api/documents/support
 *
 * Builds a supporting court document (Utah-first: acceptance of service,
 * certificate of service, financial declaration, default package,
 * finalization prep sheet) from the user's stored data and streams it back
 * as a PDF.
 *
 * Data source: when `documentId` is given, the saved document's content blob
 * is loaded (ownership-checked, same pattern as documents/generate) and
 * merged OVER the life-story profile; otherwise the profile alone. Rendering
 * goes through the exact pdfService path documents/generate uses.
 *
 * No payment gate — these are supporting papers, not the paid main document.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  let pdfFilepath: string | undefined;

  try {
    const limit = checkRateLimit('documents-support', user.id, RATE_LIMITS.pdf);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', errorType: 'RateLimitError' },
        { status: 429 },
      );
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const body = supportSchema.parse(json);
    const stateCode = body.state.toUpperCase();
    const signatureStyle = body.signatureStyle ?? 'unsworn';

    const { getSupportDoc } = require('@/services/supportDocs') as SupportDocsModule;
    const builder = getSupportDoc(stateCode, body.kind);
    if (!builder) {
      throw new ValidationError('Supporting documents are not yet available for this state');
    }

    // ── Load the user's data: saved document content merged over profile ──
    const profile = await getUserProfile(user.id);
    let merged: Record<string, unknown> = { ...profile.profile };

    if (body.documentId !== undefined) {
      const documentId = String(body.documentId).trim();
      // Same id shape as documents/[id]: positive 32-bit integer, so a
      // non-numeric value never reaches pg.
      if (!/^[1-9]\d{0,9}$/.test(documentId)) {
        throw new ValidationError('Invalid document ID');
      }
      // Ownership check + fetch in one statement (probe protection: always
      // 404, never reveal whether the row exists for someone else).
      const row = await query<{ content: unknown }>(
        'SELECT content FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, user.id],
      );
      if (row.rows.length === 0) {
        throw new NotFoundError('Document not found');
      }
      const rawContent = row.rows[0].content;
      let docContent: Record<string, unknown> = {};
      try {
        const parsed =
          typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          docContent = parsed as Record<string, unknown>;
        }
      } catch {
        logger.warn('document_support_content_parse_failed', {
          userId: user.id,
          documentId,
        });
      }
      // Document content wins over profile — the document is the more
      // specific, more recent record of this case.
      merged = { ...merged, ...docContent };
    }
    if (body.extra) {
      // Explicit per-request input (answer positions, etc.) wins over both.
      merged = { ...merged, ...body.extra };
    }
    merged.state = stateCode;
    // The lawyer handoff summarizes the user's own account and paperwork;
    // give every builder the profile facts (with provenance) and the list
    // of documents prepared so far.
    merged.profileFacts = profile.facts;
    if (body.kind === 'lawyer_handoff') {
      const docs = await query<{ title: string | null; document_type: string | null }>(
        'SELECT title, document_type FROM documents WHERE user_id = $1 ORDER BY created_at',
        [user.id],
      );
      merged.generatedDocuments = docs.rows
        .map((d) => (d.title || d.document_type || '').trim())
        .filter(Boolean)
        .slice(0, 40);
    }

    // ── Build the document structure ───────────────────────────────────
    let documentStructure: unknown;
    try {
      documentStructure = builder(merged, { signatureStyle });
    } catch (builderErr) {
      logger.error('document_support_builder_failed', {
        userId: user.id,
        kind: body.kind,
        state: stateCode,
        error: builderErr instanceof Error ? builderErr.message : String(builderErr),
      });
      throw new AppError('Failed to build supporting document', 500, 'TemplateError');
    }

    // ── Render via the same pdfService path documents/generate uses ─────
    const services = await getServices();
    const PDFService = require('@/services/pdfService');
    const pdfService = new PDFService({ templateManager: services.templateManager });

    let result: PdfServiceResult;
    try {
      result = (await pdfService.generatePDF(documentStructure, {
        // Not the DB documentId: this value lands in the temp filename on
        // disk, so keep it server-generated.
        documentId: `support-${Date.now()}`,
        userId: user.id,
      })) as PdfServiceResult;
    } catch (pdfErr) {
      logger.error('document_support_pdf_failed', {
        userId: user.id,
        kind: body.kind,
        error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
      });
      throw new AppError('Failed to generate document', 500, 'PDFGenerationError');
    }

    if (!result.success || !result.filepath) {
      throw new AppError('Document generation returned no filepath', 500, 'PDFGenerationError');
    }

    pdfFilepath = result.filepath;

    const fs = require('fs') as typeof import('fs');
    const fileBuffer = await fs.promises.readFile(pdfFilepath);

    // Cleanup — fire-and-forget, matching documents/generate.
    fs.promises.unlink(pdfFilepath).catch((cleanupErr: unknown) => {
      logger.warn('document_support_cleanup_failed', {
        filepath: pdfFilepath,
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
      });
    });
    pdfFilepath = undefined;

    // The respondent signs acceptances and answers; everything else is
    // petitioner-signed (or unsigned, like the handoff).
    const nameSource =
      body.kind === 'acceptance_of_service' || body.kind === 'answer'
        ? (merged.respondentName as string | undefined)
        : (merged.petitionerName as string | undefined);
    const baseName = sanitizeFilename(nameSource, 'document');
    const safeFilename = `${body.kind.replace(/_/g, '-')}-${baseName}.pdf`;

    logger.info('document_support_generated', {
      userId: user.id,
      kind: body.kind,
      state: stateCode,
      signatureStyle,
      bytes: fileBuffer.length,
      pages: result.pages,
    });

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${safeFilename}"`,
        'content-length': String(fileBuffer.length),
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    if (pdfFilepath) {
      try {
        const fs = require('fs') as typeof import('fs');
        await fs.promises.unlink(pdfFilepath).catch(() => undefined);
      } catch {
        /* swallow — already in error path */
      }
    }
    logger.error('document_support_failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return toErrorResponse(err);
  }
});
