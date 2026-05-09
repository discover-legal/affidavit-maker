import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
  toErrorResponse,
} from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  affidavitData: z
    .object({
      documentId: z.union([z.string(), z.number()]).optional(),
      documentTitle: z.string().optional(),
      affiantName: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      state: z.string().optional(),
      county: z.string().optional(),
      facts: z.array(z.unknown()).optional(),
      caseNumber: z.string().optional(),
      courtName: z.string().optional(),
      documentType: z.string().optional(),
    })
    .passthrough(),
  validation: z.unknown().optional(),
  categories: z.unknown().optional(),
});

// POST /api/documents/save — create or update a document. Mirrors the legacy
// upsert: if affidavitData.documentId is set, UPDATE; else INSERT.
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('documents-save', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const parsed = bodySchema.parse(json);
    const data = parsed.affidavitData;
    if (!data) throw new ValidationError('affidavitData is required');

    const affiantName =
      data.affiantName ??
      (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : null);

    const documentTitle =
      data.documentTitle ?? (affiantName ? `Affidavit of ${affiantName}` : 'Untitled Affidavit');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { factSummary: _fs, factSignature: _fsig, ...persistable } = data as Record<string, unknown>;
    const contentToSave = JSON.stringify(persistable);
    const validationJson = JSON.stringify(parsed.validation ?? null);

    if (data.documentId) {
      const id = String(data.documentId);
      const existing = await query<{ user_id: number }>(
        'SELECT user_id FROM documents WHERE id = $1',
        [id],
      );
      if (!existing.rows.length) throw new NotFoundError('Document not found');
      if (existing.rows[0].user_id !== user.id) throw new AuthorizationError('Access denied');
      const updated = await query<Record<string, unknown>>(
        `UPDATE documents
            SET content = $1, title = $2, template_state = $3, validation_results = $4,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 AND user_id = $6
          RETURNING *`,
        [contentToSave, documentTitle, data.state ?? null, validationJson, id, user.id],
      );
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
