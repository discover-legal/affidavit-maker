import { FAQS } from './content';

export default function FaqSection() {
  return (
    <section className="py-20 sm:py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900">
            Common questions.
          </h2>
        </div>

        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {FAQS.map((faq) => (
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
  );
}
