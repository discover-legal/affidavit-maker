'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Something went wrong</h1>
        <p className="text-slate-600">
          An unexpected error occurred. The team has been notified.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 font-mono">Reference: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={reset}
            className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-semibold"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-5 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-semibold"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
