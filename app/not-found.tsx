import Link from 'next/link';

export const metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-md text-center space-y-4">
        <p className="text-sm font-mono text-slate-500">404</p>
        <h1 className="text-3xl font-bold text-slate-900">Page not found</h1>
        <p className="text-slate-600">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-semibold"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
