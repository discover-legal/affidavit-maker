/**
 * Pure helpers that turn a stored life-story profile (lib/api/profile.ts)
 * into the narrated "living affidavit" shown on /profile.
 *
 * A recital is one numbered sentence of the story. Known details render as
 * highlighted value tokens; missing ones render as dotted blanks so the
 * page shows both what the assistant knows and what it's still missing.
 */

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'value'; text: string }
  | { kind: 'blank'; text: string };

export type Recital = {
  id: string;
  segments: Segment[];
  /** true when at least one real value appears in the sentence */
  known: boolean;
};

export type ProfileChild = {
  name?: string;
  dob?: string;
  dateOfBirth?: string;
  birthDate?: string;
  age?: number | string;
};

const text = (t: string): Segment => ({ kind: 'text', text: t });
const value = (t: string): Segment => ({ kind: 'value', text: t });
const blank = (t: string): Segment => ({ kind: 'blank', text: t });

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Parse only unambiguous date shapes (ISO, US numeric, written month).
 * V8's Date parser is far too lenient — "early spring 2010" parses — and a
 * user's free-text answer must come back verbatim rather than mangled.
 */
export function parseKnownDate(raw: unknown): Date | null {
  const s = str(raw);
  if (!s) return null;
  // JS Date() rolls out-of-range components forward (month 13 → next
  // January), which would silently mangle "13/01/2015" (a DD/MM entry)
  // into a wrong-but-plausible date. Require an exact round-trip.
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

/** "2010-05-01" → "May 1, 2010"; anything unparseable comes back as-is. */
export function formatFriendlyDate(raw: unknown): string {
  const s = str(raw);
  if (!s) return '';
  const date = parseKnownDate(s);
  if (!date) return s;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function childBirthDate(child: ProfileChild): string {
  return str(child.dob) || str(child.dateOfBirth) || str(child.birthDate);
}

/** Age in whole years from a birth date, or null when unknown/unparseable. */
export function computeAge(child: ProfileChild, now: Date = new Date()): number | null {
  const dob = parseKnownDate(childBirthDate(child));
  if (dob && dob <= now) {
    let age = now.getFullYear() - dob.getFullYear();
    const hadBirthday =
      now.getMonth() > dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
    if (!hadBirthday) age -= 1;
    if (age >= 0 && age < 130) return age;
  }
  const numericAge = Number(child.age);
  if (Number.isFinite(numericAge) && numericAge >= 0 && numericAge < 130) return numericAge;
  return null;
}

function fullName(profile: Record<string, unknown>): string {
  return (
    str(profile.affiantName) ||
    [str(profile.petitionerFirstName), str(profile.petitionerLastName)].filter(Boolean).join(' ') ||
    str(profile.petitionerName) ||
    [str(profile.firstName), str(profile.lastName)].filter(Boolean).join(' ')
  );
}

function spouseName(profile: Record<string, unknown>): string {
  return (
    str(profile.respondentName) ||
    [str(profile.respondentFirstName), str(profile.respondentLastName)]
      .filter(Boolean)
      .join(' ')
  );
}

function marriagePlace(profile: Record<string, unknown>): string {
  return (
    str(profile.marriageLocation) ||
    [str(profile.marriageCity), str(profile.marriageStateName)].filter(Boolean).join(', ') ||
    str(profile.marriagePlace)
  );
}

function money(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Build the numbered recitals of the story. Identity, marriage, and home
 * always appear (with blanks when unknown) so the page invites completion;
 * the rest appear only once something is known.
 */
export function buildRecitals(profile: Record<string, unknown>): Recital[] {
  const recitals: Recital[] = [];

  // 1 — who you are
  const name = fullName(profile);
  recitals.push({
    id: 'identity',
    known: Boolean(name),
    segments: [
      text('Your name is '),
      name ? value(name) : blank('your name'),
      text('.'),
    ],
  });

  // 2 — your marriage
  const spouse = spouseName(profile);
  const married = formatFriendlyDate(profile.marriageDate);
  const place = marriagePlace(profile);
  const marriageSegments: Segment[] = [text('You married ')];
  marriageSegments.push(spouse ? value(spouse) : blank('your spouse'));
  marriageSegments.push(text(' on '));
  marriageSegments.push(married ? value(married) : blank('a date'));
  if (place) {
    marriageSegments.push(text(' in '), value(place));
  }
  marriageSegments.push(text('.'));
  const separated = formatFriendlyDate(profile.separationDate);
  if (separated) {
    marriageSegments.push(text(' You separated on '), value(separated), text('.'));
  }
  recitals.push({
    id: 'marriage',
    known: Boolean(spouse || married || place || separated),
    segments: marriageSegments,
  });

  // 3 — where you live
  const county = str(profile.county);
  const state = str(profile.state).toUpperCase();
  const homeSegments: Segment[] = [text('Home is ')];
  if (county || state) {
    homeSegments.push(value([county && `${county} County`, state].filter(Boolean).join(', ')));
  } else {
    homeSegments.push(blank('a place'));
  }
  const months = Number(profile.residencyStateMonths);
  if (Number.isFinite(months) && months > 0) {
    homeSegments.push(
      text(' — where you have lived for '),
      value(months === 1 ? '1 month' : `${months} months`),
    );
  }
  homeSegments.push(text('.'));
  recitals.push({
    id: 'home',
    known: Boolean(county || state),
    segments: homeSegments,
  });

  // 4 — money (only once shared)
  const income = money(profile.monthlyIncome);
  const expenses = money(profile.monthlyExpenses);
  if (income || expenses) {
    const segments: Segment[] = [];
    if (income) segments.push(text('About '), value(`${income} a month`), text(' comes in'));
    if (income && expenses) segments.push(text(', and '));
    if (expenses) {
      segments.push(
        text(income ? 'about ' : 'About '),
        value(`${expenses} a month`),
        text(' goes out'),
      );
    }
    segments.push(text('.'));
    const assets = str(profile.assetsDescription);
    if (assets) segments.push(text(' You own '), value(assets), text('.'));
    recitals.push({ id: 'finances', known: true, segments });
  }

  // 5 — safety (only when affirmatively shared; worded with care)
  if (profile.hasProtectiveOrder === true) {
    recitals.push({
      id: 'safety',
      known: true,
      segments: [text('A '), value('protective order'), text(' is in place.')],
    });
  }

  return recitals;
}

/** Human chapter titles for fact categories collected by the orchestrators. */
const CATEGORY_LABELS: Record<string, string> = {
  general: 'Your story',
  identity: 'About you',
  residency: 'Where you live',
  grounds: 'Why you are filing',
  children: 'Your children',
  property: 'What you own',
  support: 'Support',
  service: 'Serving papers',
  indigency: 'Court fees',
  military: 'Military status',
  financial: 'Money matters',
  safety: 'Your safety',
  relational: 'Your relationships',
  event: 'What happened',
  injury: 'What happened',
  pattern: 'A pattern of events',
  evidence: 'Your evidence',
  heirship: 'Family and inheritance',
  exemption: 'Your defenses',
};

export function categoryLabel(category: unknown): string {
  const key = str(category).toLowerCase();
  if (!key) return CATEGORY_LABELS.general;
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]+/g, ' ');
}

export type FamilyMember = {
  kind: 'adult' | 'child';
  label: string;
  sublabel: string;
  title?: string;
  heightScale: number;
};

/**
 * The family portrait: the user first, children between (as recorded,
 * height by age), spouse last — everyone labeled.
 */
export function buildFamily(profile: Record<string, unknown>): FamilyMember[] {
  const members: FamilyMember[] = [];
  const children = (Array.isArray(profile.children) ? profile.children : []) as ProfileChild[];
  const spouse = str(
    (profile.respondentFirstName as string) ||
      String(profile.respondentName || '').split(' ')[0],
  );

  members.push({ kind: 'adult', label: 'You', sublabel: '', heightScale: 1 });
  for (const child of children) {
    const age = computeAge(child);
    const dob = formatFriendlyDate(childBirthDate(child));
    members.push({
      kind: 'child',
      label: (str(child.name) || 'A child').split(' ')[0],
      sublabel: age === null ? '' : `age ${age}`,
      title: dob ? `Born ${dob}` : undefined,
      // 4-year-olds come up to a grown-up's waist; growth caps at 18.
      heightScale: age === null ? 0.7 : 0.42 + 0.5 * (Math.min(age, 18) / 18),
    });
  }
  if (spouse) {
    members.push({ kind: 'adult', label: spouse, sublabel: '', heightScale: 1 });
  }
  return members;
}

export type TimelineEvent = { key: string; label: string; year: string; pos: number };
export type TimelineBirth = { key: string; initial: string; title: string; pos: number };
export type Timeline = { majors: TimelineEvent[]; births: TimelineBirth[] };

/**
 * The life timeline: married → children born → separated → today, positions
 * proportional to real time, clamped and spread so labels never collide.
 * Returns null when there is no marriage date to anchor on.
 */
export function buildTimeline(
  profile: Record<string, unknown>,
  now: Date = new Date(),
): Timeline | null {
  const married = parseKnownDate(profile.marriageDate);
  if (!married) return null;
  const span = now.getTime() - married.getTime();
  if (span <= 0) return null;

  // Clamps keep event labels clear of the fixed "Today" label on phones.
  const posOf = (d: Date) => ((d.getTime() - married.getTime()) / span) * 100;
  const clampMajor = (p: number) => Math.min(68, Math.max(8, p));

  const majors: TimelineEvent[] = [
    { key: 'married', label: 'Married', year: String(married.getFullYear()), pos: 8 },
  ];
  const separated = parseKnownDate(profile.separationDate);
  if (separated && separated > married && separated <= now) {
    majors.push({
      key: 'separated',
      label: 'Separated',
      year: String(separated.getFullYear()),
      pos: clampMajor(posOf(separated)),
    });
  }

  const children = (Array.isArray(profile.children) ? profile.children : []) as ProfileChild[];
  const births: TimelineBirth[] = [];
  for (const child of children) {
    const dob = parseKnownDate(childBirthDate(child));
    if (!dob || dob < married || dob > now) continue;
    const name = str(child.name) || 'Child';
    births.push({
      key: `${name}-${dob.getTime()}`,
      initial: name.charAt(0).toUpperCase(),
      title: `${name.split(' ')[0]} born ${dob.getFullYear()}`,
      pos: Math.min(88, Math.max(10, posOf(dob))),
    });
  }
  // Spread birth marks so initials stay readable when births are close.
  births.sort((a, b) => a.pos - b.pos);
  for (let i = 1; i < births.length; i++) {
    if (births[i].pos - births[i - 1].pos < 6) births[i].pos = births[i - 1].pos + 6;
  }
  for (let i = births.length - 1; i >= 0; i--) {
    if (births[i].pos > 88) births[i].pos = 88;
    if (i < births.length - 1 && births[i + 1].pos - births[i].pos < 6) {
      births[i].pos = births[i + 1].pos - 6;
    }
  }

  return { majors, births };
}

/** Monthly margin: positive = left over, negative = short. Null until both known. */
export function moneyLeftover(profile: Record<string, unknown>): number | null {
  const income = Number(profile.monthlyIncome);
  const expenses = Number(profile.monthlyExpenses);
  if (!Number.isFinite(income) || income <= 0) return null;
  if (!Number.isFinite(expenses) || expenses <= 0) return null;
  return Math.round(income - expenses);
}

export type MoneySegment = { label: string; amount: number };

const MAX_MONEY_SEGMENTS = 5;

/**
 * Normalize an itemized money list for the stacked bar: valid entries only,
 * sorted largest-first, anything beyond the palette's 5 slots folded into
 * "Other" (categorical hues are assigned in fixed order, never cycled).
 * Income labels get the person's name folded in when it isn't already there.
 */
export function moneySegments(
  raw: unknown,
  profile?: Record<string, unknown>,
): MoneySegment[] {
  if (!Array.isArray(raw)) return [];
  const spouse = profile
    ? str(profile.respondentFirstName as string) ||
      String(profile.respondentName || '').split(' ')[0]
    : '';
  const items: MoneySegment[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { label?: unknown; amount?: unknown; person?: unknown };
    let label = str(e.label);
    const amount = Number(e.amount);
    if (!label || !Number.isFinite(amount) || amount <= 0) continue;
    const person = str(e.person).toLowerCase();
    if (person === 'respondent' && spouse && !label.toLowerCase().includes(spouse.toLowerCase())) {
      label = `${label} (${spouse})`;
    } else if (person === 'petitioner' && !/\byour?\b/i.test(label)) {
      label = `${label} (you)`;
    }
    items.push({ label, amount: Math.round(amount) });
  }
  items.sort((a, b) => b.amount - a.amount);
  if (items.length <= MAX_MONEY_SEGMENTS) return items;
  const head = items.slice(0, MAX_MONEY_SEGMENTS - 1);
  const otherTotal = items
    .slice(MAX_MONEY_SEGMENTS - 1)
    .reduce((sum, i) => sum + i.amount, 0);
  return [...head, { label: 'Other', amount: otherTotal }];
}

export type LedgerItem = { key: string; label: string; value: string | null };

const SERVICE_LABELS: Record<string, string> = {
  waiver: 'Waiver of service',
  formal: 'Formal service',
};
const MILITARY_LABELS: Record<string, string> = {
  not_military: 'Not in the military',
  military: 'In the military',
  unknown: 'Being checked',
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * "Also on the record" — every legal detail the interviews collect,
 * humanized, with null marking a detail not yet shared. The page renders
 * nulls as dotted blanks, so per-topic gaps are visible at a glance.
 */
export function buildLedger(profile: Record<string, unknown>): LedgerItem[] {
  const items: LedgerItem[] = [];
  const push = (key: string, label: string, value: string | null) =>
    items.push({ key, label, value });

  push('grounds', 'Grounds', str(profile.groundsForDivorce) || null);

  const custody = str(profile.custodyArrangement) || str(profile.custodyType);
  const custodian = str(profile.primaryCustodian);
  push(
    'custody',
    'Custody',
    custody || custodian
      ? [custody && titleCase(custody), custodian && `with ${custodian.split(' ')[0]}`]
          .filter(Boolean)
          .join(', ')
      : null,
  );

  const csAmount = Number(profile.childSupportAmount);
  const csPayor = str(profile.childSupportObligor || profile.childSupportPayor);
  push(
    'child_support',
    'Child support',
    Number.isFinite(csAmount) && csAmount > 0
      ? `$${Math.round(csAmount).toLocaleString('en-US')}/mo${csPayor ? ` from ${csPayor.split(' ')[0]}` : ''}`
      : null,
  );

  let spousal: string | null = null;
  if (profile.spousalSupportRequested === true) {
    const amount = Number(profile.supportAmount ?? profile.spousalSupportAmount);
    spousal =
      Number.isFinite(amount) && amount > 0
        ? `Requested, $${Math.round(amount).toLocaleString('en-US')}/mo`
        : 'Requested';
  } else if (profile.spousalSupportRequested === false) {
    spousal = 'Not requested';
  }
  push('spousal_support', 'Spousal support', spousal);

  let property: string | null = null;
  if (profile.hasProperty === false) property = 'None shared';
  else if (str(profile.propertyAgreement)) property = titleCase(str(profile.propertyAgreement));
  else if (profile.hasProperty === true) property = 'Shared property';
  push('property', 'Property', property);

  const service = str(profile.serviceMethod).toLowerCase();
  push('service', 'Serving papers', service ? SERVICE_LABELS[service] || titleCase(service) : null);

  const military = str(profile.respondentMilitaryStatus).toLowerCase();
  push('military', 'Military check', military ? MILITARY_LABELS[military] || titleCase(military) : null);

  let protective: string | null = null;
  if (profile.hasProtectiveOrder === true) protective = 'In place';
  else if (profile.hasProtectiveOrder === false) protective = 'None';
  push('protective_order', 'Protective order', protective);

  let feeWaiver: string | null = null;
  if (profile.indigencyRequested === true) feeWaiver = 'Requested';
  else if (profile.indigencyRequested === false) feeWaiver = 'Not needed';
  push('fee_waiver', 'Court-fee waiver', feeWaiver);

  return items;
}

export type StoryProgress = { known: number; total: number };

/**
 * How much of the core story has been shared — the friendly meter in the
 * page header. Counts the universal slots only (optional sections like a
 * protective order never count against the user).
 */
export function storyProgress(profile: Record<string, unknown>): StoryProgress {
  const has = (v: unknown) =>
    v !== undefined &&
    v !== null &&
    !(typeof v === 'string' && v.trim() === '') &&
    !(Array.isArray(v) && v.length === 0);
  const slots = [
    has(profile.affiantName) ||
      has(profile.petitionerFirstName) ||
      has(profile.petitionerName) ||
      has(profile.firstName),
    has(profile.respondentName) || has(profile.respondentFirstName),
    has(profile.marriageDate),
    has(profile.marriageCity) || has(profile.marriageLocation) || has(profile.marriagePlace),
    has(profile.state) || has(profile.county),
    has(profile.residencyStateMonths),
    has(profile.monthlyIncome),
    has(profile.monthlyExpenses),
    has(profile.children) || profile.hasMinorChildren === false,
  ];
  return { known: slots.filter(Boolean).length, total: slots.length };
}

export type FactChapter = { label: string; facts: string[] };

/** Group first-person fact statements into labeled chapters, preserving order. */
export function groupFacts(facts: Array<Record<string, unknown>>): FactChapter[] {
  const chapters: FactChapter[] = [];
  const byLabel = new Map<string, FactChapter>();
  for (const fact of facts || []) {
    const content = str(fact?.content);
    if (!content) continue;
    const label = categoryLabel(fact?.category);
    let chapter = byLabel.get(label);
    if (!chapter) {
      chapter = { label, facts: [] };
      byLabel.set(label, chapter);
      chapters.push(chapter);
    }
    chapter.facts.push(content);
  }
  return chapters;
}
