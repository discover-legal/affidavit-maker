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
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const usNumeric = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (usNumeric) {
    const year = Number(usNumeric[3].length === 2 ? `20${usNumeric[3]}` : usNumeric[3]);
    const d = new Date(year, Number(usNumeric[1]) - 1, Number(usNumeric[2]));
    return Number.isNaN(d.getTime()) ? null : d;
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
