'use client';

import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import {
  ArrowRight,
  Check,
  FileText,
  Scale,
  Heart,
  Sparkles,
  ShieldCheck,
  Clock,
  MapPin,
  Lock,
} from 'lucide-react';
import type { Locale } from '@/lib/locale';
import {
  formatPrice,
  formatOriginalPrice,
  getDiscountPercentLabel,
  LAUNCH_PRICING_ACTIVE,
  LAUNCH_LABEL,
} from '@/lib/pricing';
import { LocaleToggle } from '@/components/LocaleToggle';

export default function LandingPage({ locale }: { locale: Locale }) {
  const { user } = useUser();
  const isAuthenticated = Boolean(user);
  const isCA = locale === 'ca';

  const jurisdictionWord = isCA ? 'province' : 'state';
  const jurisdictionWordPlural = isCA ? 'provinces' : 'states';
  const coverageHeadline = isCA
    ? 'Every Canadian province & territory'
    : 'All 50 states + D.C.';
  const coverageCount = isCA ? '13' : '51';

  const divorcePrice = formatPrice(locale, 'divorce_package');
  const affidavitPrice = formatPrice(locale, 'single_affidavit');
  const divorcePriceOriginal = formatOriginalPrice(locale, 'divorce_package');
  const affidavitPriceOriginal = formatOriginalPrice(locale, 'single_affidavit');
  const discountLabel = getDiscountPercentLabel();

  const products = [
    {
      key: 'divorce',
      name: 'Divorce Package',
      tagline: 'Petition, decree, and every supporting form.',
      price: divorcePrice,
      originalPrice: divorcePriceOriginal,
      icon: Scale,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      featured: true,
      features: [
        'Full guided divorce interview',
        'Petition + Decree generated together',
        'Children, property, support modules',
        'Service of process & filing checklist',
        `Tailored to your ${jurisdictionWord}'s waiting periods & grounds`,
      ],
      cta: 'Start a divorce package',
    },
    {
      key: 'affidavit',
      name: 'General Affidavit',
      tagline: 'A sworn statement, court-ready.',
      price: affidavitPrice,
      originalPrice: affidavitPriceOriginal,
      icon: FileText,
      iconBg: 'bg-brand-tint',
      iconColor: 'text-brand',
      features: [
        'AI-guided fact interview',
        `${jurisdictionWord.charAt(0).toUpperCase() + jurisdictionWord.slice(1)}-specific formatting`,
        isCA ? 'Commissioner of Oaths / Notary jurat' : 'Notary block & jurat included',
        'Evidence/exhibit uploads',
        'Professional PDF output',
      ],
      cta: 'Start an affidavit',
    },
  ] as const;

  const steps = [
    {
      n: '01',
      title: 'Tell us about your matter',
      body: `Pick your ${jurisdictionWord} and the document you need. We'll route you through the right interview.`,
    },
    {
      n: '02',
      title: 'Chat through the facts',
      body: isCA
        ? 'Our AI interviewer asks the questions a Canadian paralegal would. Answer in plain English — no legalese required.'
        : 'Our AI interviewer asks the questions a paralegal would. Answer in plain English — no legalese required.',
    },
    {
      n: '03',
      title: 'Download a court-ready PDF',
      body: 'Properly formatted, jurisdiction-compliant, and signed off with the right captions, citations, and notary blocks.',
    },
  ];

  const faqs = [
    {
      q: 'Is this a substitute for a lawyer?',
      a: isCA
        ? "No. discover.legal is a self-help document preparation tool. We don't provide legal advice and aren't a law firm. For contested or complex matters, consult a lawyer licensed in your province."
        : "No. discover.legal is a self-help document preparation tool. We don't provide legal advice or represent you. For complex matters or contested disputes, consult a licensed attorney.",
    },
    {
      q: `Which ${jurisdictionWordPlural} are supported?`,
      a: isCA
        ? 'All 10 Canadian provinces plus the Northwest Territories, Yukon, and Nunavut. Divorce filings follow the federal Divorce Act and your province\'s family-court rules.'
        : 'All 50 U.S. states plus the District of Columbia. Each comes with its own template, statute references, and required forms.',
    },
    {
      q: 'How long does it take?',
      a: 'Most affidavits take 10–20 minutes. A full divorce package usually takes 45–90 minutes depending on complexity (children, property, support).',
    },
    {
      q: 'Can I save and come back later?',
      a: 'Yes. Every interview auto-saves. Pick up exactly where you left off from your dashboard.',
    },
    {
      q: 'Do I still need to file with the court myself?',
      a: isCA
        ? 'Yes. We prepare the documents and a filing checklist. You file with the appropriate court (Superior Court of Justice in Ontario, Cour supérieure in Quebec, etc.) by the method your court accepts.'
        : 'Yes. We prepare the documents and a filing checklist. You file with the court (in person, by mail, or e-filing depending on your county).',
    },
  ];

  const startDocumentHref = isAuthenticated ? '/dashboard' : '/api/auth/login?screen_hint=signup';
  const signInHref = isAuthenticated ? '/dashboard' : '/api/auth/login';

  const jurisdictionCodes = isCA
    ? ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'NT', 'YT', 'NU']
    : [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
        'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
        'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
        'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
        'WI', 'WY', 'DC',
      ];

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-strong rounded-lg blur-sm opacity-40" />
                <div className="relative bg-gradient-to-br from-slate-900 to-slate-700 rounded-lg p-1.5">
                  <Scale className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="text-left">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                  discover<span className="text-brand">.</span>legal
                </h1>
              </div>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              <a
                href="#products"
                className="hidden md:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
              >
                Products
              </a>
              <a
                href="#how-it-works"
                className="hidden md:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
              >
                How it works
              </a>
              <Link
                href="/resources"
                className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
              >
                Resources
              </Link>
              <LocaleToggle active={locale} />
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="bg-slate-900 text-white px-4 sm:px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-semibold"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  {/*
                    Plain <a> rather than next/link: when the user is logged
                    out these point at /api/auth/login (the Auth0 SDK route
                    handler), which returns a 302 to Auth0. Next.js Link's
                    client-side routing layer was observed (2026-05-19) to
                    turn that redirect response into a download in the
                    browser instead of following it. A normal anchor sends
                    the user via plain browser navigation and the redirect
                    works as expected.
                  */}
                  <a
                    href={signInHref}
                    className="hidden sm:inline text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-2"
                  >
                    Sign in
                  </a>
                  <a
                    href={startDocumentHref}
                    className="bg-slate-900 text-white px-4 sm:px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-semibold"
                  >
                    Get started
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -left-20 w-[600px] h-[600px] bg-brand-soft/60 rounded-full blur-3xl" />
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
            <div className="lg:col-span-7">
              {LAUNCH_PRICING_ACTIVE && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 shadow-sm mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    {LAUNCH_LABEL}
                  </span>
                </div>
              )}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 shadow-sm mb-6 ml-0 sm:ml-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium text-slate-700">
                  AI-powered &middot; {coverageCount} {jurisdictionWordPlural} supported
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-slate-900 leading-[1.05] mb-6">
                Court-ready legal{' '}
                <span className="relative inline-block">
                  <span className="relative z-10">documents</span>
                  <span className="absolute bottom-1 left-0 right-0 h-3 bg-amber-200/70 -z-0" />
                </span>
                <br />
                in minutes, not weeks.
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mb-8 leading-relaxed">
                Complete divorce packages and court-ready affidavits, prepared by an AI interviewer
                trained on your {jurisdictionWord}&rsquo;s rules. Plain-English questions,
                properly-formatted output, a fraction of the cost of a paralegal.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
                <a
                  href={startDocumentHref}
                  className="group inline-flex items-center justify-center px-6 py-3.5 bg-slate-900 text-white text-base font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5"
                >
                  Start your document
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
                <a
                  href="#products"
                  className="inline-flex items-center justify-center px-6 py-3.5 bg-white text-slate-900 text-base font-semibold rounded-xl border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                >
                  See pricing
                </a>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" /> No subscription
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" /> Pay per document
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" /> Save &amp; resume any time
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-brand-soft/40 to-purple-200/40 rounded-3xl blur-2xl" />
                <div className="relative bg-white rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-xs text-slate-400 font-mono ml-2">
                      interview &mdash; divorce package
                    </span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand-strong flex items-center justify-center text-white text-xs font-bold">
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
                        <p className="text-sm text-white">{isCA ? 'Ontario' : 'Texas'}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand-strong flex items-center justify-center text-white text-xs font-bold">
                        AI
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2.5">
                        <p className="text-sm text-slate-700">
                          Got it.{' '}
                          {isCA
                            ? 'The federal Divorce Act requires a 1-year separation for no-fault divorce.'
                            : 'Texas requires 6 months residency in the state and 90 days in the county.'}{' '}
                          Have you and your spouse met that?
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-xs text-emerald-800 font-medium">
                        Auto-saved &middot; Petition draft updated
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:block absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Petition + decree</p>
                      <p className="text-xs text-slate-500">Generated together</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">{coverageCount}</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{coverageHeadline}</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">{affidavitPrice}+</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Per document, no subscription</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">10&ndash;90 min</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Affidavit to full divorce</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">24/7</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Save, resume, file on your time</p>
            </div>
          </div>
        </div>
      </section>

      <section id="products" className="py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
              What we make
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
              Two documents. Done right.
            </h2>
            <p className="text-lg text-slate-600">
              We focus on the filings people actually need most often. Each one is interviewed
              end-to-end by our AI and formatted for your {jurisdictionWord}&rsquo;s court.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {products.map((product) => {
              const Icon = product.icon;
              const featured = 'featured' in product && product.featured;
              return (
                <div
                  key={product.key}
                  className={`relative rounded-2xl p-8 lg:p-10 transition-all hover:-translate-y-1 ${
                    featured
                      ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20'
                      : 'bg-white border border-slate-200 hover:shadow-xl hover:shadow-slate-900/5'
                  }`}
                >
                  {featured && (
                    <div className="absolute -top-3 left-8 px-3 py-1 bg-amber-400 text-slate-900 text-xs font-bold rounded-full">
                      Most popular
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-6">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        featured ? 'bg-white/10' : product.iconBg
                      }`}
                    >
                      <Icon className={`h-6 w-6 ${featured ? 'text-white' : product.iconColor}`} />
                    </div>
                    <div className="text-right">
                      {LAUNCH_PRICING_ACTIVE && (
                        <p
                          className={`text-sm font-medium line-through ${
                            featured ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          {product.originalPrice}
                        </p>
                      )}
                      <p
                        className={`text-3xl font-bold ${featured ? 'text-white' : 'text-slate-900'}`}
                      >
                        {product.price}
                      </p>
                      {LAUNCH_PRICING_ACTIVE ? (
                        <p className="text-xs font-bold text-amber-500 mt-0.5">
                          {discountLabel}
                        </p>
                      ) : (
                        <p className={`text-xs ${featured ? 'text-slate-400' : 'text-slate-500'}`}>
                          Flat fee
                        </p>
                      )}
                    </div>
                  </div>

                  <h3
                    className={`text-2xl font-bold mb-1 ${featured ? 'text-white' : 'text-slate-900'}`}
                  >
                    {product.name}
                  </h3>
                  <p className={`text-base mb-6 ${featured ? 'text-slate-300' : 'text-slate-600'}`}>
                    {product.tagline}
                  </p>

                  <ul className="space-y-3 mb-8">
                    {product.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <Check
                          className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                            featured ? 'text-emerald-400' : 'text-emerald-600'
                          }`}
                        />
                        <span
                          className={`text-sm ${featured ? 'text-slate-200' : 'text-slate-700'}`}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={startDocumentHref}
                    className={`w-full inline-flex items-center justify-center px-5 py-3 rounded-lg font-semibold text-sm transition-all ${
                      featured
                        ? 'bg-white text-slate-900 hover:bg-slate-100'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {product.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-sm text-slate-500 text-center">
            More matter types &mdash; custody, support, name change, small claims &mdash; coming soon.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="bg-slate-50 py-20 sm:py-24 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
              Three steps. No legal jargon.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {steps.map((step, i) => (
              <div
                key={step.n}
                className="relative bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg hover:shadow-slate-900/5 transition-shadow"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-sm font-bold text-slate-400">{step.n}</span>
                  {i < steps.length - 1 && (
                    <ArrowRight className="hidden md:block h-4 w-4 text-slate-300 absolute -right-5 top-12 z-10" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
                Built for your jurisdiction
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-6">
                {coverageHeadline}.<br />
                <span className="text-slate-500">One template per court.</span>
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                Filing fees, residency rules, statute citations, even the wording of the jurat
                &mdash; we maintain a separate template for every {jurisdictionWord}, audited against
                the real court rules{isCA ? ' and the federal Divorce Act' : ''}.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-tint flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-4 w-4 text-brand" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">
                      {jurisdictionWord.charAt(0).toUpperCase() + jurisdictionWord.slice(1)}-aware
                    </p>
                    <p className="text-xs text-slate-500">Right captions, fees, deadlines.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Court-format PDFs</p>
                    <p className="text-xs text-slate-500">Margins, fonts, line numbers.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Lock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Private by default</p>
                    <p className="text-xs text-slate-500">Your draft stays your draft.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Heart className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">No surprises</p>
                    <p className="text-xs text-slate-500">Flat fees, no subscription.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-2xl p-8 lg:p-10 text-white shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-mono text-slate-400">JURISDICTIONS.JSON</span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-mono rounded">
                    LIVE
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 font-mono text-xs">
                  {jurisdictionCodes.map((code) => (
                    <div
                      key={code}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded px-2 py-1.5 text-center transition-colors"
                    >
                      {code}
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-sm">
                  <span className="text-slate-400">Total templates</span>
                  <span className="font-semibold">{coverageCount} maintained</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
              Common questions.
            </h2>
          </div>

          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-5">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <h3 className="font-semibold text-slate-900 text-base sm:text-lg pr-4">{faq.q}</h3>
                  <span className="flex-shrink-0 ml-4 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center group-open:bg-slate-900 group-open:text-white transition-colors">
                    <span className="block w-3 h-px bg-current" />
                    <span className="block w-px h-3 bg-current absolute group-open:hidden" />
                  </span>
                </summary>
                <p className="mt-3 text-slate-600 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand-strong to-purple-700" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
            Ready to start?
          </h2>
          <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Pick your document, answer the questions, download a court-ready PDF. From {affidavitPrice}.
          </p>
          <a
            href={startDocumentHref}
            className="inline-flex items-center px-8 py-4 bg-white text-slate-900 text-base font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
          >
            Start your document
            <ArrowRight className="ml-2 h-5 w-5" />
          </a>
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-3">
                <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg p-1.5">
                  <Scale className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">
                  discover<span className="text-brand">.</span>legal
                </span>
              </div>
              <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                AI-assisted legal document preparation for everyday people. Not a law firm; not a
                substitute for legal advice.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                Products
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#products" className="hover:text-white transition-colors">
                    Divorce Package
                  </a>
                </li>
                <li>
                  <a href="#products" className="hover:text-white transition-colors">
                    General Affidavit
                  </a>
                </li>
                <li>
                  <Link href="/resources" className="hover:text-white transition-colors">
                    Resources
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                Legal
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/tos" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} discover.legal. All rights reserved.
            </p>
            <p className="text-xs text-slate-500 max-w-md text-center sm:text-right">
              We are not a law firm and do not provide legal advice. Use of this site does not create
              an attorney-client relationship.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
