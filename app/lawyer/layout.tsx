import type { Metadata } from 'next';
import Link from 'next/link';
import { assertMarketplaceEnabled } from '@/lib/marketplace/flag';
import { getCurrentUser } from '@/lib/auth';
import { isProvider } from '@/lib/marketplace/guards';

export const metadata: Metadata = {
  title: { default: 'Provider Portal', template: '%s | discover.legal Provider' },
  robots: { index: false, follow: false },
};

/**
 * Provider (lawyer) portal shell. Two server-side gates:
 *   1. ENABLE_MARKETPLACE off  -> 404 (assertMarketplaceEnabled).
 *   2. Non-provider account    -> friendly "provider account required" panel
 *      instead of the portal (a logged-out user is bounced to login by each
 *      page's withPageAuthRequired before this matters).
 *
 * We deliberately do NOT redirect() here — per the (app)/layout.tsx history
 * note, redirect() in a layout can conflict with per-page withPageAuthRequired.
 * Data is fetched client-side via the SDK so RLS context (set by withAuth on
 * the API) is in effect — server-pool reads would hide the lawyer's own drafts.
 */
export default async function LawyerLayout({ children }: { children: React.ReactNode }) {
  assertMarketplaceEnabled();
  const user = await getCurrentUser();
  const allowed = user != null && isProvider(user.role);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/lawyer" className="flex items-center gap-2 font-semibold text-gray-900">
            <span className="text-blue-600">discover.legal</span>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
              Provider
            </span>
          </Link>
          {allowed && (
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/lawyer" className="text-gray-600 hover:text-blue-700">
                Dashboard
              </Link>
              <Link href="/lawyer/templates" className="text-gray-600 hover:text-blue-700">
                Templates
              </Link>
              <Link
                href="/lawyer/templates/new"
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 font-medium text-white hover:bg-blue-700"
              >
                New template
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {allowed ? children : <ProviderRequiredNotice signedIn={user != null} />}
      </main>
    </div>
  );
}

function ProviderRequiredNotice({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Provider account required</h1>
      <p className="mt-2 text-sm text-gray-600">
        The provider portal is for verified attorneys publishing document templates. Your account
        isn&apos;t set up as a provider yet.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/marketplace"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
        >
          Browse the marketplace
        </Link>
        {!signedIn && (
          <Link
            href="/api/auth/login?returnTo=/lawyer"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
