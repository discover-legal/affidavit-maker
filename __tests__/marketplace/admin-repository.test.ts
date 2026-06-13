/**
 * @jest-environment node
 */
jest.mock('@/lib/db', () => ({ query: jest.fn() }));

import { query } from '@/lib/db';
import {
  listUsers,
  setUserRole,
  listAdminTemplates,
  approveTemplate,
  suspendTemplate,
  getAdminStats,
} from '@/lib/marketplace/adminRepository';
import { ValidationError } from '@/lib/api/errors';

const mockQuery = query as jest.Mock;
beforeEach(() => mockQuery.mockReset());

describe('listUsers', () => {
  it('applies role + q filters and counts the first page', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: '2' }], rowCount: 1 };
      return {
        rows: [{ id: 1, email: 'a@b.com', name: 'A', user_role: 'lawyer', created_at: new Date() }],
        rowCount: 1,
      };
    });
    const page = await listUsers({ role: 'lawyer', q: 'a' });
    expect(page.total).toBe(2);
    expect(page.users[0].role).toBe('lawyer');
    const pageCall = mockQuery.mock.calls.find((c) => !/COUNT\(\*\)/i.test(c[0]))!;
    expect(pageCall[0]).toMatch(/user_role = \$/);
    expect(pageCall[0]).toMatch(/ILIKE/i);
  });

  it('rejects an invalid role filter', async () => {
    await expect(listUsers({ role: 'wizard' as never })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('setUserRole', () => {
  it('rejects an invalid role', async () => {
    await expect(setUserRole(1, 'wizard' as never)).rejects.toBeInstanceOf(ValidationError);
  });
  it('updates and serializes', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 1, email: 'a@b.com', name: 'A', user_role: 'admin', created_at: new Date() }],
      rowCount: 1,
    });
    const u = await setUserRole(1, 'admin');
    expect(u?.role).toBe('admin');
    expect(mockQuery.mock.calls[0][1]).toEqual(['admin', 1]);
  });
  it('returns null when the user does not exist', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    expect(await setUserRole(999, 'lawyer')).toBeNull();
  });
});

describe('listAdminTemplates', () => {
  it('excludes deleted and joins the lawyer name', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: '1' }], rowCount: 1 };
      return {
        rows: [
          {
            id: 5, slug: 's', title: 'T', status: 'pending_review', practice_area: 'civil',
            matter_type: 'affidavit', price_cents: 100, lawyer_id: 7, lawyer_name: 'Jane',
            suspension_reason: null, created_at: new Date(), published_at: null,
          },
        ],
        rowCount: 1,
      };
    });
    const page = await listAdminTemplates({ status: 'pending_review' });
    expect(page.templates[0]).toMatchObject({ status: 'pending_review', lawyer: { id: 7, displayName: 'Jane' } });
    const pageCall = mockQuery.mock.calls.find((c) => !/COUNT\(\*\)/i.test(c[0]))!;
    expect(pageCall[0]).toMatch(/status <> 'deleted'/);
  });
});

describe('moderation', () => {
  function tplRow(over = {}) {
    return {
      id: 5, slug: 's', title: 'T', status: 'published', practice_area: 'civil',
      matter_type: 'affidavit', price_cents: 100, lawyer_id: 7, lawyer_name: 'Jane',
      suspension_reason: null, created_at: new Date(), published_at: new Date(), ...over,
    };
  }

  it('approve sets published + stamps published_at', async () => {
    mockQuery.mockResolvedValue({ rows: [tplRow()], rowCount: 1 });
    const t = await approveTemplate(5);
    expect(t?.status).toBe('published');
    expect(mockQuery.mock.calls[0][0]).toMatch(/status = 'published'/);
    expect(mockQuery.mock.calls[0][0]).toMatch(/published_at = COALESCE/i);
  });

  it('suspend records the reason', async () => {
    mockQuery.mockResolvedValue({ rows: [tplRow({ status: 'suspended', suspension_reason: 'spam' })], rowCount: 1 });
    const t = await suspendTemplate(5, 'spam');
    expect(t?.suspensionReason).toBe('spam');
    expect(mockQuery.mock.calls[0][1]).toEqual(['spam', 5]);
  });

  it('returns null when the row is missing/deleted', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    expect(await approveTemplate(999)).toBeNull();
  });
});

describe('getAdminStats', () => {
  it('aggregates users, templates, and sales', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: '10', clients: '7', lawyers: '2', admins: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: '4', pending: '1', published: '2', suspended: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ purchases: '9', revenue: '900' }], rowCount: 1 });
    const stats = await getAdminStats();
    expect(stats.users).toEqual({ total: 10, clients: 7, lawyers: 2, admins: 1 });
    expect(stats.templates).toEqual({ total: 4, pendingReview: 1, published: 2, suspended: 1 });
    expect(stats.sales).toEqual({ purchases: 9, revenueCents: 900 });
  });
});
