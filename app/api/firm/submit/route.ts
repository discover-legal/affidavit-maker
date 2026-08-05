import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import {
  ExternalServiceError,
  NotFoundError,
  toErrorResponse,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { isFirmMode } from '@/lib/biglaw/config';
import { getBigLawClient } from '@/lib/biglaw/client';
import { normalizeSubmissionStatus, type IntakeFactInput } from '@/lib/biglaw/types';
import { ALL_STATES, ALL_PROVINCES } from '@/lib/api/catalog-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  documentId: z.coerce.number().int().positive(),
});

/** Max facts seeded from the draft into CRM proposals (contract §3.5 cap). */
const MAX_SEED_FACTS = 20;
const MAX_FACT_VALUE_CHARS = 2000;
const MAX_PREDICATE_CHARS = 64;

type DocumentRow = {
  id: number;
  title: string | null;
  document_type: string | null;
  template_state: string | null;
  content: unknown;
  practice_area: string | null;
};

type PreviewRenderer = {
  generateFormattedString: (affidavitData: unknown) => string;
};

/** Parse the JSONB content column defensively — pg returns an object, but
 * legacy rows may carry a double-encoded JSON string. */
function parseContent(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }
  return {};
}

/**
 * Produce the readable draft text the lawyer receives. Preference order:
 *   1. A pre-rendered string stored on the content blob (formattedPreview /
 *      preview / renderedText) — none of these are written by the current
 *      editor, but honour them if present.
 *   2. services/previewRenderer.generateFormattedString — the same
 *      deterministic renderer the PDF pipeline uses (header, sworn intro,
 *      numbered facts, perjury clause), so the firm sees the document as
 *      the client would, not raw JSON.
 *   3. JSON.stringify(content) as a last resort.
 */
function renderDraftText(content: Record<string, unknown>): string {
  for (const key of ['formattedPreview', 'preview', 'renderedText'] as const) {
    const candidate = content[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  try {
    const previewRenderer = require('@/services/previewRenderer') as PreviewRenderer;
    const rendered = previewRenderer.generateFormattedString(content);
    if (typeof rendered === 'string' && rendered.trim()) return rendered;
  } catch (err) {
    logger.warn('firm_submit_render_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return JSON.stringify(content);
}

/**
 * Map the editor's facts array to CRM fact proposals. Evidence entries
 * (fact.type === 'evidence', see lib/utils/factNormalizer.js) are exhibits,
 * not client facts — skip them. Capped at 20 per the contract.
 */
function extractSeedFacts(content: Record<string, unknown>): IntakeFactInput[] {
  const rawFacts = Array.isArray(content.facts) ? content.facts : [];
  const seeds: IntakeFactInput[] = [];
  for (const raw of rawFacts) {
    if (seeds.length >= MAX_SEED_FACTS) break;
    if (!raw || typeof raw !== 'object') continue;
    const fact = raw as Record<string, unknown>;
    if (fact.type === 'evidence') continue;
    const value =
      (typeof fact.text === 'string' && fact.text.trim()) ||
      (typeof fact.content === 'string' && fact.content.trim()) ||
      '';
    if (!value) continue;
    const predicate =
      (typeof fact.type === 'string' && fact.type.trim()) || 'fact';
    seeds.push({
      category: 'matter',
      predicate: predicate.slice(0, MAX_PREDICATE_CHARS),
      value: value.slice(0, MAX_FACT_VALUE_CHARS),
      note: '',
    });
  }
  return seeds;
}

/** Map template_state → BCP-47-style region tag (contract §3.1). */
function toJurisdiction(templateState: string | null): string | undefined {
  if (!templateState || !templateState.trim()) return undefined;
  const code = templateState.trim().toUpperCase();
  if (ALL_STATES.includes(code)) return `US-${code}`;
  if (ALL_PROVINCES.includes(code)) return `CA-${code}`;
  return code;
}

// POST /api/firm/submit — send a saved draft to the firm's BigLaw platform.
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = await checkRateLimit('firm-submit', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    if (!isFirmMode()) {
      throw new ExternalServiceError('Firm mode is not enabled on this deployment');
    }
    const biglaw = getBigLawClient();
    if (!biglaw) {
      throw new ExternalServiceError('Firm mode is not enabled on this deployment');
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const { documentId } = bodySchema.parse(json);

    // Ownership check in SQL in addition to RLS; missing OR foreign both 404
    // so a probe can't distinguish other users' documents from nonexistent.
    const result = await query<DocumentRow>(
      `SELECT id, title, document_type, template_state, content, practice_area
         FROM documents
        WHERE id = $1 AND user_id = $2`,
      [documentId, user.id],
    );
    if (!result.rows.length) throw new NotFoundError('Document not found');
    const doc = result.rows[0];

    const content = parseContent(doc.content);
    const draftText = renderDraftText(content);
    const facts = extractSeedFacts(content);

    const submission = await biglaw.submitIntake({
      externalId: `am-doc-${documentId}`,
      client: {
        externalId: user.auth0Id,
        email: user.email,
        name: user.name || user.email,
      },
      title: doc.title || 'Untitled document',
      documentType: doc.document_type || 'affidavit',
      matterType: doc.practice_area || undefined,
      jurisdiction: toJurisdiction(doc.template_state),
      content: draftText,
      facts,
    });

    const status = normalizeSubmissionStatus(submission.status);
    const hasConflict = Boolean(submission.conflict?.hasConflict);

    await query(
      `INSERT INTO firm_submissions (user_id, document_id, biglaw_submission_id, status, conflict)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (document_id) DO UPDATE
         SET biglaw_submission_id = EXCLUDED.biglaw_submission_id,
             status = EXCLUDED.status,
             conflict = EXCLUDED.conflict,
             updated_at = NOW()`,
      [user.id, documentId, submission.id, status, hasConflict],
    );

    // The firm covers document generation for its clients — mark the
    // document 'free' so the payment gate in /api/documents/generate
    // (VALID_PAYMENT_STATUSES allow-list) lets the download through.
    await query(
      `UPDATE documents
          SET payment_status = 'free', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2`,
      [documentId, user.id],
    );

    logger.info('firm_submission_created', {
      userId: user.id,
      documentId,
      biglawSubmissionId: submission.id,
      status,
      hasConflict,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          submission: {
            documentId,
            biglawSubmissionId: submission.id,
            status,
            conflict: hasConflict,
            clientNumber: submission.clientNumber,
            createdAt: submission.createdAt,
          },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
});
