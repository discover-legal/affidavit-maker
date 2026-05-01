// client/src/components/LandingPage.js — public homepage / marketing page
//
// Designed for conversion: single H1, breadth-first hero, matter-type
// proof, comparison vs lawyer/DIY, transparent pricing, FAQ schema (Google
// FAQ rich-results), and a teaser into the resources hub. Country-aware
// copy and accent (US/CA). All Tailwind classes are static so the JIT
// compiler reliably picks them up.
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, Check, Scale, FileText,
  Clock, MessageCircle, Download, Sparkles, ShieldCheck,
} from 'lucide-react';
import articlesManifest from '../content/articles/manifest.json';

// ─── Static product data ─────────────────────────────────────────────────────

const SITE_URL = 'https://discover.legal';
const OG_IMAGE = `${SITE_URL}/app-icon-1024.png`;

// Server-side pricing in routes/payment.js — keep this list in sync.
const PRICING_TIERS = [
  {
    id: 'single',
    name: 'Single Document',
    priceUsd: 79,
    cadenceLabel: 'one-time',
    bestFor: 'Affidavits, name changes, declarations, single-document filings.',
    perks: [
      'AI-guided intake — under 10 minutes',
      'State-specific formatting and language',
      'Notary block and verification page included',
      'Download a court-ready PDF',
      'Preview the full document before paying',
    ],
    cta: 'Start a single document',
    popular: false,
  },
  {
    id: 'divorce',
    name: 'Divorce Package',
    priceUsd: 249,
    cadenceLabel: 'one-time',
    bestFor: 'Full uncontested divorce — petition, decree, and required forms.',
    perks: [
      'Petition + final decree generated together',
      'Custody, support, and property worksheets',
      'Service-of-process and disclosure forms',
      'State filing-fee guidance and waiver template',
      'Re-edit anytime before you file',
    ],
    cta: 'Start a divorce package',
    popular: true,
  },
  {
    id: 'all-access',
    name: 'All-State Access',
    priceUsd: 199.99,
    cadenceLabel: 'one-time',
    bestFor: 'Ongoing matters: custody changes, support modifications, follow-up filings.',
    perks: [
      'Unlimited document drafts across matters',
      'All matter types (16+) included',
      'Re-use and update prior filings',
      'Priority chat throughput',
      'Best value if you have more than two filings',
    ],
    cta: 'Get all-state access',
    popular: false,
  },
];

const MATTER_TYPES = [
  { code: 'divorce',           label: 'Divorce',                 icon: '⚖️' },
  { code: 'custody',           label: 'Child Custody',           icon: '👨‍👩‍👧' },
  { code: 'child_support',     label: 'Child Support',           icon: '💰' },
  { code: 'paternity',         label: 'Paternity',               icon: '🧬' },
  { code: 'dvro',              label: 'Restraining Orders',      icon: '🛡️' },
  { code: 'civil_harassment',  label: 'Civil Harassment',        icon: '🚫' },
  { code: 'legal_separation',  label: 'Legal Separation',        icon: '📑' },
  { code: 'annulment',         label: 'Annulment',               icon: '💔' },
  { code: 'adoption',          label: 'Adoption',                icon: '👶' },
  { code: 'guardianship',      label: 'Guardianship',            icon: '🤝' },
  { code: 'emancipation',      label: 'Emancipation',            icon: '🗽' },
  { code: 'small_claims',      label: 'Small Claims',            icon: '⚖️' },
  { code: 'name_change',       label: 'Name Change',             icon: '✍️' },
  { code: 'debt_defense',      label: 'Debt Defense',            icon: '📉' },
  { code: 'landlord_tenant',   label: 'Landlord–Tenant',         icon: '🏠' },
  { code: 'probate',           label: 'Probate',                 icon: '📜' },
];

const HOW_IT_WORKS = [
  {
    n: '01',
    title: 'Tell us what happened',
    body:
      'Chat with the AI in plain language. It asks the questions a court needs and figures out which forms apply.',
    icon: MessageCircle,
  },
  {
    n: '02',
    title: 'Review every page',
    body:
      'See the full document — facts, statute citations, signatures, notary block — before you pay. Edit anything that looks off.',
    icon: FileText,
  },
  {
    n: '03',
    title: 'Download and file',
    body:
      'Pay once. Download a court-ready PDF. Take it to the clerk, e-file, or mail it. We tell you exactly where it goes.',
    icon: Download,
  },
];

