/**
 * @jest-environment node
 */
import { computeNextSteps, getProcedure } from '@/lib/api/procedure';
import type { StateProcedure } from '@/lib/api/procedure';

const UT = getProcedure('UT') as StateProcedure;

const keys = (steps: Array<{ key: string }>) => steps.map((s) => s.key);
const find = (steps: Array<{ key: string }>, key: string) =>
  steps.find((s) => s.key === key) as
    | { key: string; title: string; detail: string; due?: string; done: boolean }
    | undefined;

describe('procedure registry', () => {
  it('returns Utah for ut / UT', () => {
    expect(UT).not.toBeNull();
    expect(UT.stateCode).toBe('UT');
    expect(UT.stateName).toBe('Utah');
    expect(getProcedure('ut')?.stateCode).toBe('UT');
  });

  it('returns null for unknown states', () => {
    expect(getProcedure('XX')).toBeNull();
    expect(getProcedure('')).toBeNull();
  });

  it('carries the Utah statutory values', () => {
    expect(UT.residency.months).toBe(3);
    expect(UT.waitingPeriodDays).toBe(30);
    expect(UT.waitingWaivable).toBe(true);
    expect(UT.answerDeadlineDays).toEqual({ inState: 21, outOfState: 30 });
    expect(UT.unswornDeclaration.allowed).toBe(true);
    expect(UT.unswornDeclaration.wording).toContain('criminal penalty of the State of Utah');
    expect(UT.financialDisclosure.required).toBe(true);
    expect(UT.serviceMethods.map((m) => m.key)).toEqual(['acceptance', 'personal']);
  });
});

describe('computeNextSteps', () => {
  it('nothing filed: serve is first and not done, no answer/default, no due on waiting', () => {
    const steps = computeNextSteps({}, UT, new Date(2026, 5, 1));
    expect(keys(steps)).toEqual(['serve', 'waiting', 'financial', 'finalize']);
    expect(find(steps, 'serve')?.done).toBe(false);
    expect(find(steps, 'waiting')?.due).toBeUndefined();
    expect(find(steps, 'waiting')?.done).toBe(false);
    expect(find(steps, 'financial')?.done).toBe(false);
    expect(steps[steps.length - 1].key).toBe('finalize');
  });

  it('filed only: waiting period end due 30 days after filing', () => {
    const profile = { keyEvents: [{ label: 'Petition filed', date: '2026-06-20' }] };
    const steps = computeNextSteps(profile, UT, new Date(2026, 6, 1));
    const waiting = find(steps, 'waiting');
    expect(waiting?.due).toBe('2026-07-20');
    expect(waiting?.done).toBe(false);
    expect(find(steps, 'serve')?.done).toBe(false);
    expect(find(steps, 'answer')).toBeUndefined();
    expect(find(steps, 'default')).toBeUndefined();
  });

  it('filed + served: serve done, answer window due 21 days after service', () => {
    const profile = {
      keyEvents: [
        { label: 'Petition filed', date: '2026-06-20' },
        { label: 'Served respondent', date: '2026-06-28' },
      ],
    };
    const steps = computeNextSteps(profile, UT, new Date(2026, 6, 1));
    expect(find(steps, 'serve')?.done).toBe(true);
    const answer = find(steps, 'answer');
    expect(answer?.due).toBe('2026-07-19');
    expect(answer?.done).toBe(false);
    expect(find(steps, 'default')).toBeUndefined();
    // ordered: answer between serve and waiting
    expect(keys(steps)).toEqual(['serve', 'answer', 'waiting', 'financial', 'finalize']);
  });

  it('served + answer deadline passed + no answer: default step appears', () => {
    const profile = {
      keyEvents: [
        { label: 'Petition filed', date: '2026-06-20' },
        { label: 'Served respondent', date: '2026-06-28' },
      ],
    };
    const steps = computeNextSteps(profile, UT, new Date(2026, 6, 25));
    expect(find(steps, 'answer')).toBeUndefined();
    const dflt = find(steps, 'default');
    expect(dflt?.due).toBe('2026-07-19');
    expect(dflt?.done).toBe(false);
    // waiting period (due 2026-07-20) has also run by 2026-07-25
    expect(find(steps, 'waiting')?.done).toBe(true);
    // finalize detail follows the default path
    expect(find(steps, 'finalize')?.detail).toMatch(/default/i);
  });

  it('an answer on file suppresses the default step after the deadline', () => {
    const profile = {
      keyEvents: [
        { label: 'Served respondent', date: '2026-06-28' },
        { label: 'Answer filed', date: '2026-07-10' },
      ],
    };
    const steps = computeNextSteps(profile, UT, new Date(2026, 6, 25));
    expect(find(steps, 'default')).toBeUndefined();
    expect(find(steps, 'finalize')?.detail).not.toMatch(/default/i);
  });

  it('children add the education step; no children means no education step', () => {
    const withKids = computeNextSteps(
      { children: [{ name: 'Ava' }] },
      UT,
      new Date(2026, 5, 1),
    );
    const education = find(withKids, 'education');
    expect(education).toBeDefined();
    expect(education?.done).toBe(false);
    expect(find(computeNextSteps({}, UT, new Date(2026, 5, 1)), 'education')).toBeUndefined();
  });

  it('an education/orientation event marks the education step done', () => {
    const profile = {
      children: [{ name: 'Ava' }],
      keyEvents: [{ label: 'Divorce education course completed', date: '2026-06-15' }],
    };
    const steps = computeNextSteps(profile, UT, new Date(2026, 6, 1));
    expect(find(steps, 'education')?.done).toBe(true);
  });

  it('a financial event marks the financial declaration done', () => {
    const profile = { keyEvents: [{ label: 'Financial declaration served', date: '2026-06-15' }] };
    const steps = computeNextSteps(profile, UT, new Date(2026, 6, 1));
    expect(find(steps, 'financial')?.done).toBe(true);
  });

  it('serve detail follows the chosen service method', () => {
    const waiver = computeNextSteps({ serviceMethod: 'waiver' }, UT, new Date(2026, 5, 1));
    expect(find(waiver, 'serve')?.detail).toMatch(/Acceptance of Service/);
    const formal = computeNextSteps({ serviceMethod: 'formal' }, UT, new Date(2026, 5, 1));
    expect(find(formal, 'serve')?.detail).toMatch(/Personal service/);
  });

  it('parses dates defensively — junk event dates never produce deadlines', () => {
    const profile = {
      keyEvents: [
        { label: 'Petition filed', date: 'early spring 2026' },
        { label: 'Served respondent', date: '13/45/2026' },
      ],
    };
    const steps = computeNextSteps(profile, UT, new Date(2026, 6, 1));
    expect(find(steps, 'serve')?.done).toBe(true); // event exists, date unusable
    expect(find(steps, 'waiting')?.due).toBeUndefined();
    expect(find(steps, 'answer')).toBeUndefined();
    expect(find(steps, 'default')).toBeUndefined();
  });
});
