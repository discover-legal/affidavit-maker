'use client';

// Consultancy call to action: a mailto link that scrapers cannot harvest.
//
// The address never appears in the served HTML, the RSC payload or the
// client bundle as a literal. The server renders a plain anchor with no
// mailto; after hydration the browser assembles the address from the local
// part and the page's own hostname (with any subdomain such as www/ca
// stripped) and sets the href. Bots reading static HTML or grepping the
// bundle for "@" find nothing.
//
// NEXT_PUBLIC_BOOKING_URL (inlined at build time) overrides the mailto with
// a scheduler when set.

import { useEffect, useState } from 'react';
import { ArrowRight, CalendarCheck, Mail } from 'lucide-react';

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || '';
const LOCAL_PART = 'h';
const APEX = ['discover', 'legal'];

const VARIANTS = {
  hero: 'group inline-flex items-center justify-center px-6 py-3.5 bg-slate-900 text-white text-base font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:-translate-y-0.5',
  nav: 'inline-flex items-center bg-slate-900 text-white px-4 sm:px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-semibold',
  closing:
    'inline-flex items-center px-8 py-4 bg-white text-slate-900 text-base font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-xl hover:shadow-2xl hover:-translate-y-0.5',
  card: 'inline-flex items-center justify-center px-5 py-3 rounded-lg font-semibold text-sm transition-all bg-slate-900 text-white hover:bg-slate-800',
} as const;

/** The apex domain of the page being viewed, falling back to ours off-domain (dev, previews). */
function apexDomain(): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const parts = host.split('.').filter(Boolean);
  const ours = parts.length >= 2 && parts.slice(-2).join('.') === APEX.join('.');
  return ours ? parts.slice(-2).join('.') : APEX.join('.');
}

function mailto(): string {
  return ['mailto:', LOCAL_PART, String.fromCharCode(64), apexDomain()].join('');
}

export default function ContactCta({
  variant = 'hero',
  children,
}: {
  variant?: keyof typeof VARIANTS;
  children?: React.ReactNode;
}) {
  const scheduler = BOOKING_URL.length > 0;
  const [href, setHref] = useState<string>(scheduler ? BOOKING_URL : '#contact');
  useEffect(() => {
    if (!scheduler) setHref(mailto());
  }, [scheduler]);

  const label = children ?? (scheduler ? 'Book a consultation' : 'Email us');
  const Icon = scheduler ? CalendarCheck : Mail;
  const external = scheduler ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <a
      href={href}
      {...external}
      className={VARIANTS[variant]}
      onClick={(e) => {
        // Pre-hydration click or a blocked effect: assemble on the spot.
        if (!scheduler && !e.currentTarget.href.startsWith('mailto:')) {
          e.preventDefault();
          window.location.href = mailto();
        }
      }}
    >
      {variant !== 'nav' && <Icon className="mr-2 h-4 w-4" aria-hidden="true" />}
      {label}
      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
    </a>
  );
}
