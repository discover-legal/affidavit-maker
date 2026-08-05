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
jest.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withRLSBypass: (fn: () => unknown) => fn(),
}));
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
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 42, user_id: 7, document_type: 'divorce_package', payment_status: 'unpaid' }],
    });
    const response = await post('single_affidavit');
    expect(response.status).toBe(400);
    expect(createIntent).not.toHaveBeenCalled();
  });

  it('charges the canonical divorce price for a divorce package', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 42, user_id: 7, document_type: 'divorce_package', payment_status: 'unpaid' }],
      })
      .mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_1', email: 'owner@example.com' }] })
      // Purchase-attempt sequence lookup (withRLSBypass).
      .mockResolvedValueOnce({ rows: [{ attempt: 0, latest_status: null }] })
      // Ledger INSERT for the pending payment row.
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    createIntent.mockResolvedValueOnce({ id: 'pi_1', client_secret: 'secret' });
    const response = await post('divorce_package');
    expect(response.status).toBe(200);
    expect(createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4980,
        metadata: expect.objectContaining({ documentType: 'divorce_package', documentId: '42' }),
      }),
      // Deterministic idempotency key: purchase:<user>:<doc>:<product>:<attempt>
      expect.objectContaining({ idempotencyKey: 'purchase:7:42:divorce_package:0' }),
    );
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
