// Payment Modal Component with Stripe Payment Element
import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth0 } from '@auth0/auth0-react';
import { trackEvent } from '../utils/analytics';

// Use relative URLs in production (empty string), localhost in development
const API_BASE_URL = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:3001';

// Detect if we're in a pre-rendering environment (react-snap, SSR, etc.)
const isPrerendering = () => {
  if (typeof navigator === 'undefined') return true;
  return /ReactSnap|Prerender|HeadlessChrome/.test(navigator.userAgent);
};

// Load Stripe only when NOT in pre-rendering mode
// During pre-rendering, external scripts fail to load and can crash the build
const stripePromise = isPrerendering()
  ? Promise.resolve(null)
  : loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// Payment Form Component (inside Elements provider)
const PaymentForm = ({ amount, onSuccess, onCancel, documentId, documentType }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);

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
          return_url: `${window.location.origin}/payment-success`,
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
        // Payment succeeded
        trackEvent('payment_completed', {
          document_id: documentId,
          document_type: documentType,
          amount: amount / 100
        });
        onSuccess();
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

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
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
              Processing...
            </>
          ) : (
            `Pay $${(amount / 100).toFixed(2)}`
          )}
        </button>
      </div>
    </form>
  );
};

// Main Payment Modal Component
const PaymentModal = ({ isOpen, onClose, affidavitData, onPaymentSuccess, documentId, documentType = 'single_affidavit' }) => {
  const { getAccessTokenSilently } = useAuth0();
  const [clientSecret, setClientSecret] = useState(null);
  const [amount, setAmount] = useState(7900); // Default: $79.00
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

        const token = await getAccessTokenSilently();

        const response = await fetch(`${API_BASE_URL}/api/payment/create-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
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
        setAmount(data.data?.amount);
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Failed to initialize payment');
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [isOpen, getAccessTokenSilently, documentId, documentType]);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-md w-full my-auto flex flex-col max-h-[85vh]">
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-4 sm:p-6 pb-3 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold">Complete Payment</h3>
          <button onClick={onClose} disabled={loading}>
            <X className="h-6 w-6 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4">
          <div className="mb-6">
            <div className="flex items-center justify-between py-2">
              <span>{documentType === 'divorce_package' ? 'Divorce Package' : 'Professional Affidavit'}</span>
              <span className="font-semibold">${(amount / 100).toFixed(2)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${(amount / 100).toFixed(2)}</span>
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

          {!loading && !error && clientSecret && (
            <Elements stripe={stripePromise} options={options}>
              <PaymentForm
                amount={amount}
                onSuccess={onPaymentSuccess}
                onCancel={onClose}
                documentId={documentId}
                documentType={documentType}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;