import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rateLimit';
import { toErrorResponse } from '@/lib/api/errors';
import { getUserProfile } from '@/lib/api/profile';
import { getProcedure, computeNextSteps } from '@/lib/api/procedure';
import { buildCalendar, type CalendarEvent } from '@/lib/ics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalize a stored event date to YYYY-MM-DD, or null when unparseable. */
function toIsoDate(raw: unknown): string | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  if (ISO_DATE_RE.test(s)) return s;
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

// GET /api/profile/deadlines — the user's dated procedural deadlines and
// court events as a downloadable .ics calendar (all-day events with a
// 3-days-before reminder). 404 when there is nothing dated to export yet.
export const GET = withAuth(async (_req: NextRequest, { user }) => {
  try {
    const limit = await checkRateLimit('profile-deadlines', user.id, RATE_LIMITS.standard);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 },
      );
    }

    const notFound = () =>
      NextResponse.json(
        { success: false, error: 'No dated deadlines yet' },
        { status: 404 },
      );

    const { profile } = await getUserProfile(user.id);
    const state =
      typeof profile.state === 'string' ? profile.state.trim().toUpperCase() : '';
    const procedure = state ? getProcedure(state) : null;
    if (!procedure) return notFound();

    const events: CalendarEvent[] = [];

    // Upcoming procedural steps with a computed due date.
    for (const step of computeNextSteps(profile, procedure)) {
      if (!step.due || step.done) continue;
      events.push({ title: step.title, description: step.detail, date: step.due });
    }

    // Court/filing events already on the record (informational).
    const keyEvents = Array.isArray(profile.keyEvents) ? profile.keyEvents : [];
    for (const entry of keyEvents) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const label = typeof e.label === 'string' ? e.label.trim() : '';
      const date = toIsoDate(e.date);
      if (!label || !date) continue;
      events.push({ title: label, date });
    }

    if (events.length === 0) return notFound();

    const ics = buildCalendar(events, 'My court deadlines — discover.legal');
    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="my-deadlines.ics"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
});
