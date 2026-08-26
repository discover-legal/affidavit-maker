/**
 * @jest-environment node
 */

// PATCH /api/profile — LLM-first name casing on "fix my story" edits:
//  - name fields in the patch (affiantName, spouseName, children[].name) go
//    through one tool-forced normalize_names chat call before the save
//  - STRICT failure semantics: LLM error/timeout or a count mismatch stores
//    the names exactly as typed — the save never fails or blocks on the LLM
//  - patches without name fields never touch the LLM

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

// LLM: getServices() wires global.openAIService (same pattern as the ingest
// route tests); return a canned normalize_names tool call.
const chatMock = jest.fn();
jest.mock('@/lib/api/services', () => ({
  getServices: jest.fn(async () => {
    (global as Record<string, unknown>).openAIService = { chat: chatMock };
    return {};
  }),
}));

const updateUserProfileMock = jest.fn(async () => ({ profile: {}, facts: [] }));
jest.mock('@/lib/api/profile', () => ({
  getUserProfile: jest.fn(async () => ({ profile: {}, facts: [] })),
  deleteUserProfile: jest.fn(async () => {}),
  updateUserProfile: (...args: unknown[]) => updateUserProfileMock(...(args as [])),
}));

import { PATCH } from '@/app/api/profile/route';

function llmReturnsNormalized(normalized: unknown) {
  chatMock.mockResolvedValue({
    choices: [
      {
        message: {
          tool_calls: [{ function: { arguments: JSON.stringify({ normalized }) } }],
        },
      },
    ],
  });
}

function patch(body: unknown): Promise<Response> {
  return (PATCH as unknown as (req: Request) => Promise<Response>)(
    new Request('http://localhost/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PATCH /api/profile — LLM name normalization', () => {
  it('applies model-normalized casing to affiantName, spouseName, and children names', async () => {
    llmReturnsNormalized(['Mike Smith', 'Ellis Jame Smith Son-Wyatt', "Shaun O'Brien"]);

    const res = await patch({
      affiantName: 'mike smith',
      spouseName: 'ellis jame smith son-wyatt',
      children: [{ name: "shaun o'brien", dob: '2015-04-02' }],
      separationDate: '2024-11-15',
    });

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);

    // The model saw the names as typed, in order, tool-forced.
    expect(chatMock).toHaveBeenCalledTimes(1);
    const [messages, opts] = chatMock.mock.calls[0] as [
      Array<{ role: string; content: string }>,
      { tool_choice: { function: { name: string } } },
    ];
    expect(messages[1].content).toBe(
      JSON.stringify(['mike smith', 'ellis jame smith son-wyatt', "shaun o'brien"]),
    );
    expect(opts.tool_choice.function.name).toBe('normalize_names');

    // The save received the normalized names; non-name fields untouched.
    expect(updateUserProfileMock).toHaveBeenCalledWith(7, {
      affiantName: 'Mike Smith',
      spouseName: 'Ellis Jame Smith Son-Wyatt',
      children: [{ name: "Shaun O'Brien", dob: '2015-04-02' }],
      separationDate: '2024-11-15',
    });
  });

  it('stores names exactly as typed when the LLM call fails — the save never fails', async () => {
    chatMock.mockRejectedValue(new Error('provider down'));

    const res = await patch({ affiantName: 'mike smith', spouseName: 'ellis smith' });

    expect(res.status).toBe(200);
    expect(updateUserProfileMock).toHaveBeenCalledWith(7, {
      affiantName: 'mike smith',
      spouseName: 'ellis smith',
    });
  });

  it('stores names exactly as typed on a count mismatch', async () => {
    // Two names in, one out — the model dropped a name; as-typed wins.
    llmReturnsNormalized(['Mike Smith']);

    const res = await patch({ affiantName: 'mike smith', spouseName: 'ellis smith' });

    expect(res.status).toBe(200);
    expect(updateUserProfileMock).toHaveBeenCalledWith(7, {
      affiantName: 'mike smith',
      spouseName: 'ellis smith',
    });
  });

  it('stores names exactly as typed when the model returns junk instead of strings', async () => {
    llmReturnsNormalized(['Mike Smith', 42]);

    const res = await patch({ affiantName: 'mike smith', spouseName: 'ellis smith' });

    expect(res.status).toBe(200);
    expect(updateUserProfileMock).toHaveBeenCalledWith(7, {
      affiantName: 'mike smith',
      spouseName: 'ellis smith',
    });
  });

  it('never calls the LLM when the patch has no name fields', async () => {
    const res = await patch({ separationDate: '2024-11-15', spouseName: '' });

    expect(res.status).toBe(200);
    expect(chatMock).not.toHaveBeenCalled();
    // An explicit blank spouseName (clear) passes through untouched.
    expect(updateUserProfileMock).toHaveBeenCalledWith(7, {
      separationDate: '2024-11-15',
      spouseName: '',
    });
  });
});
