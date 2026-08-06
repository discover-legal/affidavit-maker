import { COVERAGE_COUNT } from './content';

export default function StatsStrip() {
  return (
    <section className="border-y border-slate-200 bg-slate-50/60 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">Free</p>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Every document, donation-supported
            </p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">{COVERAGE_COUNT} states</p>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Launch jurisdictions</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">10+</p>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Court document types, one story
            </p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">EN&nbsp;&middot;&nbsp;ES</p>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Fully bilingual journey</p>
          </div>
        </div>
      </div>
    </section>
  );
}
