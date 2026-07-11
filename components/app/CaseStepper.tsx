'use client';

/**
 * Horizontal (wrapping on mobile) visual stepper for a pro se case.
 * Pure presentation: consumers fetch the profile + procedure, run
 * computeNextSteps/detectPerspective from lib/api/procedure, and hand the
 * result in as props. Node states:
 *   done    → filled brand circle with a check
 *   current → ring-highlighted brand circle (the first not-done step)
 *   future  → muted outline
 *   urgent  → red ring + red due text (a deadline needing attention)
 * The caption keeps the UPL framing: this is where a case generally is —
 * the court decides the real timeline.
 */

import { Check } from 'lucide-react';
import type { NextStep } from '@/lib/api/procedure';
import { t, type Lang } from '@/lib/i18n';

/** '2026-07-21' → 'Jul 21' (en) / '21 jul' (es); parsed as a local date. */
function formatDue(due: string, lang: Lang): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!m) return due;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function CaseStepper({
  steps,
  perspective,
  lang,
}: {
  steps: NextStep[];
  perspective: 'petitioner' | 'respondent';
  lang: Lang;
}) {
  if (steps.length === 0) return null;

  // "Current" = the first step not yet done (everything before it is done;
  // steps after it may independently be done, e.g. a waiting period that
  // ran out while service is still pending).
  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <nav
      aria-label={t(lang, 'stepper.aria')}
      data-perspective={perspective}
      className="font-sans"
    >
      <ol className="flex flex-wrap gap-y-5">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isUrgent = !step.done && step.urgent === true;

          // Connector halves: the line into a node reflects the previous
          // step's completion, the line out of it reflects this step's.
          const inLine = i > 0 && steps[i - 1].done ? 'bg-brand' : 'bg-gray-200';
          const outLine = step.done ? 'bg-brand' : 'bg-gray-200';

          let circle: string;
          if (step.done) {
            circle = 'bg-brand text-brand-on';
          } else if (isUrgent) {
            circle =
              'border-2 border-red-500 bg-white text-red-600 ring-2 ring-red-200';
          } else if (isCurrent) {
            circle =
              'border-2 border-brand bg-white text-brand-strong ring-2 ring-brand/30';
          } else {
            circle = 'border border-gray-300 bg-white text-gray-400';
          }

          return (
            <li
              key={step.key}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex min-w-[6.5rem] flex-1 basis-28 flex-col items-center text-center"
            >
              <div className="flex w-full items-center">
                <span
                  aria-hidden="true"
                  className={`h-0.5 flex-1 rounded ${i === 0 ? 'bg-transparent' : inLine}`}
                />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${circle}`}
                >
                  {step.done ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">{t(lang, 'stepper.stepDone')}</span>
                    </>
                  ) : (
                    <span aria-hidden="true">{i + 1}</span>
                  )}
                  {isCurrent && <span className="sr-only">{t(lang, 'stepper.stepCurrent')}</span>}
                </span>
                <span
                  aria-hidden="true"
                  className={`h-0.5 flex-1 rounded ${i === steps.length - 1 ? 'bg-transparent' : outLine}`}
                />
              </div>
              <p
                className={`mt-2 max-w-[8.5rem] px-1 text-xs font-semibold leading-tight ${
                  step.done ? 'text-gray-400' : isCurrent ? 'text-gray-900' : 'text-gray-500'
                }`}
                title={step.detail}
              >
                {step.title}
              </p>
              {step.due && !step.done && (
                <p
                  className={`mt-0.5 text-xs ${
                    isUrgent ? 'font-semibold text-red-600' : 'text-gray-400'
                  }`}
                >
                  {t(lang, 'stepper.due', { date: formatDue(step.due, lang) })}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-gray-500">{t(lang, 'stepper.caption')}</p>
    </nav>
  );
}
