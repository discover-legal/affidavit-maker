import { COVERAGE_COUNT, FEATURE_QUADRANT, LAUNCH_JURISDICTIONS } from './content';

export default function JurisdictionsSection() {
  return (
    <section className="bg-slate-50 py-20 sm:py-24 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
              Built for your jurisdiction
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-6">
              Seven launch states.<br />
              <span className="text-slate-500">Jurisdiction-aware interviews.</span>
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Interview questions, captions, and formatting adapt to each supported state &mdash;
              with the deepest step-by-step guidance (procedure roadmap, child support estimator,
              fee waiver) in Utah first. Court rules change, so review the current filing
              instructions from your local court.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {FEATURE_QUADRANT.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg ${feature.iconBg} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`h-4 w-4 ${feature.iconColor}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{feature.title}</p>
                      <p className="text-xs text-slate-500">{feature.body}</p>
                    </div>
                  </div>
                );
              })}
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
                {LAUNCH_JURISDICTIONS.map((code) => (
                  <div
                    key={code}
                    className={`border rounded px-2 py-1.5 text-center transition-colors ${
                      code === 'UT'
                        ? 'bg-amber-400/20 border-amber-300/40 text-amber-200'
                        : 'bg-white/5 hover:bg-white/10 border-white/10'
                    }`}
                  >
                    {code}
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-sm">
                <span className="text-slate-400">Deepest guidance</span>
                <span className="font-semibold">Utah &middot; {COVERAGE_COUNT} states total</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
