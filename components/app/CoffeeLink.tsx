'use client';

// "Buy us a coffee" support link. discover.legal is free to use; this is
// the only ask, and it's optional. Renders nothing unless a donation URL
// is configured (NEXT_PUBLIC_DONATION_URL, inlined at build time), so a
// misconfigured deploy never links to an unclaimed handle.

import React from 'react';
import { Coffee } from 'lucide-react';

// Literal reference required for Next.js to inline the value client-side.
const DONATION_URL = process.env.NEXT_PUBLIC_DONATION_URL || '';

const STRINGS = {
  en: {
    line: 'discover.legal is free for everyone.',
    ask: 'If it saved your day, you can',
    cta: 'buy us a coffee',
  },
  es: {
    line: 'discover.legal es gratis para todos.',
    ask: 'Si te salvó el día, puedes',
    cta: 'invitarnos un café',
  },
} as const;

type Lang = keyof typeof STRINGS;

export default function CoffeeLink({
  lang = 'en',
  className = '',
}: {
  lang?: Lang;
  className?: string;
}) {
  if (!DONATION_URL) return null;
  const s = STRINGS[lang] ?? STRINGS.en;
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
    >
      <Coffee className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <span>{s.line}</span>
      <span>
        {s.ask}{' '}
        <a
          href={DONATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-2 hover:text-amber-700"
        >
          {s.cta}
        </a>
        .
      </span>
    </div>
  );
}
