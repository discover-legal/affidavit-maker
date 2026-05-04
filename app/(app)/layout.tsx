import AppShell from './AppShell';

// Server component layout for authed routes.
//
// All providers and TOSGuard live in AppShell as a client component so this
// layout can stay a Server Component. Auth gating is handled per-page via
// `withPageAuthRequired` (see each page.tsx).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
