import { redirect } from 'next/navigation';
import { getSession } from '@auth0/nextjs-auth0';
import AppShell from './AppShell';

/**
 * Auth-gated route group layout.
 *
 * DEFENSE IN DEPTH: each page under (app)/ already wraps its export in
 * `withPageAuthRequired`. This layout adds a second check at the group
 * level so a future page that forgets the per-page wrapper is still
 * gated — the (app)/ folder is the trust boundary, not any individual
 * file inside it.
 *
 * Server Component: resolves the Auth0 session on the server and
 * redirects to the login endpoint with the originally requested path
 * preserved in `returnTo`, so the user lands back where they started
 * after sign-in.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) {
    // We don't have access to the requested pathname from a layout reliably
    // (next/headers can give us the X-Invoke-Path on the App Router edge,
    // but it's an internal contract we don't want to rely on). Drop the
    // user onto /api/auth/login and let Auth0's `returnTo=/dashboard`
    // default move them along.
    redirect('/api/auth/login');
  }
  return <AppShell>{children}</AppShell>;
}
