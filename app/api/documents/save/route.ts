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

// A single persisted chat message. The client sends `type` ('user' | 'bot');
// `role` is accepted as an alias so LLM-shaped transcripts round-trip too.
const conversationMessageSchema = z.object({
  type: z.string().max(16).optional(),
  role: z.string().max(16).optional(),
  content: z.string().max(6000),
});

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
  // Chat transcript for this document. Optional: when absent the stored
  // transcript is preserved (COALESCE), never blanked.
  conversationHistory: z.array(conversationMessageSchema).max(60).optional(),
});

/** Cap the serialized document blob saved to documents.content. */
const MAX_SAVED_DOCUMENT_BYTES = 1024 * 1024;

/** Cap the serialized transcript saved to documents.conversation_history. */
const MAX_CONVERSATION_HISTORY_BYTES = 256 * 1024;

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

    // conversationHistory is persisted to its own column below — strip it
    // from the content blob (like the derived factSummary/factSignature
    // caches) so the transcript is never stored twice.
    const {
      factSummary: _fs,
      factSignature: _fsig,
      conversationHistory: _ch,
      ...persistable
    } = data as Record<string, unknown>;
    const contentToSave = JSON.stringify(persistable);
    if (contentToSave.length > MAX_SAVED_DOCUMENT_BYTES) {
      throw new ValidationError('Document content too large');
    }
    const validationJson = JSON.stringify(parsed.validation ?? null);
    if (validationJson.length > MAX_SAVED_DOCUMENT_BYTES) {
      throw new ValidationError('Validation payload too large');
    }

    // null (not '[]') when absent so the SQL COALESCE keeps the stored
    // transcript instead of overwriting it.
    const conversationHistoryJson = parsed.conversationHistory
      ? JSON.stringify(parsed.conversationHistory)
      : null;
    if (conversationHistoryJson && conversationHistoryJson.length > MAX_CONVERSATION_HISTORY_BYTES) {
      throw new ValidationError('Conversation history too large');
    }

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
                conversation_history = COALESCE($5::jsonb, conversation_history),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $6 AND user_id = $7
          RETURNING *`,
        [contentToSave, documentTitle, data.state ?? null, validationJson, conversationHistoryJson, id, user.id],
      );
      return NextResponse.json({ success: true, document: updated.rows[0] });
    }

    const inserted = await query<Record<string, unknown>>(
      `INSERT INTO documents (
         user_id, title, document_type, template_state, content,
         validation_results, conversation_history, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        user.id,
        documentTitle,
        data.documentType ?? 'affidavit',
        data.state ?? null,
        contentToSave,
        validationJson,
        conversationHistoryJson,
      ],
    );
    return NextResponse.json({ success: true, document: inserted.rows[0] }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
});
