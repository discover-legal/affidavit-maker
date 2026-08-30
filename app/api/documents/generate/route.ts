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
  classifyGenerationRequest,
  type TemplateManager,
  type AffidavitData,
} from '@/lib/api/documentStructure';
import { readJsonBody } from '@/lib/api/requestBody';
import { getUserProfile } from '@/lib/api/profile';

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

/**
 * Placeholder tokens the templates print verbatim when data is missing.
 * A rendered PDF that still carries any of these is unusable — the user
 * would file a document that says literally "[PETITIONER NAME]" where a
 * name belongs. Task blocker: TX Mari's petition rendered with
 * `[PETITIONER NAME]` and `[RESPONDENT NAME]` because the interview never
 * asked for her name.
 *
 * Explicit denylist (not a regex sweep) so the legitimate `[…]` tokens the
 * templates use for "the court fills this in" — `[DATE]`, `[NOTARY SEAL]`,
 * `[SEAL]`, `[JUDGE SIGNATURE]`, `[LABEL]` (exhibit label filled by the
 * builder at render time) — never trigger a false 422.
 *
 * Human-readable labels (used in the error message) map to the underlying
 * missing field(s) so the UI can prompt the user for the specific gap.
 */
const PLACEHOLDER_DENYLIST: ReadonlyArray<{ token: string; missing: string }> = [
  { token: '[PETITIONER NAME]',   missing: 'petitioner name' },
  { token: '[RESPONDENT NAME]',   missing: 'respondent name' },
  { token: '[PLAINTIFF NAME]',    missing: 'plaintiff name' },
  { token: '[DEFENDANT NAME]',    missing: 'defendant name' },
  { token: '[APPLICANT NAME]',    missing: 'applicant name' },
  { token: '[MOVANT]',            missing: 'movant name' },
  { token: '[DECLARANT]',         missing: 'declarant name' },
  { token: '[RECIPIENT NAME]',    missing: 'recipient name' },
  { token: '[SENDER NAME]',       missing: 'sender name' },
  { token: '[NAME]',              missing: 'name' },
  { token: '[CHILD NAME]',        missing: 'child name' },
  { token: '[BIRTH DATE]',        missing: 'child birth date' },
  { token: '[DOB]',               missing: 'date of birth' },
  { token: '[COURT NAME]',        missing: 'court name' },
  { token: '[COURT]',             missing: 'court name' },
  { token: '[CASE NUMBER]',       missing: 'case number' },
  { token: '[DOCKET NUMBER]',     missing: 'docket number' },
  { token: '[SUIT NUMBER]',       missing: 'suit number' },
  { token: '[FILE NUMBER]',       missing: 'file number' },
  { token: '[COUNTY]',            missing: 'county' },
  { token: '[CITY]',              missing: 'city' },
  { token: '[STATE]',             missing: 'state' },
  { token: '[DISTRICT]',          missing: 'judicial district' },
  { token: '[JUDICIAL DISTRICT]', missing: 'judicial district' },
  { token: '[JUDICIAL DIVISION]', missing: 'judicial division' },
  { token: '[REGISTRY]',          missing: 'registry' },
  { token: '[REGISTRY LOCATION]', missing: 'registry location' },
  { token: '[DATE OF MARRIAGE]',  missing: 'marriage date' },
  { token: '[DATE OF SEPARATION]', missing: 'separation date' },
  { token: '[MARRIAGE DATE]',     missing: 'marriage date' },
  { token: '[SEPARATION DATE]',   missing: 'separation date' },
  { token: '[COUNTY NAME]',       missing: 'county' },
  { token: '[LENGTH]',            missing: 'marriage length' },
  { token: '[AMOUNT]',            missing: 'support amount' },
  { token: '[DURATION]',          missing: 'support duration' },
  { token: '[PERIOD]',            missing: 'separation period' },
  { token: '[SUBJECT]',           missing: 'subject line' },
  { token: '[RECIPIENT ADDRESS]', missing: 'recipient address' },
  { token: '[SENDER ADDRESS]',    missing: 'sender address' },
];

