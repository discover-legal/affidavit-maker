import { NextResponse } from 'next/server';
import { MATTER_MAP, DOCS_BY_MATTER, SUPPORTED_STATES, getAllJurisdictions } from '@/lib/api/catalog-data';
import { NotFoundError, toErrorResponse } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  try {
    const matter = MATTER_MAP[params.code];
    if (!matter) {
      throw new NotFoundError(`Matter type "${params.code}" not found`);
    }
    const documents = DOCS_BY_MATTER[params.code] ?? [];
    const supported_states = SUPPORTED_STATES[params.code] ?? getAllJurisdictions();
    return NextResponse.json({
      success: true,
      data: { matter: { ...matter, documents, supported_states } },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
