'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/locale';
import { LOCALE_COOKIE } from '@/lib/locale';

/**
 * Flag toggle. Server detects the locale (host header or `locale` cookie)
 * and passes it down as `active`. Clicking the other option writes the
 * cookie and asks Next.js to re-render the server tree so copy, theme,
 * and pricing all flip together.
 *
 * The cookie is non-HttpOnly on purpose (purely a UX preference, no
 * security boundary). Path=/ + 1-year Max-Age so the choice sticks
 * across visits.
 */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

const LABELS: Record<Locale, { flag: string; label: string }> = {
  us: { flag: '🇺🇸', label: 'US' },
  ca: { flag: '🇨🇦', label: 'CA' },
};

export function LocaleToggle({ active }: { active: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const other: Locale = active === 'us' ? 'ca' : 'us';

  function switchTo(next: Locale) {
    if (next === active) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5 text-xs font-medium shadow-sm"
      role="group"
      aria-label="Country"
    >
      {(['us', 'ca'] as const).map((loc) => {
        const isActive = loc === active;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => switchTo(loc)}
            aria-pressed={isActive}
            disabled={isPending && loc === other}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors ${
              isActive
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            } ${isPending && loc === other ? 'opacity-50' : ''}`}
          >
            <span aria-hidden>{LABELS[loc].flag}</span>
            <span>{LABELS[loc].label}</span>
          </button>
        );
      })}
    </div>
  );
}