// FAQ data drives both the rendered accordion and the FAQPage JSON-LD —
// they can never drift apart.
const FAQS = [
  {
    q: 'Are the documents you generate court-ready?',
    a:
      'Yes. Every template is structured to the formatting and language requirements of the jurisdiction you select — case caption, verification page, signature block, notary acknowledgement. Courts accept these for filing. You always preview the full document before paying.',
  },
  {
    q: 'Is this legal advice?',
    a:
      'No. discover.legal is a self-help document preparation platform, not a law firm. We provide jurisdiction-specific templates and AI-guided intake; we do not represent you in court or give legal advice about your specific situation. If you have questions about strategy, settlement, or contested issues, talk to a licensed attorney.',
  },
  {
    q: 'How is this different from filling out free court forms?',
    a:
      'Most courts publish blank forms but no instructions for the unique parts: how to phrase facts so they are admissible, what to include in custody plans, how property division works in your state, what the notary needs. Our AI does that intake the way a paralegal would, then produces a complete document — not just the form skeleton.',
  },
  {
    q: 'What if my case is complicated or contested?',
    a:
      'For uncontested matters and straightforward filings, the platform handles it end-to-end. If your spouse will not agree, there are restraining orders, abuse claims, or significant assets in dispute, hire a lawyer — we will tell you when that line is crossed during intake.',
  },
  {
    q: 'Which states and provinces are supported?',
    a:
      'All 50 US states plus DC, and all 10 Canadian provinces and 3 territories. Some states (CA, AZ, FL, NV) require legal-document-preparer registration; you can browse and chat there, but paid document generation will be marked "coming soon" until registration is in place.',
  },
  {
    q: 'How much does it cost?',
    a:
      'Single documents are $79. The full Divorce Package (petition + decree + supporting forms) is $249. All-State Access is $199.99 — best if you have more than two filings to handle. Court filing fees are separate and paid to the court; we provide guidance and fee-waiver templates.',
  },
  {
    q: 'What if I make a mistake or need to change something?',
    a:
      'You can edit anything before paying. After paying, you can re-open the same document, make changes, and re-download — no extra charge for revisions to the same matter.',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

const LandingPage = ({ onGetStarted }) => {
  const { loginWithRedirect, isAuthenticated } = useAuth0();
  const [country, setCountry] = useState('US');

  // Detect country from subdomain. Default = US.
  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname.startsWith('ca.') || hostname.startsWith('canada.')) {
      setCountry('CA');
    } else {
      setCountry('US');
    }
  }, []);

  // Reset scroll on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const isCA = country === 'CA';

  // Static class branches so Tailwind JIT picks both up.
  const accentBg      = isCA ? 'bg-red-600'        : 'bg-blue-600';
  const accentBgHover = isCA ? 'hover:bg-red-700'  : 'hover:bg-blue-700';
  const accentText    = isCA ? 'text-red-600'      : 'text-blue-600';

  // Get-Started routes through Auth0 with screen_hint=signup so the user
  // lands on the signup form, not the sign-in form. Sign-in stays at the
  // default. Significantly reduces drop-off for first-time visitors.
  const handleGetStarted = () => {
    if (isAuthenticated) {
      onGetStarted();
    } else {
      loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } });
    }
  };
  const handleSignIn = () => {
    if (isAuthenticated) {
      onGetStarted();
    } else {
      loginWithRedirect();
    }
  };

  // Featured articles for the resources teaser. Pulled from the manifest
  // (small, ~73 KB) — never imports article bodies.
  const featuredGuides = useMemo(() => {
    const all = articlesManifest && Array.isArray(articlesManifest.articles)
      ? articlesManifest.articles
      : [];
    return all.filter(a => a.featured).slice(0, 4);
  }, []);

  // Real product breadth — sourced from manifest + product config.
  const guideCount = articlesManifest && articlesManifest.count ? articlesManifest.count : 81;
  const matterCount = MATTER_TYPES.length;
  const jurisdictionCount = isCA ? 13 : 51; // 13 CA provinces+territories, 51 US states+DC
  const jurisdictionLabel = isCA ? 'Canadian provinces & territories' : 'US states & DC';
  const jurisdictionWord = isCA ? 'province' : 'state';
  const exampleJurisdiction = isCA ? 'Ontario' : 'Texas';
  const exampleResidencyLine = isCA
    ? 'Ontario requires a 1-year separation for no-fault divorce.'
    : 'Texas requires 6 months residency in the state and 90 days in the county.';

  // ── SEO copy (country-aware) ─────────────────────────────────────────────
  const heroHeadlinePrefix = 'Court-ready legal';
  const heroHeadlineKeyword = 'documents';
  const heroHeadlineSuffix = isCA
    ? 'in every Canadian province.'
    : 'in every US state.';
  const heroSub = isCA
    ? "Divorce, custody, support, restraining orders and more. AI-guided intake. Province-specific formatting. Pay only when you're ready to file."
    : "Divorce, custody, support, restraining orders and more. AI-guided intake. State-specific formatting. Pay only when you're ready to file.";
  const pageTitle = isCA
    ? 'discover.legal — Divorce, Custody & Family Law Documents in Canada'
    : 'discover.legal — Divorce, Custody & Family Law Documents in All 50 States';
  const metaDescription = isCA
    ? 'Generate court-ready divorce, custody, support and family-law documents for any Canadian province. AI-guided intake. Province-specific formatting. Preview before you pay.'
    : 'Generate court-ready divorce, custody, support and family-law documents for any US state. AI-guided intake. State-specific formatting. Preview before you pay.';

  // ── JSON-LD structured data ──────────────────────────────────────────────
  // Four schemas: Organization (brand), WebSite (sitelinks searchbox),
  // Service (offers/pricing), FAQPage (FAQ rich results in SERPs).
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'discover.legal',
    url: SITE_URL,
    logo: OG_IMAGE,
    description:
      'Self-help legal document preparation for self-represented litigants across the United States and Canada.',
  };
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: SITE_URL,
    name: 'discover.legal',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/resources?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'discover.legal — AI-guided legal document preparation',
    serviceType: 'Self-help legal document preparation',
    provider: { '@type': 'Organization', name: 'discover.legal', url: SITE_URL },
    areaServed: ['United States', 'Canada'],
    description:
      'Court-ready divorce, custody, support, restraining-order and family-law documents generated through AI-guided intake. State- and province-specific formatting.',
    offers: PRICING_TIERS.map(tier => ({
      '@type': 'Offer',
      name: tier.name,
      price: tier.priceUsd,
      priceCurrency: 'USD',
      description: tier.bestFor,
      url: `${SITE_URL}/`,
      availability: 'https://schema.org/InStock',
    })),
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={`${SITE_URL}/`} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="discover.legal" />
        <meta property="og:url" content={`${SITE_URL}/`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:width" content="1024" />
        <meta property="og:image:height" content="1024" />
        <meta property="og:image:alt" content="discover.legal — AI-Powered Legal Documents" />
        <meta property="og:locale" content={isCA ? 'en_CA' : 'en_US'} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <meta name="twitter:image:alt" content="discover.legal — AI-Powered Legal Documents" />

        {/* Structured data */}
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(websiteSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      {/* ── Sticky nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <nav
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"
          aria-label="Primary"
        >
          <Link to="/" className="flex items-center gap-2">
            <Scale className={`h-6 w-6 ${accentText}`} aria-hidden="true" />
            <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">discover.legal</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <a href="#how-it-works" className="hidden md:inline text-sm text-slate-700 hover:text-slate-900">
              How it works
            </a>
            <a href="#pricing" className="hidden md:inline text-sm text-slate-700 hover:text-slate-900">
              Pricing
            </a>
            <Link to="/resources" className="hidden md:inline text-sm text-slate-700 hover:text-slate-900">
              Guides
            </Link>
            {!isAuthenticated && (
              <button
                onClick={handleSignIn}
                className="text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-2"
              >
                Sign in
              </button>
            )}
            <button
              onClick={handleGetStarted}
              className="text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-4 py-2 transition-colors"
            >
              Get started
            </button>
          </div>
        </nav>
      </header>

      <main>
        {/* ── Hero — two-column with chat-mockup card ──────────────────── */}
        <section className="relative overflow-hidden">
          {/* Background mesh + gradient blurs */}
          <div className="absolute inset-0 -z-10" aria-hidden="true">
            <div className="absolute -top-40 -left-20 w-[600px] h-[600px] bg-blue-100/60 rounded-full blur-3xl" />
            <div className="absolute -top-20 right-0 w-[500px] h-[500px] bg-purple-100/50 rounded-full blur-3xl" />
            <div className="absolute top-60 left-1/3 w-[400px] h-[400px] bg-amber-50 rounded-full blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 lg:pt-28 pb-16 sm:pb-20">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Headline column */}
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 shadow-sm mb-6">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                  <span className="text-xs font-medium text-slate-700">
                    {matterCount} matter types · {jurisdictionCount} {jurisdictionLabel} · {guideCount} free guides
                  </span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-slate-900 leading-[1.05] mb-6">
                  {heroHeadlinePrefix}{' '}
                  <span className="relative inline-block">
                    <span className="relative z-10">{heroHeadlineKeyword}</span>
                    <span className="absolute bottom-1 left-0 right-0 h-3 bg-amber-200/70 -z-0" aria-hidden="true" />
                  </span>
                  <br />
                  {heroHeadlineSuffix}
                </h1>

                <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mb-8 leading-relaxed">
                  {heroSub}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
                  <button
                    onClick={handleGetStarted}
                    className="group inline-flex items-center justify-center px-6 py-3.5 bg-slate-900 text-white text-base font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5"
                  >
                    Start your document
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </button>
                  <a
                    href="#pricing"
                    className="inline-flex items-center justify-center px-6 py-3.5 bg-white text-slate-900 text-base font-semibold rounded-xl border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                  >
                    See pricing
                  </a>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> No subscription
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Pay per document
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Save &amp; resume any time
                  </span>
                </div>
              </div>

              {/* Hero card mockup — shows the actual interview UX */}
              <div className="lg:col-span-5">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-br from-blue-200/40 to-purple-200/40 rounded-3xl blur-2xl" aria-hidden="true" />
                  <div className="relative bg-white rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                      <div className="flex gap-1.5" aria-hidden="true">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      </div>
                      <span className="text-xs text-slate-400 font-mono ml-2">interview — divorce package</span>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold" aria-hidden="true">
                          AI
                        </div>
                        <div className="flex-1 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2.5">
                          <p className="text-sm text-slate-700">
                            To start your divorce petition, what {jurisdictionWord} are you filing in?
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 justify-end">
                        <div className="bg-slate-900 rounded-2xl rounded-tr-sm px-4 py-2.5">
                          <p className="text-sm text-white">{exampleJurisdiction}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold" aria-hidden="true">
                          AI
                        </div>
                        <div className="flex-1 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2.5">
                          <p className="text-sm text-slate-700">
                            Got it. {exampleResidencyLine} Have you and your spouse met that?
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" aria-hidden="true" />
                        <span className="text-xs text-emerald-800 font-medium">Auto-saved · Petition draft updated</span>
                      </div>
                    </div>
                  </div>

                  {/* Floating accent card */}
                  <div className="hidden sm:block absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center" aria-hidden="true">
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">Avg. completion</p>
                        <p className="text-xs text-slate-500">~10 min · single document</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust strip ─────────────────────────────────────────────── */}
        <section aria-label="Key stats" className="border-y border-slate-200 bg-slate-50/60 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">{jurisdictionCount}</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{jurisdictionLabel} supported</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">{matterCount}+</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">matter types covered</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">$79+</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">per document, no subscription</p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">~10 min</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">average completion time</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Matter type grid ─────────────────────────────────────── */}
        <section aria-labelledby="matters-heading" className="py-20 sm:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className={`text-sm font-semibold ${accentText} uppercase tracking-wider mb-3`}>What we make</p>
              <h2 id="matters-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
                Every common family- &amp; civil-law matter
              </h2>
              <p className="text-lg text-slate-600">
                If your matter is here, your documents can be drafted here.
              </p>
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {MATTER_TYPES.map(m => (
                <li
                  key={m.code}
                  className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                >
                  <span className="text-2xl" aria-hidden="true">{m.icon}</span>
                  <span className="font-medium text-slate-800">{m.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────── */}
        <section id="how-it-works" aria-labelledby="how-heading" className="bg-slate-50 py-20 sm:py-24 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className={`text-sm font-semibold ${accentText} uppercase tracking-wider mb-3`}>How it works</p>
              <h2 id="how-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
                Three steps. No legal jargon.
              </h2>
              <p className="text-lg text-slate-600">
                Average completion time: about 10 minutes.
              </p>
            </div>
            <ol className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {HOW_IT_WORKS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.n}
                    className="relative bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg hover:shadow-slate-900/5 transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <span className="font-mono text-sm font-bold text-slate-400">{step.n}</span>
                      {i < HOW_IT_WORKS.length - 1 && (
                        <ArrowRight className="hidden md:block h-4 w-4 text-slate-300 absolute -right-5 top-12 z-10" aria-hidden="true" />
                      )}
                    </div>
                    <Icon className={`h-8 w-8 ${accentText} mb-4`} aria-hidden="true" />
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{step.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ── Comparison table ─────────────────────────────────────── */}
        <section aria-labelledby="compare-heading" className="py-20 sm:py-24 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className={`text-sm font-semibold ${accentText} uppercase tracking-wider mb-3`}>Why discover.legal</p>
              <h2 id="compare-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
                The math behind doing this yourself
              </h2>
              <p className="text-lg text-slate-600">
                Lawyer fees stack up fast. Free court forms leave too many gaps.
              </p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="p-4 text-sm font-semibold text-slate-700">&nbsp;</th>
                    <th scope="col" className="p-4 text-sm font-semibold text-slate-700">DIY court forms</th>
                    <th scope="col" className="p-4 text-sm font-semibold text-slate-700">Hire a lawyer</th>
                    <th scope="col" className="p-4 text-sm font-semibold text-white bg-slate-900 rounded-tr-2xl">
                      discover.legal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {[
                    {
                      row: 'Typical cost',
                      diy: 'Free forms + $200–$450 filing fee',
                      lawyer: '$1,500–$5,000+ for uncontested',
                      us: '$79–$249 + filing fee',
                    },
                    {
                      row: 'Time to ready',
                      diy: 'Days of research and form-hunting',
                      lawyer: 'Weeks waiting for a draft',
                      us: 'About 10 minutes of guided intake',
                    },
                    {
                      row: 'State-specific compliance',
                      diy: 'You verify it yourself',
                      lawyer: 'Yes, billed by the hour',
                      us: 'Built into every template',
                    },
                    {
                      row: 'Edits and re-files',
                      diy: 'Start the form over',
                      lawyer: 'Hourly rate per revision',
                      us: 'Free re-edits on the same matter',
                    },
                    {
                      row: 'You stay in control',
                      diy: 'Yes',
                      lawyer: 'Often handed off to a paralegal',
                      us: 'Yes — review every word',
                    },
                  ].map((r, i) => (
                    <tr key={i}>
                      <th scope="row" className="p-4 text-sm font-medium text-slate-900 align-top">{r.row}</th>
                      <td className="p-4 text-sm text-slate-700 align-top">{r.diy}</td>
                      <td className="p-4 text-sm text-slate-700 align-top">{r.lawyer}</td>
                      <td className={`p-4 text-sm align-top font-medium ${accentText}`}>{r.us}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────── */}
        <section id="pricing" aria-labelledby="pricing-heading" className="bg-slate-50 py-20 sm:py-24 border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className={`text-sm font-semibold ${accentText} uppercase tracking-wider mb-3`}>Pricing</p>
              <h2 id="pricing-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
                Pay once. Take it to court.
              </h2>
              <p className="text-lg text-slate-600">
                Server-side pricing. No hidden fees. Filing fees go to the court, not us.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {PRICING_TIERS.map(tier => (
                <article
                  key={tier.id}
                  className={`relative rounded-2xl p-7 lg:p-8 transition-all hover:-translate-y-1 flex flex-col ${
                    tier.popular
                      ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20'
                      : 'bg-white border border-slate-200 hover:shadow-xl hover:shadow-slate-900/5'
                  }`}
                >
                  {tier.popular && (
                    <span className="absolute -top-3 left-8 px-3 py-1 bg-amber-400 text-slate-900 text-xs font-bold rounded-full">
                      Most popular
                    </span>
                  )}

                  <h3 className={`text-2xl font-bold ${tier.popular ? 'text-white' : 'text-slate-900'}`}>
                    {tier.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className={`text-4xl font-extrabold ${tier.popular ? 'text-white' : 'text-slate-900'}`}>${tier.priceUsd}</span>
                    <span className={`text-sm ${tier.popular ? 'text-slate-400' : 'text-slate-500'}`}>{tier.cadenceLabel}</span>
                  </div>
                  <p className={`mt-3 text-sm ${tier.popular ? 'text-slate-300' : 'text-slate-600'}`}>{tier.bestFor}</p>

                  <ul className="mt-6 space-y-2.5 flex-1">
                    {tier.perks.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check
                          className={`h-4 w-4 flex-shrink-0 mt-0.5 ${tier.popular ? 'text-emerald-400' : 'text-emerald-600'}`}
                          aria-hidden="true"
                        />
                        <span className={tier.popular ? 'text-slate-200' : 'text-slate-700'}>{p}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={handleGetStarted}
                    className={`mt-7 w-full inline-flex items-center justify-center font-semibold rounded-xl py-3 transition-colors ${
                      tier.popular
                        ? 'bg-white text-slate-900 hover:bg-slate-100'
                        : `${accentBg} ${accentBgHover} text-white`
                    }`}
                  >
                    {tier.cta}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ (accordion + JSON-LD FAQPage above) ─────────────── */}
        <section id="faq" aria-labelledby="faq-heading" className="py-20 sm:py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className={`text-sm font-semibold ${accentText} uppercase tracking-wider mb-3`}>FAQ</p>
              <h2 id="faq-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
                Common questions.
              </h2>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {FAQS.map((f, i) => (
                <details key={i} className="group py-5">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="font-semibold text-slate-900 text-base sm:text-lg pr-4">{f.q}</h3>
                    <span className="flex-shrink-0 ml-4 w-6 h-6 rounded-full bg-slate-100 group-open:bg-slate-900 group-open:text-white flex items-center justify-center transition-colors">
                      <ArrowRight className="h-3 w-3 transition-transform group-open:rotate-90" aria-hidden="true" />
                    </span>
                  </summary>
                  <p className="mt-3 text-slate-600 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Recent guides (resources teaser) ────────────────────── */}
        {featuredGuides.length > 0 && (
          <section aria-labelledby="guides-heading" className="bg-slate-50 py-20 sm:py-24 border-y border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
                <div>
                  <p className={`text-sm font-semibold ${accentText} uppercase tracking-wider mb-3`}>Resources</p>
                  <h2 id="guides-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
                    Read up before you file
                  </h2>
                  <p className="mt-3 text-lg text-slate-600">
                    {guideCount} free guides on divorce, custody, support, and self-representation.
                  </p>
                </div>
                <Link to="/resources" className={`inline-flex items-center font-semibold ${accentText} hover:underline`}>
                  Browse all guides
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {featuredGuides.map(g => (
                  <Link
                    key={g.slug}
                    to={`/resources/${g.slug}`}
                    className="block bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5 transition-all"
                  >
                    <div className="text-3xl mb-3" aria-hidden="true">{g.image || '📘'}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{g.category}</div>
                    <h3 className="mt-2 font-semibold text-slate-900 leading-snug">{g.title}</h3>
                    <p className="mt-2 text-sm text-slate-600 line-clamp-3">{g.description}</p>
                    <div className="mt-3 text-xs text-slate-500">{g.readTime}</div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Final CTA ───────────────────────────────────────────── */}
        <section aria-labelledby="final-cta-heading" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700" aria-hidden="true" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <h2 id="final-cta-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
              Your filing doesn't have to wait for someone to call you back.
            </h2>
            <p className="mt-4 text-lg text-white/90 max-w-2xl mx-auto">
              Start the intake. Preview the document. Pay only when you're ready to file.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleGetStarted}
                className="group inline-flex items-center justify-center px-7 py-3.5 bg-white text-slate-900 text-base font-semibold rounded-xl shadow hover:shadow-md hover:bg-slate-50 transition-all"
              >
                Start your document
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </button>
              <Link
                to="/resources"
                className="inline-flex items-center justify-center px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white text-base font-semibold rounded-xl border border-white/30 backdrop-blur transition-colors"
              >
                Read the guides first
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-white" aria-hidden="true" />
                <span className="text-base font-bold tracking-tight text-white">discover.legal</span>
              </div>
              <p className="mt-3 text-slate-400">
                AI-guided legal documents for self-represented litigants in the US and Canada.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Product</h3>
              <ul className="space-y-2">
                <li><a href="#how-it-works" className="hover:text-white">How it works</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><a href="#faq" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Resources</h3>
              <ul className="space-y-2">
                <li><Link to="/resources" className="hover:text-white">All guides</Link></li>
                <li><Link to="/brand" className="hover:text-white">Brand &amp; press</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Legal</h3>
              <ul className="space-y-2">
                <li><Link to="/tos" className="hover:text-white">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-slate-800 text-xs text-slate-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <span>© {new Date().getFullYear()} discover.legal. All rights reserved.</span>
            <span>
              discover.legal is not a law firm and does not provide legal advice. Documents we generate are self-help templates; for advice about your specific legal matter, consult a licensed attorney.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
