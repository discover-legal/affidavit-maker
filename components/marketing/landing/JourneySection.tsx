import { JOURNEY } from './content';

export default function JourneySection() {
  return (
    <section id="journey" className="bg-slate-50 py-20 sm:py-24 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold text-brand uppercase tracking-wider mb-3">
            Beyond the documents
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            The whole journey, guided.
          </h2>
          <p className="text-lg text-slate-600">
            Filing is only the beginning. Your life story powers a step-by-step path through
            everything that comes after &mdash; in English or Espa&ntilde;ol.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {JOURNEY.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="bg-white rounded-2xl border border-slate-200 p-7 hover:shadow-lg hover:shadow-slate-900/5 transition-shadow"
              >
                <div className={`w-11 h-11 rounded-xl ${item.iconBg} flex items-center justify-center mb-5`}>
                  <Icon className={`h-5 w-5 ${item.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
