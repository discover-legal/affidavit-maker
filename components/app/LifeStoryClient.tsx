'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Feather, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import {
  buildRecitals,
  childBirthDate,
  computeAge,
  formatFriendlyDate,
  groupFacts,
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

function RecitalLine({ recital, index }: { recital: Recital; index: number }) {
  return (
    <li
      className="life-story-line flex gap-4"
      style={{ animationDelay: `${150 + index * 120}ms` }}
    >
      <span
        aria-hidden="true"
        className="mt-1 w-6 shrink-0 select-none text-right font-sans text-sm font-semibold tabular-nums text-gray-300"
      >
        {index + 1}.
      </span>
      <p className="text-lg leading-relaxed text-gray-800 sm:text-xl">
        {recital.segments.map((segment, i) => (
          <SegmentSpan key={i} segment={segment} />
        ))}
      </p>
    </li>
  );
}

function ChildChip({ child }: { child: ProfileChild }) {
  const age = computeAge(child);
  const dob = formatFriendlyDate(childBirthDate(child));
  return (
    <span
      className="inline-flex items-baseline gap-2 rounded-full border border-brand-soft bg-brand-tint/60 px-3.5 py-1.5"
      title={dob ? `Born ${dob}` : undefined}
    >
      <span className="font-serif text-base font-medium text-gray-900">
        {child.name || 'A child'}
      </span>
      {age !== null && <span className="text-sm text-brand-strong">{age}</span>}
    </span>
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
  const knownCount = recitals.filter((r) => r.known).length;
  const isEmpty = knownCount === 0 && children.length === 0 && chapters.length === 0;

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

      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          In the matter of
        </p>
        <h1 className="font-serif text-4xl text-gray-900 sm:text-5xl">Your life story</h1>
        <p className="mt-3 max-w-xl text-gray-600">
          Everything your assistant remembers from your conversations — so you never
          have to repeat yourself, in any document.
        </p>
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
          {/* The story — a warm page of numbered recitals, like the affidavits it feeds. */}
          <section
            aria-label="What your assistant knows"
            className="rounded-2xl border border-gray-200 bg-[#FDFCF9] p-8 shadow-sm sm:p-10"
          >
            <ol className="space-y-5 font-serif">
              {recitals.map((recital, index) => (
                <RecitalLine key={recital.id} recital={recital} index={index} />
              ))}

              {children.length > 0 && (
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
                  <div>
                    <p className="text-lg leading-relaxed text-gray-800 sm:text-xl">
                      {children.length === 1
                        ? 'You have one child.'
                        : `You have ${children.length} children.`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {children.map((child, i) => (
                        <ChildChip key={`${child.name || 'child'}-${i}`} child={child} />
                      ))}
                    </div>
                  </div>
                </li>
              )}
            </ol>
          </section>

          {/* Chapters — the facts, in the user's own words. */}
          {chapters.length > 0 && (
            <section aria-label="Facts you have shared" className="mt-10">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                In your own words
              </h2>
              <div className="mt-4 space-y-6">
                {chapters.map((chapter) => (
                  <div key={chapter.label}>
                    <h3 className="mb-2 font-semibold text-gray-900">{chapter.label}</h3>
                    <ul className="space-y-2">
                      {chapter.facts.map((fact, i) => (
                        <li
                          key={i}
                          className="border-l-2 border-brand-soft pl-4 font-serif text-gray-700"
                        >
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
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
