import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">
          discover<span className="text-blue-600">.</span>legal
        </h1>
        <p className="text-slate-600">
          Migration in progress — full landing page being ported to Next.js App Router.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/resources"
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-semibold"
          >
            Resources
          </Link>
          <Link
            href="/privacy"
            className="px-4 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-semibold"
          >
            Privacy
          </Link>
        </div>
      </div>
    </main>
  );
}
