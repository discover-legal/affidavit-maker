'use client';

// The only auth-aware pieces of the landing page, isolated so every section
// can stay a server component. Signed-out visitors (and the SSG HTML) get
// the Auth0 login/signup URLs; a signed-in visitor is routed to /dashboard
// after hydration.
//
// Plain <a> rather than next/link: when the user is logged out these point
// at /api/auth/login (the Auth0 SDK route handler), which returns a 302 to
// Auth0. Next.js Link's client-side routing layer was observed (2026-05-19)
// to turn that redirect response into a download in the browser instead of
// following it. A normal anchor sends the user via plain browser navigation
// and the redirect works as expected.

import { useUser } from '@auth0/nextjs-auth0/client';
import { ArrowRight } from 'lucide-react';
import { AUTH0_PROFILE_ROUTE } from '@/lib/auth0-routes';

export function useStartHref(): string {
  const { user } = useUser({ route: AUTH0_PROFILE_ROUTE });
  return user ? '/dashboard' : '/api/auth/login?screen_hint=signup';
}

const VARIANTS = {
  hero: 'group inline-flex items-center justify-center px-6 py-3.5 bg-slate-900 text-white text-base font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5',
  card: 'w-full inline-flex items-center justify-center px-5 py-3 rounded-lg font-semibold text-sm transition-all bg-slate-900 text-white hover:bg-slate-800',
  cardInverted:
    'w-full inline-flex items-center justify-center px-5 py-3 rounded-lg font-semibold text-sm transition-all bg-white text-slate-900 hover:bg-slate-100',
  closing:
    'inline-flex items-center px-8 py-4 bg-white text-slate-900 text-base font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-xl hover:shadow-2xl hover:-translate-y-0.5',
} as const;

export default function StartCta({
  children,
  variant = 'hero',
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
}) {
  const href = useStartHref();
  return (
    <a href={href} className={VARIANTS[variant]}>
      {children}
      <ArrowRight
        className={
          variant === 'hero'
            ? 'ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform'
            : variant === 'closing'
            ? 'ml-2 h-5 w-5'
            : 'ml-2 h-4 w-4'
        }
      />
    </a>
  );
}
