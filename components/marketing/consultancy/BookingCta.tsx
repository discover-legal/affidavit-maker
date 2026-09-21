// Consultancy call to action. Renders the paid booking link only when
// NEXT_PUBLIC_BOOKING_URL is configured (inlined at build time, same pattern
// as CoffeeLink), so a deploy without a scheduler never links to nothing.
// Without it the button points at our public GitHub organisation instead.

import { ArrowRight, CalendarCheck, Code2 } from 'lucide-react';
import { GITHUB_ORG } from './content';

// Literal reference required for Next.js to inline the value client-side.
const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || '';

const VARIANTS = {
  hero: 'group inline-flex items-center justify-center px-6 py-3.5 bg-slate-900 text-white text-base font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:-translate-y-0.5',
  nav: 'inline-flex items-center bg-slate-900 text-white px-4 sm:px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm font-semibold',
  closing:
    'inline-flex items-center px-8 py-4 bg-white text-slate-900 text-base font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-xl hover:shadow-2xl hover:-translate-y-0.5',
  card: 'inline-flex items-center justify-center px-5 py-3 rounded-lg font-semibold text-sm transition-all bg-slate-900 text-white hover:bg-slate-800',
} as const;

export function bookingConfigured(): boolean {
  return BOOKING_URL.length > 0;
}

export default function BookingCta({
  variant = 'hero',
  children,
}: {
  variant?: keyof typeof VARIANTS;
  children?: React.ReactNode;
}) {
  const configured = bookingConfigured();
  const href = configured ? BOOKING_URL : GITHUB_ORG;
  const label = children ?? (configured ? 'Book a consultation' : 'See our work on GitHub');
  const Icon = configured ? CalendarCheck : Code2;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={VARIANTS[variant]}>
      {variant !== 'nav' && <Icon className="mr-2 h-4 w-4" aria-hidden="true" />}
      {label}
      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
    </a>
  );
}

/** Small caption under a booking button; empty when no scheduler is configured. */
export function BookingNote({ className = '' }: { className?: string }) {
  if (!bookingConfigured()) return null;
  return <p className={`text-xs text-slate-500 ${className}`}>Paid session, scheduled online.</p>;
}
