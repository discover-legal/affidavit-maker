import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import ConsultancyNav from '@/components/marketing/consultancy/ConsultancyNav';
import ConsultancyFooter from '@/components/marketing/consultancy/ConsultancyFooter';
import BookingCta, { BookingNote } from '@/components/marketing/consultancy/BookingCta';
import { SERVICES } from '@/components/marketing/consultancy/content';
import { jsonLd } from '@/lib/json-ld';

const pageTitle = 'Services: Buy, Build, Run, Advise';
const pageDescription =
  'Independent legal technology selection, custom intake and document automation, managed services on your infrastructure, and fractional CTO advisory for law firms and legal teams.';
const pageUrl = 'https://discover.legal/services';

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
    images: [{ url: 'https://discover.legal/app-icon-1024.png', width: 1024, height: 1024, alt: 'discover.legal' }],
  },
  twitter: { card: 'summary_large_image', title: `${pageTitle} | discover.legal`, description: pageDescription, images: ['https://discover.legal/app-icon-1024.png'] },
  robots: { index: true, follow: true },
};

const STAGES = [
  { n: '01', title: 'Consultation', body: 'A paid session to understand the problem, the firm and the constraints. You leave with our read on it.' },
  { n: '02', title: 'Scoped proposal', body: 'A written scope with deliverables, timeline and price. Fixed where the work can be fixed; monthly where it is a service.' },
  { n: '03', title: 'The work', body: 'Selection, build, deployment or advisory, with a named point of contact and written checkpoints.' },
  { n: '04', title: 'Handover or run', body: 'Code and documentation delivered to you, or the system operated for you under a managed-service agreement.' },
] as const;

export default function ServicesPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': pageUrl,
    url: pageUrl,
    name: pageTitle,
    itemListElement: SERVICES.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: { '@type': 'Service', name: `${s.name}: ${s.headline}`, description: s.body, url: `${pageUrl}#${s.key}`, provider: { '@id': 'https://discover.legal/#organization' } },
    })),
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <ConsultancyNav />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12">
        <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-4">Services</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05] mb-6 max-w-3xl">
          Buy, build, run, advise.
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed">
          Four engagement types that cover the life of a legal technology decision, from the first
          vendor demo to the system running in production.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-10">
        {SERVICES.map((s) => {
          const Icon = s.icon;
          return (
            <article key={s.key} id={s.key} className="scroll-mt-24 grid lg:grid-cols-12 gap-8 rounded-2xl border border-slate-200 p-8 sm:p-10">
              <div className="lg:col-span-7">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${s.iconBg}`}>
                  <Icon className={`h-6 w-6 ${s.iconColor}`} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{s.name}</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">{s.headline}</h2>
                <p className="text-base text-slate-600 mb-4 leading-relaxed">{s.body}</p>
                <p className="text-base text-slate-700 leading-relaxed">{s.engagement}</p>
              </div>
              <div className="lg:col-span-5 lg:border-l lg:border-slate-200 lg:pl-8">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">What you get</h3>
                <ul className="space-y-3">
                  {s.deliverables.map((d) => (
                    <li key={d} className="flex items-start gap-3 text-sm text-slate-700">
                      <Check className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </section>

      <section className="bg-slate-50 border-y border-slate-200/70 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-10">How an engagement runs.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STAGES.map((st) => (
              <div key={st.n} className="rounded-2xl bg-white border border-slate-200 p-6">
                <p className="text-xs font-mono text-brand mb-3">{st.n}</p>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{st.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{st.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start gap-3">
            <BookingCta variant="hero" />
            <BookingNote />
          </div>
        </div>
      </section>

      <ConsultancyFooter />
    </div>
  );
}
