/**
 * @jest-environment node
 */
jest.mock('@/lib/db', () => ({ query: jest.fn() }));

import { query } from '@/lib/db';
import {
  searchTemplates,
  getTemplateBySlug,
  encodeCursor,
} from '@/lib/marketplace/repository';
import { ValidationError } from '@/lib/api/errors';

const mockQuery = query as jest.Mock;

function row(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: 's1',
    title: 'T1',
    short_description: null,
    description: null,
    matter_type: 'affidavit',
    practice_area: 'civil',
    jurisdictions: ['TX'],
    price_cents: 100,
    cover_image_url: null,
    tags: [],
    estimated_minutes: 10,
    difficulty_level: 'basic',
    total_purchases: 5,
    avg_rating: '4.50',
    rating_count: 3,
    published_at: new Date('2026-06-01T00:00:00.000Z'),
    lawyer_id: 7,
    lawyer_name: 'Jane',
    ...over,
  };
}

beforeEach(() => mockQuery.mockReset());

/** Wire the count call (SELECT COUNT) and the page call separately. */
function wire({ count, rows }: { count?: number; rows: unknown[] }) {
  mockQuery.mockImplementation(async (sql: string) => {
    if (/count\(\*\)/i.test(sql)) return { rows: [{ count: String(count ?? 0) }], rowCount: 1 };
    return { rows, rowCount: rows.length };
  });
}

describe('searchTemplates', () => {
  it('filters to published, non-deleted rows and returns a serialized page', async () => {
    wire({ count: 1, rows: [row()] });
    const page = await searchTemplates({});
    const pageSql = mockQuery.mock.calls.find((c) => !/count\(\*\)/i.test(c[0]))![0] as string;
    expect(pageSql).toMatch(/status\s*=\s*'published'/i);
    expect(pageSql).toMatch(/deleted_at\s+IS\s+NULL/i);
    expect(page.total).toBe(1);
    expect(page.templates[0]).toMatchObject({ slug: 's1', avgRating: 4.5, lawyer: { id: 7 } });
    expect(page.nextCursor).toBeNull();
  });

  it('applies q / jurisdiction / price / rating filters as bound params', async () => {
    wire({ count: 0, rows: [] });
    await searchTemplates({
      q: 'divorce',
      jurisdiction: 'ca',
      matterType: 'divorce',
      practiceArea: 'family',
      minPrice: 100,
      maxPrice: 500,
      minRating: 4,
    });
    const call = mockQuery.mock.calls.find((c) => !/count\(\*\)/i.test(c[0]))!;
    const sql = call[0] as string;
    const params = call[1] as unknown[];
    expect(sql).toMatch(/search_vector @@/i);
    expect(sql).toMatch(/jurisdictions/i);
    expect(params).toContain('divorce'); // q + matter_type
    expect(params).toContain('CA'); // jurisdiction upper-cased
    expect(params).toContain('family');
    expect(params).toContain(100);
    expect(params).toContain(500);
    expect(params).toContain(4);
  });

  it('maps sortBy to the correct ORDER BY column', async () => {
    wire({ count: 0, rows: [] });
    await searchTemplates({ sortBy: 'price_asc' });
    const sql = mockQuery.mock.calls.find((c) => !/count\(\*\)/i.test(c[0]))![0] as string;
    expect(sql).toMatch(/ORDER BY\s+mt\.price_cents ASC/i);
    expect(sql).toMatch(/mt\.id DESC/i);
  });

  it('rejects an unknown sortBy', async () => {
    await expect(searchTemplates({ sortBy: 'bogus' as never })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('clamps limit and fetches limit+1 to detect more pages', async () => {
    wire({ count: 10, rows: [row({ id: 1 }), row({ id: 2 }), row({ id: 3 })] });
    const page = await searchTemplates({ limit: 2 });
    // limit+1 = 3 requested; 3 returned -> hasMore, sliced to 2
    expect(page.templates).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();
    const params = mockQuery.mock.calls.find((c) => !/count\(\*\)/i.test(c[0]))![1] as unknown[];
    expect(params[params.length - 1]).toBe(3);
  });

  it('skips the COUNT query and applies a keyset clause when a cursor is given', async () => {
    wire({ rows: [row()] });
    const cursor = encodeCursor('popular', 5, 99);
    const page = await searchTemplates({ sortBy: 'popular', cursor });
    expect(mockQuery.mock.calls.some((c) => /count\(\*\)/i.test(c[0]))).toBe(false);
    expect(page.total).toBeNull();
    const call = mockQuery.mock.calls[0];
    expect(call[0]).toMatch(/total_purchases\s*<\s*\$/i);
    expect(call[1]).toEqual(expect.arrayContaining([5, 99]));
  });

  it('rejects a cursor whose sort does not match the request', async () => {
    const cursor = encodeCursor('rating', 4.5, 1);
    await expect(searchTemplates({ sortBy: 'popular', cursor })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe('getTemplateBySlug', () => {
  it('returns null when no row matches', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    expect(await getTemplateBySlug('nope')).toBeNull();
  });

  it('returns a serialized template and binds the slug', async () => {
    mockQuery.mockResolvedValue({ rows: [row({ slug: 'found' })], rowCount: 1 });
    const tpl = await getTemplateBySlug('found');
    expect(tpl).toMatchObject({ slug: 'found' });
    expect(mockQuery.mock.calls[0][1]).toEqual(['found']);
  });
});
