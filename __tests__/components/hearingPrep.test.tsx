/**
 * Pure-helper tests for the "Your day in court" hearing-prep page:
 * deterministic prove-up practice questions and the "your dates" reference
 * lines, both built entirely from the stored life-story profile (no LLM).
 */

import {
  buildPracticeQuestions,
  buildYourDates,
} from '@/components/app/HearingPrepClient';

const FULL_PROFILE = {
  petitionerFirstName: 'Maria',
  petitionerLastName: 'Lopez',
  respondentName: 'Daniel Lopez',
  marriageDate: '2015-06-20',
  marriageLocation: 'Provo, Utah',
  separationDate: '2025-11-02',
  county: 'Utah',
  state: 'UT',
  residencyStateMonths: 48,
  groundsForDivorce: 'irreconcilable differences',
  propertyAgreement: 'agreed',
  custodyArrangement: 'joint',
  children: [
    { name: 'Sofia Lopez', dob: '2017-03-10' },
    { name: 'Leo Lopez', dob: '2020-08-01' },
  ],
  keyEvents: [
    { label: 'Petition filed', date: '2026-06-01', source: 'Court stamp' },
    { label: 'Respondent served', date: '2026-06-05' },
  ],
};

describe('buildPracticeQuestions', () => {
  it('always returns the full prove-up set, in order', () => {
    const ids = buildPracticeQuestions({}).map((q) => q.id);
    expect(ids).toEqual([
      'name',
      'marriage',
      'separation',
      'residency',
      'children',
      'grounds',
      'fair',
      'waiting',
    ]);
  });

  it('answers every question from a full profile', () => {
    const questions = buildPracticeQuestions(FULL_PROFILE, 'en', 30);
    const byId = Object.fromEntries(questions.map((q) => [q.id, q]));

    expect(byId.name.answer).toBe('Your name is Maria Lopez.');
    expect(byId.marriage.answer).toBe(
      'You were married on June 20, 2015 in Provo, Utah.',
    );
    expect(byId.separation.question).toContain('Daniel');
    expect(byId.separation.answer).toBe('You separated on November 2, 2025.');
    expect(byId.residency.question).toContain('Utah County');
    // Hedged: the question no longer asserts any state's residency period.
    expect(byId.residency.question).not.toMatch(/three months/i);
    expect(byId.residency.answer).toBe('You told us about 4 years.');
    expect(byId.children.answer).toBe(
      'Sofia Lopez (born March 10, 2017); Leo Lopez (born August 1, 2020)',
    );
    expect(byId.grounds.answer).toContain('irreconcilable differences');
    expect(byId.fair.answer).toBe('Your story says — Property: agreed. Custody: joint.');
  });

  it('computes the waiting-period end date from the filed key event', () => {
    const waiting = buildPracticeQuestions(FULL_PROFILE, 'en', 30).find(
      (q) => q.id === 'waiting',
    )!;
    expect(waiting.question).toBe(
      'Has the 30-day waiting period passed since you filed your petition?',
    );
    expect(waiting.answer).toBe(
      'Your papers show a filing on June 1, 2026; 30 days after that is July 1, 2026.',
    );
  });

  it('degrades to null answers on an empty profile', () => {
    const questions = buildPracticeQuestions({}, 'en', 30);
    expect(questions.every((q) => q.answer === null)).toBe(true);
    // Generic phrasing when the county is unknown.
    expect(questions.find((q) => q.id === 'residency')!.question).toContain('your county');
    expect(questions.find((q) => q.id === 'separation')!.question).toContain('your spouse');
  });

  it('treats an explicit "no minor children" as a real answer', () => {
    const questions = buildPracticeQuestions({ hasMinorChildren: false });
    expect(questions.find((q) => q.id === 'children')!.answer).toBe(
      'You told us you have no minor children.',
    );
  });

  it('does not treat adult children as minors', () => {
    const adultKidsProfile = {
      // California persona Alison — Ethan + Sofía are both adults.
      children: [
        { name: 'Ethan Rivera', dob: '1998-04-12' },
        { name: 'Sofía Rivera', dob: '2001-09-30' },
      ],
    };
    const answer = buildPracticeQuestions(adultKidsProfile).find(
      (q) => q.id === 'children',
    )!.answer;
    expect(answer).toBe(
      'Your children on record are adults and are not subject to custody orders.',
    );
    expect(answer).not.toMatch(/born/);
  });

  it('lists only minors when the child list is mixed', () => {
    const mixedProfile = {
      children: [
        { name: 'Ada Adult', dob: '1998-04-12' },
        { name: 'Min Minor', dob: '2015-06-20' },
      ],
    };
    const answer = buildPracticeQuestions(mixedProfile).find(
      (q) => q.id === 'children',
    )!.answer;
    expect(answer).toContain('Min Minor');
    expect(answer).not.toContain('Ada Adult');
  });

  it('phrases the waiting-period question generically without a known period', () => {
    const waiting = buildPracticeQuestions({}, 'en', null).find((q) => q.id === 'waiting')!;
    expect(waiting.question).toBe(
      'Has your state’s waiting period passed since you filed your petition?',
    );
    expect(waiting.answer).toBeNull();
  });

  it('humanizes residency durations: months under 24, years (and months) at 24+', () => {
    const answerFor = (months: number) =>
      buildPracticeQuestions({ residencyStateMonths: months }).find(
        (q) => q.id === 'residency',
      )!.answer;
    expect(answerFor(18)).toBe('You told us about 18 months.');
    expect(answerFor(24)).toBe('You told us about 2 years.');
    expect(answerFor(27)).toBe('You told us about 2 years and 3 months.');
    expect(answerFor(144)).toBe('You told us about 12 years.');
  });

  it('renders questions and answers in Spanish', () => {
    const questions = buildPracticeQuestions(FULL_PROFILE, 'es', 30);
    const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
    expect(byId.name.question).toBe('Por favor, di tu nombre para el registro.');
    expect(byId.name.answer).toBe('Tu nombre es Maria Lopez.');
    expect(byId.marriage.answer).toContain('20 de junio de 2015');
    expect(byId.residency.question).toContain('el condado de Utah');
    expect(byId.waiting.answer).toContain('30 días después');
  });
});

describe('buildYourDates', () => {
  it('formats key events as friendly reference lines', () => {
    expect(buildYourDates(FULL_PROFILE)).toEqual([
      { label: 'Petition filed', date: 'June 1, 2026' },
      { label: 'Respondent served', date: 'June 5, 2026' },
    ]);
  });

  it('keeps unparseable dates verbatim and skips incomplete entries', () => {
    const dates = buildYourDates({
      keyEvents: [
        { label: 'Hearing', date: 'sometime in fall' },
        { label: '', date: '2026-01-01' },
        { date: '2026-01-01' },
        null,
        'junk',
      ],
    });
    expect(dates).toEqual([{ label: 'Hearing', date: 'sometime in fall' }]);
  });

  it('returns an empty list when the profile has no key events', () => {
    expect(buildYourDates({})).toEqual([]);
    expect(buildYourDates({ keyEvents: 'oops' })).toEqual([]);
  });
});
