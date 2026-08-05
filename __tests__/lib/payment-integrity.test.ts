/** @jest-environment node */

import type Stripe from 'stripe';
import { assertPaymentIntentBinding } from '@/lib/api/paymentIntegrity';

const ledger = {
  user_id: 42,
  amount_cents: 1999,
  currency: 'usd',
  metadata: { documentId: '71', documentType: 'single_affidavit' },
};

function intent(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent {
  return {
    id: 'pi_test12345678901234',
    object: 'payment_intent',
    amount: 1999,
    amount_capturable: 0,
    amount_details: { tip: {} },
    amount_received: 1999,
    application: null,
    application_fee_amount: null,
    automatic_payment_methods: null,
    canceled_at: null,
    cancellation_reason: null,
    capture_method: 'automatic',
    client_secret: null,
    confirmation_method: 'automatic',
    created: 1,
    currency: 'usd',
    customer: null,
    description: null,
    invoice: null,
    last_payment_error: null,
    latest_charge: null,
    livemode: false,
    metadata: {
      userId: '42',
      documentId: '71',
      documentType: 'single_affidavit',
    },
    next_action: null,
    on_behalf_of: null,
    payment_method: null,
    payment_method_configuration_details: null,
    payment_method_options: {},
    payment_method_types: ['card'],
    processing: null,
    receipt_email: null,
    review: null,
    setup_future_usage: null,
    shipping: null,
    source: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    status: 'succeeded',
    transfer_data: null,
    transfer_group: null,
    ...overrides,
  } as Stripe.PaymentIntent;
}

describe('payment intent ledger binding', () => {
  it('accepts a fully matching Stripe intent', () => {
    expect(() => assertPaymentIntentBinding(intent(), ledger)).not.toThrow();
  });

  it.each([
    ['user', { metadata: { ...intent().metadata, userId: '43' } }],
    ['amount', { amount: 1 }],
    ['currency', { currency: 'cad' }],
    ['documentType', { metadata: { ...intent().metadata, documentType: 'divorce_package' } }],
    ['documentId', { metadata: { ...intent().metadata, documentId: '72' } }],
    ['amountReceived', { amount_received: 1500 }],
  ])('rejects a %s mismatch', (_field, override) => {
    expect(() => assertPaymentIntentBinding(intent(override as Partial<Stripe.PaymentIntent>), ledger))
      .toThrow(/ledger binding mismatch/);
  });

  it('binds document-less purchases to the explicit new sentinel', () => {
    const access = {
      ...ledger,
      metadata: { documentId: null, documentType: 'all_state_access' },
    };
    const accessIntent = intent({
      metadata: {
        userId: '42',
        documentId: 'new',
        documentType: 'all_state_access',
      },
    });
    expect(() => assertPaymentIntentBinding(accessIntent, access)).not.toThrow();
  });

  it('rejects legacy ledger rows without a server-bound product', () => {
    expect(() =>
      assertPaymentIntentBinding(intent(), { ...ledger, metadata: { documentId: '71' } }),
    ).toThrow(/documentType/);
  });
});

