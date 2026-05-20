import AppShell from './AppShell';

// Server component layout for authed routes.
//
// All providers and TOSGuard live in AppShell as a client component so this
// layout can stay a Server Component. Auth gating is handled per-page via
// `withPageAuthRequired` (see each page.tsx).
//
// HISTORY: an earlier iteration of this file also called
// `getSession() + redirect('/api/auth/login')` here as a defense-in-depth
// gate, but that path conflicted with the per-page `withPageAuthRequired`
// HOC under some Next.js client-routing conditions (issue observed
// 2026-05-19 — sign-in click downloading the redirect response). The
// per-page wrappers are sufficient on their own; if you add a new page
// under (app)/, ALSO wrap it in `withPageAuthRequired`.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
