/**
 * @jest-environment node
 */
jest.mock('@/lib/db', () => ({ query: jest.fn() }));

import { query } from '@/lib/db';
import {
  slugify,
  createTemplate,
  listLawyerTemplates,
  getLawyerTemplate,
  updateTemplate,
  setTemplateStatus,
  softDeleteTemplate,
  getLawyerDashboard,
} from '@/lib/marketplace/lawyerRepository';
import { ValidationError } from '@/lib/api/errors';

const mockQuery = query as jest.Mock;

function lrow(over: Record<string, unknown> = {}) {
  return {
    id: 5,
    slug: 'draft-x',
    title: 'Draft X',
    short_description: null,
    description: null,
    matter_type: 'affidavit',
    practice_area: 'civil',
    jurisdictions: ['TX'],
    price_cents: 100,
    cover_image_url: null,
    tags: [],
    estimated_minutes: 15,
    difficulty_level: 'standard',
    status: 'draft',
    version: 1,
    template_config: { questions: [] },
    total_purchases: 0,
    total_revenue_cents: 0,
    avg_rating: '0.00',
    rating_count: 0,
    published_at: null,
    created_at: new Date('2026-06-12T00:00:00.000Z'),
    updated_at: new Date('2026-06-12T00:00:00.000Z'),
    ...over,
  };
}

beforeEach(() => mockQuery.mockReset());

describe('slugify', () => {
  it('lowercases, strips punctuation, and hyphenates', () => {
    expect(slugify('Simple Affidavit (TX)!')).toBe('simple-affidavit-tx');
    expect(slugify('   ')).toBe('template');
  });
});

describe('createTemplate', () => {
  it('generates a unique slug and inserts a draft owned by the lawyer', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (/SELECT slug FROM/i.test(sql)) return { rows: [{ slug: 'draft-x' }], rowCount: 1 };
      if (/INSERT INTO marketplace_templates/i.test(sql)) return { rows: [lrow({ slug: 'draft-x-2' })], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    const created = await createTemplate(7, {
      title: 'Draft X',
      matterType: 'affidavit',
      practiceArea: 'civil',
    });

    expect(created.slug).toBe('draft-x-2'); // base 'draft-x' was taken
    const insert = mockQuery.mock.calls.find((c) => /INSERT/i.test(c[0]))!;
    expect(insert[1][0]).toBe(7); // lawyer_id
    expect(insert[1]).toContain('draft-x-2'); // generated slug
    expect(insert[0]).toMatch(/'draft'/); // forced draft status
  });
});

describe('listLawyerTemplates', () => {
  it('scopes to lawyer_id, excludes deleted, and counts first page', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: '1' }], rowCount: 1 };
      return { rows: [lrow()], rowCount: 1 };
    });
    const page = await listLawyerTemplates(7);
    const pageCall = mockQuery.mock.calls.find((c) => !/COUNT\(\*\)/i.test(c[0]))!;
    expect(pageCall[0]).toMatch(/lawyer_id = \$1/);
    expect(pageCall[0]).toMatch(/status <> 'deleted'/);
    expect(pageCall[1][0]).toBe(7);
    expect(page.total).toBe(1);
    expect(page.templates[0].status).toBe('draft');
  });

  it('filters by status when supplied', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await listLawyerTemplates(7, { status: 'published' });
    const call = mockQuery.mock.calls.find((c) => !/COUNT\(\*\)/i.test(c[0]))!;
    expect(call[1]).toContain('published');
  });
});

describe('getLawyerTemplate', () => {
  it('returns null when not owned', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    expect(await getLawyerTemplate(7, 999)).toBeNull();
    expect(mockQuery.mock.calls[0][1]).toEqual([999, 7]);
  });
});

describe('updateTemplate', () => {
  it('builds a dynamic SET for provided fields only and scopes to owner', async () => {
    mockQuery.mockResolvedValue({ rows: [lrow({ price_cents: 250 })], rowCount: 1 });
    const updated = await updateTemplate(7, 5, { priceCents: 250, title: 'New' });
    expect(updated?.priceCents).toBe(250);
    const sql = mockQuery.mock.calls[0][0] as string;
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/price_cents = \$/);
    expect(sql).toMatch(/title = \$/);
    expect(sql).toMatch(/lawyer_id = \$/);
    expect(params).toContain(250);
    expect(params).toContain('New');
    expect(params.slice(-2)).toEqual([5, 7]); // id, lawyer_id last
  });

  it('serializes templateConfig to jsonb', async () => {
    mockQuery.mockResolvedValue({ rows: [lrow()], rowCount: 1 });
    await updateTemplate(7, 5, { templateConfig: { questions: [{ id: 'q1', label: 'Name', type: 'text' }] } });
    const sql = mockQuery.mock.calls[0][0] as string;
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/template_config = \$\d+::jsonb/);
    expect(params.some((p) => typeof p === 'string' && p.includes('"q1"'))).toBe(true);
  });

  it('returns the current row when patch is empty (no SET)', async () => {
    mockQuery.mockResolvedValue({ rows: [lrow()], rowCount: 1 });
    const res = await updateTemplate(7, 5, {});
    expect(res?.id).toBe(5);
    // Falls through to getLawyerTemplate -> a SELECT, not an UPDATE.
    expect(mockQuery.mock.calls[0][0]).toMatch(/SELECT/i);
  });
});

describe('setTemplateStatus', () => {
  it('stamps published_at when publishing', async () => {
    mockQuery.mockResolvedValue({ rows: [lrow({ status: 'published' })], rowCount: 1 });
    const res = await setTemplateStatus(7, 5, 'published');
    expect(res?.status).toBe('published');
    expect(mockQuery.mock.calls[0][0]).toMatch(/published_at = COALESCE/i);
  });

  it('does not stamp published_at for other statuses', async () => {
    mockQuery.mockResolvedValue({ rows: [lrow({ status: 'archived' })], rowCount: 1 });
    await setTemplateStatus(7, 5, 'archived');
    // RETURNING lists published_at as a column; assert it is not in the SET clause.
    expect(mockQuery.mock.calls[0][0]).not.toMatch(/published_at = COALESCE/i);
  });

  it('rejects deleting via status', async () => {
    await expect(setTemplateStatus(7, 5, 'deleted')).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('softDeleteTemplate', () => {
  it('marks deleted and reports whether a row was affected', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    expect(await softDeleteTemplate(7, 5)).toBe(true);
    expect(mockQuery.mock.calls[0][0]).toMatch(/status = 'deleted'/);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    expect(await softDeleteTemplate(7, 999)).toBe(false);
  });
});

describe('getLawyerDashboard', () => {
  it('aggregates totals and includes recent templates', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (/COUNT\(\*\) FILTER/i.test(sql)) {
        return {
          rows: [{ templates: '3', published: '1', drafts: '2', total_purchases: '9', total_revenue_cents: '900', avg_rating: '4.5' }],
          rowCount: 1,
        };
      }
      if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: '3' }], rowCount: 1 };
      return { rows: [lrow()], rowCount: 1 };
    });

    const dash = await getLawyerDashboard(7);
    expect(dash.totals).toEqual({
      templates: 3,
      published: 1,
      drafts: 2,
      totalPurchases: 9,
      totalRevenueCents: 900,
      avgRating: 4.5,
    });
    expect(dash.recentTemplates).toHaveLength(1);
  });
});
