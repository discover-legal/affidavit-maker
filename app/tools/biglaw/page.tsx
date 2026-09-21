import type { Metadata } from 'next';
import { AlertTriangle, ArrowRight, Check, Code2 } from 'lucide-react';
import ConsultancyNav from '@/components/marketing/consultancy/ConsultancyNav';
import ConsultancyFooter from '@/components/marketing/consultancy/ConsultancyFooter';
import BookingCta, { BookingNote } from '@/components/marketing/consultancy/BookingCta';
import { BIGLAW_REPO } from '@/components/marketing/consultancy/content';
import { jsonLd } from '@/lib/json-ld';

// Facts below come from the BigLaw repository README; keep them in step with it.

const pageTitle = 'BigLaw: Open-Source Legal AI Platform';
const pageDescription =
  'BigLaw is a free, Apache-2.0 legal AI platform covering research, drafting, redlining, e-signatures, docketing, billing and collaboration, run by a bench of agents with a verification protocol and human gates. One static Go binary; runs on local models.';
const pageUrl = 'https://discover.legal/tools/biglaw';

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
    images: [{ url: 'https://discover.legal/app-icon-1024.png', width: 1024, height: 1024, alt: 'BigLaw by discover.legal' }],
  },
  twitter: { card: 'summary_large_image', title: `${pageTitle} | discover.legal`, description: pageDescription, images: ['https://discover.legal/app-icon-1024.png'] },
  keywords: ['open source legal AI', 'legal AI platform', 'self-hosted legal software', 'law firm AI', 'legal research AI', 'contract redlining AI'],
  robots: { index: true, follow: true },
};

const COVERS = [
  'Legal research with cited, verified synthesis',
  'Drafting and redlining',
  'E-signatures (DocuSeal)',
  'Briefing, docketing and billing',
  'Collaboration through Teams and Slack via the Big Michael agent',
  'An MCP server so other tools can call the bench',
] as const;

const RUNS = [
  'One static Go binary; the whole stack runs on a Raspberry Pi with 4 GB of RAM',
  'Entirely on local models (Ollama, LM Studio) or your model provider',
  'Docker setup script brings up the three-container stack in about a minute',
  'Apache-2.0 licence; the source is on GitHub',
] as const;

const PROTOCOL = [
  'DyTopo rounds of specialised epistemic, conceptual and writing agents over an in-process vector agent registry',
  'A debate and verification protocol between every finding and the page',
  'Low-confidence or challenged findings stop at a human gate before final synthesis',
] as const;

const DOCS = [
  { href: `${BIGLAW_REPO}#readme`, label: 'README' },
  { href: `${BIGLAW_REPO}/blob/main/docs/why-biglaw.md`, label: 'Why BigLaw: the cost math' },
  { href: `${BIGLAW_REPO}/blob/main/docs/security.md`, label: 'Security notice' },
  { href: `${BIGLAW_REPO}/blob/main/docs/legal-notices.md`, label: 'Legal notices' },
] as const;

export default function BigLawPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': pageUrl,
    name: 'BigLaw',
    url: pageUrl,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Linux, Docker',
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    codeRepository: BIGLAW_REPO,
    description: pageDescription,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@id': 'https://discover.legal/#organization' },
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <ConsultancyNav />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12">
        <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-4">Free solution · Open source</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05] mb-6 max-w-3xl">
          BigLaw. The BigLaw tool stack. Open. Free.
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed mb-8">
          What the largest firms spend on a stack of vendor contracts, consolidated into one
          open-source platform, free for solos, boutiques and small firms. Not a chatbot with a
          legal prompt: an orchestration engine with a verification protocol between every finding
          and the page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <a
            href={BIGLAW_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center justify-center px-6 py-3.5 bg-slate-900 text-white text-base font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
          >
            <Code2 className="mr-2 h-4 w-4" />
            View on GitHub
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
          <BookingCta variant="hero">Have us run it for your firm</BookingCta>
        </div>
        <BookingNote className="mt-3" />
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 flex gap-4">
          <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold text-amber-900 mb-1">Experimental. Read this first.</p>
            <p className="text-sm text-amber-900 leading-relaxed">
              BigLaw is an experimental research project, not production-hardened software. It
              handles credentials, client matter data and privileged communications, and it has
              not had a formal independent security audit. Before anything touches real client
              data, read the security notice and legal notices and engage an independent review.
              Authentication is off by default for local development; never expose the API on a
              shared network without enabling it. Nothing it produces is legal advice.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 grid md:grid-cols-3 gap-6 lg:gap-8">
        {[
          { title: 'What it covers', items: COVERS },
          { title: 'How it runs', items: RUNS },
          { title: 'How it decides', items: PROTOCOL },
        ].map((col) => (
          <div key={col.title} className="rounded-2xl border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-5">{col.title}</h2>
            <ul className="space-y-3">
              {col.items.map((it) => (
                <li key={it} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
                  <Check className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="bg-slate-50 border-y border-slate-200/70 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Sixty seconds to running.</h2>
            <p className="text-base text-slate-600 mb-4 leading-relaxed">
              Needs git and Docker. The setup script clones the repository, seeds the environment
              file and brings up the stack. Add a model-provider key or local-inference settings;
              unconfigured connectors degrade gracefully.
            </p>
            <pre className="rounded-xl bg-slate-900 text-slate-100 text-sm p-4 overflow-x-auto"><code>curl -fsSL https://raw.githubusercontent.com/discover-legal/BigLaw/main/setup.sh | bash</code></pre>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Or have it run for you.</h2>
            <p className="text-base text-slate-600 mb-6 leading-relaxed">
              Our managed service deploys BigLaw on infrastructure you control, starting with the
              security review and authentication switched on, then monitors, patches and supports
              it for your staff.
            </p>
            <ul className="space-y-2 mb-6">
              {DOCS.map((d) => (
                <li key={d.href}>
                  <a href={d.href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-900 underline underline-offset-2 hover:text-brand">
                    {d.label}
                  </a>
                </li>
              ))}
            </ul>
            <BookingCta variant="card">Talk about a deployment</BookingCta>
          </div>
        </div>
      </section>

      <ConsultancyFooter />
    </div>
  );
}
