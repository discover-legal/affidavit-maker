/**
 * @jest-environment node
 */
jest.mock('@/lib/db', () => ({ query: jest.fn() }));

import { query } from '@/lib/db';
import {
  createPurchase,
  getPurchaseDetail,
  saveAnswers,
  listPurchases,
  getPurchasablePricing,
} from '@/lib/marketplace/purchaseRepository';

const mockQuery = query as jest.Mock;

function prow(over: Record<string, unknown> = {}) {
  return {
    id: 3,
    template_id: 5,
    template_title: 'Affidavit',
    template_slug: 'affidavit',
    status: 'paid',
    amount_cents: 100,
    currency: 'usd',
    interview_answers: { fullName: 'Jane' },
    completed_document: null,
    document_generated_at: null,
    created_at: new Date('2026-06-12T00:00:00.000Z'),
    paid_at: new Date('2026-06-12T00:01:00.000Z'),
    template_config: { questions: [{ id: 'fullName', label: 'Full name', type: 'text' }] },
    ...over,
  };
}

beforeEach(() => mockQuery.mockReset());

describe('getPurchasablePricing', () => {
  it('returns pricing only for published templates', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 5, lawyer_id: 7, price_cents: 100 }], rowCount: 1 });
    const p = await getPurchasablePricing(5);
    expect(p).toEqual({ templateId: 5, lawyerId: 7, priceCents: 100 });
    expect(mockQuery.mock.calls[0][0]).toMatch(/status = 'published'/);
  });
  it('returns null when not found/unpublished', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    expect(await getPurchasablePricing(5)).toBeNull();
  });
});

describe('createPurchase', () => {
  it('inserts and returns the new id, stamping paid_at via CASE', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 42 }], rowCount: 1 });
    const id = await createPurchase({
      buyerId: 8,
      templateId: 5,
      lawyerId: 7,
      amountCents: 100,
      currency: 'usd',
      stripePaymentIntentId: 'pi_1',
      status: 'pending',
    });
    expect(id).toBe(42);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO marketplace_purchases/);
    expect(sql).toMatch(/CASE WHEN \$7 = 'paid'/);
    expect(params[0]).toBe(8); // buyer
    expect(params[5]).toBe('pi_1');
    expect(params[6]).toBe('pending');
  });
});

describe('getPurchaseDetail', () => {
  it('returns null when not owned', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    expect(await getPurchaseDetail(8, 3)).toBeNull();
    expect(mockQuery.mock.calls[0][1]).toEqual([3, 8]);
  });

  it('serializes the purchase + normalizes templateConfig', async () => {
    mockQuery.mockResolvedValue({ rows: [prow()], rowCount: 1 });
    const d = await getPurchaseDetail(8, 3);
    expect(d).toMatchObject({
      id: 3,
      templateId: 5,
      templateTitle: 'Affidavit',
      status: 'paid',
      amountCents: 100,
      interviewAnswers: { fullName: 'Jane' },
    });
    expect(d?.templateConfig.questions).toHaveLength(1);
    expect(d?.paidAt).toBe('2026-06-12T00:01:00.000Z');
  });
});

describe('saveAnswers', () => {
  it('returns null when the row is not paid/owned (0 rows updated)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect(await saveAnswers(8, 3, { a: 1 })).toBeNull();
    expect(mockQuery.mock.calls[0][0]).toMatch(/status = 'paid'/);
  });

  it('updates then returns the refreshed detail', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 3 }], rowCount: 1 }) // UPDATE
      .mockResolvedValueOnce({ rows: [prow({ interview_answers: { a: 1 } })], rowCount: 1 }); // getPurchaseDetail
    const d = await saveAnswers(8, 3, { a: 1 });
    expect(d?.interviewAnswers).toEqual({ a: 1 });
  });
});

describe('listPurchases', () => {
  it('counts on first page and scopes to the buyer', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (/COUNT\(\*\)/i.test(sql)) return { rows: [{ count: '1' }], rowCount: 1 };
      return { rows: [prow()], rowCount: 1 };
    });
    const page = await listPurchases(8);
    expect(page.total).toBe(1);
    expect(page.purchases[0].templateSlug).toBe('affidavit');
    const pageCall = mockQuery.mock.calls.find((c) => !/COUNT\(\*\)/i.test(c[0]))!;
    expect(pageCall[0]).toMatch(/p\.buyer_id = \$1/);
  });
});
