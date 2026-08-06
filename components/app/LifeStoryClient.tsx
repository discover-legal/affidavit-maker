'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Briefcase,
  CalendarPlus,
  Check,
  Download,
  ExternalLink,
  Feather,
  Gavel,
  Heart,
  Loader2,
  MapPin,
  Quote,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Tooltip from '@/components/marketing/Tooltip';
import QuickExit from './QuickExit';
import CoffeeLink from './CoffeeLink';
// Pure step computation shared with the server (no server-only imports),
// so the fetched procedure can be turned into steps right in the browser.
import { computeNextSteps, detectPerspective } from '@/lib/api/procedure';
import { getInitialLang, setLang, t, type Lang } from '@/lib/i18n';
import {
  MONEY_OTHER_LABELS,
  advisorFlags,
  buildFamily,
  buildLedger,
  buildRecitals,
  buildTimeline,
  feeWaiverHint,
  getGlossary,
  groupFacts,
  moneyLeftover,
  moneySegments,
  localizeNextStep,
  storyProgress,
  supportKindVisible,
  waitingPeriodNote,
  type MoneySegment,
  type ProfileChild,
  type Recital,
  type Segment,
} from './lifeStory';

type ProfileResponse = {
  success?: boolean;
  data?: {
    profile?: Record<string, unknown>;
    facts?: Array<Record<string, unknown>>;
  };
  error?: string;
};

type LoadState = 'loading' | 'ready' | 'error';

// Mark colors validated for CVD + contrast on the paper surface
// (dataviz six-checks): brand blue for "in"/figures, warm amber for "out".
const INK_IN = '#2563eb';
const INK_OUT = '#b45309';
// Categorical palette for itemized money segments — validated (chroma,
// CVD separation, 3:1 surface contrast); assigned in fixed order by
// descending amount, with the "Other" fold in neutral gray (identified by
// its legend label + segment gaps, not color).
const MONEY_PALETTE = ['#2563eb', '#0d9488', '#7c3aed', '#b45309', '#be185d'];
const MONEY_OTHER = '#9ca3af';

// Keyed by chapter label in both languages (chapter labels come from
// categoryLabel, which is language-aware).
const CHAPTER_ICONS: Record<string, LucideIcon> = {
  'Where you live': MapPin,
  'Why you are filing': Scale,
  'Your children': Users,
  'Your relationships': Heart,
  'Money matters': Banknote,
  'What you own': Banknote,
  'Dónde vives': MapPin,
  'Por qué presentas tu caso': Scale,
  'Tus hijos': Users,
  'Tus relaciones': Heart,
  'Asuntos de dinero': Banknote,
  'Lo que posees': Banknote,
};

function SegmentSpan({
  segment,
  lang,
  onAsk,
}: {
  segment: Segment;
  lang: Lang;
  onAsk?: () => void;
}) {
  if (segment.kind === 'value') {
    return (
      <mark className="rounded bg-brand-tint px-1 font-medium text-brand-strong">
        {segment.text}
      </mark>
    );
  }
  if (segment.kind === 'blank') {
    // A gap is an invitation: tapping it opens the chat with the user's own
    // "I want to add…" message prefilled (their words to edit and send).
    if (onAsk) {
      return (
        <button
          onClick={onAsk}
          className="border-b-2 border-dotted border-gray-400 px-0.5 italic text-gray-400 transition-colors hover:border-brand hover:text-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          title={t(lang, 'story.addTitle')}
        >
          {segment.text} +
        </button>
      );
    }
    return (
      <span className="border-b-2 border-dotted border-gray-300 px-0.5 italic text-gray-400">
        {segment.text}
      </span>
    );
  }
  return <>{segment.text}</>;
}

/**
 * A friendly standing person silhouette. Height scales with age so the
 * family row reads like a portrait: grown-ups tall, little ones little.
 */
function PersonFigure({ heightScale }: { heightScale: number }) {
  const h = Math.round(88 * heightScale);
  return (
    <svg
      width={Math.max(26, Math.round(40 * heightScale))}
      height={h}
      viewBox="0 0 40 96"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      className="block"
    >
      <circle cx="20" cy="13" r="11" fill={INK_IN} />
      <path
        d="M20 27 C9 27 6 36 6 47 L6 74 C6 79 10 82 14 82 L14 96 L26 96 L26 82 C30 82 34 79 34 74 L34 47 C34 36 31 27 20 27 Z"
        fill={INK_IN}
      />
    </svg>
  );
}

