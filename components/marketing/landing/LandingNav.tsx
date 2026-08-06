'use client';

import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Scale } from 'lucide-react';

export default function LandingNav() {
  const { user } = useUser();
  const isAuthenticated = Boolean(user);
  const signInHref = isAuthenticated ? '/dashboard' : '/api/auth/login';
  const startHref = isAuthenticated ? '/dashboard' : '/api/auth/login?screen_hint=signup';

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-brand to-brand-strong rounded-lg blur-sm opacity-40" />
              <div className="relative bg-gradient-to-br from-slate-900 to-slate-700 rounded-lg p-1.5">
                <Scale className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="text-left">
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                discover<span className="text-brand">.</span>legal
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <a
              href="#documents"
              className="hidden md:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
            >
              Documents
            </a>
            <a
              href="#journey"
              className="hidden md:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
            >
              The journey
            </a>
            <a
              href="#how-it-works"
              className="hidden md:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
            >
              How it works
            </a>
            <Link
              href="/resources"
              className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
            >
              Resources
            </Link>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="bg-slate-900 text-white px-4 sm:px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-semibold"
              >
                Dashboard
              </Link>
            ) : (
              <>
                {/* Plain <a>: see StartCta.tsx for the Auth0-redirect rationale. */}
                <a
                  href={signInHref}
                  className="hidden sm:inline text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-2"
                >
                  Sign in
                </a>
                <a
                  href={startHref}
                  className="bg-slate-900 text-white px-4 sm:px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-semibold"
                >
                  Get started
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
