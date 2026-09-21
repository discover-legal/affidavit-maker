// Consultancy home. Every section is a server component rendering from
// ./content.ts; the only client island is ConsultancyNav (auth-aware sign-in).

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import ConsultancyNav from './ConsultancyNav';
import ConsultancyFooter from './ConsultancyFooter';
import BookingCta, { BookingNote } from './BookingCta';
import { CONSULTANCY_FAQS, FREE_SOLUTIONS, PRINCIPLES, RESEARCH, SERVICES } from './content';

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-20 w-[600px] h-[600px] bg-brand-soft/60 rounded-full blur-3xl" />
        <div className="absolute -top-20 right-0 w-[500px] h-[500px] bg-purple-100/50 rounded-full blur-3xl" />
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
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-4">
            Legal technology consultancy
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-slate-900 leading-[1.05] mb-6">
            From{' '}
            <span className="relative inline-block">
              <span className="relative z-10">buy</span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-amber-200/70 -z-0" />
            </span>{' '}
            to build to run.
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mb-8 leading-relaxed">
            We help law firms and legal teams choose the right technology, build what the market
            does not sell, and run it on infrastructure they control. Two of our own solutions
            are free for anyone to use.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-3">
            <BookingCta variant="hero" />
            <Link
              href="/services"
              className="inline-flex items-center justify-center px-6 py-3.5 bg-white text-slate-900 text-base font-semibold rounded-xl border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              See the services
            </Link>
          </div>
          <BookingNote />
        </div>
      </div>
    </section>
  );
}

function ServicesSection() {
  return (
    <section id="services" className="py-20 sm:py-24 bg-slate-50 border-y border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
            What we do
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Four ways to work with us.
          </h2>
          <p className="text-lg text-slate-600">
            Pick one, or move through them as the firm&rsquo;s needs change: select a tool, build
            the gap, have it run for you, keep a technical lead on call.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.key}
                href={`/services#${s.key}`}
                className="group rounded-2xl bg-white border border-slate-200 p-8 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${s.iconBg}`}>
                  <Icon className={`h-6 w-6 ${s.iconColor}`} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {s.name}
                </p>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{s.headline}</h3>
                <p className="text-base text-slate-600 mb-6">{s.body}</p>
                <ul className="space-y-2 mb-6">
                  {s.deliverables.slice(0, 3).map((d) => (
                    <li key={d} className="flex items-start gap-3 text-sm text-slate-700">
                      <Check className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                      {d}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center text-sm font-semibold text-slate-900">
                  Details
                  <ArrowRight className="ml-1.5 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FreeSolutionsSection() {
  return (
    <section id="free" className="py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
            Free solutions
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Two things we built and give away.
          </h2>
          <p className="text-lg text-slate-600">
            They are how we work in public: the same verification-first approach we bring to
            client engagements, running for real people and real firms today.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {FREE_SOLUTIONS.map((f, i) => {
            const Icon = f.icon;
            const dark = i === 1;
            return (
              <div
                key={f.key}
                className={`rounded-2xl p-8 transition-all hover:-translate-y-1 ${
                  dark
                    ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20'
                    : 'bg-white border border-slate-200 hover:shadow-xl hover:shadow-slate-900/5'
                }`}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dark ? 'bg-white/10' : f.iconBg}`}>
                    <Icon className={`h-6 w-6 ${dark ? 'text-white' : f.iconColor}`} />
                  </div>
                  <p className={`text-xs font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{f.status}</p>
                </div>
                <h3 className={`text-2xl font-bold mb-2 ${dark ? 'text-white' : 'text-slate-900'}`}>{f.name}</h3>
                <p className={`text-base mb-6 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{f.tagline}</p>
                <ul className="space-y-3 mb-8">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-start gap-3">
                      <Check className={`h-5 w-5 flex-shrink-0 mt-0.5 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <span className={`text-sm ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{p}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={f.href}
                  className={`w-full inline-flex items-center justify-center px-5 py-3 rounded-lg font-semibold text-sm transition-all ${
                    dark ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {f.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PrinciplesSection() {
  return (
    <section id="approach" className="py-20 sm:py-24 bg-slate-50 border-y border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
            How we work
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
            The same rules for what we build and what we recommend.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRINCIPLES.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-2xl bg-white border border-slate-200 p-6">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${p.iconBg}`}>
                  <Icon className={`h-5 w-5 ${p.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{p.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ResearchSection() {
  return (
    <section id="research" className="py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5">
          <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">Research</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Questions we are testing in public.
          </h2>
          <p className="text-lg text-slate-600 mb-6">
            Open experiments on how language models behave on legal tasks. Code, data pipeline
            and results are published as they exist, with their status stated plainly.
          </p>
          <Link href="/research" className="inline-flex items-center text-sm font-semibold text-slate-900">
            All research
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
        <div className="lg:col-span-7 space-y-6">
          {RESEARCH.map((r) => (
            <Link
              key={r.key}
              href={`/research#${r.key}`}
              className="group block rounded-2xl bg-white border border-slate-200 p-8 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 transition-all"
            >
              <p className="text-xs font-semibold text-slate-500 mb-3">{r.status}</p>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">{r.title}</h3>
              <p className="text-base text-slate-600 mb-4">{r.question}</p>
              <span className="inline-flex items-center text-sm font-semibold text-slate-900">
                Read the design
                <ArrowRight className="ml-1.5 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="py-20 sm:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-10">
          Questions firms ask first.
        </h2>
        <dl className="divide-y divide-slate-200">
          {CONSULTANCY_FAQS.map((f) => (
            <div key={f.q} className="py-6">
              <dt className="text-lg font-semibold text-slate-900 mb-2">{f.q}</dt>
              <dd className="text-base text-slate-600 leading-relaxed">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand-strong to-purple-700" />
      <div className="relative max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
          Bring us the problem.
        </h2>
        <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
          A vendor decision, a workflow nobody sells, a platform that needs running, or a
          roadmap that needs an owner. We come back with a scoped proposal.
        </p>
        <BookingCta variant="closing" />
      </div>
    </section>
  );
}

export default function ConsultancyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <ConsultancyNav />
      <Hero />
      <ServicesSection />
      <FreeSolutionsSection />
      <PrinciplesSection />
      <ResearchSection />
      <FaqSection />
      <ClosingCta />
      <ConsultancyFooter />
    </div>
  );
}
