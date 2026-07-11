'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Banknote,
  Feather,
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
import {
  buildFamily,
  buildLedger,
  buildRecitals,
  buildTimeline,
  groupFacts,
  moneyLeftover,
  storyProgress,
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

const CHAPTER_ICONS: Record<string, LucideIcon> = {
  'Where you live': MapPin,
  'Why you are filing': Scale,
  'Your children': Users,
  'Your relationships': Heart,
  'Money matters': Banknote,
  'What you own': Banknote,
};

function SegmentSpan({ segment }: { segment: Segment }) {
  if (segment.kind === 'value') {
    return (
      <mark className="rounded bg-brand-tint px-1 font-medium text-brand-strong">
        {segment.text}
      </mark>
    );
  }
  if (segment.kind === 'blank') {
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
function FamilyPortrait({ profile }: { profile: Record<string, unknown> }) {
  const members = buildFamily(profile);
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
function LifeTimeline({ profile }: { profile: Record<string, unknown> }) {
  const timeline = buildTimeline(profile);
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
      <div className="relative mt-1.5 h-9 text-xs">
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
          <span className="block font-semibold text-gray-700">Today</span>
          <span className="block text-gray-400">{new Date().getFullYear()}</span>
        </span>
      </div>
    </div>
  );
}

/** Two thin labeled bars plus the bottom line: what's left each month. */
function MoneyBars({ profile }: { profile: Record<string, unknown> }) {
  const income = Number(profile.monthlyIncome);
  const expenses = Number(profile.monthlyExpenses);
  const rows = [
    { label: 'Comes in', amount: income, color: INK_IN },
    { label: 'Goes out', amount: expenses, color: INK_OUT },
  ].filter((r) => Number.isFinite(r.amount) && r.amount > 0);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.amount));
  const leftover = moneyLeftover(profile);

  return (
    <div className="mt-4 font-sans" aria-hidden="true">
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 text-gray-500">{row.label}</span>
            <div className="h-2.5 flex-1 rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(4, (row.amount / max) * 100)}%`, backgroundColor: row.color }}
              />
            </div>
            <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-gray-800">
              ${Math.round(row.amount).toLocaleString('en-US')}
              <span className="font-normal text-gray-400">/mo</span>
            </span>
          </div>
        ))}
      </div>
      {leftover !== null && leftover !== 0 && (
        <p className="mt-2 text-sm text-gray-500">
          ≈{' '}
          <span className="font-semibold text-gray-800">
            ${Math.abs(leftover).toLocaleString('en-US')}
          </span>{' '}
          {leftover > 0 ? 'left over each month' : 'short each month'}
        </p>
      )}
    </div>
  );
}

