import type { Metadata } from 'next';
import type { PracticeArea, TemplateSearchParams, TemplateSort } from '@discover-legal/sdk';
import { searchTemplates } from '@/lib/marketplace/repository';
import MarketplaceSearchBar from '@/components/marketplace/MarketplaceSearchBar';
import LoadMoreResults from '@/components/marketplace/LoadMoreResults';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Browse templates',
  description: 'Search lawyer-authored legal document templates by keyword, jurisdiction, and practice area.',
};

const SORTS: TemplateSort[] = ['popular', 'newest', 'rating', 'price_asc', 'price_desc'];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parse + sanitize the URL query into typed SDK search params. */
function parseSearchParams(sp: Record<string, string | string[] | undefined>): TemplateSearchParams {
  const sortRaw = first(sp.sort) as TemplateSort | undefined;
  const practiceRaw = first(sp.practice_area);
  const num = (v: string | undefined) => {
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    q: first(sp.q)?.trim() || undefined,
    matterType: first(sp.matter_type)?.trim() || undefined,
    practiceArea:
      practiceRaw === 'family' || practiceRaw === 'civil' ? (practiceRaw as PracticeArea) : undefined,
    jurisdiction: first(sp.jurisdiction)?.trim().toUpperCase() || undefined,
    minPrice: num(first(sp.min_price)),
    maxPrice: num(first(sp.max_price)),
    minRating: num(first(sp.min_rating)),
    sortBy: sortRaw && SORTS.includes(sortRaw) ? sortRaw : 'popular',
  };
}

export default async function MarketplaceSearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = parseSearchParams(searchParams);
  const page = await searchTemplates({ ...params, limit: 12 });

  const resultLabel =
    page.total != null ? `${page.total} ${page.total === 1 ? 'template' : 'templates'}` : 'Templates';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Browse templates</h1>
        <p className="mt-1 text-sm text-gray-500">{resultLabel}</p>
      </div>

      <MarketplaceSearchBar
        defaults={{
          q: params.q,
          jurisdiction: params.jurisdiction,
          practiceArea: params.practiceArea,
          sort: params.sortBy,
        }}
      />

      <LoadMoreResults
        initialTemplates={page.templates}
        initialCursor={page.nextCursor}
        searchParams={params}
        emptyMessage="No templates match your search. Try broadening your filters."
      />
    </div>
  );
}
