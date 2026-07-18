import { redirect } from 'next/navigation';
import { getCurrentSession } from './auth';

/**
 * Explicit App Router page guard. This keeps authentication behavior visible
 * and testable across Auth0 SDK upgrades while retaining the non-production
 * E2E session supplied by getCurrentSession().
 */
export async function requirePageAuth(returnTo: string): Promise<void> {
  const session = await getCurrentSession();
  if (!session?.user?.sub) {
    redirect(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
}
