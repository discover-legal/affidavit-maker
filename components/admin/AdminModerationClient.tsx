'use client';

import { useCallback, useEffect, useState } from 'react';
import { MarketplaceApiError, type AdminTemplate, type TemplateStatus } from '@discover-legal/sdk';
import { marketplaceClient } from '@/lib/marketplace/browserClient';
import { formatPrice } from '@/components/marketplace/format';
import StatusBadge from '@/components/lawyer/StatusBadge';

const FILTERS: { label: string; value: TemplateStatus | 'all' }[] = [
  { label: 'Pending review', value: 'pending_review' },
  { label: 'Published', value: 'published' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Draft', value: 'draft' },
  { label: 'All', value: 'all' },
];

export default function AdminModerationClient({
  initialStatus = 'pending_review',
}: {
  initialStatus?: TemplateStatus | 'all';
}) {
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [filter, setFilter] = useState<TemplateStatus | 'all'>(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (status: TemplateStatus | 'all') => {
    setLoading(true);
    setError(null);
    try {
      const page = await marketplaceClient.admin.listTemplates({
        status: status === 'all' ? undefined : status,
        limit: 100,
      });
      setTemplates(page.templates);
    } catch (err) {
      setError(err instanceof MarketplaceApiError ? 'Could not load templates.' : 'Network error.');
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
        setError(err instanceof MarketplaceApiError ? err.message : 'Action failed.');
      } finally {
        setBusyId(null);
      }
    },
    [filter, load],
  );

  const suspend = (t: AdminTemplate) => {
    const reason =
      typeof window !== 'undefined' ? window.prompt(`Suspend "${t.title}" — reason:`) : null;
    if (!reason || !reason.trim()) return;
    void act(t.id, () => marketplaceClient.admin.suspendTemplate(t.id, reason.trim()));
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Template moderation</h1>

      <div className="flex flex-wrap gap-2">
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
          <p className="text-gray-500">Nothing here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <a
                    href={`/marketplace/${t.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-gray-900 hover:text-blue-700"
                  >
                    {t.title}
                  </a>
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-xs text-gray-500">
                  {t.lawyer?.displayName ?? 'unknown'} · {t.matterType} · {formatPrice(t.priceCents)}
                  {t.suspensionReason && ` · suspended: ${t.suspensionReason}`}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {(t.status === 'pending_review' || t.status === 'draft') && (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => void act(t.id, () => marketplaceClient.admin.approveTemplate(t.id))}
                    className="rounded-lg bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {t.status === 'suspended' ? (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => void act(t.id, () => marketplaceClient.admin.reinstateTemplate(t.id))}
                    className="rounded-lg border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50"
                  >
                    Reinstate
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => suspend(t)}
                    className="rounded-lg border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
