/**
 * @jest-environment node
 */

// POST /api/profile/ingest — image (OCR) path added alongside pasted text:
//  - body is EITHER { text, label? } OR { imageBase64, label? }
//  - base64 decode: data URL or raw, ≤ 8MB decoded, PNG/JPEG magic-byte sniff
//  - OCR output < 40 chars → friendly 422
//  - OCR text flows through the SAME extraction path as pasted text, so
//    provenance (document-kind `source` on events/facts) is identical
//  - tesseract worker is always terminated (no leaked workers)

// Bypass the Auth0 session/RLS wrapper: inject a fixed AppUser.
type Handler = (
  req: Request,
  ctx: { user: { id: number }; params: Record<string, string> },
) => Promise<Response>;
jest.mock('@/lib/api/auth', () => ({
  withAuth: (handler: Handler) => (req: Request) => handler(req, { params: {}, user: { id: 7 } }),
}));

jest.mock('@/lib/api/rateLimit', () => ({
  checkRateLimit: jest.fn(() => ({ ok: true })),
  RATE_LIMITS: { standard: {} },
}));

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// LLM: getServices() wires global.openAIService; return a canned tool call.
const chatMock = jest.fn();
jest.mock('@/lib/api/services', () => ({
  getServices: jest.fn(async () => {
    (global as Record<string, unknown>).openAIService = { chat: chatMock };
    return {};
  }),
}));

const appendKeyEventsMock = jest.fn(async () => {});
const mergeUserProfileMock = jest.fn(async () => {});
jest.mock('@/lib/api/profile', () => ({
  appendKeyEvents: (...args: unknown[]) => appendKeyEventsMock(...(args as [])),
  mergeUserProfile: (...args: unknown[]) => mergeUserProfileMock(...(args as [])),
}));

// tesseract.js: never load the real wasm in tests; capture worker lifecycle.
const recognizeMock = jest.fn();
const terminateMock = jest.fn(async () => {});
const createWorkerMock = jest.fn(async () => ({
  recognize: recognizeMock,
  terminate: terminateMock,
}));
jest.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => createWorkerMock(...(args as [])),
  OEM: { TESSERACT_ONLY: 0, LSTM_ONLY: 1, TESSERACT_LSTM_COMBINED: 2, DEFAULT: 3 },
}));

import { POST } from '@/app/api/profile/ingest/route';

// A real 1x1 PNG — the magic-byte sniff runs against actual file content.
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const EXTRACTION = {
  document_kind: 'Hearing notice',
  events: [{ label: 'Hearing', date: '2026-08-01' }],
  facts: [{ content: 'A hearing is set for August 1, 2026.', category: 'response' }],
};

function llmReturnsExtraction() {
  chatMock.mockResolvedValue({
    choices: [
      {
        message: {
          tool_calls: [{ function: { arguments: JSON.stringify(EXTRACTION) } }],
        },
      },
    ],
  });
}

function post(body: unknown): Promise<Response> {
  return (POST as unknown as (req: Request) => Promise<Response>)(
    new Request('http://localhost/api/profile/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  llmReturnsExtraction();
});

describe('POST /api/profile/ingest — pasted text (unchanged path)', () => {
  it('extracts events and facts from pasted text', async () => {
    const res = await post({
      text: 'NOTICE OF HEARING. A hearing is set for August 1, 2026 in Dept 5.',
      label: 'Hearing notice',
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ documentKind: 'Hearing notice', eventsAdded: 1, factsAdded: 1 });
    expect(createWorkerMock).not.toHaveBeenCalled();
  });

  it('rejects a body with neither text nor imageBase64', async () => {
    const res = await post({ label: 'mystery' });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});

describe('POST /api/profile/ingest — photographed paper (OCR path)', () => {
  it('OCRs a PNG data URL and feeds the text through the shared extraction path', async () => {
    const ocrText =
      'NOTICE OF HEARING — Superior Court. A hearing is set for August 1, 2026 in Department 5.';
    recognizeMock.mockResolvedValue({ data: { text: ocrText } });

    const res = await post({
      imageBase64: `data:image/png;base64,${TINY_PNG_B64}`,
      label: 'Photo of papers',
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ documentKind: 'Hearing notice', eventsAdded: 1, factsAdded: 1 });

    // OCR text reached the LLM, and the worker was created then terminated.
    expect(chatMock.mock.calls[0][0][1].content).toContain(ocrText);
    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    expect(terminateMock).toHaveBeenCalledTimes(1);

    // Offline config: langPath points at the bundled traineddata, not a CDN.
    const [, , options] = createWorkerMock.mock.calls[0] as unknown as [
      string,
      number,
      { langPath: string; cacheMethod: string },
    ];
    expect(options.langPath).toContain('@tesseract.js-data');
    expect(options.cacheMethod).toBe('none');

    // Provenance identical to the text path: source = extracted document kind.
    expect(appendKeyEventsMock).toHaveBeenCalledWith(7, [
      { label: 'Hearing', date: '2026-08-01', source: 'Hearing notice' },
    ]);
    const facts = mergeUserProfileMock.mock.calls[0] as unknown as [
      number,
      object,
      Array<{ source: string; sourceQuote: string }>,
    ];
    expect(facts[2][0].source).toBe('Hearing notice');
    expect(facts[2][0].sourceQuote).toBe('From: Hearing notice');
  });

  it('accepts raw base64 without a data-URL prefix', async () => {
    recognizeMock.mockResolvedValue({
      data: { text: 'This scanned page has plenty of recognizable text in it, well over forty characters.' },
    });
    const res = await post({ imageBase64: TINY_PNG_B64 });
    expect(res.status).toBe(200);
  });

  it('returns a friendly 422 when OCR finds almost no text — and still terminates the worker', async () => {
    recognizeMock.mockResolvedValue({ data: { text: '  \n ~ ' } });
    const res = await post({ imageBase64: TINY_PNG_B64 });
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.error).toBe("Couldn't read this image — try a clearer photo or paste the text");
    expect(terminateMock).toHaveBeenCalledTimes(1);
    expect(chatMock).not.toHaveBeenCalled();
    expect(appendKeyEventsMock).not.toHaveBeenCalled();
  });

  it('rejects content that is not really PNG/JPEG (magic-byte sniff), even with an image data-URL', async () => {
    const notAnImage = Buffer.from('just some plain text pretending to be a photo').toString('base64');
    const res = await post({ imageBase64: `data:image/png;base64,${notAnImage}` });
    expect(res.status).toBe(415);
    expect(createWorkerMock).not.toHaveBeenCalled();
  });

  it('rejects non-image data-URL MIME types outright', async () => {
    const res = await post({ imageBase64: `data:application/pdf;base64,${TINY_PNG_B64}` });
    expect(res.status).toBe(415);
  });

  it('rejects invalid base64', async () => {
    const res = await post({ imageBase64: 'data:image/png;base64,%%%not-base64%%%' });
    expect(res.status).toBe(400);
  });

  it('rejects images over 8MB decoded', async () => {
    // Real PNG magic bytes followed by padding past the cap.
    const big = Buffer.concat([
      Buffer.from(TINY_PNG_B64, 'base64'),
      Buffer.alloc(8 * 1024 * 1024),
    ]);
    const res = await post({ imageBase64: big.toString('base64') });
    expect(res.status).toBe(413);
    expect(createWorkerMock).not.toHaveBeenCalled();
  });
});
