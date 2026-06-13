import Link from 'next/link';
import type { MarketplaceTemplate } from '@discover-legal/sdk';
import { difficultyLabel, formatJurisdictions, formatPrice, formatRating } from './format';

/**
 * Presentational card for a single marketplace template. Pure / server-safe —
 * no client state. Links to the template detail page.
 */
export default function TemplateCard({ template }: { template: MarketplaceTemplate }) {
  const rating = formatRating(template.avgRating, template.ratingCount);

  return (
    <Link
      href={`/marketplace/${template.slug}`}
      className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium capitalize text-blue-700">
          {template.practiceArea}
        </span>
        <span className="text-xs text-gray-500">{formatJurisdictions(template.jurisdictions)}</span>
      </div>

      <h3 className="line-clamp-2 text-lg font-semibold text-gray-900 group-hover:text-blue-700">
        {template.title}
      </h3>

      {template.shortDescription && (
        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{template.shortDescription}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        {template.lawyer && <span>by {template.lawyer.displayName}</span>}
        {rating && (
          <span className="inline-flex items-center gap-1" aria-label={`Rated ${rating} out of 5`}>
            <span aria-hidden className="text-amber-500">★</span>
            {rating}
            <span className="text-gray-400">({template.ratingCount})</span>
          </span>
        )}
        <span>{difficultyLabel(template.difficultyLevel)}</span>
        {template.estimatedMinutes != null && <span>~{template.estimatedMinutes} min</span>}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-base font-bold text-gray-900">{formatPrice(template.priceCents)}</span>
        <span className="text-sm font-medium text-blue-600 group-hover:underline">View →</span>
      </div>
    </Link>
  );
}
