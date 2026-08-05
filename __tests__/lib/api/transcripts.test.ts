/**
 * @jest-environment node
 */

// Conversation-transcript persistence on POST /api/documents/save:
//  - Zod bounds on the optional `conversationHistory` field
//  - transcript written on INSERT and UPDATE
//  - absent transcript must NOT overwrite the stored one (COALESCE + null)
//  - transcript stripped from the content blob (never stored twice)

// Mock the DB layer — assertions run against the captured SQL + params.
const queryMock = jest.fn();
jest.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

// Bypass the Auth0 session/RLS wrapper: inject a fixed AppUser.
type Handler = (req: Request, ctx: { user: { id: number }; params: Record<string, string> }) => Promise<Response>;
jest.mock('@/lib/api/auth', () => ({
  withAuth: (handler: Handler) => (req: Request) =>
    handler(req, { params: {}, user: { id: 7 } }),
}));

jest.mock('@/lib/api/rateLimit', () => ({
  checkRateLimit: jest.fn(() => ({ ok: true })),
  RATE_LIMITS: { standard: {} },
}));

import { POST } from '@/app/api/documents/save/route';

const postJson = (body: unknown): Promise<Response> =>
  (POST as unknown as (req: Request) => Promise<Response>)(
    new Request('http://localhost/api/documents/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const transcript = [
  { type: 'bot', content: 'Hi! Which state are you in?' },
  { type: 'user', content: 'Texas.' },
];

beforeEach(() => {
  queryMock.mockReset();
});

describe('POST /api/documents/save — conversationHistory validation', () => {
  test('rejects more than 60 messages', async () => {
    const res = await postJson({
      affidavitData: { affiantName: 'Pat Doe' },
      conversationHistory: Array.from({ length: 61 }, () => ({ type: 'user', content: 'hi' })),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  test('rejects a message with content over 6000 chars', async () => {
    const res = await postJson({
      affidavitData: { affiantName: 'Pat Doe' },
      conversationHistory: [{ type: 'bot', content: 'x'.repeat(6001) }],
    });
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  test('rejects a type/role longer than 16 chars', async () => {
    const res = await postJson({
      affidavitData: { affiantName: 'Pat Doe' },
      conversationHistory: [{ type: 'a'.repeat(17), content: 'hi' }],
    });
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  test('rejects a message without string content', async () => {
    const res = await postJson({
      affidavitData: { affiantName: 'Pat Doe' },
      conversationHistory: [{ type: 'bot' }],
    });
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  test('rejects a transcript whose serialized size exceeds ~256KB', async () => {
    // 60 messages x 6000 chars ≈ 360KB serialized — each message passes the
    // per-message bound but the aggregate cap must still refuse it.
    const res = await postJson({
      affidavitData: { affiantName: 'Pat Doe' },
      conversationHistory: Array.from({ length: 60 }, () => ({
        type: 'user',
        content: 'y'.repeat(6000),
      })),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/conversation history too large/i);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/documents/save — INSERT', () => {
  test('writes the transcript to conversation_history on create', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 123 }], rowCount: 1 });

    const res = await postJson({
      affidavitData: { affiantName: 'Pat Doe', conversationHistory: transcript },
      conversationHistory: transcript,
    });
    expect(res.status).toBe(201);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO documents');
    expect(sql).toContain('conversation_history');
    expect(params[6]).toBe(JSON.stringify(transcript));

    // The content blob must not carry a second copy of the transcript.
    const content = JSON.parse(params[4] as string);
    expect(content.conversationHistory).toBeUndefined();
    expect(content.affiantName).toBe('Pat Doe');
  });

  test('inserts NULL conversation_history when the field is absent', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 124 }], rowCount: 1 });

    const res = await postJson({ affidavitData: { affiantName: 'Pat Doe' } });
    expect(res.status).toBe(201);

    const [, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(params[6]).toBeNull();
  });
});

describe('POST /api/documents/save — UPDATE', () => {
  const mockOwnedDocument = () => {
    // Single compare-and-set UPDATE (ownership + revision in the WHERE).
    queryMock.mockResolvedValueOnce({ rows: [{ id: 55 }], rowCount: 1 });
  };

  test('writes the transcript when provided', async () => {
    mockOwnedDocument();

    const res = await postJson({
      affidavitData: { documentId: 55, affiantName: 'Pat Doe' },
      conversationHistory: transcript,
    });
    expect(res.status).toBe(200);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE documents');
    // COALESCE keeps the stored transcript whenever the param is NULL.
    expect(sql).toMatch(/conversation_history = COALESCE\(\$8::jsonb, conversation_history\)/);
    expect(params[7]).toBe(JSON.stringify(transcript));
    // Ownership stays parameterized on both id and user_id.
    expect(params[4]).toBe('55');
    expect(params[5]).toBe(7);
  });

  test('does NOT overwrite the stored transcript when the field is absent', async () => {
    mockOwnedDocument();

    const res = await postJson({
      affidavitData: { documentId: 55, affiantName: 'Pat Doe' },
    });
    expect(res.status).toBe(200);

    const [sql, params] = queryMock.mock.calls[0] as [string, unknown[]];
    // NULL param + COALESCE = stored conversation_history preserved.
    expect(params[7]).toBeNull();
    expect(sql).toContain('COALESCE($8::jsonb, conversation_history)');
  });

  test('strips a client-smuggled conversationHistory from the content blob', async () => {
    mockOwnedDocument();

    await postJson({
      affidavitData: {
        documentId: 55,
        affiantName: 'Pat Doe',
        conversationHistory: transcript, // must not survive into content
      },
      conversationHistory: transcript,
    });

    const [, params] = queryMock.mock.calls[0] as [string, unknown[]];
    const content = JSON.parse(params[0] as string);
    expect(content.conversationHistory).toBeUndefined();
  });
});
