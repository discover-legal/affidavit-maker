'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MarketplaceApiError,
  type LawyerTemplate,
  type TemplateStatus,
} from '@discover-legal/sdk';
import { marketplaceClient } from '@/lib/marketplace/browserClient';
import { formatPrice } from '@/components/marketplace/format';
import StatusBadge from './StatusBadge';

const FILTERS: { label: string; value: TemplateStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
];

export default function LawyerTemplateListClient() {
  const [templates, setTemplates] = useState<LawyerTemplate[]>([]);
  const [filter, setFilter] = useState<TemplateStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (status: TemplateStatus | 'all') => {
    setLoading(true);
    setError(null);
    try {
      const page = await marketplaceClient.lawyer.list({
        status: status === 'all' ? undefined : status,
        limit: 100,
      });
      setTemplates(page.templates);
    } catch (err) {
      setError(
        err instanceof MarketplaceApiError ? 'Could not load your templates.' : 'Network error.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const act = useCallback(
    async (id: number, fn: () => Promise<unknown>) => {
      setBusyId(id);
      setError(null);
      try {
        await fn();
        await load(filter);
      } catch (err) {
        setError(
          err instanceof MarketplaceApiError ? err.message : 'Action failed. Please try again.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [filter, load],
  );

  const remove = (t: LawyerTemplate) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${t.title}"? This cannot be undone.`)) {
      return;
    }
    void act(t.id, () => marketplaceClient.lawyer.remove(t.id));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">My templates</h1>
        <Link
          href="/lawyer/templates/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          New template
        </Link>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              filter === f.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-gray-500">No templates here yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/lawyer/templates/${t.id}`} className="font-medium text-gray-900 hover:text-blue-700">
                    {t.title}
                  </Link>
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-xs text-gray-500">
                  {t.matterType} · {formatPrice(t.priceCents)} · {t.totalPurchases} created
                  {t.ratingCount > 0 && ` · ★ ${t.avgRating.toFixed(1)}`}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Link
                  href={`/lawyer/templates/${t.id}`}
                  className="rounded-lg border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
                >
                  Edit
                </Link>
                {t.status === 'published' || t.status === 'pending_review' ? (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => void act(t.id, () => marketplaceClient.lawyer.unpublish(t.id))}
                    className="rounded-lg border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:border-amber-300 hover:text-amber-700 disabled:opacity-50"
                  >
                    {t.status === 'pending_review' ? 'Withdraw' : 'Unpublish'}
                  </button>
                ) : t.status === 'draft' || t.status === 'archived' ? (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => void act(t.id, () => marketplaceClient.lawyer.publish(t.id))}
                    className="rounded-lg bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Submit for review
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => remove(t)}
                  className="rounded-lg border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
