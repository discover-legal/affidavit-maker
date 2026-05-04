import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api/errors';
import { getServices } from '@/lib/api/services';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { templateManager } = getServices();
    const states = (templateManager as {
      getSupportedStates: () => Array<{ code: string; name: string; requirements: unknown }>;
    }).getSupportedStates();
    const transformed = states.map((s) => ({
      stateCode: s.code,
      stateName: s.name,
      requirements: s.requirements,
    }));
    return NextResponse.json(transformed);
  } catch (err) {
    console.error('[templates/states] failed', err);
    return toErrorResponse(err);
  }
}