/** "Also on the record" — every legal detail, known or still blank. */
function RecordLedger({ profile }: { profile: Record<string, unknown> }) {
  const items = buildLedger(profile);
  return (
    <section aria-label="Legal details on record" className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
        Also on the record
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
              <dt className="text-xs text-gray-500">{item.label}</dt>
              <dd className="text-sm font-medium text-gray-800">
                {item.value ?? (
                  <span className="border-b border-dotted border-gray-300 font-normal italic text-gray-400">
                    not yet
                  </span>
                )}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Segmented "how much of your story is told" meter. */
function StoryMeter({ known, total }: { known: number; total: number }) {
  return (
    <div className="font-sans">
      <div className="flex items-center gap-1.5" role="img" aria-label={`${known} of ${total} story details shared`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-5 rounded-full ${i < known ? 'bg-brand' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-gray-500">
        {known === total
          ? 'Your core story is complete'
          : `${known} of ${total} story details shared`}
      </p>
    </div>
  );
}

function RecitalLine({
  recital,
  index,
  visual,
}: {
  recital: Recital;
  index: number;
  visual?: React.ReactNode;
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
            <SegmentSpan key={i} segment={segment} />
          ))}
        </p>
        {visual}
      </div>
    </li>
  );
}

export default function LifeStoryClient() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [facts, setFacts] = useState<Array<Record<string, unknown>>>([]);
  const [confirmingErase, setConfirmingErase] = useState(false);
  const [erasing, setErasing] = useState(false);

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
    loadProfile();
  }, [loadProfile]);

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

  const recitals = buildRecitals(profile);
  const chapters = groupFacts(facts);
  const children = (Array.isArray(profile.children) ? profile.children : []) as ProfileChild[];
  const progress = storyProgress(profile);
  const isEmpty =
    recitals.every((r) => !r.known) && children.length === 0 && chapters.length === 0;

  // Each recital can carry an illustration beneath its sentence.
  const visualFor = (recital: Recital): React.ReactNode => {
    if (recital.id === 'marriage') return <LifeTimeline profile={profile} />;
    if (recital.id === 'finances') return <MoneyBars profile={profile} />;
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

      <button
        onClick={() => router.push('/dashboard')}
        className="mb-8 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
      </button>

      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            In the matter of
          </p>
          <h1 className="font-serif text-4xl text-gray-900 sm:text-5xl">Your life story</h1>
          <p className="mt-3 max-w-xl text-gray-600">
            Everything your assistant remembers from your conversations — so you never
            have to repeat yourself, in any document.
          </p>
        </div>
        {loadState === 'ready' && !isEmpty && (
          <StoryMeter known={progress.known} total={progress.total} />
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
            Opening your story…
          </p>
        </div>
      )}

      {loadState === 'error' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-700">Your story couldn&apos;t be opened.</p>
          <button
            onClick={loadProfile}
            className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === 'ready' && isEmpty && (
        <div className="rounded-2xl border border-gray-200 bg-[#FDFCF9] p-10 text-center shadow-sm sm:p-14">
          <Feather className="mx-auto h-8 w-8 text-brand" aria-hidden="true" />
          <h2 className="mt-4 font-serif text-2xl text-gray-900">
            Your story hasn&apos;t started yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-gray-600">
            Start a document and tell the assistant about your situation. Everything
            you share is remembered here, ready for the next document.
          </p>
          <span className="mx-auto mt-6 block max-w-xs border-b-2 border-dotted border-gray-300 pb-1 font-serif text-lg italic text-gray-300">
            Your name is …
          </span>
          <button
            onClick={() => router.push('/editor/new')}
            className="mt-8 rounded-lg bg-brand px-5 py-2.5 font-semibold text-brand-on transition-colors hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Start your first document
          </button>
        </div>
      )}

      {loadState === 'ready' && !isEmpty && (
        <>
          {/* The story — numbered recitals, each with its illustration. */}
          <section
            aria-label="What your assistant knows"
            className="rounded-2xl border border-gray-200 bg-[#FDFCF9] p-8 shadow-sm sm:p-10"
          >
            <ol className="space-y-7 font-serif">
              {recitals.map((recital, index) => (
                <RecitalLine
                  key={recital.id}
                  recital={recital}
                  index={index}
                  visual={visualFor(recital)}
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
                        ? 'You have no minor children.'
                        : children.length === 1
                          ? 'You have one child.'
                          : `You have ${children.length} children.`}
                    </p>
                    {children.length > 0 && <FamilyPortrait profile={profile} />}
                  </div>
                </li>
              )}
            </ol>
          </section>

          {/* Legal details ledger — known values and dotted gaps alike. */}
          <RecordLedger profile={profile} />

          {/* Chapters — the facts, in the user's own words. */}
          {chapters.length > 0 && (
            <section aria-label="Facts you have shared" className="mt-10">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                In your own words
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
                            <span>{fact}</span>
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
            aria-label="Privacy"
            className="mt-10 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">This story is yours.</span>{' '}
                It stays private to your account and is used only to fill in your
                documents. Erasing it won&apos;t touch any saved documents.
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
                  Erase everything
                </button>
                <button
                  onClick={() => setConfirmingErase(false)}
                  disabled={erasing}
                  className="rounded-lg px-3.5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:text-gray-900"
                >
                  Keep it
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingErase(true)}
                className="shrink-0 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-red-300 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                Erase my story
              </button>
            )}
          </section>
        </>
      )}
    </main>
  );
}
