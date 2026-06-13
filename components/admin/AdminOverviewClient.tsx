'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MarketplaceApiError, type AdminStats } from '@discover-legal/sdk';
import { marketplaceClient } from '@/lib/marketplace/browserClient';
import { formatPrice } from '@/components/marketplace/format';

export default function AdminOverviewClient() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    marketplaceClient.admin
      .stats()
      .then((s) => active && setStats(s))
      .catch((err) =>
        active &&
        setError(err instanceof MarketplaceApiError ? 'Could not load stats.' : 'Network error.'),
      );
    return () => {
      active = false;
    };
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="text-sm text-gray-500">Loading…</p>;

  const cards = [
    { label: 'Users', value: String(stats.users.total) },
    { label: 'Lawyers', value: String(stats.users.lawyers) },
    { label: 'Admins', value: String(stats.users.admins) },
    { label: 'Templates', value: String(stats.templates.total) },
    { label: 'Pending review', value: String(stats.templates.pendingReview), highlight: stats.templates.pendingReview > 0 },
    { label: 'Published', value: String(stats.templates.published) },
    { label: 'Suspended', value: String(stats.templates.suspended) },
    { label: 'Documents sold', value: String(stats.sales.purchases) },
    { label: 'Gross revenue', value: formatPrice(stats.sales.revenueCents) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border bg-white p-4 shadow-sm ${
              c.highlight ? 'border-amber-300' : 'border-gray-200'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            <div className="mt-1 text-xs text-gray-500">{c.label}</div>
          </div>
        ))}
      </div>
      {stats.templates.pendingReview > 0 && (
        <Link
          href="/admin/templates?status=pending_review"
          className="inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
        >
          Review {stats.templates.pendingReview} pending template
          {stats.templates.pendingReview === 1 ? '' : 's'} →
        </Link>
      )}
    </div>
  );
}
