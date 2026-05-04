import { NextResponse } from 'next/server';
import { MATTER_MAP, DOCS_BY_MATTER } from '@/lib/api/catalog-data';
import { NotFoundError, toErrorResponse } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  try {
    if (!MATTER_MAP[params.code]) {
      throw new NotFoundError(`Matter type "${params.code}" not found`);
    }
    return NextResponse.json({
      success: true,
      data: { matter_code: params.code, documents: DOCS_BY_MATTER[params.code] ?? [] },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
