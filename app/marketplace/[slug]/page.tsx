import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTemplateBySlug } from '@/lib/marketplace/repository';
import { jsonLd } from '@/lib/json-ld';
import {
  difficultyLabel,
  formatJurisdictions,
  formatPrice,
  formatRating,
} from '@/components/marketplace/format';
import BuyTemplateButton from '@/components/marketplace/BuyTemplateButton';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://discover.legal';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const template = await getTemplateBySlug(params.slug);
  if (!template) return { title: 'Template not found' };

  const url = `${BASE_URL}/marketplace/${template.slug}`;
  const description = template.shortDescription ?? template.description ?? template.title;
  return {
    title: template.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: template.title,
      description,
      images: template.coverImageUrl ? [{ url: template.coverImageUrl }] : undefined,
    },
  };
}

export default async function TemplateDetailPage({ params }: { params: { slug: string } }) {
  const template = await getTemplateBySlug(params.slug);
  if (!template) notFound();

  const rating = formatRating(template.avgRating, template.ratingCount);
  const url = `${BASE_URL}/marketplace/${template.slug}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': url,
    name: template.title,
    description: template.shortDescription ?? template.description ?? undefined,
    category: template.matterType,
    ...(template.lawyer ? { brand: { '@type': 'Brand', name: template.lawyer.displayName } } : {}),
    offers: {
      '@type': 'Offer',
      price: (template.priceCents / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url,
    },
    ...(rating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: template.avgRating.toFixed(1),
            ratingCount: template.ratingCount,
          },
        }
      : {}),
  };

  return (
    <article className="mx-auto max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />

      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/marketplace" className="hover:text-blue-700">
          Marketplace
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{template.title}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium capitalize text-blue-700">
          {template.practiceArea}
        </span>
        <span className="text-sm text-gray-500">{formatJurisdictions(template.jurisdictions, 12)}</span>
      </div>

      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{template.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
        {template.lawyer && <span>by {template.lawyer.displayName}</span>}
        {rating && (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className="text-amber-500">★</span>
            {rating} <span className="text-gray-400">({template.ratingCount} reviews)</span>
          </span>
        )}
        <span>{difficultyLabel(template.difficultyLevel)}</span>
        {template.estimatedMinutes != null && <span>~{template.estimatedMinutes} min</span>}
        <span>{template.totalPurchases} created</span>
      </div>

      {template.description && (
        <div className="mt-6 whitespace-pre-line leading-relaxed text-gray-700">
          {template.description}
        </div>
      )}

      {template.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {template.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col items-start gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-2xl font-bold text-gray-900">{formatPrice(template.priceCents)}</div>
          <p className="text-sm text-gray-500">
            Pay once, answer a guided interview, and generate your document.
          </p>
        </div>
        <BuyTemplateButton templateId={template.id} priceCents={template.priceCents} />
      </div>
    </article>
  );
}
