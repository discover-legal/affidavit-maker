'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { waitForPaymentSuccess } from '@/components/app/PaymentModal';

type RecoveryState = 'checking' | 'success' | 'error';

export default function PaymentSuccessClient() {
  const searchParams = useSearchParams();
  const paymentIntentId = searchParams.get('payment_intent');
  const redirectStatus = searchParams.get('redirect_status');
  const [state, setState] = useState<RecoveryState>('checking');
  const [message, setMessage] = useState('Confirming your payment and preparing your document…');
  const [documentId, setDocumentId] = useState<number | null>(null);

  const verify = useCallback(async () => {
    if (!paymentIntentId) {
      setState('error');
      setMessage('This return link is missing its payment reference. Your dashboard remains available.');
      return;
    }
    if (redirectStatus && redirectStatus !== 'succeeded') {
      setState('error');
      setMessage('The payment was not completed. You can safely return to your document and try again.');
      return;
    }

    setState('checking');
    setMessage('Confirming your payment and preparing your document…');
    try {
      const result = await waitForPaymentSuccess(paymentIntentId);
      setDocumentId(Number.isSafeInteger(result.documentId) ? result.documentId : null);
      setState('success');
      setMessage('Payment confirmed. Your document is ready.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'We could not verify this payment.');
    }
  }, [paymentIntentId, redirectStatus]);

  useEffect(() => {
    void verify();
  }, [verify]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <section
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"
        aria-live="polite"
      >
        {state === 'checking' && <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />}
        {state === 'success' && <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />}
        {state === 'error' && <AlertTriangle className="mx-auto h-12 w-12 text-amber-600" />}
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          {state === 'checking' ? 'Finalizing payment' : state === 'success' ? 'Payment complete' : 'Payment needs attention'}
        </h1>
        <p className="mt-2 text-gray-700">{message}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {state === 'error' && paymentIntentId && (
            <button
              type="button"
              onClick={() => void verify()}
              className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
            >
              Check again
            </button>
          )}
          <Link
            href={documentId ? `/editor/${documentId}` : '/dashboard'}
            className="rounded-lg border border-gray-300 px-5 py-2 font-medium text-gray-800 hover:bg-gray-50"
          >
            {documentId ? 'Return to document' : 'Go to dashboard'}
          </Link>
        </div>
        <p className="mt-5 text-xs text-gray-500">
          Do not submit another payment while confirmation is pending.
        </p>
      </section>
    </main>
  );
}
