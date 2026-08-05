/** @jest-environment node */

import { NextRequest } from 'next/server';

let currentEvent: Record<string, unknown>;
const clientQuery = jest.fn(async (sql: string) => {
  if (sql.includes('processed_webhook_events WHERE')) return { rows: [], rowCount: 0 };
  // Entitlement re-check: no other valid payment for this document.
  if (sql.includes('SELECT 1 FROM payments')) return { rows: [], rowCount: 0 };
  // Ledger row lookup (locked FOR UPDATE) by intent or charge id.
  if (sql.includes('FROM payments') && sql.includes('FOR UPDATE')) {
    return {
      rows: [{
        id: 1,
        document_id: 42,
        stripe_payment_intent_id: 'pi_1',
        user_id: 7,
        amount_cents: 4980,
        metadata: { documentId: '42' },
      }],
      rowCount: 1,
    };
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
    // Full refund (amount_refunded === amount_cents) → ledger 'refunded'.
    ['charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', amount_refunded: 4980 }, 'refunded'],
    // Dispute opened → ledger 'disputed'.
    ['charge.dispute.created', { charge: 'ch_1' }, 'disputed'],
  ])('revokes document access for %s', async (eventType, object, ledgerStatus) => {
    currentEvent = { id: `evt_${ledgerStatus}`, type: eventType, data: { object } };
    const response = await POST(request());
    expect(response.status).toBe(200);

    // Ledger transition carries the revocation status.
    const ledgerUpdate = clientQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('UPDATE payments'),
    ) as [string, unknown[]] | undefined;
    expect(ledgerUpdate).toBeDefined();
    expect(ledgerUpdate![1]).toEqual(expect.arrayContaining(['pi_1', ledgerStatus]));

    // With no other valid payment, the document entitlement is revoked.
    const docUpdate = clientQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('UPDATE documents'),
    ) as [string, unknown[]] | undefined;
    expect(docUpdate).toBeDefined();
    expect(docUpdate![1]).toEqual([42, 7, 'refunded']);
  });
});
