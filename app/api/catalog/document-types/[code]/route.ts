import { NextResponse } from 'next/server';
import { DOCS_BY_MATTER } from '@/lib/api/catalog-data';
import { NotFoundError, toErrorResponse } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  try {
    const usedIn = Object.entries(DOCS_BY_MATTER)
      .filter(([, docs]) => docs.includes(params.code))
      .map(([matterCode]) => matterCode);
    if (usedIn.length === 0) {
      throw new NotFoundError(`Document type "${params.code}" not found in catalog`);
    }
    return NextResponse.json({
      success: true,
      data: { document_type: params.code, used_in_matters: usedIn },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
