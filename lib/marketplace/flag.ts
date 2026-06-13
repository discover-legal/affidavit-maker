/**
 * lib/marketplace/flag.ts
 *
 * TypeScript-facing accessor for the document-marketplace feature flag.
 * Mirrors `config/marketplace.js` (the CommonJS source of truth used by
 * services) but reads the env var directly so TS callers don't pay a
 * require()/interop hop. Both read the same `ENABLE_MARKETPLACE` variable, so
 * they can never disagree.
 *
 * Use `isMarketplaceEnabled()` in Route Handlers (to 404 marketplace APIs when
 * off) and `assertMarketplaceEnabled()` in Server Components / layouts (to
 * `notFound()` the marketplace pages when off). When the flag is off the
 * marketplace simply does not exist — current users see today's product
 * unchanged.
 */
import { notFound } from 'next/navigation';

export function isMarketplaceEnabled(): boolean {
  return process.env.ENABLE_MARKETPLACE === 'true';
}

/**
 * For use in Server Components / route-group layouts. When the marketplace is
 * disabled this renders the standard Next.js 404 — the route is invisible and
 * indistinguishable from a path that was never defined.
 */
export function assertMarketplaceEnabled(): void {
  if (!isMarketplaceEnabled()) {
    notFound();
  }
}
