import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ValidationError, toErrorResponse } from '@/lib/api/errors';
import { getServices } from '@/lib/api/services';

export const runtime = 'nodejs';

const bodySchema = z.object({
  affidavitData: z.record(z.unknown()),
  state: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const json = (await req.json().catch(() => ({}))) as unknown;
    const { affidavitData, state } = bodySchema.parse(json);
    if (!affidavitData || !state) {
      throw new ValidationError('affidavitData and state are required');
    }
    const { templateManager } = getServices();
    const validation = (templateManager as {
      validateAffidavitData: (state: string, data: unknown) => unknown;
    }).validateAffidavitData(state, affidavitData);
    return NextResponse.json({ success: true, validation, state });
  } catch (err) {
    return toErrorResponse(err);
  }
}
