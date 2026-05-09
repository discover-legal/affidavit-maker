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

const updateCaseSchema = z
  .object({
    matter_type_code: z.string().optional(),
    title: z.string().optional(),
    cause_number: z.string().optional(),
    court_name: z.string().optional(),
    state: z.string().optional(),
    county: z.string().optional(),
    petitioner_first_name: z.string().optional(),
    petitioner_last_name: z.string().optional(),
    respondent_first_name: z.string().optional(),
    respondent_last_name: z.string().optional(),
    children: z.array(z.unknown()).optional(),
    case_metadata: z.record(z.unknown()).optional(),
    status: z.string().optional(),
    interview_phase: z.string().optional(),
    interview_data: z.record(z.unknown()).optional(),
  })
  .strict();

function parseCaseId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new ValidationError('Invalid case ID');
  }
  return id;
}

// GET /api/cases/[id]
export const GET = withAuth<{ id: string | string[] }>(async (_req, { user, params }) => {
  try {
    const limit = checkRateLimit('cases-by-id', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const caseId = parseCaseId(params.id);
    const caseResult = await query<{ user_id: string }>(
      'SELECT * FROM cases WHERE id = $1',
      [caseId],
    );
    if (!caseResult.rows.length) throw new NotFoundError('Case not found');
    if (caseResult.rows[0].user_id !== user.id) throw new AuthorizationError('Access denied');

    const docs = await query(
      `SELECT id, title, document_type, status, updated_at, created_at
         FROM documents
        WHERE case_id = $1
        ORDER BY updated_at DESC`,
      [caseId],
    );
    return NextResponse.json({
      success: true,
      data: { case: caseResult.rows[0], documents: docs.rows },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});

// PUT /api/cases/[id]
export const PUT = withAuth<{ id: string | string[] }>(async (req: NextRequest, { user, params }) => {
  try {
    const limit = checkRateLimit('cases-by-id', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const caseId = parseCaseId(params.id);

    const existing = await query<{ user_id: string }>(
      'SELECT user_id FROM cases WHERE id = $1',
      [caseId],
    );
    if (!existing.rows.length) throw new NotFoundError('Case not found');
    if (existing.rows[0].user_id !== user.id) throw new AuthorizationError('Access denied');

    const json = (await req.json().catch(() => ({}))) as unknown;
    const body = updateCaseSchema.parse(json);

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const add = (col: string, val: unknown) => {
      if (val !== undefined) {
        updates.push(`${col} = $${idx++}`);
        values.push(val);
      }
    };

    add('matter_type_code', body.matter_type_code);
    add('title', body.title);
    add('cause_number', body.cause_number);
    add('court_name', body.court_name);
    add('state', body.state);
    add('county', body.county);
    add('petitioner_first_name', body.petitioner_first_name);
    add('petitioner_last_name', body.petitioner_last_name);
    add('respondent_first_name', body.respondent_first_name);
    add('respondent_last_name', body.respondent_last_name);
    if (body.children !== undefined) add('children', JSON.stringify(body.children));
    if (body.case_metadata !== undefined) add('case_metadata', JSON.stringify(body.case_metadata));
    add('status', body.status);
    add('interview_phase', body.interview_phase);
    if (body.interview_data !== undefined) add('interview_data', JSON.stringify(body.interview_data));

    if (updates.length === 0) {
      throw new ValidationError('No fields provided to update');
    }

    values.push(caseId);
    const result = await query(
      `UPDATE cases SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return NextResponse.json({
      success: true,
      data: { case: result.rows[0] },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
