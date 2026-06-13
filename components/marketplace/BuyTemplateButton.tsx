'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { MarketplaceApiError } from '@discover-legal/sdk';
import { marketplaceClient } from '@/lib/marketplace/browserClient';
import { formatPrice } from './format';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

/**
 * "$1/doc" purchase entry point on the template detail page. Starts checkout
 * via the SDK, then either redirects straight to the interview (free template)
 * or mounts Stripe Elements to collect payment. On success the buyer lands on
 * /marketplace/purchases/[id] to complete the interview and generate the doc.
 */
export default function BuyTemplateButton({
  templateId,
  priceCents,
}: {
  templateId: number;
  priceCents: number;
}) {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setStarting(true);
    setError(null);
    try {
      const session = await marketplaceClient.purchases.create(templateId);
      if (session.free || !session.clientSecret) {
        router.push(`/marketplace/purchases/${session.purchaseId}`);
        return;
      }
      setPurchaseId(session.purchaseId);
      setClientSecret(session.clientSecret);
    } catch (err) {
      if (err instanceof MarketplaceApiError && err.status === 401) {
        window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      setError(
        err instanceof MarketplaceApiError
          ? 'Could not start checkout. Please try again.'
          : 'Network error. Please try again.',
      );
      setStarting(false);
    }
  }

  if (clientSecret && purchaseId && stripePromise) {
    return (
      <div className="w-full sm:w-96">
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm purchaseId={purchaseId} priceCents={priceCents} />
        </Elements>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={starting}
        className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
      >
        {starting ? 'Starting…' : `Buy & start — ${formatPrice(priceCents)}`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function CheckoutForm({ purchaseId, priceCents }: { purchaseId: number; priceCents: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);
    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/marketplace/purchases/${purchaseId}`,
        },
        redirect: 'if_required',
      });
      if (submitError) {
        setError(submitError.message ?? 'Payment failed.');
        setProcessing(false);
        return;
      }
      // No redirect needed (e.g. card without 3DS) — go to the interview.
      router.push(`/marketplace/purchases/${purchaseId}`);
    } catch {
      setError('An unexpected error occurred.');
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {processing ? 'Processing…' : `Pay ${formatPrice(priceCents)}`}
      </button>
      <p className="text-center text-xs text-gray-400">Secured by Stripe</p>
    </form>
  );
}
