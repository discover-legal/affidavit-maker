/** @jest-environment node */

// v22-D broader-scan rescue for respondentSuspectedLocation. Amara-shape:
// primary Luna call sets respondentAddressUnknown=true but emits NO
// whereabouts-tagged fact this turn. The narrow rescue has nothing to
// scan. The broader-scan rescue sweeps ALL facts' sourceQuote + content
// and lets the LLM find any place mentioned as where the respondent
// might be.

const queryMock = jest.fn();
jest.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { mergeUserProfile } from '@/lib/api/profile';

beforeEach(() => {
  queryMock.mockReset();
});

afterEach(() => {
  delete (global as unknown as { openAIService?: unknown }).openAIService;
});

const readEmpty = () => ({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
const savedProfile = () => {
  const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
  return JSON.parse(params[1] as string);
};

describe('mergeUserProfile — respondentSuspectedLocation broader-scan rescue', () => {
  test('Amara-shape: addressUnknown=true, no whereabouts fact, place mentioned in unrelated fact\'s sourceQuote → rescue LLM extracts "Alabama"', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async (
      _msgs: unknown,
      options: { response_format?: { json_schema?: { name?: string } } },
    ) => {
      if (options?.response_format?.json_schema?.name === 'place_extraction') {
        return {
          choices: [{ message: { content: JSON.stringify({ place: 'Alabama' }) } }],
        };
      }
      throw new Error('unexpected rescue call');
    });
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      respondentAddressUnknown: true,
      facts: [
        {
          id: 'f1',
          content: 'The respondent left the marital home about a year ago.',
          sourceQuote: 'he left about a year ago — moved to Alabama maybe, I really don\'t know',
          category: 'separation',
          subcategory: 'separation_date',
        },
        {
          id: 'f2',
          content: 'The parties were married in 2010.',
          sourceQuote: 'we got married in 2010',
          category: 'marriage',
          subcategory: 'ceremony',
        },
      ],
    });

    expect(chat).toHaveBeenCalledTimes(1);
    const saved = savedProfile();
    expect(saved.respondentSuspectedLocation).toBe('Alabama');
    // Explicit flag preserved.
    expect(saved.respondentAddressUnknown).toBe(true);
  });

  test('narrow rescue path still wins when a whereabouts fact IS present — broader scan does NOT fire', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    // Only one call expected, with sourceQuote of the whereabouts fact.
    const chat = jest.fn(async () => ({
      choices: [{ message: { content: JSON.stringify({ place: 'Louisiana' }) } }],
    }));
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      respondentAddressUnknown: true,
      facts: [
        {
          id: 'f1',
          content: 'possibly Louisiana',
          sourceQuote: 'maybe Louisiana',
          category: 'service',
          subcategory: 'respondent_whereabouts',
        },
      ],
    });

    expect(chat).toHaveBeenCalledTimes(1);
    expect(savedProfile().respondentSuspectedLocation).toBe('Louisiana');
  });

  test('addressUnknown is NOT true → broader scan does NOT fire', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn();
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      // respondentAddressUnknown intentionally absent
      facts: [
        {
          id: 'f1',
          content: 'unrelated fact',
          sourceQuote: 'we lived in Alabama once',
          category: 'marriage',
          subcategory: 'residence',
        },
      ],
    });

    expect(chat).not.toHaveBeenCalled();
    expect(savedProfile().respondentSuspectedLocation).toBeUndefined();
  });

  test('rescue LLM returns empty string → respondentSuspectedLocation stays absent (no invention)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async () => ({
      choices: [{ message: { content: JSON.stringify({ place: '' }) } }],
    }));
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      respondentAddressUnknown: true,
      facts: [
        {
          id: 'f1',
          content: 'The parties separated last year.',
          sourceQuote: 'we split up last year, no idea where he is',
          category: 'separation',
          subcategory: 'separation_date',
        },
      ],
    });

    expect(chat).toHaveBeenCalledTimes(1);
    expect(savedProfile().respondentSuspectedLocation).toBeUndefined();
  });

  test('rescue LLM throws → fails open (no crash, field stays absent)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async () => { throw new Error('llm down'); });
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await expect(
      mergeUserProfile(7, {
        respondentAddressUnknown: true,
        facts: [
          {
            id: 'f1',
            content: 'anything',
            sourceQuote: 'he moved to Alabama maybe',
            category: 'separation',
            subcategory: 'separation_date',
          },
        ],
      }),
    ).resolves.not.toThrow();

    expect(savedProfile().respondentSuspectedLocation).toBeUndefined();
  });

  test('no facts at all → broader scan does NOT fire (nothing to scan)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn();
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      respondentAddressUnknown: true,
      facts: [],
    });

    expect(chat).not.toHaveBeenCalled();
    expect(savedProfile().respondentSuspectedLocation).toBeUndefined();
  });

  test('explicit respondentSuspectedLocation wins — broader scan never invoked', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn();
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      respondentAddressUnknown: true,
      respondentSuspectedLocation: 'Ohio',
      facts: [
        {
          id: 'f1',
          content: 'anything',
          sourceQuote: 'he moved to Alabama maybe',
          category: 'separation',
          subcategory: 'separation_date',
        },
      ],
    });

    expect(chat).not.toHaveBeenCalled();
    expect(savedProfile().respondentSuspectedLocation).toBe('Ohio');
  });
});
