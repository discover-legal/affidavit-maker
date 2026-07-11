/**
 * State procedure metadata + "what's next" computation for
 * self-represented divorce litigants.
 *
 * Powers the What's-next panel, calendar deadlines, and form generation.
 * Everything here is INFORMATION about court procedure — statutory
 * citations live in code comments, and user-facing text stays plain
 * language and hedged ("generally", "may", "the court decides"). It is
 * never legal advice and never a prediction about a specific case.
 */
import { UT_PROCEDURE } from './ut';

export type StateProcedure = {
  stateCode: string;
  stateName: string;
  residency: { months: number; text: string };
  waitingPeriodDays: number;
  waitingPeriodText: string;
  waitingWaivable: boolean;
  answerDeadlineDays: { inState: number; outOfState: number };
  /** Plain-language text, or null when the state has no such requirement. */
  educationRequirement: string | null;
  serviceMethods: Array<{ key: string; title: string; steps: string[] }>;
  defaultJudgment: { eligibleAfterText: string; steps: string[] };
  unswornDeclaration: { allowed: boolean; statute: string; wording: string };
  financialDisclosure: { required: boolean; rule: string; text: string };
  filing: { feeText: string; whereText: string; copiesText: string };
};

const REGISTRY: Record<string, StateProcedure> = {
  UT: UT_PROCEDURE,
};

