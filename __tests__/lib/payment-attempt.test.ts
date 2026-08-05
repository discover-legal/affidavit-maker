import { purchaseAttemptNumber } from '@/lib/api/paymentIntegrity';

describe('payment intent attempt sequencing', () => {
  it('converges concurrent and recoverable retries on the current intent', () => {
    expect(purchaseAttemptNumber(0, null)).toBe(0);
    expect(purchaseAttemptNumber(1, 'pending')).toBe(0);
    expect(purchaseAttemptNumber(1, 'requires_payment_method')).toBe(0);
  });

  it('advances immediately after terminal attempts', () => {
    expect(purchaseAttemptNumber(1, 'failed')).toBe(1);
    expect(purchaseAttemptNumber(2, 'canceled')).toBe(2);
    expect(purchaseAttemptNumber(3, 'refunded')).toBe(3);
  });
});
