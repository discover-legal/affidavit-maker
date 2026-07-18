/** @jest-environment node */

import fs from 'node:fs';

const mockQuery = jest.fn();
const createIntent = jest.fn();
jest.mock('@/lib/api/auth', () => ({
  withAuth: (handler: Function) => (req: Request) => handler(req, {
    params: {},
    user: { id: 7, email: 'owner@example.com' },
  }),
}));
jest.mock('@/lib/db', () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
jest.mock('@/lib/api/rateLimit', () => ({
  checkRateLimit: () => ({ ok: true }),
  RATE_LIMITS: { payment: {} },
}));
jest.mock('@/lib/locale.server', () => ({ getLocale: () => 'us' }));
jest.mock('@/lib/api/stripe', () => ({
  paymentsEnabled: () => true,
  getStripe: () => ({
    customers: { create: jest.fn() },
    paymentIntents: { create: createIntent },
  }),
}));

import { POST } from '@/app/api/payment/create-intent/route';

function post(documentType: string): Promise<Response> {
  return (POST as unknown as (req: Request) => Promise<Response>)(
    new Request('https://discover.legal/api/payment/create-intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documentId: 42, documentType }),
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('server-bound payment products', () => {
  it('rejects a cheaper affidavit SKU for an owned divorce package', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 42, document_type: 'divorce_package' }] });
    const response = await post('single_affidavit');
    expect(response.status).toBe(400);
    expect(createIntent).not.toHaveBeenCalled();
  });

  it('charges the canonical divorce price for a divorce package', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 42, document_type: 'divorce_package' }] })
      .mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_1', email: 'owner@example.com' }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    createIntent.mockResolvedValueOnce({ id: 'pi_1', client_secret: 'secret' });
    const response = await post('divorce_package');
    expect(response.status).toBe(200);
    expect(createIntent).toHaveBeenCalledWith(expect.objectContaining({
      amount: 4980,
      metadata: expect.objectContaining({ documentType: 'divorce_package', documentId: '42' }),
    }));
  });

  it('ships an own-user, pending-only RLS insert policy', () => {
    const sql = fs.readFileSync('migrations/017_payment_insert_rls.sql', 'utf8');
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("current_setting('app.user_id'");
  });

  it('revokes paid status when saved document content materially changes', () => {
    const source = fs.readFileSync('app/api/documents/save/route.ts', 'utf8');
    expect(source).toContain("content IS DISTINCT FROM $1::jsonb THEN 'unpaid'");
  });
});
