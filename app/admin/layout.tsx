import type { Metadata } from 'next';
import Link from 'next/link';
import { assertMarketplaceEnabled } from '@/lib/marketplace/flag';
import { getCurrentUser } from '@/lib/auth';
import { isAdmin } from '@/lib/marketplace/guards';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | discover.legal Admin' },
  robots: { index: false, follow: false },
};

/**
 * Marketplace admin shell. Gated by ENABLE_MARKETPLACE (404 when off) and the
 * admin role (non-admins see a denial panel; logged-out users are bounced by
 * each page's withPageAuthRequired). Data is fetched client-side via the SDK so
 * the admin RLS context set by withAuth is in effect.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  assertMarketplaceEnabled();
  const user = await getCurrentUser();
  const allowed = user != null && isAdmin(user.role);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/admin" className="flex items-center gap-2 font-semibold text-gray-900">
            <span className="text-blue-600">discover.legal</span>
            <span className="rounded bg-gray-900 px-1.5 py-0.5 text-xs font-medium text-white">Admin</span>
          </Link>
          {allowed && (
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin" className="text-gray-600 hover:text-blue-700">Overview</Link>
              <Link href="/admin/templates" className="text-gray-600 hover:text-blue-700">Moderation</Link>
              <Link href="/admin/users" className="text-gray-600 hover:text-blue-700">Users</Link>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {allowed ? (
          children
        ) : (
          <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">Administrator access required</h1>
            <p className="mt-2 text-sm text-gray-600">This area is restricted to platform administrators.</p>
            <Link
              href="/marketplace"
              className="mt-6 inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
            >
              Back to marketplace
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
