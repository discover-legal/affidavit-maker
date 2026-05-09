import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function GET() {
  try {
    let documentTypes: string[];
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const registry = require('@/services/affidavits/AffidavitTypeRegistry');
      documentTypes = Object.keys(registry?.all ?? {});
      if (documentTypes.length === 0) {
        documentTypes = ['general', 'divorce', 'custody', 'financial', 'property', 'identity'];
      }
    } catch {
      documentTypes = ['general', 'divorce', 'custody', 'financial', 'property', 'identity'];
    }
    return NextResponse.json({
      success: true,
      documentTypes,
      count: documentTypes.length,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
