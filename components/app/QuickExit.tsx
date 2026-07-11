'use client';

import { useEffect } from 'react';

/**
 * Safety control for domestic-violence flows: one tap (or Esc pressed
 * twice) immediately replaces this page with a neutral site, leaving no
 * entry in the back button. Standard practice on DV-support sites.
 */
const NEUTRAL_URL = 'https://www.google.com/search?q=weather+forecast';

export function quickExitNow(): void {
  try {
    window.location.replace(NEUTRAL_URL);
  } catch {
    window.location.href = NEUTRAL_URL;
  }
}

export default function QuickExit() {
  useEffect(() => {
    let lastEsc = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const now = Date.now();
      if (now - lastEsc < 800) quickExitNow();
      lastEsc = now;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <button
      onClick={quickExitNow}
      className="fixed right-3 top-3 z-50 rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
      title="Instantly leave this page (or press Esc twice). This page won't stay in your history."
    >
      Quick exit
    </button>
  );
}
