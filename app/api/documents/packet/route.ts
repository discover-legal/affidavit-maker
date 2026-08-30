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
import { ALL_STATES, ALL_PROVINCES } from '@/lib/api/catalog-data';
import { paymentsEnabled } from '@/lib/api/stripe';
import {
  buildDocumentStructureForType,
  listPacketDocumentTypes,
  packetRenderContextFor,
  type AffidavitData,
  type TemplateManager,
} from '@/lib/api/documentStructure';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const packetSchema = z.object({
  documentId: z.union([z.string(), z.number()]),
  state: z.string().min(2).max(8).optional(),
});

const VALID_PAYMENT_STATUSES = new Set(['paid', 'completed', 'free', 'succeeded']);

type PdfServiceResult = {
  success: boolean;
  filepath?: string;
  filename?: string;
  pages?: number;
  documentType?: string;
};

type EvidenceStorageModule = {
  listEvidenceForDocument: (
    userId: number | string,
    documentId: number | string,
  ) => Promise<Array<{ filename: string; fileKey: string; fileSizeBytes: number }>>;
  getEvidence: (
    userId: number | string,
    documentId: number | string,
    fileKey: string,
  ) => Promise<{ filepath: string; exists: boolean }>;
};

type PacketEvidenceItem = {
  label: string;
  originalName: string;
  mime: string;
  buffer: Buffer | null;
};

