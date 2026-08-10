'use client';

// Payment Modal Component with Stripe Payment Element
import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { trackEvent } from '@/lib/utils/analytics';
import { useModalFocus } from '@/hooks/useModalFocus';

// Use relative URLs in production (empty string), localhost in development
const API_BASE_URL = '';

// In the free/donation deployment the publishable key is unset; loadStripe('')
// rejects at import time on every editor page load. <Elements> accepts null.
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const PAYMENT_STATUS_DELAYS_MS = [500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
const TERMINAL_PAYMENT_FAILURES = new Set(['canceled', 'failed', 'requires_payment_method']);

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const formatMoney = (amount, currency = 'usd') => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: currency.toUpperCase(),
}).format((amount || 0) / 100);

export const waitForPaymentSuccess = async (
  paymentIntentId,
  { fetchImpl = fetch, waitImpl = wait, signal } = {},
) => {
  if (!paymentIntentId) {
    throw new Error('Payment confirmation is missing an identifier. Please try again.');
  }

  for (let attempt = 0; attempt <= PAYMENT_STATUS_DELAYS_MS.length; attempt += 1) {
    const response = await fetchImpl(
      `${API_BASE_URL}/api/payment/status/${encodeURIComponent(paymentIntentId)}`,
      { method: 'GET', cache: 'no-store', signal },
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        // Transient failures are retried within the same bounded window.
      } else {
        throw new Error(payload.error || 'Unable to verify your payment.');
      }
    } else {
      const status = payload.data?.status;
      if (status === 'succeeded' && payload.data?.entitlementReady === true) return payload.data;
      if (TERMINAL_PAYMENT_FAILURES.has(status)) {
        throw new Error('The payment was not completed. Please use another payment method.');
      }
    }

    if (attempt === PAYMENT_STATUS_DELAYS_MS.length) break;
    await waitImpl(PAYMENT_STATUS_DELAYS_MS[attempt]);
  }

  throw new Error(
    'Your payment is still being confirmed. You have not been charged twice. Select “Check again” in a moment.',
  );
};