/** The whole family, labeled and standing on one baseline. */
function FamilyPortrait({ profile, lang }: { profile: Record<string, unknown>; lang: Lang }) {
  const members = buildFamily(profile, lang);
  return (
    <div className="mt-4 flex items-end gap-3 overflow-x-auto border-b-2 border-gray-200 pb-0 sm:gap-8">
      {members.map((member, i) => (
        <figure
          key={`${member.label}-${i}`}
          className="flex min-w-[3.25rem] flex-col items-center"
          title={member.title}
        >
          <PersonFigure heightScale={member.heightScale} />
          <figcaption className="mt-2 pb-2 text-center font-sans">
            <span className="block max-w-[7rem] truncate text-sm font-semibold text-gray-800">
              {member.label}
            </span>
            <span className="block h-4 whitespace-nowrap text-xs text-gray-500">
              {member.sublabel}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Married → births → separated → today, positioned proportionally in time. */
function LifeTimeline({ profile, lang }: { profile: Record<string, unknown>; lang: Lang }) {
  const timeline = buildTimeline(profile, new Date(), lang);
  if (!timeline) return null;

  return (
    <div className="mt-4 font-sans" aria-hidden="true">
      {/* Children's births sit above the line as small initialed marks. */}
      {timeline.births.length > 0 && (
        <div className="relative mb-1 h-4 text-[10px] font-semibold text-brand-strong">
          {timeline.births.map((b) => (
            <span
              key={b.key}
              title={b.title}
              className="absolute -translate-x-1/2"
              style={{ left: `${b.pos}%` }}
            >
              {b.initial}
            </span>
          ))}
        </div>
      )}
      <div className="relative h-2">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-gray-200" />
        {timeline.births.map((b) => (
          <span
            key={b.key}
            title={b.title}
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
            style={{ left: `${b.pos}%`, borderColor: INK_IN }}
          />
        ))}
        {timeline.majors.map((e) => (
          <span
            key={e.key}
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
            style={{ left: `${e.pos}%`, backgroundColor: INK_IN }}
          />
        ))}
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300">▸</span>
      </div>
      {/* Absolute labels work on wider paper, but long court-event names can
          collide on phones. Mobile gets a compact chronological legend. */}
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:hidden">
        {timeline.majors.map((e) => (
          <span key={e.key} className="min-w-0 border-l-2 border-brand pl-2 leading-tight">
            <span className="block break-words font-semibold text-gray-700">{e.label}</span>
            <span className="block text-gray-400">{e.year}</span>
          </span>
        ))}
        <span className="min-w-0 border-l-2 border-gray-200 pl-2 leading-tight">
          <span className="block font-semibold text-gray-700">{t(lang, 'timeline.today')}</span>
          <span className="block text-gray-400">{new Date().getFullYear()}</span>
        </span>
      </div>
      <div className="relative mt-1.5 hidden h-9 text-xs sm:block">
        {timeline.majors.map((e) => (
          <span
            key={e.key}
            className="absolute -translate-x-1/2 text-center leading-tight"
            style={{ left: `${e.pos}%` }}
          >
            <span className="block font-semibold text-gray-700">{e.label}</span>
            <span className="block text-gray-400">{e.year}</span>
          </span>
        ))}
        <span className="absolute right-0 text-right leading-tight">
          <span className="block font-semibold text-gray-700">{t(lang, 'timeline.today')}</span>
          <span className="block text-gray-400">{new Date().getFullYear()}</span>
        </span>
      </div>
    </div>
  );
}

function segmentColor(index: number, label: string): string {
  const isOtherFold = label === MONEY_OTHER_LABELS.en || label === MONEY_OTHER_LABELS.es;
  return isOtherFold ? MONEY_OTHER : MONEY_PALETTE[index % MONEY_PALETTE.length];
}

/**
 * One money row: either a stacked bar of itemized segments (color-coded,
 * 2px surface gaps, legend chips beneath) or a plain bar when only the
 * total is known.
 */
function MoneyRow({
  label,
  total,
  max,
  segments,
  fallbackColor,
  lang,
}: {
  label: string;
  total: number;
  max: number;
  segments: MoneySegment[];
  fallbackColor: string;
  lang: Lang;
}) {
  const widthPct = Math.max(4, (total / max) * 100);
  const perMonth = t(lang, 'money.perMonth');
  return (
    <div>
      {/* Phones: label + total on one line, full-width bar below.
          sm+: label | bar | total in one row. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm sm:flex-nowrap">
        <span className="order-1 w-20 shrink-0 text-gray-500">{label}</span>
        <span className="order-2 ml-auto shrink-0 text-right font-semibold tabular-nums text-gray-800 sm:order-3 sm:ml-0 sm:w-24">
          ${Math.round(total).toLocaleString('en-US')}
          <span className="font-normal text-gray-400">{perMonth}</span>
        </span>
        <div className="order-3 h-3 w-full rounded-full bg-gray-100 sm:order-2 sm:w-auto sm:flex-1">
          {segments.length > 1 ? (
            <div className="flex h-full gap-0.5" style={{ width: `${widthPct}%` }}>
              {segments.map((seg, i) => (
                <div
                  key={seg.label}
                  title={`${seg.label}: $${seg.amount.toLocaleString('en-US')}${perMonth}`}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${(seg.amount / total) * 100}%`,
                    backgroundColor: segmentColor(i, seg.label),
                  }}
                />
              ))}
            </div>
          ) : (
            <div
              className="h-full rounded-full"
              style={{ width: `${widthPct}%`, backgroundColor: fallbackColor }}
            />
          )}
        </div>
      </div>
      {segments.length > 1 && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 sm:ml-[5.75rem]">
          {segments.map((seg, i) => (
            <span key={seg.label} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: segmentColor(i, seg.label) }}
              />
              {seg.label}{' '}
              <span className="font-medium tabular-nums text-gray-800">
                ${seg.amount.toLocaleString('en-US')}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Money in vs out — itemized by source/person and category when known. */
function MoneyBars({ profile, lang }: { profile: Record<string, unknown>; lang: Lang }) {
  const income = Number(profile.monthlyIncome);
  const expenses = Number(profile.monthlyExpenses);
  const rows = [
    {
      label: t(lang, 'money.in'),
      amount: income,
      color: INK_IN,
      segments: moneySegments(profile.incomeBreakdown, profile, lang),
    },
    {
      label: t(lang, 'money.out'),
      amount: expenses,
      color: INK_OUT,
      segments: moneySegments(profile.expenseBreakdown, profile, lang),
    },
  ]
    .map((r) => ({
      ...r,
      // The itemization is the source of truth for the bar total once present.
      amount:
        r.segments.length > 0
          ? r.segments.reduce((sum, s) => sum + s.amount, 0)
          : r.amount,
    }))
    .filter((r) => Number.isFinite(r.amount) && r.amount > 0);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.amount));
  const leftover = moneyLeftover(profile);

  return (
    // Not aria-hidden: unlike the timeline, the itemized legend carries
    // information the recital sentence doesn't (per-source/per-category).
    <div className="mt-4 space-y-3 font-sans">
      {rows.map((row) => (
        <MoneyRow
          key={row.label}
          label={row.label}
          total={row.amount}
          max={max}
          segments={row.segments}
          fallbackColor={row.color}
          lang={lang}
        />
      ))}
      {leftover !== null && leftover !== 0 && (
        <p className="text-sm text-gray-500">
          ≈{' '}
          <span className="font-semibold text-gray-800">
            ${Math.abs(leftover).toLocaleString('en-US')}
          </span>{' '}
          {leftover > 0 ? t(lang, 'money.leftOver') : t(lang, 'money.short')}
        </p>
      )}
    </div>
  );
}

type Procedure = NonNullable<Parameters<typeof computeNextSteps>[1]>;

/** '2026-07-19' → 'Jul 19' (en) / '19 jul' (es); parsed as a local date. */
function formatDueChip(due: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!m) return due;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * "What's next" — the usual procedural path for the user's state, as
 * numbered steps: done ones checked off and muted, the next actionable one
 * highlighted, dated ones wearing a due chip. General information about the
 * process (UPL-safe framing in the intro), never case-specific advice.
 * Renders only when the profile has a state AND the procedure fetch
 * succeeded; steps are computed client-side from the fetched procedure.
 */
function WhatsNext({ profile, lang }: { profile: Record<string, unknown>; lang: Lang }) {
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [stateName, setStateName] = useState('');

  const state = typeof profile.state === 'string' ? profile.state.trim().toUpperCase() : '';

  useEffect(() => {
    setProcedure(null);
    if (!state) return;
    let cancelled = false;
    fetch(`/api/procedure/${encodeURIComponent(state)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success || !json.data || typeof json.data !== 'object') return;
        const raw = json.data as Record<string, unknown>;
        // The route may return the procedure directly or wrapped as { procedure }.
        const proc = (
          raw.procedure && typeof raw.procedure === 'object' ? raw.procedure : raw
        ) as Procedure;
        const name = (proc as unknown as Record<string, unknown>).stateName ?? raw.stateName;
        setStateName(typeof name === 'string' && name ? name : state);
        setProcedure(proc);
      })
      .catch(() => {}); // best-effort: no procedure, no section
    return () => {
      cancelled = true;
    };
  }, [state]);

  const steps = useMemo(() => {
    if (!procedure) return [];
    try {
      return computeNextSteps(profile, procedure);
    } catch {
      return [];
    }
  }, [profile, procedure]);

  const perspective = useMemo(() => detectPerspective(profile), [profile]);

  if (!state || !procedure || steps.length === 0) return null;

  const nextIndex = steps.findIndex((s) => !s.done);
  const hasDatedDeadline = steps.some((s) => s.due && !s.done);

  // Respondent: days left on the answer clock, when computable from the
  // answer step's due date (local-date arithmetic, whole days).
  let answerDaysLeft: number | null = null;
  const answerStep = steps.find((s) => s.key === 'answer');
  if (perspective === 'respondent' && answerStep?.due && !answerStep.done) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(answerStep.due);
    if (m) {
      const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      answerDaysLeft = Math.round((due.getTime() - todayStart.getTime()) / 86400000);
    }
  }

  return (
    <section aria-label={t(lang, 'next.aria')} className="mt-10 font-sans">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
        {t(lang, 'next.heading')}
      </h2>
      <p className="mt-2 text-sm text-gray-500">{t(lang, 'next.intro', { stateName })}</p>

      {/* Respondent: the answer clock is theirs — surface /respond up top. */}
      {perspective === 'respondent' && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="min-w-0 flex-1 text-sm text-amber-900">
            <span className="font-semibold">{t(lang, 'respond.banner')}</span>
            {answerDaysLeft !== null && (
              <>
                {' '}
                {/* A deadline passes at the END of its calendar day, so due
                    today (0) still means one day to act. */}
                {answerDaysLeft >= 0
                  ? t(lang, answerDaysLeft <= 1 ? 'respond.dayLeft' : 'respond.daysLeft', {
                      n: answerDaysLeft,
                    })
                  : t(lang, 'respond.overdue')}
              </>
            )}
          </p>
          <a
            href="/respond"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {t(lang, 'respond.cta')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      )}

      <ol className="mt-4 space-y-2">
        {steps.map((step, i) => {
          const displayStep = localizeNextStep(step, procedure, profile, perspective, lang);
          const isNext = i === nextIndex;
          return (
            <li
              key={step.key}
              className={`flex items-start gap-3 rounded-xl border bg-white p-4 ${
                isNext ? 'border-brand ring-2 ring-brand' : 'border-gray-200'
              }`}
            >
              {step.done ? (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-on">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">{t(lang, 'next.done')}</span>
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums ${
                    isNext ? 'border-brand text-brand-strong' : 'border-gray-300 text-gray-400'
                  }`}
                >
                  {i + 1}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`flex flex-wrap items-center gap-2 text-sm font-semibold ${
                    step.done ? 'text-gray-400' : 'text-gray-900'
                  }`}
                >
                  {displayStep.title}
                  {step.due && !step.done && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        step.urgent
                          ? 'bg-red-100 text-red-700'
                          : 'bg-brand-tint text-brand-strong'
                      }`}
                    >
                      {t(lang, 'next.due', { date: formatDueChip(step.due, lang) })}
                    </span>
                  )}
                </p>
                {displayStep.detail && (
                  <p className={`mt-0.5 text-sm ${step.done ? 'text-gray-400' : 'text-gray-600'}`}>
                    {displayStep.detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {hasDatedDeadline && (
        <a
          href="/api/profile/deadlines"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-brand hover:text-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          {t(lang, 'next.calendar')}
        </a>
      )}
    </section>
  );
}

type SupportKindMeta = {
  key: string;
  title: string;
  titleEs?: string;
  description?: string;
  descriptionEs?: string;
};

type DownloadStatus = 'idle' | 'downloading' | 'error';

/**
 * "Papers you can create" — the support documents available for the user's
 * state, one card per kind, each filled in from the life story on download.
 * Two special kinds: 'answer' links to /respond (it needs the user's
 * admit/deny choices, not a one-click PDF), and 'lawyer_handoff' gets an
 * emphasized card of its own. Renders only when the profile has a state
 * AND GET /api/documents/support answers — endpoint missing, no panel.
 */
function PapersPanel({ profile, lang }: { profile: Record<string, unknown>; lang: Lang }) {
  const [kinds, setKinds] = useState<SupportKindMeta[]>([]);
  const [status, setStatus] = useState<Record<string, DownloadStatus>>({});

  const state = typeof profile.state === 'string' ? profile.state.trim().toUpperCase() : '';
  const perspective = detectPerspective(profile);

  useEffect(() => {
    setKinds([]);
    if (!state) return;
    let cancelled = false;
    fetch(`/api/documents/support?state=${encodeURIComponent(state)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success) return;
        const list = json.data?.kinds;
        if (!Array.isArray(list)) return;
        setKinds(
          list.filter(
            (k): k is SupportKindMeta =>
              Boolean(k) && typeof k.key === 'string' && typeof k.title === 'string',
          ),
        );
      })
      .catch(() => {}); // best-effort: no catalog, no panel
    return () => {
      cancelled = true;
    };
  }, [state]);

  // Blob-anchor download, same pattern as the serve-page helper forms.
  const download = useCallback(
    async (kind: string) => {
      setStatus((s) => ({ ...s, [kind]: 'downloading' }));
      try {
        const res = await fetch('/api/documents/support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, state }),
        });
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${kind.replace(/_/g, '-')}-${state}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setStatus((s) => ({ ...s, [kind]: 'idle' }));
      } catch (err) {
        console.error('Support document download failed:', err);
        setStatus((s) => ({ ...s, [kind]: 'error' }));
        setTimeout(() => setStatus((s) => ({ ...s, [kind]: 'idle' })), 4000);
      }
    },
    [state],
  );

  if (!state || kinds.length === 0) return null;

  const title = (k: SupportKindMeta) => (lang === 'es' && k.titleEs) || k.title;
  const description = (k: SupportKindMeta) =>
    (lang === 'es' && k.descriptionEs) || k.description || '';

  const relevantKinds = kinds.filter((kind) => supportKindVisible(kind.key, perspective, profile));
  const handoff = relevantKinds.find((k) => k.key === 'lawyer_handoff');
  const rows = relevantKinds.filter((k) => k.key !== 'lawyer_handoff');

  return (
    <section aria-label={t(lang, 'docs.aria')} className="mt-10 font-sans">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
        {t(lang, 'docs.heading')}
      </h2>
      <p className="mt-2 text-sm text-gray-500">{t(lang, 'docs.intro')}</p>

      <div className="mt-4 space-y-2">
        {rows.map((kind) => (
          <div
            key={kind.key}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="min-w-0 flex-1 basis-56">
              <h3 className="text-sm font-semibold text-gray-900">{title(kind)}</h3>
              {kind.key === 'answer' ? (
                <p className="mt-0.5 text-sm text-gray-600">{t(lang, 'docs.answerNote')}</p>
              ) : (
                description(kind) && (
                  <p className="mt-0.5 text-sm text-gray-600">{description(kind)}</p>
                )
              )}
              {status[kind.key] === 'error' && (
                <p className="mt-1 text-sm text-red-600">{t(lang, 'docs.error')}</p>
              )}
            </div>
            {kind.key === 'answer' ? (
              <a
                href="/respond"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-brand hover:text-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t(lang, 'docs.answerCta')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <button
                onClick={() => download(kind.key)}
                disabled={status[kind.key] === 'downloading'}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-brand hover:text-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
              >
                {status[kind.key] === 'downloading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                {status[kind.key] === 'downloading'
                  ? t(lang, 'docs.preparing')
                  : t(lang, 'docs.download')}
              </button>
            )}
          </div>
        ))}

        {/* Taking the case to a lawyer — emphasized handoff card. */}
        {handoff && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-soft bg-brand-tint/50 p-4">
            <Briefcase className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <div className="min-w-0 flex-1 basis-56">
              <h3 className="text-sm font-semibold text-gray-900">
                {t(lang, 'docs.handoffTitle')}
              </h3>
              <p className="mt-0.5 text-sm text-gray-600">{t(lang, 'docs.handoffBody')}</p>
              {status[handoff.key] === 'error' && (
                <p className="mt-1 text-sm text-red-600">{t(lang, 'docs.error')}</p>
              )}
            </div>
            <button
              onClick={() => download(handoff.key)}
              disabled={status[handoff.key] === 'downloading'}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              {status[handoff.key] === 'downloading' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {status[handoff.key] === 'downloading'
                ? t(lang, 'docs.preparing')
                : t(lang, 'docs.download')}
            </button>
          </div>
        )}
      </div>

      {/* Check-our-work + hearing-prep pointers. */}
      <div className="mt-3 space-y-1.5 text-sm">
        {state === 'UT' && (
          <p className="text-gray-600">
            {t(lang, 'docs.ocapPre')}
            <a
              href="https://www.utcourts.gov/ocap/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-brand-strong underline hover:text-brand"
            >
              {t(lang, 'docs.ocapLink')}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            .
          </p>
        )}
        <p>
          <a
            href="/hearing"
            className="inline-flex items-center gap-1.5 font-semibold text-brand-strong underline hover:text-brand"
          >
            <Gavel className="h-4 w-4" aria-hidden="true" />
            {t(lang, 'docs.hearing')}
          </a>
        </p>
      </div>
    </section>
  );
}

/**
 * "Also on the record" — every legal detail, known or still blank.
 * Labels carry plain-language explanations; blanks open the chat with an
 * "I want to add…" message prefilled.
 */
function RecordLedger({
  profile,
  lang,
  onAsk,
}: {
  profile: Record<string, unknown>;
  lang: Lang;
  onAsk: (topic: string) => void;
}) {
  const items = buildLedger(profile, lang);
  const glossary = getGlossary(lang);
  return (
    <section aria-label={t(lang, 'ledger.aria')} className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
        {t(lang, 'ledger.heading')}
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-gray-200 bg-white p-6 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                item.value ? 'bg-brand' : 'border border-gray-300 bg-transparent'
              }`}
            />
            <div className="min-w-0">
              <dt className="text-xs text-gray-500">
                {glossary[item.label] ? (
                  <Tooltip term={item.label} definition={glossary[item.label]} />
                ) : (
                  item.label
                )}
              </dt>
              <dd className="text-sm font-medium text-gray-800">
                {item.value ?? (
                  <button
                    onClick={() => onAsk(item.key)}
                    className="border-b border-dotted border-gray-400 font-normal italic text-gray-400 transition-colors hover:border-brand hover:text-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    title={t(lang, 'story.addTitle')}
                  >
                    {t(lang, 'ledger.add')}
                  </button>
                )}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Fee-waiver eligibility hint. Deliberately hedged: general information
 * about a court process the user may qualify for, with a pointer to real
 * advice — never a determination.
 */
function FeeWaiverNote({ lang, onAsk }: { lang: Lang; onAsk: (topic: string) => void }) {
  return (
    <div className="mt-3 rounded-lg border border-brand-soft bg-brand-tint/50 p-3 font-sans text-sm text-gray-700">
      {t(lang, 'feeWaiver.p1a')}
      <span className="font-semibold">{t(lang, 'feeWaiver.may')}</span>
      {t(lang, 'feeWaiver.p1b')}{' '}
      <button
        onClick={() => onAsk('fee_waiver')}
        className="font-semibold text-brand-strong underline hover:text-brand"
      >
        {t(lang, 'feeWaiver.add')}
      </button>
      {t(lang, 'feeWaiver.p2a')}
      <a
        href="https://www.lawhelp.org/find-help"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-brand-strong underline hover:text-brand"
      >
        {t(lang, 'feeWaiver.legalAid')}
      </a>
      {t(lang, 'feeWaiver.p2b')}
    </div>
  );
}

/** Segmented "how much of your story is told" meter. */
function StoryMeter({ known, total, lang }: { known: number; total: number; lang: Lang }) {
  const progress = t(lang, 'meter.progress', { known, total });
  return (
    <div className="font-sans">
      <div className="flex items-center gap-1.5" role="img" aria-label={progress}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-5 rounded-full ${i < known ? 'bg-brand' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-gray-500">
        {known === total ? t(lang, 'meter.complete') : progress}
      </p>
    </div>
  );
}

function RecitalLine({
  recital,
  index,
  lang,
  visual,
  onAsk,
}: {
  recital: Recital;
  index: number;
  lang: Lang;
  visual?: React.ReactNode;
  onAsk?: (topic: string) => void;
}) {
  return (
    <li className="life-story-line flex gap-4" style={{ animationDelay: `${150 + index * 120}ms` }}>
      <span
        aria-hidden="true"
        className="mt-1 w-6 shrink-0 select-none text-right font-sans text-sm font-semibold tabular-nums text-gray-300"
      >
        {index + 1}.
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg leading-relaxed text-gray-800 sm:text-xl">
          {recital.segments.map((segment, i) => (
            <SegmentSpan
              key={i}
              segment={segment}
              lang={lang}
              onAsk={onAsk ? () => onAsk(recital.id) : undefined}
            />
          ))}
        </p>
        {visual}
      </div>
    </li>
  );
}

/** Persistent (not dismissable) note when an issue calls for a lawyer. */
function AdvisorBanner({
  flags,
  lang,
}: {
  flags: Array<{ key: string; label: string }>;
  lang: Lang;
}) {
  if (flags.length === 0) return null;
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 font-sans">
      <Scale className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <p className="text-sm text-amber-900">
        <span className="font-semibold">
          {t(lang, 'advisor.lead')}
          {flags.map((f) => f.label).join(', ')}.
        </span>
        {t(lang, 'advisor.body')}
        <a
          href="https://www.lawhelp.org/find-help"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline hover:text-amber-700"
        >
          LawHelp.org
        </a>
        .
      </p>
    </div>
  );
}

type ChildDraft = { name: string; dob: string };

/** "Fix my story" — direct edits to the core facts, saved via PATCH. */
function EditStoryPanel({
  profile,
  lang,
  onSaved,
  onClose,
}: {
  profile: Record<string, unknown>;
  lang: Lang;
  onSaved: () => void;
  onClose: () => void;
}) {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const initialChildren = (Array.isArray(profile.children) ? profile.children : []) as ProfileChild[];
  const initialRole = s(profile.role) === 'respondent' ? 'respondent' : s(profile.role) === 'petitioner' ? 'petitioner' : '';
  const [role, setRole] = useState(initialRole);
  const [name, setName] = useState(
    s(profile.affiantName) ||
      (initialRole === 'respondent' ? s(profile.respondentName) : s(profile.petitionerName)),
  );
  const [spouse, setSpouse] = useState(
    initialRole === 'respondent' ? s(profile.petitionerName) : s(profile.respondentName),
  );
  const [marriageDate, setMarriageDate] = useState(s(profile.marriageDate));
  const [separationDate, setSeparationDate] = useState(s(profile.separationDate));
  const [children, setChildren] = useState<ChildDraft[]>(
    initialChildren.map((c) => ({ name: s(c.name), dob: s(c.dob) || s(c.dateOfBirth) || s(c.birthDate) })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const splitName = (full: string): [string, string] => {
    const parts = full.trim().split(/\s+/);
    return [parts[0] || '', parts.slice(1).join(' ')];
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const [firstName, lastName] = splitName(name);
      const [spouseFirst, spouseLast] = splitName(spouse);
      const respondent = role === 'respondent';
      const patch: Record<string, unknown> = {
        role: role || null,
        affiantName: name.trim(),
        firstName,
        lastName,
        petitionerName: respondent ? spouse.trim() : name.trim(),
        petitionerFirstName: respondent ? spouseFirst : firstName,
        petitionerLastName: respondent ? spouseLast : lastName,
        respondentName: respondent ? name.trim() : spouse.trim(),
        respondentFirstName: respondent ? firstName : spouseFirst,
        respondentLastName: respondent ? lastName : spouseLast,
        marriageDate: marriageDate.trim(),
        separationDate: separationDate.trim(),
        children: children
          .filter((c) => c.name.trim() !== '')
          .map((c) => ({ name: c.name.trim(), dob: c.dob.trim() })),
      };
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || t(lang, 'edit.saveFailed'));
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 font-sans">
      <h3 className="font-semibold text-gray-900">{t(lang, 'edit.title')}</h3>
      <p className="mt-1 text-sm text-gray-500">{t(lang, 'edit.body')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-gray-600">{t(lang, 'edit.role')}</span>
          <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t(lang, 'edit.roleUnknown')}</option>
            <option value="petitioner">{t(lang, 'edit.rolePetitioner')}</option>
            <option value="respondent">{t(lang, 'edit.roleRespondent')}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">{t(lang, 'edit.yourName')}</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">{t(lang, 'edit.spouseName')}</span>
          <input className={field} value={spouse} onChange={(e) => setSpouse(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">{t(lang, 'edit.marriageDate')}</span>
          <input className={field} placeholder="YYYY-MM-DD" value={marriageDate} onChange={(e) => setMarriageDate(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-gray-600">{t(lang, 'edit.separationDate')}</span>
          <input className={field} placeholder="YYYY-MM-DD" value={separationDate} onChange={(e) => setSeparationDate(e.target.value)} />
        </label>
      </div>
      <div className="mt-4">
        <span className="mb-1 block text-sm text-gray-600">{t(lang, 'edit.children')}</span>
        <div className="space-y-2">
          {children.map((child, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={field}
                placeholder={t(lang, 'edit.childName')}
                value={child.name}
                onChange={(e) =>
                  setChildren(children.map((c, j) => (j === i ? { ...c, name: e.target.value } : c)))
                }
              />
              <input
                className={field}
                placeholder={t(lang, 'edit.childDob')}
                value={child.dob}
                onChange={(e) =>
                  setChildren(children.map((c, j) => (j === i ? { ...c, dob: e.target.value } : c)))
                }
              />
              <button
                onClick={() => setChildren(children.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label={t(lang, 'edit.removeChild', {
                  name: child.name || t(lang, 'edit.aChild'),
                })}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setChildren([...children, { name: '', dob: '' }])}
            className="text-sm font-semibold text-brand-strong hover:text-brand"
          >
            {t(lang, 'edit.addChild')}
          </button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t(lang, 'edit.save')}
        </button>
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-lg px-3.5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          {t(lang, 'edit.cancel')}
        </button>
      </div>
    </div>
  );
}

/** Paste a court paper you received — or add a photo of it; events land on
 * the timeline, its statements join the record labeled with the document
 * they came from. */
function IngestPanel({
  lang,
  onDone,
  onClose,
}: {
  lang: Lang;
  onDone: (summary: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [photo, setPhoto] = useState<{ name: string; dataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handlePhoto = (file: File | undefined) => {
    setError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setError(t(lang, 'ingest.errType'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError(t(lang, 'ingest.errSize'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto({ name: file.name, dataUrl: String(reader.result) });
    reader.onerror = () => setError(t(lang, 'ingest.errRead'));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/profile/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          photo
            ? { imageBase64: photo.dataUrl, label: label || undefined }
            : { text, label: label || undefined },
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || t(lang, 'ingest.errFail'));
      const d = json.data || {};
      const events = d.eventsAdded || 0;
      const facts = d.factsAdded || 0;
      onDone(
        t(lang, 'ingest.summary', {
          kind: d.documentKind || t(lang, 'ingest.defaultKind'),
          events,
          eventsNoun: t(lang, events === 1 ? 'ingest.event' : 'ingest.events'),
          facts,
          factsNoun: t(lang, facts === 1 ? 'ingest.statement' : 'ingest.statements'),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 font-sans">
      <h3 className="font-semibold text-gray-900">{t(lang, 'ingest.title')}</h3>
      <p className="mt-1 text-sm text-gray-500">{t(lang, 'ingest.body')}</p>
      <input
        className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        placeholder={t(lang, 'ingest.labelPlaceholder')}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={120}
      />
      <textarea
        className="mt-2 h-40 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        placeholder={
          photo ? t(lang, 'ingest.textPlaceholderPhoto') : t(lang, 'ingest.textPlaceholder')
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={20000}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id="ingest-photo-input"
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            handlePhoto(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <label
          htmlFor="ingest-photo-input"
          className={`cursor-pointer rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          {photo ? t(lang, 'ingest.photoChange') : t(lang, 'ingest.photoAdd')}
        </label>
        {photo && (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
            <span className="max-w-[16rem] truncate" title={photo.name}>
              {photo.name}
            </span>
            <button
              onClick={() => setPhoto(null)}
              disabled={busy}
              className="font-semibold text-gray-500 hover:text-gray-900"
              aria-label={t(lang, 'ingest.photoRemoveAria')}
            >
              {t(lang, 'ingest.photoRemove')}
            </button>
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={busy || (!photo && text.trim().length < 40)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy && photo ? t(lang, 'ingest.submitBusyPhoto') : t(lang, 'ingest.submit')}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          className="rounded-lg px-3.5 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          {t(lang, 'edit.cancel')}
        </button>
      </div>
    </div>
  );
}

export default function LifeStoryClient() {
  const router = useRouter();
  // Language starts as 'en' so the first client render matches the
  // server-rendered HTML; the saved/browser preference applies in an
  // effect right after hydration.
  const [lang, setLangState] = useState<Lang>('en');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [facts, setFacts] = useState<Array<Record<string, unknown>>>([]);
  const [confirmingErase, setConfirmingErase] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [latestDraftId, setLatestDraftId] = useState<string | null>(null);
  const [waitingNote, setWaitingNote] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'edit' | 'ingest'>('none');
  const [ingestSummary, setIngestSummary] = useState('');

  const loadProfile = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await fetch('/api/profile');
      const json = (await res.json()) as ProfileResponse;
      if (!res.ok || !json.success) throw new Error(json.error || 'Request failed');
      setProfile(json.data?.profile ?? {});
      setFacts(Array.isArray(json.data?.facts) ? json.data.facts : []);
      setLoadState('ready');
    } catch (err) {
      console.error('Failed to load life story:', err);
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    setLangState(getInitialLang());
  }, []);

  const chooseLang = useCallback((next: Lang) => {
    setLangState(next);
    setLang(next); // persists to localStorage for future visits
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Most recent draft = where "add this" gap-taps resume the conversation.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/documents')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.success) return;
        const docs = (json.data?.documents ?? []) as Array<{ id: unknown; status?: unknown }>;
        const draft = docs.find((d) => d.status === 'draft') ?? docs[0];
        if (draft?.id !== undefined) setLatestDraftId(String(draft.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // State waiting period (authoritative per-state template metadata) for
  // the timeline's procedural note. Divorce stories only.
  useEffect(() => {
    const state = typeof profile.state === 'string' ? profile.state.trim().toUpperCase() : '';
    if (!state || (!profile.marriageDate && !profile.groundsForDivorce)) {
      setWaitingNote(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/templates/divorce/requirements/${state}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success) return;
        const days = Number(json.data?.waitingPeriod?.days);
        const stateName = String(json.data?.stateName || state);
        setWaitingNote(
          Number.isFinite(days)
            ? waitingPeriodNote(profile, days, stateName, new Date(), lang)
            : null,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profile, lang]);

  // Tapping a gap opens the chat with the user's own "I want to add…"
  // message prefilled (they can edit it before sending) — data completion
  // in their words, not advice from us.
  const handleAsk = useCallback(
    (topic: string) => {
      const target = latestDraftId ? `/editor/${latestDraftId}` : '/editor/new';
      router.push(`${target}?ask=${encodeURIComponent(topic)}`);
    },
    [latestDraftId, router],
  );

  const handleErase = async () => {
    setErasing(true);
    try {
      const res = await fetch('/api/profile', { method: 'DELETE' });
      const json = (await res.json()) as ProfileResponse;
      if (!res.ok || !json.success) throw new Error(json.error || 'Request failed');
      setProfile({});
      setFacts([]);
      setConfirmingErase(false);
    } catch (err) {
      console.error('Failed to erase life story:', err);
    } finally {
      setErasing(false);
    }
  };

  const recitals = buildRecitals(profile, lang);
  const chapters = groupFacts(facts, lang);
  const children = (Array.isArray(profile.children) ? profile.children : []) as ProfileChild[];
  const progress = storyProgress(profile);
  const isEmpty =
    recitals.every((r) => !r.known) && children.length === 0 && chapters.length === 0;

  const flags = advisorFlags(profile, lang);
  const showQuickExit = profile.hasProtectiveOrder === true;

  // Each recital can carry an illustration beneath its sentence.
  const visualFor = (recital: Recital): React.ReactNode => {
    if (recital.id === 'marriage') {
      return (
        <>
          <LifeTimeline profile={profile} lang={lang} />
          {waitingNote && (
            <p className="mt-1 font-sans text-xs text-gray-500">{waitingNote}</p>
          )}
        </>
      );
    }
    if (recital.id === 'finances') {
      return (
        <>
          <MoneyBars profile={profile} lang={lang} />
          {feeWaiverHint(profile) && <FeeWaiverNote lang={lang} onAsk={handleAsk} />}
        </>
      );
    }
    return null;
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Recital lines write themselves in on load; static under reduced motion. */}
      <style>{`
        .life-story-line { opacity: 0; animation: lifeStoryWrite 0.5s ease-out forwards; }
        @keyframes lifeStoryWrite {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .life-story-line { animation: none; opacity: 1; }
        }
      `}</style>

      {showQuickExit && <QuickExit />}

      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft className="h-4 w-4" />
          {t(lang, 'nav.dashboard')}
        </button>

        {/* EN/ES pill — the choice persists (localStorage) across visits. */}
        <div
          role="group"
          aria-label={t(lang, 'lang.toggleAria')}
          className="inline-flex rounded-full border border-gray-300 p-0.5 font-sans"
        >
          {(['en', 'es'] as const).map((code) => (
            <button
              key={code}
              onClick={() => chooseLang(code)}
              aria-pressed={lang === code}
              aria-label={t(lang, `lang.${code}`)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                lang === code
                  ? 'bg-brand text-brand-on'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {code === 'en' ? 'EN' : 'ES'}
            </button>
          ))}
        </div>
      </div>

      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            {t(lang, 'header.eyebrow')}
          </p>
          <h1 className="font-serif text-4xl text-gray-900 sm:text-5xl">
            {t(lang, 'header.title')}
          </h1>
          <p className="mt-3 max-w-xl text-gray-600">{t(lang, 'header.subtitle')}</p>
        </div>
        {loadState === 'ready' && !isEmpty && (
          <StoryMeter known={progress.known} total={progress.total} lang={lang} />
        )}
      </header>

      {loadState === 'loading' && (
        <div className="rounded-2xl border border-gray-200 bg-[#FDFCF9] p-8 shadow-sm sm:p-10">
          <div className="space-y-5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-6 rounded bg-gray-100" />
                <div className="h-4 rounded bg-gray-100" style={{ width: `${72 - i * 14}%` }} />
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t(lang, 'loading.opening')}
          </p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-700">{t(lang, 'error.cantOpen')}</p>
          <button
            onClick={loadProfile}
            className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong"
          >
            {t(lang, 'error.tryAgain')}
          </button>
        </div>
      )}

      {loadState === 'ready' && isEmpty && (
        <div className="rounded-2xl border border-gray-200 bg-[#FDFCF9] p-10 text-center shadow-sm sm:p-14">
          <Feather className="mx-auto h-8 w-8 text-brand" aria-hidden="true" />
          <h2 className="mt-4 font-serif text-2xl text-gray-900">{t(lang, 'empty.title')}</h2>
          <p className="mx-auto mt-2 max-w-md text-gray-600">{t(lang, 'empty.body')}</p>
          <span className="mx-auto mt-6 block max-w-xs border-b-2 border-dotted border-gray-300 pb-1 font-serif text-lg italic text-gray-300">
            {t(lang, 'empty.blank')}
          </span>
          <button
            onClick={() => router.push('/editor/new')}
            className="mt-8 rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-on transition-colors hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {t(lang, 'empty.cta')}
          </button>
        </div>
      )}

      {loadState === 'ready' && !isEmpty && (
        <>
          <AdvisorBanner flags={flags} lang={lang} />

          {ingestSummary && (
            <div className="mb-6 rounded-xl border border-brand-soft bg-brand-tint/50 p-4 font-sans text-sm text-gray-700">
              {ingestSummary}
            </div>
          )}

          {/* The story — numbered recitals, each with its illustration. */}
          <section
            aria-label={t(lang, 'story.aria')}
            className="rounded-2xl border border-gray-200 bg-[#FDFCF9] p-8 shadow-sm sm:p-10"
          >
            <ol className="space-y-7 font-serif">
              {recitals.map((recital, index) => (
                <RecitalLine
                  key={recital.id}
                  recital={recital}
                  index={index}
                  lang={lang}
                  visual={visualFor(recital)}
                  onAsk={handleAsk}
                />
              ))}

              {(children.length > 0 || profile.hasMinorChildren === false) && (
                <li
                  className="life-story-line flex gap-4"
                  style={{ animationDelay: `${150 + recitals.length * 120}ms` }}
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 w-6 shrink-0 select-none text-right font-sans text-sm font-semibold tabular-nums text-gray-300"
                  >
                    {recitals.length + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg leading-relaxed text-gray-800 sm:text-xl">
                      {children.length === 0
                        ? t(lang, 'children.none')
                        : children.length === 1
                          ? t(lang, 'children.one')
                          : t(lang, 'children.many', { n: children.length })}
                    </p>
                    {children.length > 0 && <FamilyPortrait profile={profile} lang={lang} />}
                  </div>
                </li>
              )}
            </ol>
          </section>

          {/* Story actions: fix details directly, or read in a court paper. */}
          <div className="mt-4 flex flex-wrap gap-2 font-sans">
            <button
              onClick={() => setPanel(panel === 'edit' ? 'none' : 'edit')}
              className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-brand hover:text-brand-strong"
            >
              {t(lang, 'actions.fix')}
            </button>
            <button
              onClick={() => setPanel(panel === 'ingest' ? 'none' : 'ingest')}
              className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-brand hover:text-brand-strong"
            >
              {t(lang, 'actions.addPaper')}
            </button>
          </div>

          {panel === 'edit' && (
            <EditStoryPanel
              profile={profile}
              lang={lang}
              onSaved={() => {
                setPanel('none');
                loadProfile();
              }}
              onClose={() => setPanel('none')}
            />
          )}
          {panel === 'ingest' && (
            <IngestPanel
              lang={lang}
              onDone={(summary) => {
                setPanel('none');
                setIngestSummary(summary);
                loadProfile();
              }}
              onClose={() => setPanel('none')}
            />
          )}

          {/* The procedural roadmap — where the user is on the usual path. */}
          <WhatsNext profile={profile} lang={lang} />

          {/* Support documents the user can generate from this story. */}
          <PapersPanel profile={profile} lang={lang} />

          {/* Legal details ledger — known values and dotted gaps alike. */}
          <RecordLedger profile={profile} lang={lang} onAsk={handleAsk} />

          {/* Chapters — the facts, in the user's own words. */}
          {chapters.length > 0 && (
            <section aria-label={t(lang, 'chapters.aria')} className="mt-10">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                {t(lang, 'chapters.heading')}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {chapters.map((chapter) => {
                  const Icon = CHAPTER_ICONS[chapter.label] ?? Sparkles;
                  return (
                    <div
                      key={chapter.label}
                      className="rounded-xl border border-gray-200 bg-white p-5"
                    >
                      <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-tint">
                          <Icon className="h-4 w-4 text-brand" aria-hidden="true" />
                        </span>
                        {chapter.label}
                      </h3>
                      <ul className="mt-3 space-y-2.5">
                        {chapter.facts.map((fact, i) => (
                          <li key={i} className="flex gap-2 font-serif text-gray-700">
                            <Quote
                              className="mt-1.5 h-3 w-3 shrink-0 -scale-x-100 text-gray-300"
                              aria-hidden="true"
                            />
                            <span>
                              {fact.content}
                              {fact.provenance && (
                                <span className="mt-0.5 block font-sans text-xs text-gray-400">
                                  {fact.provenance}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Privacy — the story belongs to the user. */}
          <section
            aria-label={t(lang, 'privacy.aria')}
            className="mt-10 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{t(lang, 'privacy.title')}</span>{' '}
                {t(lang, 'privacy.body')}
              </p>
            </div>
            {confirmingErase ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleErase}
                  disabled={erasing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                >
                  {erasing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {t(lang, 'privacy.eraseAll')}
                </button>
                <button
                  onClick={() => setConfirmingErase(false)}
                  disabled={erasing}
                  className="rounded-lg px-3.5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900"
                >
                  {t(lang, 'privacy.keep')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingErase(true)}
                className="shrink-0 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-red-300 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                {t(lang, 'privacy.erase')}
              </button>
            )}
          </section>
          <CoffeeLink lang={lang} className="mt-8" />
        </>
      )}
    </main>
  );
}
