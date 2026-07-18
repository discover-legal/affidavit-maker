/** @jest-environment node */

import { NextRequest } from 'next/server';

let currentEvent: Record<string, unknown>;
const clientQuery = jest.fn(async (sql: string) => {
  if (sql.includes('processed_webhook_events WHERE')) return { rows: [], rowCount: 0 };
  if (sql.includes('SELECT user_id, metadata FROM payments')) {
    return { rows: [{ user_id: 7, metadata: { documentId: '42' } }], rowCount: 1 };
  }
  return { rows: [], rowCount: 1 };
});
const client = { query: clientQuery, release: jest.fn() };
jest.mock('@/lib/api/stripe', () => ({
  getStripe: () => ({ webhooks: { constructEvent: () => currentEvent } }),
}));
jest.mock('@/lib/db', () => ({
  getPool: async () => ({ connect: async () => client }),
}));

import { POST } from '@/app/api/payment/webhook/route';

function request(): NextRequest {
  return new NextRequest('https://discover.legal/api/payment/webhook', {
    method: 'POST',
    body: '{}',
    headers: { 'stripe-signature': 'valid-test-signature' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
});

describe('Stripe entitlement revocation', () => {
  it.each([
    ['charge.refunded', { payment_intent: 'pi_1' }, 'refunded'],
    ['charge.dispute.created', { payment_intent: 'pi_1' }, 'disputed'],
  ])('revokes document access for %s', async (eventType, object, paymentStatus) => {
    currentEvent = { id: `evt_${paymentStatus}`, type: eventType, data: { object } };
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE payments SET status = $1'),
      [paymentStatus, 'pi_1', 7],
    );
    expect(clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("payment_status = 'refunded'"),
      [42, 7],
    );
  });
});
