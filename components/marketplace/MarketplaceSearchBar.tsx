import type { PracticeArea, TemplateSort } from '@discover-legal/sdk';

/**
 * Search/filter bar. A plain GET <form> targeting /marketplace/search so it
 * works without JavaScript (progressive enhancement) and produces shareable,
 * crawlable result URLs. Defaults pre-fill from the current query.
 */
export default function MarketplaceSearchBar({
  defaults = {},
}: {
  defaults?: {
    q?: string;
    jurisdiction?: string;
    practiceArea?: PracticeArea;
    sort?: TemplateSort;
  };
}) {
  return (
    <form
      action="/marketplace/search"
      method="get"
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
    >
      <label className="flex-1">
        <span className="mb-1 block text-xs font-medium text-gray-600">Search</span>
        <input
          type="search"
          name="q"
          defaultValue={defaults.q ?? ''}
          placeholder="Affidavit, divorce petition, custody…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </label>

      <label className="sm:w-32">
        <span className="mb-1 block text-xs font-medium text-gray-600">Jurisdiction</span>
        <input
          type="text"
          name="jurisdiction"
          maxLength={10}
          defaultValue={defaults.jurisdiction ?? ''}
          placeholder="TX"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </label>

      <label className="sm:w-36">
        <span className="mb-1 block text-xs font-medium text-gray-600">Practice area</span>
        <select
          name="practice_area"
          defaultValue={defaults.practiceArea ?? ''}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Any</option>
          <option value="family">Family</option>
          <option value="civil">Civil</option>
        </select>
      </label>

      <label className="sm:w-36">
        <span className="mb-1 block text-xs font-medium text-gray-600">Sort</span>
        <select
          name="sort"
          defaultValue={defaults.sort ?? 'popular'}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="popular">Most popular</option>
          <option value="newest">Newest</option>
          <option value="rating">Top rated</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </label>

      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
      >
        Search
      </button>
    </form>
  );
}
