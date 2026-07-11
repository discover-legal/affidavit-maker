import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { AppError, toErrorResponse } from '@/lib/api/errors';
import { getServices } from '@/lib/api/services';
import { appendKeyEvents, mergeUserProfile, type KeyEvent } from '@/lib/api/profile';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/profile/ingest — parse a court paper the user received (served
 * petition, response, hearing notice, order) into their life story: key
 * events land on the timeline, factual statements join the record marked
 * as coming from that document.
 *
 * v1 accepts pasted text (most court PDFs copy-paste; scanned-image OCR is
 * a follow-up — the evidence pipeline stores images but nothing extracts
 * text from them yet).
 */

const bodySchema = z.object({
  text: z.string().min(40, 'Paste at least a few sentences from the document').max(20000),
  label: z.string().max(120).optional(),
});

const INGEST_TOOL = {
  type: 'function',
  function: {
    name: 'ingest_court_document',
    description:
      'Extract the key events and factual statements from this legal/court document.',
    parameters: {
      type: 'object',
      required: ['document_kind', 'events', 'facts'],
      properties: {
        document_kind: {
          type: 'string',
          description:
            'What this document is, in plain words (e.g. "Original petition served on you", "Respondent\'s answer", "Hearing notice", "Temporary order")',
        },
        events: {
          type: 'array',
          description:
            'Dated events EXPLICITLY stated in the document: filing date, service date, hearing date, answer/response deadline, order date.',
          items: {
            type: 'object',
            required: ['label', 'date'],
            properties: {
              label: { type: 'string', description: 'Short human label, e.g. "Served", "Hearing", "Answer due"' },
              date: { type: 'string', description: 'YYYY-MM-DD' },
            },
          },
        },
        facts: {
          type: 'array',
          description:
            'Factual statements in the document relevant to the case (claims made, relief requested, case number, court). Only what is explicitly written.',
          items: {
            type: 'object',
            required: ['content'],
            properties: {
              content: { type: 'string', description: 'Third-person statement of what the document says' },
              category: { type: 'string' },
            },
          },
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

export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = checkRateLimit('profile-ingest', user.id, { max: 10, windowMs: 15 * 60 * 1000 });
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const body = bodySchema.parse(await req.json().catch(() => ({})));

    await getServices(); // wires global.openAIService
    const llm = (global as unknown as { openAIService?: LLMService }).openAIService;
    if (!llm) throw new AppError('Document analysis is temporarily unavailable', 503, 'ServiceUnavailable');

    const completion = await llm.chat(
      [
        {
          role: 'system',
          content:
            'You extract structured information from legal documents for a self-represented litigant. Extract ONLY what is explicitly written in the document — never guess or infer dates, names, or claims. This is information handling, not legal advice.',
        },
        {
          role: 'user',
          content: `Document${body.label ? ` (user describes it as: ${body.label})` : ''}:\n\n${body.text}`,
        },
      ],
      {
        tools: [INGEST_TOOL],
        tool_choice: { type: 'function', function: { name: 'ingest_court_document' } },
        temperature: 0.1,
        max_tokens: 1500,
      },
    );

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new AppError('Could not read this document', 422, 'IngestFailed');
    let extracted: {
      document_kind?: string;
      events?: Array<{ label?: string; date?: string }>;
      facts?: Array<{ content?: string; category?: string }>;
    };
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new AppError('Could not read this document', 422, 'IngestFailed');
    }

    const kind = String(extracted.document_kind || body.label || 'Court document').slice(0, 120);

    const events: KeyEvent[] = (extracted.events || [])
      .filter((e) => e && e.label && e.date)
      .map((e) => ({ label: String(e.label), date: String(e.date), source: kind }));
    await appendKeyEvents(user.id, events);

    const facts = (extracted.facts || [])
      .filter((f) => f && typeof f.content === 'string' && f.content.trim() !== '')
      .slice(0, 25)
      .map((f) => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        content: f.content as string,
        category: f.category || 'response',
        type: 'fact',
        source: kind,
        sourceQuote: `From: ${kind}`,
        timestamp: new Date().toISOString(),
      }));
    if (facts.length > 0) {
      await mergeUserProfile(user.id, {}, facts);
    }

    logger.info('profile_document_ingested', {
      userId: user.id,
      kind,
      events: events.length,
      facts: facts.length,
    });

    return NextResponse.json({
      success: true,
      data: { documentKind: kind, eventsAdded: events.length, factsAdded: facts.length },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
