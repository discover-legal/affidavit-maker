import type Stripe from 'stripe';

export type PaymentLedgerBinding = {
  user_id: number;
  amount_cents: number;
  currency: string;
  metadata: {
    documentId?: string | number | null;
    documentType?: string | null;
  } | null;
};

/**
 * Refuse to grant an entitlement unless Stripe's immutable, server-authored
 * fields agree with the local ledger. The local row remains authoritative for
 * which document is unlocked; Stripe metadata is only a binding check.
 */
export function assertPaymentIntentBinding(
  intent: Stripe.PaymentIntent,
  payment: PaymentLedgerBinding,
): void {
  const expectedUserId = String(payment.user_id);
  const expectedCurrency = String(payment.currency).toLowerCase();
  const expectedDocumentType = payment.metadata?.documentType;
  const localDocumentId = payment.metadata?.documentId;
  const expectedDocumentId =
    localDocumentId === null || localDocumentId === undefined
      ? 'new'
      : String(localDocumentId);

  const mismatches: string[] = [];
  if (intent.metadata?.userId !== expectedUserId) mismatches.push('user');
  if (intent.amount !== payment.amount_cents) mismatches.push('amount');
  if (intent.currency.toLowerCase() !== expectedCurrency) mismatches.push('currency');
  if (
    typeof expectedDocumentType !== 'string' ||
    intent.metadata?.documentType !== expectedDocumentType
  ) {
    mismatches.push('documentType');
  }
  if (intent.metadata?.documentId !== expectedDocumentId) mismatches.push('documentId');
  if (
    intent.status === 'succeeded' &&
    typeof intent.amount_received === 'number' &&
    intent.amount_received !== payment.amount_cents
  ) {
    mismatches.push('amountReceived');
  }

  if (mismatches.length > 0) {
    throw new Error(`Payment intent ledger binding mismatch: ${mismatches.join(',')}`);
  }
}

export type DurablePaymentStatus =
  | 'pending' | 'failed' | 'canceled' | 'succeeded'
  | 'partially_refunded' | 'refunded' | 'disputed';

/** Pure model of the monotonic ledger rules used by webhook/status SQL. */
export function paymentStatusAfter(
  current: DurablePaymentStatus,
  event: 'succeeded' | 'failed' | 'partial_refund' | 'full_refund' | 'dispute_opened' | 'dispute_won',
  refundedAmountCents = 0,
): DurablePaymentStatus {
  if (event === 'full_refund') return 'refunded';
  if (event === 'dispute_opened') return current === 'refunded' ? current : 'disputed';
  if (event === 'dispute_won') {
    if (current !== 'disputed') return current;
    return refundedAmountCents > 0 ? 'partially_refunded' : 'succeeded';
  }
  if (event === 'partial_refund') {
    return ['refunded', 'disputed'].includes(current) ? current : 'partially_refunded';
  }
  if (event === 'succeeded') {
    return ['refunded', 'disputed', 'partially_refunded'].includes(current)
      ? current
      : 'succeeded';
  }
  return ['pending'].includes(current) ? 'failed' : current;
}

export function documentEntitled(statuses: DurablePaymentStatus[]): boolean {
  return statuses.some((status) => status === 'succeeded' || status === 'partially_refunded');
}

export function purchaseAttemptNumber(count: number, latestStatus: string | null): number {
  const terminal = ['failed', 'canceled', 'refunded', 'disputed'].includes(latestStatus ?? '');
  return terminal ? count : Math.max(0, count - 1);
}