// Payment Form Component (inside Elements provider)
const PaymentForm = ({ amount, currency, onSuccess, onCancel, documentId, documentType, paymentIntentId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const verifyPayment = async () => {
    setProcessing(true);
    setError(null);

    try {
      await waitForPaymentSuccess(paymentIntentId);
      trackEvent('payment_completed', {
        document_id: documentId,
        document_type: documentType,
        amount: amount / 100,
      });
      onSuccess(paymentIntentId);
    } catch (err) {
      setError(err.message || 'Unable to verify your payment. Please check again.');
      setProcessing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    // Track payment attempt
    trackEvent('payment_initiated', {
      document_id: documentId,
      document_type: documentType,
      amount: amount / 100
    });

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success?documentId=${encodeURIComponent(documentId)}`,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message);
        setProcessing(false);

        // Track payment failure
        trackEvent('payment_failed', {
          document_id: documentId,
          error_message: submitError.message
        });
      } else {
        // Stripe accepted the confirmation. The server remains authoritative:
        // wait for the authenticated status endpoint before enabling download.
        setPaymentConfirmed(true);
        await verifyPayment();
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      setProcessing(false);

      // Track payment error
      trackEvent('payment_error', {
        document_id: documentId,
        error_message: err.message
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="mb-6">
        <PaymentElement
          options={{
            layout: {
              type: 'accordion',
              defaultCollapsed: false,
              radios: false,
              spacedAccordionItems: false,
            }
          }}
        />
      </div>

      {(processing || error) && (
        <div
          className={`mb-4 p-3 border rounded-lg flex items-start ${
            error ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
          }`}
          role={error ? 'alert' : 'status'}
          aria-live="polite"
        >
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className={`text-sm ${error ? 'text-red-800' : 'text-blue-800'}`}>
              {error || (paymentConfirmed
                ? 'Payment received. Confirming your download access…'
                : 'Securely processing your payment…')}
            </p>
            {error && paymentConfirmed && (
              <button
                type="button"
                onClick={verifyPayment}
                className="mt-2 text-sm font-semibold text-red-800 underline hover:no-underline"
              >
                Check again
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center font-medium"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {paymentConfirmed ? 'Confirming…' : 'Processing…'}
            </>
          ) : (
            `Pay ${formatMoney(amount, currency)}`
          )}
        </button>
      </div>
    </form>
  );
};

// Main Payment Modal Component
const PaymentModal = ({ isOpen, onClose, affidavitData, onPaymentSuccess, documentId, documentType = 'single_affidavit' }) => {
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [amount, setAmount] = useState(7900); // Default: $79.00
  const [currency, setCurrency] = useState('usd');
  const [originalAmount, setOriginalAmount] = useState(null);
  const [launchDiscountActive, setLaunchDiscountActive] = useState(false);
  const [launchDiscountPct, setLaunchDiscountPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dialogRef = useModalFocus(isOpen, { onEscape: onClose, canClose: !loading });

  useEffect(() => {
    if (!isOpen) return;

    // Track payment modal opened
    trackEvent('payment_modal_opened', {
      document_id: documentId,
      document_type: documentType
    });

    const createPaymentIntent = async () => {
      try {
        setLoading(true);
        setError(null);
        setClientSecret(null);
        setPaymentIntentId(null);

        const response = await fetch(`${API_BASE_URL}/api/payment/create-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType,
            documentId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to create payment intent');
        }

        setClientSecret(data.data?.clientSecret);
        setPaymentIntentId(data.data?.paymentIntentId);
        setAmount(data.data?.amount);
        setCurrency(data.data?.currency || 'usd');
        setOriginalAmount(data.data?.originalAmount ?? null);
        setLaunchDiscountActive(Boolean(data.data?.launchDiscountActive));
        setLaunchDiscountPct(data.data?.launchDiscountPct ?? 0);
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to initialize payment');
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [isOpen, documentId, documentType]);

  if (!isOpen) return null;

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#2563eb',
        spacingUnit: '4px',
        borderRadius: '6px',
      },
    },
    // Note: layout and paymentMethodSave are PaymentElement options, not Elements provider options.
    // They are already configured in the PaymentElement component (PaymentForm).
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title" className="bg-white rounded-lg max-w-md w-full my-auto flex flex-col max-h-[85vh]">
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-4 sm:p-6 pb-3 border-b flex-shrink-0">
          <h3 id="payment-dialog-title" className="text-lg font-semibold">Complete Payment</h3>
          <button onClick={onClose} disabled={loading} aria-label="Close payment dialog">
            <X className="h-6 w-6 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4">
          <div className="mb-6">
            {launchDiscountActive && originalAmount && (
              <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Launch special — {Math.round(launchDiscountPct * 100)}% off
                </p>
              </div>
            )}
            <div className="flex items-center justify-between py-2">
              <span>{documentType === 'divorce_package' ? 'Divorce Package' : 'Professional Affidavit'}</span>
              {launchDiscountActive && originalAmount ? (
                <span className="text-gray-400 line-through">{formatMoney(originalAmount, currency)}</span>
              ) : (
                <span className="font-semibold">{formatMoney(amount, currency)}</span>
              )}
            </div>
            {launchDiscountActive && originalAmount && (
              <div className="flex items-center justify-between py-1 text-emerald-700">
                <span className="text-sm">Launch discount ({Math.round(launchDiscountPct * 100)}% off)</span>
                <span className="text-sm font-medium">
                  -{formatMoney(originalAmount - amount, currency)}
                </span>
              </div>
            )}
            <div className="border-t pt-2">
              <div className="flex items-center justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatMoney(amount, currency)}</span>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-semibold">Payment Error</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && clientSecret && paymentIntentId && (
            <Elements stripe={stripePromise} options={options}>
              <PaymentForm
                amount={amount}
                currency={currency}
                onSuccess={onPaymentSuccess}
                onCancel={onClose}
                documentId={documentId}
                documentType={documentType}
                paymentIntentId={paymentIntentId}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
