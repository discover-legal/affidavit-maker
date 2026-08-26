import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { z } from 'zod';
import { fileTypeFromBuffer } from 'file-type';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit } from '@/lib/api/rateLimit';
import { AppError, toErrorResponse } from '@/lib/api/errors';
import { getServices } from '@/lib/api/services';
import {
  appendKeyEvents,
  mergeUserProfile,
  updateUserProfile,
  type KeyEvent,
} from '@/lib/api/profile';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// OCR on a phone photo routinely takes longer than the default timeout.
export const maxDuration = 120;

/**
 * POST /api/profile/ingest — parse a court paper the user received (served
 * petition, response, hearing notice, order) into their life story: key
 * events land on the timeline, factual statements join the record marked
 * as coming from that document.
 *
 * Accepts EITHER pasted text ({ text, label? }) OR a photographed page
 * ({ imageBase64, label? } — data URL or raw base64, PNG/JPEG, ≤ 8MB
 * decoded). Images are OCRed server-side with tesseract.js and the
 * recognized text flows through the same extraction path as pasted text.
 */

const MAX_TEXT_CHARS = 20000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // decoded
const MAX_IMAGE_DIMENSION = 10000;
const MAX_IMAGE_PIXELS = 25_000_000;
// 8MB of raw bytes is ~10.7M base64 chars; allow headroom for the data-URL
// prefix and whitespace. The precise limit is enforced after decoding.
const MAX_IMAGE_B64_CHARS = 11_500_000;

function readImageDimensions(image: Buffer, mime: string): { width: number; height: number } {
  if (mime === 'image/png') {
    if (image.length < 24) throw new AppError('PNG image is truncated', 400, 'InvalidImage');
    return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
  }

  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 8 < image.length) {
    if (image[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < image.length && image[offset] === 0xff) offset += 1;
    if (offset >= image.length) break;
    const marker = image[offset++];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > image.length) break;
    const segmentLength = image.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > image.length) break;
    if (sofMarkers.has(marker) && segmentLength >= 7) {
      return {
        height: image.readUInt16BE(offset + 3),
        width: image.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new AppError('JPEG dimensions could not be determined', 400, 'InvalidImage');
}

function assertSafeImageDimensions(image: Buffer, mime: string): void {
  const { width, height } = readImageDimensions(image, mime);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new AppError('Image dimensions are invalid', 400, 'InvalidImage');
  }
  if (
    width > MAX_IMAGE_DIMENSION
    || height > MAX_IMAGE_DIMENSION
    || width * height > MAX_IMAGE_PIXELS
  ) {
    throw new AppError('Image dimensions are too large to process safely', 413, 'ImageTooLarge');
  }
}

const labelSchema = z.string().max(120).optional();

const bodySchema = z.union([
  z.object({
    text: z.string().min(40, 'Paste at least a few sentences from the document').max(MAX_TEXT_CHARS),
    label: labelSchema,
  }),
  z.object({
    imageBase64: z.string().min(1).max(MAX_IMAGE_B64_CHARS, 'Image is too large — 8MB max'),
    label: labelSchema,
  }),
]);

