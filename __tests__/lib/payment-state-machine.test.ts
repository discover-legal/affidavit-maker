import {
  documentEntitled,
  paymentStatusAfter,
} from '@/lib/api/paymentIntegrity';

describe('payment ledger state machine', () => {
  it('does not let delayed success or failure undo reversals', () => {
    expect(paymentStatusAfter('partially_refunded', 'succeeded')).toBe('partially_refunded');
    expect(paymentStatusAfter('refunded', 'succeeded')).toBe('refunded');
    expect(paymentStatusAfter('disputed', 'succeeded')).toBe('disputed');
    expect(paymentStatusAfter('succeeded', 'failed')).toBe('succeeded');
    expect(paymentStatusAfter('refunded', 'failed')).toBe('refunded');
  });

  it('keeps partial refunds entitled and revokes full refunds', () => {
    expect(paymentStatusAfter('succeeded', 'partial_refund')).toBe('partially_refunded');
    expect(documentEntitled(['partially_refunded'])).toBe(true);
    expect(paymentStatusAfter('partially_refunded', 'full_refund')).toBe('refunded');
    expect(documentEntitled(['refunded'])).toBe(false);
  });

  it('does not revoke a document with another valid payment', () => {
    expect(documentEntitled(['refunded', 'succeeded'])).toBe(true);
    expect(documentEntitled(['disputed', 'partially_refunded'])).toBe(true);
    expect(documentEntitled(['refunded', 'disputed'])).toBe(false);
  });

  it('restores won disputes without erasing partial-refund state', () => {
    expect(paymentStatusAfter('disputed', 'dispute_won', 0)).toBe('succeeded');
    expect(paymentStatusAfter('disputed', 'dispute_won', 100)).toBe('partially_refunded');
    expect(paymentStatusAfter('refunded', 'dispute_won', 0)).toBe('refunded');
  });

  it('keeps lost disputes revoked and full refunds dominant', () => {
    expect(paymentStatusAfter('disputed', 'failed')).toBe('disputed');
    expect(paymentStatusAfter('refunded', 'dispute_opened')).toBe('refunded');
  });
});
