import { Check, FileStack, Heart, ShieldCheck, Sparkles } from 'lucide-react';
import StartCta from './StartCta';
import { COVERAGE_COUNT } from './content';

export default function Hero() {
  return (
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 shadow-sm mb-3">
              <Heart className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Free for everyone
              </span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 shadow-sm mb-6 ml-0 sm:ml-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium text-slate-700">
                AI-powered &middot; English &amp; Espa&ntilde;ol &middot; {COVERAGE_COUNT} jurisdictions
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-slate-900 leading-[1.05] mb-6">
              Tell your{' '}
              <span className="relative inline-block">
                <span className="relative z-10">story</span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-amber-200/70 -z-0" />
              </span>{' '}
              once.
              <br />
              We get your paperwork organized.
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mb-8 leading-relaxed">
              A guided interview turns your words into organized divorce petition, decree, and
              affidavit drafts — plus plain-language help with serving, responding, and your day
              in court. Walk in prepared. Completely free to use.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
              <StartCta variant="hero">Start your document</StartCta>
              <a
                href="#documents"
                className="inline-flex items-center justify-center px-6 py-3.5 bg-white text-slate-900 text-base font-semibold rounded-xl border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors"
              >
                See what you get
              </a>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> Free &mdash; no subscription
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> No card required
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
                        To start your divorce petition, what state are you filing in?
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-slate-900 rounded-2xl rounded-tr-sm px-4 py-2.5">
                      <p className="text-sm text-white">Utah</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-brand to-brand-strong flex items-center justify-center text-white text-xs font-bold">
                      AI
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2.5">
                      <p className="text-sm text-slate-700">
                        Got it. Utah generally asks for 3 months&rsquo; residency in your county,
                        and has a 30-day waiting period after filing. Have you lived there since
                        spring?
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs text-emerald-800 font-medium">
                      Saved to your life story &middot; Petition draft updated
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden sm:block absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <FileStack className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Case packet</p>
                    <p className="text-xs text-slate-500">Cover, TOC &amp; exhibits</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
