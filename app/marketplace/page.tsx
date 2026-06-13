import Link from 'next/link';
import { searchTemplates } from '@/lib/marketplace/repository';
import MarketplaceSearchBar from '@/components/marketplace/MarketplaceSearchBar';
import TemplateGrid from '@/components/marketplace/TemplateGrid';

// DB- and flag-dependent: never statically prerender.
export const dynamic = 'force-dynamic';

/**
 * Marketplace landing / browse. Server-rendered from the repository (good for
 * SEO and first paint) with curated "Popular" and "Newest" sections.
 */
export default async function MarketplaceHomePage() {
  const [popular, newest] = await Promise.all([
    searchTemplates({ sortBy: 'popular', limit: 6 }),
    searchTemplates({ sortBy: 'newest', limit: 3 }),
  ]);

  return (
    <div className="space-y-10">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Lawyer-built legal document templates
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-gray-600">
          Pick a template, answer a guided interview, and generate a court-ready document for your
          jurisdiction — reviewed and authored by practicing attorneys.
        </p>
      </section>

      <MarketplaceSearchBar />

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Popular templates</h2>
          <Link href="/marketplace/search?sort=popular" className="text-sm font-medium text-blue-600 hover:underline">
            View all →
          </Link>
        </div>
        <TemplateGrid
          templates={popular.templates}
          emptyMessage="No published templates yet. Check back soon."
        />
      </section>

      {newest.templates.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Recently added</h2>
            <Link href="/marketplace/search?sort=newest" className="text-sm font-medium text-blue-600 hover:underline">
              View all →
            </Link>
          </div>
          <TemplateGrid templates={newest.templates} />
        </section>
      )}
    </div>
  );
}