export function getProcedure(state: string): StateProcedure | null {
  const code = typeof state === 'string' ? state.trim().toUpperCase() : '';
  return REGISTRY[code] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// Next-steps computation
// ─────────────────────────────────────────────────────────────────────────

export type NextStep = {
  key: string;
  title: string;
  detail: string;
  /** Calendar deadline in YYYY-MM-DD, present when computable. */
  due?: string;
  done: boolean;
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Parse only unambiguous date shapes (ISO, US numeric, written month).
 * Reimplemented locally from components/app/lifeStory.ts parseKnownDate —
 * lib code must not import from components. V8's Date parser is far too
 * lenient ("early spring 2010" parses), and JS Date() rolls out-of-range
 * components forward (month 13 → next January), so we require an exact
 * round-trip instead of trusting `new Date(string)`.
 */
function parseKnownDate(raw: unknown): Date | null {
  const s = str(raw);
  if (!s) return null;
  const exact = (year: number, month: number, day: number): Date | null => {
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
      ? d
      : null;
  };
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (iso) return exact(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const usNumeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (usNumeric) {
    const year = Number(usNumeric[3].length === 2 ? `20${usNumeric[3]}` : usNumeric[3]);
    return exact(year, Number(usNumeric[1]), Number(usNumeric[2]));
  }
  const written = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/.exec(s);
  if (written) {
    const d = new Date(`${written[1]} ${written[2]}, ${written[3]}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Calendar-day arithmetic in local time (DST-safe via Date rollover). */
function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Local-time YYYY-MM-DD (toISOString would shift the day in non-UTC TZs). */
function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

type ParsedEvent = { label: string; date: Date | null };

/**
 * Ordered next steps for a divorce case in `procedure`'s state, computed
 * from the user's life-story profile (keyEvents labels like "Filed" /
 * "Served", children, serviceMethod). Pure function — no I/O.
 *
 * Dates are treated day-granular; a deadline "passes" at the end of its
 * calendar day. All detail text is information about procedure, not advice.
 */
export function computeNextSteps(
  profile: Record<string, unknown>,
  procedure: StateProcedure,
  now: Date = new Date(),
): NextStep[] {
  const rawEvents = Array.isArray(profile.keyEvents) ? profile.keyEvents : [];
  const events: ParsedEvent[] = rawEvents
    .map((e: unknown): ParsedEvent => {
      const rec = e && typeof e === 'object' ? (e as Record<string, unknown>) : {};
      return { label: str(rec.label), date: parseKnownDate(rec.date) };
    })
    .filter((e) => e.label.length > 0);

  // Prefer the first matching event that carries a parseable date.
  const findEvent = (re: RegExp): ParsedEvent | undefined =>
    events.find((e) => re.test(e.label) && e.date) ?? events.find((e) => re.test(e.label));

  const filed = findEvent(/fil/i);
  const served = findEvent(/serv/i);
  const answered = findEvent(/answer/i);
  const educationEvent = findEvent(/educat|orient/i);
  const financialEvent = findEvent(/financial/i);

  const children = Array.isArray(profile.children) ? profile.children : [];
  const hasChildren = children.length > 0;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const steps: NextStep[] = [];

  // 1. Serve the papers (method-appropriate detail).
  const method = str(profile.serviceMethod).toLowerCase();
  const acceptance = procedure.serviceMethods.find((m) => /accept|waiv/i.test(m.key));
  const personal = procedure.serviceMethods.find((m) => /personal|formal/i.test(m.key));
  let serveDetail: string;
  if (/waiv|accept/.test(method) && acceptance) {
    serveDetail = `${acceptance.title}: ${acceptance.steps.join(' ')}`;
  } else if (method && personal) {
    serveDetail = `${personal.title}: ${personal.steps.join(' ')}`;
  } else {
    serveDetail = `Your spouse generally must receive the papers before the case can move forward. Common options: ${procedure.serviceMethods
      .map((m) => m.title)
      .join('; ')}.`;
  }
  steps.push({
    key: 'serve',
    title: 'Serve your spouse',
    detail: serveDetail,
    done: Boolean(served),
  });

  // 2/3. Answer window vs. default eligibility, keyed off the served date.
  const answerDue = served?.date ? addDays(served.date, procedure.answerDeadlineDays.inState) : null;
  const answerWindowOpen = answerDue !== null && todayStart <= answerDue;
  const defaultEligible = answerDue !== null && todayStart > answerDue && !answered;

  if (answerDue && answerWindowOpen) {
    steps.push({
      key: 'answer',
      title: 'Answer window',
      detail:
        `Your spouse generally has ${procedure.answerDeadlineDays.inState} days after being served in ${procedure.stateName} ` +
        `(${procedure.answerDeadlineDays.outOfState} days if served outside ${procedure.stateName}) to file an answer. ` +
        'During this window they may agree, respond, or counter-petition; if they do nothing, you may be able to ask for a default.',
      due: isoDate(answerDue),
      done: Boolean(answered),
    });
  }

  if (answerDue && defaultEligible) {
    steps.push({
      key: 'default',
      title: 'Default may be available',
      detail: `${procedure.defaultJudgment.eligibleAfterText} ${procedure.defaultJudgment.steps.join(' ')}`,
      due: isoDate(answerDue),
      done: false,
    });
  }

  // 4. Waiting period end.
  const waitingEnd = filed?.date ? addDays(filed.date, procedure.waitingPeriodDays) : null;
  steps.push({
    key: 'waiting',
    title: 'Waiting period',
    detail: procedure.waitingPeriodText,
    ...(waitingEnd ? { due: isoDate(waitingEnd) } : {}),
    done: waitingEnd !== null && todayStart > waitingEnd,
  });

  // 5. Education courses — only relevant when there are minor children.
  if (hasChildren && procedure.educationRequirement) {
    steps.push({
      key: 'education',
      title: 'Parent education courses',
      detail: procedure.educationRequirement,
      done: Boolean(educationEvent),
    });
  }

  // 6. Financial disclosure — required in every divorce here.
  steps.push({
    key: 'financial',
    title: 'Financial declaration',
    detail: procedure.financialDisclosure.text,
    done: Boolean(financialEvent),
  });

  // 7. Finalize — last; the path differs for default vs. uncontested.
  steps.push({
    key: 'finalize',
    title: 'Finish the case',
    detail: defaultEligible
      ? 'If the court enters a default, you generally submit the final papers (findings, conclusions, and the proposed decree, with a supporting declaration) for the judge to review. The court decides whether to sign the decree.'
      : 'When the waiting period has run and the required steps are complete, you generally submit the final papers (the proposed decree and a supporting declaration). Uncontested cases are often finished on the papers without a hearing — the court decides whether one is needed.',
    done: false,
  });

  return steps;
}
