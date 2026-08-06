import { Check } from 'lucide-react';
import CoffeeLink from '@/components/app/CoffeeLink';
import StartCta from './StartCta';
import { OFFERINGS } from './content';

export default function OfferingsSection() {
  return (
    <section id="documents" className="py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
            What we make
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Every document. Free.
          </h2>
          <p className="text-lg text-slate-600">
            The filings people actually need — each one interviewed end-to-end by our AI, filled
            from your life story, and formatted for your state&rsquo;s court.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {OFFERINGS.map((offering) => {
            const Icon = offering.icon;
            const featured = Boolean(offering.featured);
            return (
              <div
                key={offering.key}
                className={`relative rounded-2xl p-8 transition-all hover:-translate-y-1 ${
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
                      featured ? 'bg-white/10' : offering.iconBg
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${featured ? 'text-white' : offering.iconColor}`} />
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${featured ? 'text-white' : 'text-slate-900'}`}>
                      Free
                    </p>
                    <p className={`text-xs ${featured ? 'text-slate-400' : 'text-slate-500'}`}>
                      Donation-supported
                    </p>
                  </div>
                </div>

                <h3
                  className={`text-2xl font-bold mb-1 ${featured ? 'text-white' : 'text-slate-900'}`}
                >
                  {offering.name}
                </h3>
                <p className={`text-base mb-6 ${featured ? 'text-slate-300' : 'text-slate-600'}`}>
                  {offering.tagline}
                </p>

                <ul className="space-y-3 mb-8">
                  {offering.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check
                        className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                          featured ? 'text-emerald-400' : 'text-emerald-600'
                        }`}
                      />
                      <span className={`text-sm ${featured ? 'text-slate-200' : 'text-slate-700'}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <StartCta variant={featured ? 'cardInverted' : 'card'}>{offering.cta}</StartCta>
              </div>
            );
          })}
        </div>

        <CoffeeLink className="mt-10 max-w-2xl mx-auto" />

        <p className="mt-8 text-sm text-slate-500 text-center">
          More matter types &mdash; custody, support, name change, small claims &mdash; coming soon.
        </p>
      </div>
    </section>
  );
}
