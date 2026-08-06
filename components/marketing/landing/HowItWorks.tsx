import { ArrowRight } from 'lucide-react';
import { STEPS } from './content';

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Four steps. No legal jargon.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className="relative bg-white rounded-2xl border border-slate-200 p-7 hover:shadow-lg hover:shadow-slate-900/5 transition-shadow"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-sm font-bold text-slate-400">{step.n}</span>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="hidden lg:block h-4 w-4 text-slate-300 absolute -right-5 top-12 z-10" />
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