type CourtPacketModule = {
  assemblePacket: (opts: {
    /** Multi-document form: every rendered document in filing order. */
    documents?: Array<{ buffer: Buffer; title?: string }>;
    /** Single-document form (used when `documents` is absent). */
    mainPdfBuffer?: Buffer;
    mainTitle?: string;
    evidence?: PacketEvidenceItem[];
    state?: string;
    county?: string;
    packetDate?: string;
    parties?: string[];
  }) => Promise<Buffer>;
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

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

type EvidenceFactMeta = { fileName?: string; description?: string };

/**
 * Pull fileKey → { fileName, description } out of the saved content blob's
 * evidence facts, so exhibits carry the user's original filename and label
 * (the on-disk name is just `<uuid>.<ext>`). Returns keys in fact order so
 * exhibit lettering follows the order the user arranged their evidence.
 */
function extractEvidenceMeta(content: Record<string, unknown>): Map<string, EvidenceFactMeta> {
  const meta = new Map<string, EvidenceFactMeta>();
  const facts = Array.isArray(content.facts) ? content.facts : [];
  for (const fact of facts) {
    if (!fact || typeof fact !== 'object') continue;
    const f = fact as {
      type?: string;
      evidenceData?: { fileKey?: string; fileName?: string; description?: string };
    };
    const fileKey = f.evidenceData?.fileKey;
    if (f.type === 'evidence' && typeof fileKey === 'string' && fileKey && !meta.has(fileKey)) {
      meta.set(fileKey, {
        fileName: f.evidenceData?.fileName ?? undefined,
        description: f.evidenceData?.description ?? undefined,
      });
    }
  }
  return meta;
}

/**
 * POST /api/documents/packet
 *
 * "Print your case packet": assembles the user's saved document — every
 * sub-document of a multi-document package (divorce_package = petition +
 * decree, in filing order), rendered through the exact pdfService path
 * documents/generate uses — plus every uploaded evidence file into ONE
 * organized draft PDF with a cover sheet,
 * table of contents, exhibit separator pages, and an exhibit index
 * (services/courtPacket).
 *
 * The packet contains the complete rendered legal document, so it enforces
 * the same server-side paid/free status as documents/generate.
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  let pdfFilepath: string | undefined;

  try {
    const limit = await checkRateLimit('documents-packet', user.id, RATE_LIMITS.pdf);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', errorType: 'RateLimitError' },
        { status: 429 },
      );
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const body = packetSchema.parse(json);

    // Same id shape as documents/[id]: positive 32-bit integer, so a
    // non-numeric value never reaches pg.
    const documentId = String(body.documentId).trim();
    if (!/^[1-9]\d{0,9}$/.test(documentId) || Number(documentId) > 2_147_483_647) {
      throw new ValidationError('Invalid document ID');
    }

    // Ownership check + fetch in one statement (probe protection: always
    // 404, never reveal whether the row exists for someone else).
    const row = await query<{
      content: unknown;
      title: string | null;
      document_type: string | null;
      template_state: string | null;
      payment_status: string | null;
    }>(
      `SELECT content, title, document_type, template_state, payment_status
         FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, user.id],
    );
    if (row.rows.length === 0) {
      throw new NotFoundError('Document not found');
    }
    const doc = row.rows[0];

    if (paymentsEnabled() && !VALID_PAYMENT_STATUSES.has(doc.payment_status ?? '')) {
      logger.warn('document_packet_payment_required', {
        userId: user.id,
        documentId,
        paymentStatus: doc.payment_status ?? '',
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

    let content: Record<string, unknown> = {};
    try {
      const parsed =
        typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        content = parsed as Record<string, unknown>;
      }
    } catch {
      logger.warn('document_packet_content_parse_failed', { userId: user.id, documentId });
    }

    // Resolve the jurisdiction: explicit request > saved content > saved
    // template_state. Anything outside the known US/CA set degrades to the
    // generic render path instead of erroring — the packet must still
    // assemble for older/imperfect saves.
    const candidateState = (
      body.state ??
      (typeof content.state === 'string' ? content.state : undefined) ??
      doc.template_state ??
      ''
    )
      .trim()
      .toUpperCase();
    const allowed = new Set<string>([...ALL_STATES, ...ALL_PROVINCES]);
    const stateCode = allowed.has(candidateState) ? candidateState : undefined;

    const title =
      (typeof content.documentTitle === 'string' && content.documentTitle) ||
      doc.title ||
      'Legal Document';

    // ── STEP 1: Render the main document(s) the same way documents/generate ──
    // does. Multi-document packages (divorce_package = petition + decree)
    // expand to EVERY sub-document in filing order — a filed divorce packet
    // needs both pleadings, not just the one open in the editor.
    const services = await getServices();
    const templateManager = services.templateManager as TemplateManager | null;

    const packetTypes = listPacketDocumentTypes(
      doc.document_type ?? (content.documentType as string | undefined),
      // Role-aware: a respondent's divorce_package expands to just the
      // decree draft, not the petition (which is the other side's filing).
      content.role as string | undefined,
    );

    const documentStructures: unknown[] = [];
    if (stateCode && templateManager) {
      for (const packetType of packetTypes) {
        try {
          // Same builder as documents/generate: divorce packages route to
          // their jurisdiction-specific petition/decree templates instead of
          // being flattened into a generic affidavit with [PLACEHOLDER]
          // captions. The saved row's document_type is authoritative.
          documentStructures.push(
            buildDocumentStructureForType(
              templateManager,
              stateCode,
              { ...content, state: stateCode, documentType: packetType } as AffidavitData,
              packetType,
              {
                // Bug (Tavita, FL): a respondent-side packet must not put the
                // Final Judgment of Dissolution in the "file this" pile; the
                // court signs the decree. Mark it as REFERENCE — NOT FOR
                // FILING so the packet still shows the eventual terms without
                // implying the respondent files it.
                renderContext: packetRenderContextFor(
                  content.role as string | undefined,
                  packetType,
                ),
              },
            ),
          );
        } catch (templateErr) {
          // Per-sub-document degradation: a jurisdiction missing (say) the
          // decree template still packets the petition.
          logger.warn('document_packet_template_failed_falling_back', {
            userId: user.id,
            documentId,
            state: stateCode,
            packetType,
            error: templateErr instanceof Error ? templateErr.message : String(templateErr),
          });
        }
      }
    }
    if (documentStructures.length === 0) {
      // Generic degraded path: the saved content lacks the fields the state
      // template needs (or the state is unknown). Render a plain document
      // from whatever facts we have rather than 500-ing.
      const rawFacts = Array.isArray(content.facts) ? content.facts : [];
      const items = rawFacts
        .map((f) => {
          if (typeof f === 'string') return f;
          if (f && typeof f === 'object') {
            const t = (f as { text?: unknown; content?: unknown }).text ??
              (f as { content?: unknown }).content;
            return typeof t === 'string' ? t : '';
          }
          return '';
        })
        .filter(Boolean)
        .map((text, idx) => ({ number: idx + 1, content: text }));
      documentStructures.push({
        documentType: 'affidavit',
        state: stateCode,
        sections: {
          title,
          introduction:
            'This document was prepared from the saved case record with Discover.Legal.',
          facts: items.length > 0 ? { items } : undefined,
        },
      });
    }

    const PDFService = require('@/services/pdfService');
    const pdfService = new PDFService({ templateManager });
    const fs = require('fs') as typeof import('fs');

    // Render each structure through the exact pdfService path documents/
    // generate uses, collecting {buffer, title} in filing order. The
    // entitlement + rate-limit checks above already ran once for the whole
    // request — they gate the saved row, not individual renders.
    const renderedDocuments: Array<{ buffer: Buffer; title: string }> = [];
    for (let i = 0; i < documentStructures.length; i += 1) {
      const structure = documentStructures[i];
      let result: PdfServiceResult;
      try {
        // Deliberately NOT passing `userId`: pdfService.generatePDF appends
        // its own exhibit pages when userId is present, and the packet
        // assembler adds separator pages + exhibits itself — passing userId
        // would duplicate every exhibit. documentId here is server-generated
        // (it lands in the temp filename on disk); the index suffix keeps
        // each render's temp file unique within the request.
        result = (await pdfService.generatePDF(structure, {
          documentId: `packet-${documentId}-${Date.now()}-${i}`,
        })) as PdfServiceResult;
      } catch (pdfErr) {
        logger.error('document_packet_pdf_failed', {
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

      const renderedPath = result.filepath;
      const buffer = await fs.promises.readFile(/* turbopackIgnore: true */ renderedPath);

      // This render's temp file is consumed — clean up now, fire-and-forget
      // (matching documents/generate).
      fs.promises.unlink(renderedPath).catch((cleanupErr: unknown) => {
        logger.warn('document_packet_cleanup_failed', {
          filepath: renderedPath,
          error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      });
      pdfFilepath = undefined;

      // The structure knows the real pleading name ("Verified Petition for
      // Divorce"); the saved title/"Legal Document" is only a fallback.
      const structureTitle = (
        structure as { metadata?: { documentTitle?: unknown } } | null
      )?.metadata?.documentTitle;
      renderedDocuments.push({
        buffer,
        title:
          typeof structureTitle === 'string' && structureTitle.trim()
            ? structureTitle.trim()
            : title,
      });
    }

    // ── STEP 2: Load the uploaded evidence for this document ────────────────
    const evidenceStorage = require('@/services/evidenceStorage') as EvidenceStorageModule;
    const listed = await evidenceStorage.listEvidenceForDocument(user.id, documentId);
    const factMeta = extractEvidenceMeta(content);

    // Exhibit order: evidence facts first (the order the user arranged),
    // then any uploaded files the facts don't reference.
    const byKey = new Map(listed.map((f) => [f.fileKey, f]));
    const orderedKeys: string[] = [];
    for (const key of factMeta.keys()) {
      if (byKey.has(key)) orderedKeys.push(key);
    }
    for (const f of listed) {
      if (!orderedKeys.includes(f.fileKey)) orderedKeys.push(f.fileKey);
    }

    const evidence: PacketEvidenceItem[] = [];
    for (const fileKey of orderedKeys) {
      const file = byKey.get(fileKey)!;
      const meta = factMeta.get(fileKey);
      const originalName = meta?.fileName || file.filename;
      const mime = mimeFromFilename(originalName) !== 'application/octet-stream'
        ? mimeFromFilename(originalName)
        : mimeFromFilename(file.filename);
      let buffer: Buffer | null = null;
      try {
        const { filepath } = await evidenceStorage.getEvidence(user.id, documentId, fileKey);
        buffer = await fs.promises.readFile(/* turbopackIgnore: true */ filepath);
      } catch (readErr) {
        // Tolerate individual read failures: the assembler substitutes a
        // "print separately" placeholder page for a null buffer.
        logger.warn('document_packet_evidence_read_failed', {
          userId: user.id,
          documentId,
          fileKey,
          error: readErr instanceof Error ? readErr.message : String(readErr),
        });
      }
      evidence.push({
        label: meta?.description ?? '',
        originalName,
        mime,
        buffer,
      });
    }

    // ── STEP 3: Assemble the packet ─────────────────────────────────────────
    const { assemblePacket } = require('@/services/courtPacket') as CourtPacketModule;

    const parties: string[] = [];
    if (typeof content.petitionerName === 'string' && content.petitionerName.trim()) {
      parties.push(`Petitioner: ${content.petitionerName.trim()}`);
    }
    if (typeof content.respondentName === 'string' && content.respondentName.trim()) {
      parties.push(`Respondent: ${content.respondentName.trim()}`);
    }
    if (parties.length === 0 && typeof content.affiantName === 'string' && content.affiantName.trim()) {
      parties.push(`Affiant: ${content.affiantName.trim()}`);
    }

    // Multi-document packages pass the filing-order array (petition first);
    // single-document types keep the historical single-buffer call shape.
    const mainTitle = renderedDocuments[0].title;
    const packetBuffer = await assemblePacket({
      ...(renderedDocuments.length > 1
        ? { documents: renderedDocuments }
        : { mainPdfBuffer: renderedDocuments[0].buffer, mainTitle }),
      evidence,
      state: stateCode,
      county: typeof content.county === 'string' ? content.county : undefined,
      packetDate: new Date().toISOString().slice(0, 10),
      parties,
    });

    const baseName = sanitizeFilename(
      mainTitle !== 'Legal Document'
        ? mainTitle
        : typeof content.affiantName === 'string'
        ? content.affiantName
        : undefined,
      'document',
    );
    const safeFilename = `case-packet-${baseName}.pdf`;

    logger.info('document_packet_generated', {
      userId: user.id,
      documentId,
      state: stateCode,
      documents: renderedDocuments.length,
      exhibits: evidence.length,
      bytes: packetBuffer.length,
    });

    return new Response(new Uint8Array(packetBuffer), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${safeFilename}"`,
        'content-length': String(packetBuffer.length),
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    // Best-effort cleanup if we threw between writing the temp file and
    // consuming it.
    if (pdfFilepath) {
      try {
        const fs = require('fs') as typeof import('fs');
        await fs.promises.unlink(pdfFilepath).catch(() => undefined);
      } catch {
        /* swallow — already in error path */
      }
    }
    logger.error('document_packet_failed', {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return toErrorResponse(err);
  }
});