const INGEST_TOOL = {
  type: 'function',
  function: {
    name: 'ingest_court_document',
    description:
      'Extract the key events and factual statements from this legal/court document.',
    parameters: {
      type: 'object',
      required: ['document_kind', 'served_on_user', 'events', 'facts'],
      properties: {
        document_kind: {
          type: 'string',
          description:
            'What this document is, in plain words (e.g. "Original petition served on you", "Respondent\'s answer", "Hearing notice", "Temporary order")',
        },
        served_on_user: {
          type: 'string',
          enum: ['yes', 'no', 'unclear'],
          description:
            'Whether the person uploading this document is the one these papers were served ON — i.e. they are the responding party. Judge from the document text AND how the user described it (in any language). "yes" only when that is clear (e.g. the user says they received/were served the papers, or the document is a petition and summons addressed to them as the party being served). Proof that the OTHER side was served is "no". A petition alone says nothing about who is uploading it — when you cannot tell, answer "unclear".',
        },
        petitioner_name: {
          type: 'string',
          description:
            "The petitioner's/plaintiff's full legal name as printed on the document, normalized to proper name casing (mike smith → Mike Smith), with compound and hyphenated surnames intact (smith son-wyatt → Smith Son-Wyatt). Include ONLY when the document clearly states it — omit otherwise. Never guess or infer.",
        },
        respondent_name: {
          type: 'string',
          description:
            "The respondent's/defendant's full legal name as printed on the document, normalized to proper name casing, with compound and hyphenated surnames intact. Include ONLY when the document clearly states it — omit otherwise. Never guess or infer.",
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

/**
 * Decode a client-supplied image (data URL or raw base64) into a Buffer,
 * enforcing the size cap and verifying via magic bytes that the content
 * really is PNG or JPEG (same MIME-spoofing defense as
 * services/evidenceStorage.js, using the same file-type package).
 */
async function decodeAndSniffImage(imageBase64: string): Promise<Buffer> {
  let b64 = imageBase64.trim();
  const dataUrlMatch = /^data:([^;,]+);base64,(.*)$/s.exec(b64);
  if (dataUrlMatch) {
    if (!['image/png', 'image/jpeg'].includes(dataUrlMatch[1].toLowerCase())) {
      throw new AppError('Only PNG and JPEG photos are supported', 415, 'UnsupportedImage');
    }
    b64 = dataUrlMatch[2];
  } else if (b64.startsWith('data:')) {
    throw new AppError('Only PNG and JPEG photos are supported', 415, 'UnsupportedImage');
  }

  if (b64 === '' || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) {
    throw new AppError('Image data is not valid base64', 400, 'InvalidImage');
  }
  const image = Buffer.from(b64, 'base64');
  if (image.length === 0) {
    throw new AppError('Image data is not valid base64', 400, 'InvalidImage');
  }
  if (image.length > MAX_IMAGE_BYTES) {
    throw new AppError('Image is too large — 8MB max', 413, 'ImageTooLarge');
  }

  // Magic-byte sniff — never trust the declared MIME type.
  const detected = await fileTypeFromBuffer(image);
  if (!detected || !['image/png', 'image/jpeg'].includes(detected.mime)) {
    throw new AppError('Only PNG and JPEG photos are supported', 415, 'UnsupportedImage');
  }
  // Bound decoded pixels before Tesseract allocates image buffers. A tiny,
  // highly compressed file can otherwise expand to hundreds of MB in OCR.
  assertSafeImageDimensions(image, detected.mime);
  return image;
}

/**
 * OCR a photographed court paper with tesseract.js (English).
 *
 * Fully offline configuration — the production container has restricted
 * egress, so nothing may be fetched at runtime:
 *  - workerPath / wasm core resolve from node_modules (tesseract.js +
 *    tesseract.js-core packages),
 *  - langPath points at the @tesseract.js-data/eng npm package (LSTM
 *    traineddata, gzipped) instead of the default jsDelivr CDN,
 *  - cacheMethod 'none' so nothing is written to the (read-only) cwd.
 *
 * The worker is created lazily per request and always terminated — no
 * leaked worker threads.
 */
async function ocrImage(image: Buffer): Promise<string> {
  const startedAt = Date.now();
  const mod = await import('tesseract.js');
  const Tesseract = mod.default ?? mod;

  const nodeModules = path.join(process.cwd(), 'node_modules');
  const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
    workerPath: path.join(nodeModules, 'tesseract.js', 'src', 'worker-script', 'node', 'index.js'),
    langPath: path.join(nodeModules, '@tesseract.js-data', 'eng', '4.0.0_best_int'),
    gzip: true,
    cacheMethod: 'none',
  });
  try {
    const { data } = await worker.recognize(image);
    const text = (data.text || '').trim();
    logger.info('profile_ingest_ocr', {
      durationMs: Date.now() - startedAt,
      imageBytes: image.length,
      chars: text.length,
    });
    return text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Shared extraction path: run the document text through the LLM tool call
 * and merge the results into the user's life story. Both the pasted-text
 * and the OCR flow end here, so provenance (document-kind `source` on
 * events and facts) is identical for both.
 */
async function extractIntoProfile(
  userId: number,
  text: string,
  label: string | undefined,
): Promise<{ documentKind: string; eventsAdded: number; factsAdded: number }> {
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
        content: `Document${label ? ` (user describes it as: ${label})` : ''}:\n\n${text}`,
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
    served_on_user?: string;
    petitioner_name?: string;
    respondent_name?: string;
    events?: Array<{ label?: string; date?: string }>;
    facts?: Array<{ content?: string; category?: string }>;
  };
  try {
    extracted = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new AppError('Could not read this document', 422, 'IngestFailed');
  }

  const kind = String(extracted.document_kind || label || 'Court document').slice(0, 120);

  // Which side of the case the user is on comes from the extractor, which
  // sees both the document text and the user's own description of it
  // (`served_on_user` in INGEST_TOOL). Only an unambiguous "yes" flips the
  // profile to respondent — updateUserProfile then reconciles the party
  // names so the flip never leaves stale petitioner/respondent captions.
  //
  // Deliberately no "petitioner" inference on any other answer: receiving
  // or uploading a petition says nothing by itself about which person owns
  // this profile.
  if (extracted.served_on_user === 'yes') {
    await updateUserProfile(userId, { role: 'respondent' });
  }

  const events: KeyEvent[] = (extracted.events || [])
    .filter((e) => e && e.label && e.date)
    .map((e) => ({ label: String(e.label), date: String(e.date), source: kind }));
  await appendKeyEvents(userId, events);

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
  // Party names the model read off the caption (already model-normalized —
  // no deterministic casing here). Merged through the standard path:
  // mergeUserProfile → reconcileParties derives spouseName under the stored
  // role, and affiantName is never written (caption fields are not identity
  // fields), so a stored affiantName can never be overwritten by an ingest.
  const partyFields: Record<string, unknown> = {};
  const petitionerName = String(extracted.petitioner_name ?? '').trim().slice(0, 120);
  const respondentName = String(extracted.respondent_name ?? '').trim().slice(0, 120);
  if (petitionerName) partyFields.petitionerName = petitionerName;
  if (respondentName) partyFields.respondentName = respondentName;

  if (facts.length > 0 || Object.keys(partyFields).length > 0) {
    await mergeUserProfile(userId, partyFields, facts);
  }

  logger.info('profile_document_ingested', {
    userId,
    kind,
    events: events.length,
    facts: facts.length,
  });

  return { documentKind: kind, eventsAdded: events.length, factsAdded: facts.length };
}

export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    const limit = await checkRateLimit('profile-ingest', user.id, { max: 10, windowMs: 15 * 60 * 1000 });
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const body = bodySchema.parse(await req.json().catch(() => ({})));

    let text: string;
    if ('text' in body) {
      text = body.text;
    } else {
      const image = await decodeAndSniffImage(body.imageBase64);
      text = await ocrImage(image);
      if (text.length < 40) {
        throw new AppError(
          "Couldn't read this image — try a clearer photo or paste the text",
          422,
          'OcrTooLittleText',
        );
      }
      text = text.slice(0, MAX_TEXT_CHARS);
    }

    const summary = await extractIntoProfile(user.id, text, body.label);

    return NextResponse.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
