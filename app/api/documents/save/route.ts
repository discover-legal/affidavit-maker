import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';
import { readJsonBody } from '@/lib/api/requestBody';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  affidavitData: z
    .object({
      documentId: z.union([z.string(), z.number()]).optional(),
      documentTitle: z.string().max(255).optional(),
      affiantName: z.string().max(255).optional(),
      firstName: z.string().max(120).optional(),
      lastName: z.string().max(120).optional(),
      state: z.string().max(8).optional(),
      county: z.string().max(100).optional(),
      facts: z.array(z.unknown()).max(500).optional(),
      caseNumber: z.string().max(80).optional(),
      courtName: z.string().max(200).optional(),
      documentType: z.string().max(64).optional(),
    })
    .passthrough(),
  validation: z.unknown().optional(),
  categories: z.unknown().optional(),
  expectedRevision: z.number().int().positive().optional(),
});

/** Cap the serialized document blob saved to documents.content. */
const MAX_SAVED_DOCUMENT_BYTES = 1024 * 1024;

// POST /api/documents/save — create or update a document. Mirrors the legacy
// upsert: if affidavitData.documentId is set, UPDATE; else INSERT.
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = await checkRateLimit('documents-save', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const json = await readJsonBody(req);
    const parsed = bodySchema.parse(json);
    const data = parsed.affidavitData;
    if (!data) throw new ValidationError('affidavitData is required');

    const affiantName =
      data.affiantName ??
      (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : null);

    const documentTitle =
      data.documentTitle ?? (affiantName ? `Affidavit of ${affiantName}` : 'Untitled Affidavit');

    const { factSummary: _fs, factSignature: _fsig, ...persistable } = data as Record<string, unknown>;
    const contentToSave = JSON.stringify(persistable);
    if (contentToSave.length > MAX_SAVED_DOCUMENT_BYTES) {
      throw new ValidationError('Document content too large');
    }
    const validationJson = JSON.stringify(parsed.validation ?? null);
    if (validationJson.length > MAX_SAVED_DOCUMENT_BYTES) {
      throw new ValidationError('Validation payload too large');
    }

    if (data.documentId) {
      const id = String(data.documentId);
      if (!parsed.expectedRevision) {
        throw new ValidationError('Document revision is required');
      }
      const updated = await query<Record<string, unknown>>(
        `UPDATE documents
            SET content = $1, title = $2, template_state = $3, validation_results = $4,
                updated_at = CURRENT_TIMESTAMP, edit_revision = edit_revision + 1
          WHERE id = $5 AND user_id = $6 AND edit_revision = $7
          RETURNING *`,
        [
          contentToSave,
          documentTitle,
          data.state ?? null,
          validationJson,
          id,
          user.id,
          parsed.expectedRevision,
        ],
      );
      if (!updated.rows.length) {
        // Preserve the same not-found response for missing and other-user IDs.
        const current = await query<{ edit_revision: number }>(
          'SELECT edit_revision FROM documents WHERE id = $1 AND user_id = $2',
          [id, user.id],
        );
        if (!current.rows.length) throw new NotFoundError('Document not found');
        return NextResponse.json(
          {
            success: false,
            error: 'This document was changed in another tab or device.',
            errorType: 'DocumentConflict',
            currentRevision: Number(current.rows[0].edit_revision),
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ success: true, document: updated.rows[0] });
    }

    const inserted = await query<Record<string, unknown>>(
      `INSERT INTO documents (
         user_id, title, document_type, template_state, content,
         validation_results, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        user.id,
        documentTitle,
        data.documentType ?? 'affidavit',
        data.state ?? null,
        contentToSave,
        validationJson,
      ],
    );
    return NextResponse.json({ success: true, document: inserted.rows[0] }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
});
