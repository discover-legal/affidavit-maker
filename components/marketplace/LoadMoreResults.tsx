'use client';

import { useCallback, useState } from 'react';
import {
  MarketplaceApiError,
  type MarketplaceTemplate,
  type TemplateSearchParams,
} from '@discover-legal/sdk';
import { marketplaceClient as client } from '@/lib/marketplace/browserClient';
import TemplateGrid from './TemplateGrid';

/**
 * Renders an initial server-rendered page of results, then paginates further
 * pages client-side via the published @discover-legal/sdk against the
 * same-origin API. This is the canonical example of the SDK driving the UI —
 * partners integrate exactly the same way against an absolute baseUrl.
 */

export default function LoadMoreResults({
  initialTemplates,
  initialCursor,
  searchParams,
  emptyMessage,
}: {
  initialTemplates: MarketplaceTemplate[];
  initialCursor: string | null;
  searchParams: TemplateSearchParams;
  emptyMessage?: string;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await client.templates.search({ ...searchParams, cursor });
      setTemplates((prev) => [...prev, ...page.templates]);
      setCursor(page.nextCursor);
    } catch (err) {
      const message =
        err instanceof MarketplaceApiError
          ? 'Could not load more results. Please try again.'
          : 'Network error. Check your connection and try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, searchParams]);

  return (
    <div className="space-y-6">
      <TemplateGrid templates={templates} emptyMessage={emptyMessage} />

      {error && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      )}

      {cursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
