import type { Metadata } from 'next';
import Link from 'next/link';
import { assertMarketplaceEnabled } from '@/lib/marketplace/flag';

export const metadata: Metadata = {
  title: {
    default: 'Document Marketplace',
    template: '%s | discover.legal Marketplace',
  },
  description:
    'Browse lawyer-authored, jurisdiction-specific legal document templates. Complete a guided interview and generate a court-ready document in minutes.',
};

/**
 * Marketplace route-group shell. The flag guard lives here so EVERY nested
 * marketplace route (browse, search, detail) is invisible — a clean 404 —
 * whenever ENABLE_MARKETPLACE is off. Nothing about the marketplace is wired
 * into the main site chrome, so when the flag is off current users see exactly
 * today's product.
 */
export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  assertMarketplaceEnabled();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/marketplace" className="flex items-center gap-2 font-semibold text-gray-900">
            <span className="text-blue-600">discover.legal</span>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
              Marketplace
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/marketplace/search" className="text-gray-600 hover:text-blue-700">
              Browse all
            </Link>
            <Link
              href="/marketplace/purchases"
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 font-medium text-white hover:bg-blue-700"
            >
              My documents
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