/**
 * Serialize the built document structure and look for denylisted placeholder
 * tokens the templates leave behind when required data is missing. Returns
 * the set of human-readable missing-field labels (dedup'd, sorted for a
 * stable error body), empty when the rendered content is clean.
 *
 * JSON.stringify covers every nested paragraph/section field regardless of
 * which template class emitted it — cheaper and more defensive than walking
 * an ever-growing set of section shapes.
 */
function findUnfilledPlaceholders(structure: unknown): string[] {
  let serialized: string;
  try {
    serialized = JSON.stringify(structure);
  } catch {
    // A structure that can't serialize (unlikely for template output) can't
    // be scanned — fail open rather than reject an otherwise valid render.
    return [];
  }
  if (!serialized) return [];
  const hit = new Set<string>();
  for (const { token, missing } of PLACEHOLDER_DENYLIST) {
    if (serialized.includes(token)) hit.add(missing);
  }
  return Array.from(hit).sort();
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
      // The caller chooses WHICH document of an owned package to render
      // (petition vs decree, or one of the case's support documents) —
      // that choice is entitlement-neutral and must NOT be overwritten by
      // the saved row's document_type. Everything else comes from the
      // saved record. Prior to this fix, every /generate request for a
      // divorce_package returned the same petition PDF because the caller's
      // documentType was silently replaced with the row's document_type
      // (evidence: TX Mari's per-tab requests returned byte-identical
      // 6,092-byte petitions for indigency, cert_last_known_address, and
      // military_status_affidavit tabs).
      const callerActive = body.affidavitData.activeSubDocument;
      const callerDocType = body.affidavitData.documentType;
      affidavitData = generateSchema.shape.affidavitData.parse({
        ...(parsedContent as Record<string, unknown>),
        documentType: callerDocType ?? record.document_type ?? undefined,
        ...(callerActive !== undefined ? { activeSubDocument: callerActive } : {}),
      });
      // Case-packet requests reach here when the editor's "Download packet"
      // action posts to /api/documents/generate instead of the packet route.
      // The packet is assembled by /api/documents/packet (cover sheet + TOC
      // + evidence + separator pages), not this per-document generator —
      // return a truthful 400 pointing the caller at the correct endpoint
      // rather than the confusing "Requested output does not match the saved
      // document type" that assertGenerationTypeAllowed would emit
      // downstream (CA QA, 2026-08-28).
      const requestedTypeRaw = (affidavitData.documentType ?? '').trim().toLowerCase();
      if (requestedTypeRaw === 'case_packet') {
        return NextResponse.json(
          {
            success: false,
            error:
              'Case packets are downloaded via /api/documents/packet, not /api/documents/generate',
            errorType: 'WrongEndpoint',
          },
          { status: 400 },
        );
      }
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

    // ── STEP 2: Classify request → build document structure ──────────────
    // Explicit dispatch (added 2026-08-28): the caller's documentType picks
    // the concrete rendering path. Divorce petition/decree flow through the
    // jurisdictional template manager; support-doc kinds (indigency,
    // financial declaration, worksheets, prove-up, etc.) flow through
    // services/supportDocs, which is the same dispatcher /api/documents/support
    // uses. Unknown types were classified in classifyGenerationRequest and
    // already threw ValidationError above.
    const classification = classifyGenerationRequest(
      affidavitData.documentType,
      affidavitData.activeSubDocument,
      (affidavitData as Record<string, unknown>).role as string | undefined,
    );

    const services = await getServices();
    const templateManager = services.templateManager as TemplateManager | null;

    let documentStructure: unknown;

    if (classification.kind === 'support') {
      const supportKind = classification.name;
      // Support-doc builders live in services/supportDocs and don't take a
      // jurisdictional template manager — the builder itself IS the whole
      // render structure. Mirrors app/api/documents/support/route.ts.
      const supportDocs = require('@/services/supportDocs') as {
        getSupportDoc: (
          state: string,
          kind: string,
        ) => ((data: Record<string, unknown>, opts?: { signatureStyle?: string }) => unknown) | null;
      };
      const builder = supportDocs.getSupportDoc(affidavitData.state, supportKind);
      if (!builder) {
        // Kind is allow-listed but the (state, kind) pair has no builder yet.
        // Return a truthful 400 rather than silently rendering the wrong doc.
        throw new ValidationError(
          `Supporting document "${supportKind}" is not yet available for ${affidavitData.state}`,
        );
      }
      // Merge user-profile life-story fields UNDER the affidavitData so
      // saved editor input wins, matching /support's ordering (profile,
      // then document content, then explicit request extras).
      let merged: Record<string, unknown>;
      try {
        const profile = await getUserProfile(user.id);
        merged = { ...profile.profile, ...affidavitData };
        merged.profileFacts = profile.facts;
      } catch (profileErr) {
        // Profile read is best-effort here — the affidavitData already has
        // everything the editor knows.
        logger.warn('document_generate_profile_load_failed', {
          userId: user.id,
          error: profileErr instanceof Error ? profileErr.message : String(profileErr),
        });
        merged = { ...affidavitData };
      }
      try {
        documentStructure = builder(merged, { signatureStyle: 'unsworn' });
      } catch (builderErr) {
        logger.error('document_generate_support_builder_failed', {
          userId: user.id,
          documentId,
          state: affidavitData.state,
          supportKind,
          error: builderErr instanceof Error ? builderErr.message : String(builderErr),
        });
        throw new AppError('Failed to build supporting document', 500, 'TemplateError');
      }
    } else {
      if (!templateManager) {
        throw new AppError('Template manager unavailable', 503, 'ServiceUnavailable');
      }
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
    }

    // ── STEP 2.5: Refuse to render a document whose body still carries ─
    // literal `[…]` placeholder tokens the templates leave behind when the
    // required data is missing. This is the last-ditch guard against the
    // TX Mari class of blocker: an interview that never asked for the
    // user's name produced a petition that read "[PETITIONER NAME]" and
    // "[RESPONDENT NAME]" in the rendered PDF. 422 body carries the
    // human-readable list so the UI can prompt the user for the specific
    // missing fields rather than saying "try again".
    const missingFields = findUnfilledPlaceholders(documentStructure);
    if (missingFields.length > 0) {
      logger.warn('document_generate_blocked_missing_fields', {
        userId: user.id,
        documentId,
        state: affidavitData.state,
        documentType: affidavitData.documentType,
        missingFields,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Document cannot be generated: missing required fields — ${missingFields.join(', ')}`,
          errorType: 'MissingRequiredFields',
          missingFields,
        },
        { status: 422 },
      );
    }

    // ── STEP 3: Run pdfService two-pass generation ───────────────────────
    const PDFService = require('@/services/pdfService');
    // Support-doc structures are fully self-contained (no template lookup
    // during render); passing the templateManager is harmless but leaving it
    // off keeps the dependency graph honest.
    const pdfService =
      classification.kind === 'support'
        ? new PDFService()
        : new PDFService({ templateManager });

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
    // Filename prefix must reflect the ACTUAL document that was rendered so
    // per-tab downloads carry distinct, honest names (task blocker: Katie's
    // packet downloaded as "case-packet-<id>" and Mari's per-support-doc
    // requests all resolved through pdfService's generic "petition" tag,
    // producing indistinguishable filenames on disk).
    let prefix: string;
    if (classification.kind === 'support') {
      prefix = classification.name.replace(/_/g, '-');
    } else if (classification.kind === 'divorce') {
      prefix =
        classification.type === 'divorce_petition'
          ? 'petition'
          : classification.type === 'divorce_response'
            ? 'response'
            : 'decree';
    } else if (result.documentType === 'petition') {
      prefix = 'petition';
    } else if (result.documentType === 'decree') {
      prefix = 'decree';
    } else {
      prefix = 'affidavit';
    }
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
