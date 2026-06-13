'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MarketplaceApiError, type LawyerDashboard } from '@discover-legal/sdk';
import { marketplaceClient } from '@/lib/marketplace/browserClient';
import { formatPrice } from '@/components/marketplace/format';
import StatusBadge from './StatusBadge';

export default function LawyerDashboardClient() {
  const [data, setData] = useState<LawyerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    marketplaceClient.lawyer
      .dashboard()
      .then((d) => active && setData(d))
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof MarketplaceApiError
            ? 'Could not load your dashboard.'
            : 'Network error loading your dashboard.',
        );
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;

  const { totals, recentTemplates } = data;
  const cards = [
    { label: 'Templates', value: String(totals.templates) },
    { label: 'Published', value: String(totals.published) },
    { label: 'Drafts', value: String(totals.drafts) },
    { label: 'Documents created', value: String(totals.totalPurchases) },
    { label: 'Revenue', value: formatPrice(totals.totalRevenueCents) },
    { label: 'Avg rating', value: totals.avgRating != null ? totals.avgRating.toFixed(1) : '—' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/lawyer/templates/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          New template
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            <div className="mt-1 text-xs text-gray-500">{c.label}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent templates</h2>
          <Link href="/lawyer/templates" className="text-sm font-medium text-blue-600 hover:underline">
            View all →
          </Link>
        </div>
        {recentTemplates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <p className="text-gray-500">You haven&apos;t created any templates yet.</p>
            <Link
              href="/lawyer/templates/new"
              className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create your first template
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {recentTemplates.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/lawyer/templates/${t.id}`} className="font-medium text-gray-900 hover:text-blue-700">
                    {t.title}
                  </Link>
                  <div className="text-xs text-gray-500">
                    {t.matterType} · {formatPrice(t.priceCents)} · {t.totalPurchases} created
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
