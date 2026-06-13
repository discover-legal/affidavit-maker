'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MarketplaceApiError, type Purchase } from '@discover-legal/sdk';
import { marketplaceClient } from '@/lib/marketplace/browserClient';
import { formatPrice } from './format';

const STATUS_LABEL: Record<Purchase['status'], string> = {
  pending: 'Payment pending',
  paid: 'Ready',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

export default function PurchaseListClient() {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    marketplaceClient.purchases
      .list({ limit: 50 })
      .then((page) => active && setPurchases(page.purchases))
      .catch((err) => {
        if (!active) return;
        setError(err instanceof MarketplaceApiError ? 'Could not load your documents.' : 'Network error.');
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!purchases) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My documents</h1>
        <Link href="/marketplace" className="text-sm font-medium text-blue-600 hover:underline">
          Browse marketplace →
        </Link>
      </div>

      {purchases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-gray-500">You haven&apos;t purchased any documents yet.</p>
          <Link
            href="/marketplace"
            className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Browse templates
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {purchases.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <Link
                  href={`/marketplace/purchases/${p.id}`}
                  className="font-medium text-gray-900 hover:text-blue-700"
                >
                  {p.templateTitle}
                </Link>
                <div className="text-xs text-gray-500">
                  {formatPrice(p.amountCents)} ·{' '}
                  {p.completedDocument ? 'Document generated' : STATUS_LABEL[p.status]}
                </div>
              </div>
              <Link
                href={`/marketplace/purchases/${p.id}`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
              >
                {p.completedDocument ? 'View' : p.status === 'paid' ? 'Complete' : 'Open'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
