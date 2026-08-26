import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse, ValidationError } from '@/lib/api/errors';
import { getUserProfile, deleteUserProfile, updateUserProfile } from '@/lib/api/profile';
import { getServices } from '@/lib/api/services';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * LLM-first name casing for "fix my story" edits.
 *
 * When the patch carries person-name fields (affiantName, spouseName,
 * children[].name), one tool-forced chat call normalizes their casing before
 * the save. The model — not a regex — owns name casing, so McDonald,
 * van der Berg, and compound surnames come out right.
 *
 * STRICT failure semantics: any error, missing service, timeout (~5s), or a
 * count mismatch between input and output stores the names exactly as typed.
 * The save NEVER fails or blocks on the LLM.
 */
const NAME_NORMALIZE_TIMEOUT_MS = 5000;

const NORMALIZE_NAMES_TOOL = {
  type: 'function',
  function: {
    name: 'normalize_names',
    description:
      'Return the given personal names with corrected casing — same order, same count, one output per input.',
    parameters: {
      type: 'object',
      required: ['normalized'],
      properties: {
        normalized: {
          type: 'array',
          items: { type: 'string' },
          description:
            'The input names in the same order, each in proper legal-document casing. Casing corrections only — every name part preserved.',
        },
      },
    },
  },
};

type LLMService = {
  chat: (
    messages: Array<{ role: string; content: string }>,
    opts: Record<string, unknown>,
  ) => Promise<{
    choices: Array<{ message: { tool_calls?: Array<{ function: { arguments: string } }> } }>;
  }>;
};

async function normalizeNamesViaLLM(names: string[]): Promise<string[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await getServices(); // wires global.openAIService
    const llm = (global as unknown as { openAIService?: LLMService }).openAIService;
    if (!llm) return null;

    const completion = await Promise.race([
      llm.chat(
        [
          {
            role: 'system',
            content:
              'Return each personal name in proper legal-document casing (mike smith → Mike Smith; smith son-wyatt → Smith Son-Wyatt), preserving intentional internal capitals (McDonald, van der Berg) and compound/hyphenated surnames in full. Correct casing ONLY — never change, add, or drop name parts.',
          },
          { role: 'user', content: JSON.stringify(names) },
        ],
        {
          tools: [NORMALIZE_NAMES_TOOL],
          tool_choice: { type: 'function', function: { name: 'normalize_names' } },
          temperature: 0,
          max_tokens: 500,
        },
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('normalize_names timed out')),
          NAME_NORMALIZE_TIMEOUT_MS,
        );
      }),
    ]);

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;
    const parsed = JSON.parse(toolCall.function.arguments) as { normalized?: unknown };
    const normalized = parsed.normalized;
    // Count-in/count-out validation — anything off means as-typed wins.
    if (!Array.isArray(normalized) || normalized.length !== names.length) return null;
    if (!normalized.every((n) => typeof n === 'string' && n.trim() !== '')) return null;
    return (normalized as string[]).map((n) => n.trim());
  } catch (err) {
    logger.warn('profile_name_normalize_skipped', { error: (err as Error).message });
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Normalize the patch's name fields in place; on any failure leave them as typed. */
async function normalizePatchNames(patch: Record<string, unknown>): Promise<void> {
  const slots: Array<{ value: string; apply: (v: string) => void }> = [];
  for (const field of ['affiantName', 'spouseName'] as const) {
    const v = patch[field];
    if (typeof v === 'string' && v.trim() !== '') {
      slots.push({ value: v.trim(), apply: (n) => { patch[field] = n; } });
    }
  }
  if (Array.isArray(patch.children)) {
    for (const child of patch.children) {
      if (!child || typeof child !== 'object') continue;
      const c = child as Record<string, unknown>;
      if (typeof c.name === 'string' && c.name.trim() !== '') {
        slots.push({ value: c.name.trim(), apply: (n) => { c.name = n; } });
      }
    }
  }
  if (slots.length === 0) return;

  const normalized = await normalizeNamesViaLLM(slots.map((s) => s.value));
  if (!normalized) return; // store as typed
  slots.forEach((s, i) => s.apply(normalized[i]));
}

// GET /api/profile — the user's life-story profile (structured fields +
// accumulated facts), used to seed new documents and conversations.
export const GET = withAuth(async (_req: NextRequest, { user }) => {
  try {
    const limit = await checkRateLimit('profile', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const profile = await getUserProfile(user.id);
    return NextResponse.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});

// PATCH /api/profile — explicit "fix my story" edits from the profile page.
// Provided fields are set verbatim (empty clears); whitelisting happens in
// updateUserProfile so per-document state can never be written here.
export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = await checkRateLimit('profile', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const patch = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new ValidationError('A JSON object of fields to update is required');
    }
    if (JSON.stringify(patch).length > 64 * 1024) {
      throw new ValidationError('Update too large');
    }

    // LLM-first name casing (best-effort; never blocks or fails the save).
    await normalizePatchNames(patch);

    const updated = await updateUserProfile(user.id, patch);
    logger.info('user_profile_edited', { userId: user.id, fields: Object.keys(patch) });
    return NextResponse.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});

// DELETE /api/profile — erase the stored life story (privacy control).
export const DELETE = withAuth(async (_req: NextRequest, { user }) => {
  try {
    const limit = await checkRateLimit('profile', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    await deleteUserProfile(user.id);
    logger.info('user_profile_deleted', { userId: user.id });
    return NextResponse.json({
      success: true,
      deleted: true,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
