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
const updateUserProfileMock = jest.fn(async () => ({}));
jest.mock('@/lib/api/profile', () => ({
  appendKeyEvents: (...args: unknown[]) => appendKeyEventsMock(...(args as [])),
  mergeUserProfile: (...args: unknown[]) => mergeUserProfileMock(...(args as [])),
  updateUserProfile: (...args: unknown[]) => updateUserProfileMock(...(args as [])),
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
  served_on_user: 'unclear',
  events: [{ label: 'Hearing', date: '2026-08-01' }],
  facts: [{ content: 'A hearing is set for August 1, 2026.', category: 'response' }],
};

function llmReturnsExtraction(
  overrides: Partial<typeof EXTRACTION> & Record<string, unknown> = {},
) {
  chatMock.mockResolvedValue({
    choices: [
      {
        message: {
          tool_calls: [
            { function: { arguments: JSON.stringify({ ...EXTRACTION, ...overrides }) } },
          ],
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

  // Which side of the case the user is on is the extractor's call
  // (served_on_user in the tool schema), not a regex over the label — the
  // model sees the document AND the user's description in any language.
  it('records respondent perspective when the model says the papers were served on the user', async () => {
    llmReturnsExtraction({ served_on_user: 'yes' });
    const res = await post({
      text: 'ORIGINAL PETITION AND SUMMONS. These papers were delivered on July 10, 2026.',
      label: 'Papers I was served',
    });

    expect(res.status).toBe(200);
    expect(updateUserProfileMock).toHaveBeenCalledWith(7, { role: 'respondent' });
  });

  it("forwards the user's own description to the model so it can judge who was served", async () => {
    const res = await post({
      text: 'PETICIÓN DE DIVORCIO Y CITACIÓN. Los documentos fueron entregados el 10 de julio de 2026.',
      label: 'Papeles que me entregaron',
    });

    expect(res.status).toBe(200);
    expect(chatMock.mock.calls[0][0][1].content).toContain('Papeles que me entregaron');
    const tool = (chatMock.mock.calls[0][1] as { tools: Array<{ function: { parameters: { properties: Record<string, unknown>; required: string[] } } }> }).tools[0];
    expect(tool.function.parameters.required).toContain('served_on_user');
  });

  it('does not infer a role when the model says the other side was served', async () => {
    llmReturnsExtraction({ served_on_user: 'no' });
    const res = await post({
      text: 'PROOF OF SERVICE. The summons was delivered to the respondent on July 10, 2026.',
      label: 'Proof of service',
    });

    expect(res.status).toBe(200);
    expect(updateUserProfileMock).not.toHaveBeenCalled();
  });

  // Party names come out of the extractor already model-normalized (proper
  // casing, compound surnames intact) — there is no deterministic casing
  // layer. When present they flow into the profile through the standard
  // merge path (mergeUserProfile → reconcileParties derives spouseName).
  it('merges model-extracted party names into the profile via mergeUserProfile', async () => {
    llmReturnsExtraction({
      petitioner_name: 'Mike Smith',
      respondent_name: 'Ellis Jame Smith Son-Wyatt',
    });
    const res = await post({
      text: 'IN RE THE MARRIAGE OF MIKE SMITH, Petitioner, AND ELLIS JAME SMITH SON-WYATT, Respondent.',
      label: 'Divorce petition',
    });

    expect(res.status).toBe(200);
    expect(mergeUserProfileMock).toHaveBeenCalledWith(
      7,
      { petitionerName: 'Mike Smith', respondentName: 'Ellis Jame Smith Son-Wyatt' },
      expect.any(Array),
    );
  });

  it('merges party names even when the document yields no facts', async () => {
    llmReturnsExtraction({
      petitioner_name: 'Mike Smith',
      facts: [],
      events: [],
    });
    const res = await post({
      text: 'IN RE THE MARRIAGE OF MIKE SMITH, Petitioner. Case number 2026-123.',
    });

    expect(res.status).toBe(200);
    expect(mergeUserProfileMock).toHaveBeenCalledWith(7, { petitionerName: 'Mike Smith' }, []);
  });

  it('omitted party names leave the merge payload empty (never guessed)', async () => {
    const res = await post({
      text: 'NOTICE OF HEARING. A hearing is set for August 1, 2026 in Dept 5.',
    });

    expect(res.status).toBe(200);
    // Default EXTRACTION has no party names — the merge carries no name fields.
    expect(mergeUserProfileMock).toHaveBeenCalledWith(7, {}, expect.any(Array));
    const tool = (chatMock.mock.calls[0][1] as {
      tools: Array<{ function: { parameters: { properties: Record<string, { description?: string }>; required: string[] } } }>;
    }).tools[0];
    // The fields are optional and instruct the model to include them ONLY
    // when the document clearly states them.
    expect(tool.function.parameters.required).not.toContain('petitioner_name');
    expect(tool.function.parameters.properties.petitioner_name.description).toContain('ONLY when');
    expect(tool.function.parameters.properties.respondent_name.description).toContain('ONLY when');
  });

  it('does not infer a role when the model is unsure', async () => {
    // Default EXTRACTION answers 'unclear'.
    const res = await post({
      text: 'PETITION FOR DIVORCE. Case number 2026-123. Filed July 1, 2026.',
      label: 'Divorce petition',
    });

    expect(res.status).toBe(200);
    expect(updateUserProfileMock).not.toHaveBeenCalled();
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
