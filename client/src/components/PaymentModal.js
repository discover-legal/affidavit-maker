// Payment Modal Component with Stripe Payment Element
import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth0 } from '@auth0/auth0-react';

// Load Stripe (publishable key from environment)
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

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
      } else {
        // Payment succeeded
        onSuccess();
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <PaymentElement />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
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

    const createPaymentIntent = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await getAccessTokenSilently();

        const response = await fetch('/api/payment/create-intent', {
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
    layout: 'accordion',
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#2563eb',
      },
    },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Complete Payment</h3>
          <button onClick={onClose} disabled={loading}>
            <X className="h-6 w-6 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between py-2">
            <span>Professional Affidavit</span>
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
  );
};

export default PaymentModal;