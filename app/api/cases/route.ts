import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { query } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createCaseSchema = z.object({
  practice_area: z.enum(['family', 'civil']).default('family'),
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
  children: z.array(z.unknown()).default([]),
  case_metadata: z.record(z.unknown()).default({}),
  interview_phase: z.string().default('INTAKE'),
  interview_data: z.record(z.unknown()).default({}),
});

// GET /api/cases — list cases for the current user
export const GET = withAuth(async (_req, { user }) => {
  try {
    const limit = await checkRateLimit('cases-list', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const result = await query(
      `SELECT
         c.*,
         COUNT(d.id) AS document_count,
         json_agg(
           json_build_object(
             'id', d.id,
             'title', d.title,
             'document_type', d.document_type,
             'status', d.status,
             'updated_at', d.updated_at
           ) ORDER BY d.updated_at DESC
         ) FILTER (WHERE d.id IS NOT NULL) AS documents
       FROM cases c
       LEFT JOIN documents d ON d.case_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.updated_at DESC`,
      [user.id],
    );
    return NextResponse.json({
      success: true,
      data: { cases: result.rows },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});

// POST /api/cases — create a new case
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = await checkRateLimit('cases-list', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const json = (await req.json().catch(() => ({}))) as unknown;
    const body = createCaseSchema.parse(json);

    const result = await query(
      `INSERT INTO cases (
         user_id, practice_area, matter_type_code, title, cause_number, court_name,
         state, county,
         petitioner_first_name, petitioner_last_name,
         respondent_first_name, respondent_last_name,
         children, case_metadata, interview_phase, interview_data
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        user.id,
        body.practice_area,
        body.matter_type_code ?? null,
        body.title ?? null,
        body.cause_number ?? null,
        body.court_name ?? null,
        body.state ?? null,
        body.county ?? null,
        body.petitioner_first_name ?? null,
        body.petitioner_last_name ?? null,
        body.respondent_first_name ?? null,
        body.respondent_last_name ?? null,
        JSON.stringify(body.children),
        JSON.stringify(body.case_metadata),
        body.interview_phase,
        JSON.stringify(body.interview_data),
      ],
    );
    return NextResponse.json(
      {
        success: true,
        data: { case: result.rows[0] },
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
});
