import type { Metadata } from 'next';
import { ArrowRight, Check, Code2, FlaskConical } from 'lucide-react';
import ConsultancyNav from '@/components/marketing/consultancy/ConsultancyNav';
import ConsultancyFooter from '@/components/marketing/consultancy/ConsultancyFooter';
import BookingCta, { BookingNote } from '@/components/marketing/consultancy/BookingCta';
import { RESEARCH } from '@/components/marketing/consultancy/content';
import { jsonLd } from '@/lib/json-ld';

const pageTitle = 'Research: Language Models on Legal Tasks';
const pageDescription =
  'Open experiments from discover.legal on how language models behave on legal tasks, published with their code, design and current status. First project: whether the language a model reasons in changes its accuracy on LegalBench classification tasks.';
const pageUrl = 'https://discover.legal/research';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: pageUrl },
  openGraph: {
    type: 'website',
    url: pageUrl,
    title: `${pageTitle} | discover.legal`,
    description: pageDescription,
    siteName: 'discover.legal',
    images: [{ url: 'https://discover.legal/app-icon-1024.png', width: 1024, height: 1024, alt: 'discover.legal research' }],
  },
  twitter: { card: 'summary_large_image', title: `${pageTitle} | discover.legal`, description: pageDescription, images: ['https://discover.legal/app-icon-1024.png'] },
  keywords: ['legal AI research', 'LegalBench', 'multilingual reasoning', 'chain of thought language', 'legal classification LLM'],
  robots: { index: true, follow: true },
};

export default function ResearchPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl,
    url: pageUrl,
    name: pageTitle,
    description: pageDescription,
    isPartOf: { '@id': 'https://discover.legal/#website' },
    hasPart: RESEARCH.map((r) => ({
      '@type': 'ScholarlyArticle',
      '@id': `${pageUrl}#${r.key}`,
      headline: r.title,
      abstract: r.question,
      creativeWorkStatus: 'Draft',
      codeRepository: r.repo,
      author: { '@id': 'https://discover.legal/#organization' },
    })),
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <ConsultancyNav />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12">
        <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-4">Research</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05] mb-6 max-w-3xl">
          Questions we are testing in public.
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
          Open experiments on how language models behave on legal tasks. Each project is published
          with its code and design, and its status is stated as it is: a pilot is a pilot, and a
          result is only claimed once the full run exists.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-10">
        {RESEARCH.map((r) => (
          <article key={r.key} id={r.key} className="scroll-mt-24 rounded-2xl border border-slate-200 p-8 sm:p-10 grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-brand-tint">
                <FlaskConical className="h-6 w-6 text-brand" />
              </div>
              <p className="text-xs font-semibold text-slate-500 mb-2">{r.status}</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">{r.title}</h2>
              <p className="text-base text-slate-700 mb-4 leading-relaxed">{r.question}</p>
              <p className="text-base text-slate-600 mb-6 leading-relaxed">{r.summary}</p>
              {r.pilotNote && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">From the pilot</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{r.pilotNote}</p>
                </div>
              )}
              <a
                href={r.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center px-5 py-3 rounded-lg font-semibold text-sm bg-slate-900 text-white hover:bg-slate-800 transition-all"
              >
                <Code2 className="mr-2 h-4 w-4" />
                Code and design on GitHub
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
            <div className="lg:col-span-5 lg:border-l lg:border-slate-200 lg:pl-8">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Design</h3>
              <ul className="space-y-3">
                {r.facts.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                    <Check className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>

      <section className="bg-slate-50 border-y border-slate-200/70 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Have a question worth testing?</h2>
          <p className="text-base text-slate-600 max-w-2xl mb-6 leading-relaxed">
            Firms sometimes need an answer that no vendor benchmark gives them: how a model does on
            their documents, in their language, under their constraints. That is a scoped
            engagement.
          </p>
          <BookingCta variant="hero" />
          <BookingNote className="mt-3" />
        </div>
      </section>

      <ConsultancyFooter />
    </div>
  );
}
