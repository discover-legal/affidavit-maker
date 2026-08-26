/**
 * Pure helpers that turn a stored life-story profile (lib/api/profile.ts)
 * into the narrated "living affidavit" shown on /profile.
 *
 * A recital is one numbered sentence of the story. Known details render as
 * highlighted value tokens; missing ones render as dotted blanks so the
 * page shows both what the assistant knows and what it's still missing.
 *
 * Every language-bearing builder takes an optional trailing
 * `lang: 'en' | 'es' = 'en'` so the page can render fully in Spanish;
 * the default keeps every existing caller (and test) unchanged.
 * formatFriendlyDate localizes month names (en-US / es-US).
 */

import type { Lang } from '@/lib/i18n';
import type { NextStep, StateProcedure } from '@/lib/api/procedure';

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

/** Localize the dynamic procedure engine's output for the bilingual story page. */
export function localizeNextStep(
  step: NextStep,
  procedure: StateProcedure,
  profile: Record<string, unknown>,
  perspective: 'petitioner' | 'respondent',
  lang: Lang = 'en',
): NextStep {
  if (lang !== 'es') return step;

  const method = str(profile.serviceMethod).toLowerCase();
  const state = procedure.stateName;
  const deadlines = procedure.answerDeadlineDays;
  const spanish: Record<string, { title: string; detail: string }> = {
    serve: {
      title: 'Notifica a tu cónyuge',
      detail: /waiv|accept/.test(method)
        ? 'Aceptación de la notificación: Entrega o envía los documentos a tu cónyuge junto con el formulario. Tu cónyuge firma para confirmar que recibió los documentos; después, presenta el formulario firmado ante el tribunal.'
        : method
          ? 'Notificación personal: Un sheriff, alguacil, notificador privado u otro adulto que no sea parte del caso entrega los documentos. La persona que los entregó completa la constancia de notificación para presentarla ante el tribunal.'
          : 'Tu cónyuge generalmente debe recibir los documentos antes de que el caso pueda avanzar. Las opciones comunes incluyen la aceptación voluntaria o la notificación personal.',
    },
    answer: {
      title: perspective === 'respondent' ? 'Presenta tu respuesta' : 'Plazo para responder',
      detail:
        `Generalmente hay ${deadlines.inState} días después de la notificación dentro de ${state} ` +
        `(${deadlines.outOfState} días si la notificación fue fuera de ${state}) para presentar una respuesta. ` +
        'Este plazo importa porque, si no se responde a tiempo, el tribunal puede considerar una solicitud de rebeldía.',
    },
    default: {
      title: 'Puede estar disponible la rebeldía',
      detail:
        'Si tu cónyuge no presenta una respuesta dentro del plazo, puedes pedir al tribunal que considere su rebeldía. El tribunal decide si la concede y si firma el decreto.',
    },
    mediation: {
      title: 'Mediación',
      detail:
        'Cuando se presenta una respuesta en un divorcio de Utah, ambas partes generalmente deben intentar al menos una sesión de mediación de buena fe antes del juicio. Se puede pedir al tribunal una excepción por una buena causa, incluidas preocupaciones de seguridad.',
    },
    waiting: {
      title: 'Período de espera',
      detail:
        'Utah generalmente tiene un período de espera de 30 días: el tribunal no puede firmar el decreto final hasta 30 días después de presentar la petición. Puede eximir este período por circunstancias extraordinarias.',
    },
    education: {
      title: 'Cursos para padres',
      detail:
        'Los padres de hijos menores generalmente deben completar los cursos de orientación y educación sobre el divorcio antes de que el tribunal firme el decreto. El tribunal puede eximir la asistencia en algunas situaciones.',
    },
    financial: {
      title: 'Declaración financiera',
      detail:
        'En un divorcio de Utah, cada parte generalmente debe completar e intercambiar una Declaración Financiera con sus ingresos, gastos, bienes y deudas, junto con los documentos de respaldo.',
    },
    finalize: {
      title: 'Finaliza el caso',
      detail:
        'Cuando termine el período de espera y se completen los pasos requeridos, los documentos finales generalmente se envían al juez para revisión. Los casos acordados a menudo terminan por escrito; el tribunal decide si se necesita una audiencia y si firma el decreto.',
    },
  };

  return spanish[step.key] ? { ...step, ...spanish[step.key] } : step;
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

/**
 * "2010-05-01" → "May 1, 2010" (en) / "1 de mayo de 2010" (es);
 * anything unparseable comes back as-is.
 */
export function formatFriendlyDate(raw: unknown, lang: Lang = 'en'): string {
  const s = str(raw);
  if (!s) return '';
  const date = parseKnownDate(s);
  if (!date) return s;
  return date.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Humanize a residency duration for display. Under 24 months stays in
 * months ("18 months"); 24 and up reads in years, with a months remainder
 * when there is one ("12 years", "2 years and 3 months"). Pure number
 * math — never applied to user free text.
 */
export function formatResidencyDuration(months: number, lang: Lang = 'en'): string {
  const es = lang === 'es';
  const n = Math.floor(months);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 24) {
    if (n === 1) return es ? '1 mes' : '1 month';
    return es ? `${n} meses` : `${n} months`;
  }
  const years = Math.floor(n / 12);
  const rem = n % 12;
  const yearsText = es ? `${years} años` : `${years} years`;
  if (rem === 0) return yearsText;
  const remText =
    rem === 1 ? (es ? '1 mes' : '1 month') : es ? `${rem} meses` : `${rem} months`;
  return es ? `${yearsText} y ${remText}` : `${yearsText} and ${remText}`;
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

function isRespondent(profile: Record<string, unknown>): boolean {
  return str(profile.role).toLowerCase() === 'respondent';
}

function petitionerName(profile: Record<string, unknown>): string {
  return (
    str(profile.petitionerName) ||
    [str(profile.petitionerFirstName), str(profile.petitionerLastName)].filter(Boolean).join(' ')
  );
}

function respondentName(profile: Record<string, unknown>): string {
  return (
    str(profile.respondentName) ||
    [str(profile.respondentFirstName), str(profile.respondentLastName)].filter(Boolean).join(' ')
  );
}

/**
 * The user's own display name, role-aware: affiantName first, then the
 * caption name for the user's OWN side under `role` (missing role means
 * petitioner), then split first/last. Works for both stored profiles and
 * editor document objects, which mirror the same fields — never reach for
 * petitionerName without checking role.
 */
export function fullName(profile: Record<string, unknown>): string {
  return (
    str(profile.affiantName) ||
    (isRespondent(profile) ? respondentName(profile) : petitionerName(profile)) ||
    [str(profile.firstName), str(profile.lastName)].filter(Boolean).join(' ')
  );
}

/** The user's spouse's display name, role-aware (see fullName). */
export function spouseName(profile: Record<string, unknown>): string {
  // spouseName is canonical and role-independent; the role-relative caption
  // fields are only a fallback for profiles written before it existed.
  return (
    str(profile.spouseName) ||
    (isRespondent(profile) ? petitionerName(profile) : respondentName(profile))
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
export function buildRecitals(
  profile: Record<string, unknown>,
  lang: Lang = 'en',
): Recital[] {
  const es = lang === 'es';
  const recitals: Recital[] = [];

  // 1 — who you are
  const name = fullName(profile);
  recitals.push({
    id: 'identity',
    known: Boolean(name),
    segments: [
      text(es ? 'Tu nombre es ' : 'Your name is '),
      name ? value(name) : blank(es ? 'tu nombre' : 'your name'),
      text('.'),
    ],
  });

  // 2 — your marriage
  const spouse = spouseName(profile);
  const married = formatFriendlyDate(profile.marriageDate, lang);
  const place = marriagePlace(profile);
  const hasMarriageDetail = Boolean(spouse || married || place || profile.separationDate);
  const marriageSegments: Segment[] = hasMarriageDetail
    ? [text(es ? 'Te casaste con ' : 'You married ')]
    : [text(es ? 'Los detalles de tu matrimonio: ' : 'Your marriage details: ')];
  if (hasMarriageDetail) {
    marriageSegments.push(spouse ? value(spouse) : blank(es ? 'tu cónyuge' : 'your spouse'));
    marriageSegments.push(text(es ? ' el ' : ' on '));
    marriageSegments.push(married ? value(married) : blank(es ? 'una fecha' : 'a date'));
  } else {
    marriageSegments.push(blank(es ? 'agrégalos' : 'add them'));
  }
  if (place) {
    marriageSegments.push(text(es ? ' en ' : ' in '), value(place));
  }
  if (hasMarriageDetail) marriageSegments.push(text('.'));
  const separated = formatFriendlyDate(profile.separationDate, lang);
  if (separated) {
    marriageSegments.push(
      text(es ? ' Se separaron el ' : ' You separated on '),
      value(separated),
      text('.'),
    );
  }
  recitals.push({
    id: 'marriage',
    known: Boolean(spouse || married || place || separated),
    segments: marriageSegments,
  });

  // 3 — where you live
  const county = str(profile.county);
  const countyName = county.replace(/\s+county$/i, '').trim();
  const state = str(profile.state).toUpperCase();
  const homeSegments: Segment[] = [text(es ? 'Tu hogar está en ' : 'Home is ')];
  if (county || state) {
    homeSegments.push(
      value(
        [countyName && (es ? `el condado de ${countyName}` : `${countyName} County`), state]
          .filter(Boolean)
          .join(', '),
      ),
    );
  } else {
    homeSegments.push(blank(es ? 'un lugar' : 'a place'));
  }
  const months = Number(profile.residencyStateMonths);
  if (Number.isFinite(months) && months > 0) {
    homeSegments.push(
      text(es ? ' — donde has vivido por ' : ' — where you have lived for '),
      value(formatResidencyDuration(months, lang)),
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
    if (income) {
      segments.push(
        text(es ? 'Entran unos ' : 'About '),
        value(es ? `${income} al mes` : `${income} a month`),
        text(es ? '' : ' comes in'),
      );
    }
    if (income && expenses) segments.push(text(es ? ', y ' : ', and '));
    if (expenses) {
      segments.push(
        text(es ? (income ? 'salen unos ' : 'Salen unos ') : income ? 'about ' : 'About '),
        value(es ? `${expenses} al mes` : `${expenses} a month`),
        text(es ? '' : ' goes out'),
      );
    }
    segments.push(text('.'));
    const assets = str(profile.assetsDescription);
    if (assets) {
      segments.push(text(es ? ' Tienes ' : ' You own '), value(assets), text('.'));
    }
    recitals.push({
      id: 'finances',
      known: true,
      segments: segments.filter((s) => s.text !== ''),
    });
  }

  // 5 — safety (only when affirmatively shared; worded with care)
  if (profile.hasProtectiveOrder === true) {
    recitals.push({
      id: 'safety',
      known: true,
      segments: es
        ? [text('Hay una '), value('orden de protección'), text(' vigente.')]
        : [text('A '), value('protective order'), text(' is in place.')],
    });
  }

  return recitals;
}

/** Human chapter titles for fact categories collected by the orchestrators. */
const CATEGORY_LABELS: Record<string, string> = {
  general: 'Your story',
  marriage: 'Your marriage',
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
  response: 'From court papers',
  temporal: 'Timeline',
  communication: 'Communications',
  separation: 'Separation',
  property_debts: 'Property and debts',
  property_and_debts: 'Property and debts',
  court: 'Court',
  case_number: 'Case number',
  parties: 'Parties',
  court_event: 'Court events',
  hearing: 'Court hearings',
  filing: 'Court filings',
  deadline: 'Deadlines',
};

const CATEGORY_LABELS_ES: Record<string, string> = {
  general: 'Tu historia',
  marriage: 'Tu matrimonio',
  identity: 'Sobre ti',
  residency: 'Dónde vives',
  grounds: 'Por qué presentas tu caso',
  children: 'Tus hijos',
  property: 'Lo que posees',
  support: 'Manutención',
  service: 'Entrega de papeles',
  indigency: 'Cuotas del tribunal',
  military: 'Estatus militar',
  financial: 'Asuntos de dinero',
  safety: 'Tu seguridad',
  relational: 'Tus relaciones',
  event: 'Lo que pasó',
  injury: 'Lo que pasó',
  pattern: 'Un patrón de eventos',
  evidence: 'Tu evidencia',
  heirship: 'Familia y herencia',
  exemption: 'Tus defensas',
  response: 'De documentos del tribunal',
  temporal: 'Cronología',
  communication: 'Comunicaciones',
  separation: 'Separación',
  property_debts: 'Bienes y deudas',
  property_and_debts: 'Bienes y deudas',
  court: 'Tribunal',
  case_number: 'Número de caso',
  parties: 'Partes del caso',
  court_event: 'Eventos judiciales',
  hearing: 'Audiencias judiciales',
  filing: 'Presentaciones judiciales',
  deadline: 'Fechas límite',
};

export function categoryLabel(category: unknown, lang: Lang = 'en'): string {
  const labels = lang === 'es' ? CATEGORY_LABELS_ES : CATEGORY_LABELS;
  // Extraction sources are not perfectly canonical: court-paper facts can
  // arrive as `case_number`, `case number`, or with surrounding whitespace.
  // Normalize them before lookup so changing the UI language never exposes a
  // title-cased English fallback for a category we already understand.
  const key = str(category).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!key) return labels.general;
  if (labels[key]) return labels[key];
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
export function buildFamily(
  profile: Record<string, unknown>,
  lang: Lang = 'en',
): FamilyMember[] {
  const es = lang === 'es';
  const members: FamilyMember[] = [];
  const children = (Array.isArray(profile.children) ? profile.children : []) as ProfileChild[];
  const spouse = spouseName(profile).split(' ')[0];

  members.push({ kind: 'adult', label: es ? 'Tú' : 'You', sublabel: '', heightScale: 1 });
  for (const child of children) {
    const age = computeAge(child);
    const dob = formatFriendlyDate(childBirthDate(child), lang);
    members.push({
      kind: 'child',
      label: (str(child.name) || (es ? 'Menor' : 'A child')).split(' ')[0],
      sublabel: age === null ? '' : es ? `${age} años` : `age ${age}`,
      title: dob ? (es ? `Nació el ${dob}` : `Born ${dob}`) : undefined,
      // 4-year-olds come up to a grown-up's waist; growth caps at 18.
      heightScale: age === null ? 0.7 : 0.42 + 0.5 * (Math.min(age, 18) / 18),
    });
  }
  if (spouse) {
    members.push({ kind: 'adult', label: spouse, sublabel: '', heightScale: 1 });
  }
  return members;
}

export type TimelineEvent = {
  key: string;
  label: string;
  year: string;
  pos: number;
  title?: string;
};
export type TimelineBirth = { key: string; initial: string; title: string; pos: number };
export type Timeline = { majors: TimelineEvent[]; births: TimelineBirth[] };

export type KeyEventLike = { label?: unknown; date?: unknown; source?: unknown };

/** Show at most this many procedural events on the line — latest win. */
const MAX_TIMELINE_EVENTS = 3;

/**
 * The life timeline: married → children born → separated → court events
 * (from ingested papers) → today. Positions proportional to real time,
 * clamped and spread so labels never collide. Anchors on the marriage
 * date, or the earliest court event when there is no marriage recorded.
 */
export function buildTimeline(
  profile: Record<string, unknown>,
  now: Date = new Date(),
  lang: Lang = 'en',
): Timeline | null {
  const es = lang === 'es';
  const married = parseKnownDate(profile.marriageDate);
  const separated = parseKnownDate(profile.separationDate);

  const keyEvents = (Array.isArray(profile.keyEvents) ? profile.keyEvents : [])
    .map((e: KeyEventLike) => ({
      label: str(e?.label),
      source: str(e?.source),
      date: parseKnownDate(e?.date),
    }))
    .filter((e) => e.label && e.date && e.date <= now) as Array<{
    label: string;
    source: string;
    date: Date;
  }>;
  keyEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  const shownEvents = keyEvents.slice(-MAX_TIMELINE_EVENTS);

  const anchorCandidates = [married, ...shownEvents.map((e) => e.date)].filter(
    (d): d is Date => Boolean(d) && (d as Date) <= now,
  );
  if (anchorCandidates.length === 0) return null;
  const anchor = new Date(Math.min(...anchorCandidates.map((d) => d.getTime())));
  const span = now.getTime() - anchor.getTime();
  if (span <= 0) return null;

  const posOf = (d: Date) => ((d.getTime() - anchor.getTime()) / span) * 100;

  const majors: TimelineEvent[] = [];
  if (married) {
    majors.push({
      key: 'married',
      label: es ? 'Matrimonio' : 'Married',
      year: String(married.getFullYear()),
      pos: posOf(married),
    });
  }
  if (separated && (!married || separated > married) && separated <= now) {
    majors.push({
      key: 'separated',
      label: es ? 'Separación' : 'Separated',
      year: String(separated.getFullYear()),
      pos: posOf(separated),
    });
  }
  shownEvents.forEach((e, i) => {
    const label = timelineLabel(e.label, lang);
    majors.push({
      key: `event-${i}-${e.date.getTime()}`,
      label,
      year: String(e.date.getFullYear()),
      pos: posOf(e.date),
      title: e.source ? `${label} — ${e.source}` : undefined,
    });
  });

  // Clamp into [8, 80] (room for the fixed "Today" label), then spread so
  // adjacent labels never collide — forward push, then backward pull.
  majors.sort((a, b) => a.pos - b.pos);
  const MIN_GAP = 14;
  for (const m of majors) m.pos = Math.min(80, Math.max(8, m.pos));
  for (let i = 1; i < majors.length; i++) {
    if (majors[i].pos - majors[i - 1].pos < MIN_GAP) majors[i].pos = majors[i - 1].pos + MIN_GAP;
  }
  for (let i = majors.length - 1; i >= 0; i--) {
    if (majors[i].pos > 80) majors[i].pos = 80;
    if (i > 0 && majors[i].pos - majors[i - 1].pos < MIN_GAP) {
      majors[i - 1].pos = majors[i].pos - MIN_GAP;
    }
  }

  const children = (Array.isArray(profile.children) ? profile.children : []) as ProfileChild[];
  const births: TimelineBirth[] = [];
  if (married) {
    for (const child of children) {
      const dob = parseKnownDate(childBirthDate(child));
      if (!dob || dob < married || dob > now) continue;
      const name = str(child.name) || (es ? 'Menor' : 'Child');
      births.push({
        key: `${name}-${dob.getTime()}`,
        initial: name.charAt(0).toUpperCase(),
        title: es
          ? `${name.split(' ')[0]} nació en ${dob.getFullYear()}`
          : `${name.split(' ')[0]} born ${dob.getFullYear()}`,
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
  }

  return { majors, births };
}

/**
 * Waiting-period note for the timeline. When an ingested "filed" event and
 * the state's waiting period are both known, computes the earliest date a
 * court could finalize; otherwise returns the general rule. Information
 * about the law, phrased as such — never a prediction for this user's case.
 */
export function waitingPeriodNote(
  profile: Record<string, unknown>,
  waitingDays: number | null | undefined,
  stateName: string,
  now: Date = new Date(),
  lang: Lang = 'en',
): string | null {
  if (!waitingDays || waitingDays <= 0) return null;
  const es = lang === 'es';
  const keyEvents = Array.isArray(profile.keyEvents) ? profile.keyEvents : [];
  for (const e of keyEvents as KeyEventLike[]) {
    if (!/\bfil/i.test(str(e?.label))) continue;
    const filed = parseKnownDate(e?.date);
    if (!filed) continue;
    const earliest = new Date(filed.getTime() + waitingDays * 24 * 3600 * 1000);
    if (earliest > now) {
      const earliestDate = formatFriendlyDate(earliest.toISOString().slice(0, 10), lang);
      return es
        ? `${stateName} tiene un período de espera de ${waitingDays} días — según la fecha de presentación registrada, lo más pronto que un tribunal podría finalizar es el ${earliestDate}.`
        : `${stateName} has a ${waitingDays}-day waiting period — based on the filing date on record, the earliest a court could finalize is ${earliestDate}.`;
    }
    return null; // waiting period already passed — nothing to flag
  }
  return es
    ? `${stateName} tiene un período de espera de ${waitingDays} días: un tribunal no puede finalizar un divorcio hasta ${waitingDays} días después de la presentación.`
    : `${stateName} has a ${waitingDays}-day waiting period: a court can't finalize a divorce until ${waitingDays} days after filing.`;
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
/** Fold labels for the beyond-the-palette money segments, per language.
 * The chart colors the fold neutral gray by matching either label. */
export const MONEY_OTHER_LABELS: Record<Lang, string> = { en: 'Other', es: 'Otros' };

/** Keep My Story's document actions relevant to the person's side and facts. */
export function supportKindVisible(
  key: string,
  perspective: 'petitioner' | 'respondent',
  profile: Record<string, unknown>,
): boolean {
  const children = (Array.isArray(profile.children) ? profile.children : []) as ProfileChild[];
  const hasChildren = profile.hasMinorChildren === true || children.some((child) => {
    const age = computeAge(child);
    return age === null || age < 18;
  });
  if (key === 'child_support_worksheet' && !hasChildren) return false;
  if (perspective === 'respondent') {
    return !['default_package', 'finalization_prep'].includes(key);
  }
  return key !== 'answer';
}

const TIMELINE_LABELS_ES: Record<string, string> = {
  served: 'Notificación',
  filed: 'Presentado',
  hearing: 'Audiencia',
  'petition filed': 'Petición presentada',
  'petition for divorce filed': 'Petición de divorcio presentada',
  'divorce petition filed': 'Petición de divorcio presentada',
};

function timelineLabel(label: string, lang: Lang): string {
  if (lang !== 'es') return label;
  return TIMELINE_LABELS_ES[label.trim().toLowerCase()] || label;
}

export function moneySegments(
  raw: unknown,
  profile?: Record<string, unknown>,
  lang: Lang = 'en',
): MoneySegment[] {
  if (!Array.isArray(raw)) return [];
  const es = lang === 'es';
  const spouse = profile ? spouseName(profile).split(' ')[0] : '';
  const userRole = profile && isRespondent(profile) ? 'respondent' : 'petitioner';
  const youRe = es ? /\btus?\b|tú/i : /\byour?\b/i;
  const items: MoneySegment[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { label?: unknown; amount?: unknown; person?: unknown };
    let label = str(e.label);
    const amount = Number(e.amount);
    if (!label || !Number.isFinite(amount) || amount <= 0) continue;
    const person = str(e.person).toLowerCase();
    if (person && person !== userRole && spouse && !label.toLowerCase().includes(spouse.toLowerCase())) {
      label = `${label} (${spouse})`;
    } else if (person === userRole && !youRe.test(label)) {
      label = es ? `${label} (tú)` : `${label} (you)`;
    }
    items.push({ label, amount: Math.round(amount) });
  }
  items.sort((a, b) => b.amount - a.amount);
  if (items.length <= MAX_MONEY_SEGMENTS) return items;
  const head = items.slice(0, MAX_MONEY_SEGMENTS - 1);
  const otherTotal = items
    .slice(MAX_MONEY_SEGMENTS - 1)
    .reduce((sum, i) => sum + i.amount, 0);
  return [...head, { label: MONEY_OTHER_LABELS[lang], amount: otherTotal }];
}

export type LedgerItem = { key: string; label: string; value: string | null };

const SERVICE_LABELS: Record<Lang, Record<string, string>> = {
  en: { waiver: 'Waiver of service', formal: 'Formal service' },
  es: { waiver: 'Renuncia a la entrega', formal: 'Entrega formal' },
};
const MILITARY_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    not_military: 'Not in the military',
    military: 'In the military',
    unknown: 'Being checked',
  },
  es: {
    not_military: 'No está en el ejército',
    military: 'En el ejército',
    unknown: 'En verificación',
  },
};

/** Ledger row labels per language — also the keys of getGlossary(lang). */
const LEDGER_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    grounds: 'Grounds',
    custody: 'Custody',
    child_support: 'Child support',
    spousal_support: 'Spousal support',
    property: 'Property',
    service: 'Serving papers',
    military: 'Military check',
    protective_order: 'Protective order',
    fee_waiver: 'Court-fee waiver',
  },
  es: {
    grounds: 'Causales',
    custody: 'Custodia',
    child_support: 'Manutención de los hijos',
    spousal_support: 'Manutención del cónyuge',
    property: 'Bienes',
    service: 'Entrega de papeles',
    military: 'Verificación militar',
    protective_order: 'Orden de protección',
    fee_waiver: 'Exención de cuotas',
  },
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * "Also on the record" — every legal detail the interviews collect,
 * humanized, with null marking a detail not yet shared. The page renders
 * nulls as dotted blanks, so per-topic gaps are visible at a glance.
 */
export function buildLedger(
  profile: Record<string, unknown>,
  lang: Lang = 'en',
): LedgerItem[] {
  const es = lang === 'es';
  const labels = LEDGER_LABELS[lang];
  const items: LedgerItem[] = [];
  const push = (key: string, value: string | null) =>
    items.push({ key, label: labels[key], value });

  push('grounds', str(profile.groundsForDivorce) || null);

  const custody = str(profile.custodyArrangement) || str(profile.custodyType);
  const custodian = str(profile.primaryCustodian);
  push(
    'custody',
    custody || custodian
      ? [
          custody && titleCase(custody),
          custodian && `${es ? 'con' : 'with'} ${custodian.split(' ')[0]}`,
        ]
          .filter(Boolean)
          .join(', ')
      : null,
  );

  const perMo = es ? '/mes' : '/mo';
  const csAmount = Number(profile.childSupportAmount);
  const csPayor = str(profile.childSupportObligor || profile.childSupportPayor);
  push(
    'child_support',
    Number.isFinite(csAmount) && csAmount > 0
      ? `$${Math.round(csAmount).toLocaleString('en-US')}${perMo}${
          csPayor ? ` ${es ? 'de' : 'from'} ${csPayor.split(' ')[0]}` : ''
        }`
      : null,
  );

  let spousal: string | null = null;
  if (profile.spousalSupportRequested === true) {
    const amount = Number(profile.supportAmount ?? profile.spousalSupportAmount);
    spousal =
      Number.isFinite(amount) && amount > 0
        ? `${es ? 'Solicitada' : 'Requested'}, $${Math.round(amount).toLocaleString('en-US')}${perMo}`
        : es
          ? 'Solicitada'
          : 'Requested';
  } else if (profile.spousalSupportRequested === false) {
    spousal = es ? 'No solicitada' : 'Not requested';
  }
  push('spousal_support', spousal);

  let property: string | null = null;
  if (profile.hasProperty === false) property = es ? 'Ninguno compartido' : 'None shared';
  else if (str(profile.propertyAgreement)) property = titleCase(str(profile.propertyAgreement));
  else if (profile.hasProperty === true) property = es ? 'Bienes compartidos' : 'Shared property';
  push('property', property);

  const service = str(profile.serviceMethod).toLowerCase();
  push('service', service ? SERVICE_LABELS[lang][service] || titleCase(service) : null);

  const military = str(profile.respondentMilitaryStatus).toLowerCase();
  push('military', military ? MILITARY_LABELS[lang][military] || titleCase(military) : null);

  let protective: string | null = null;
  if (profile.hasProtectiveOrder === true) protective = es ? 'Vigente' : 'In place';
  else if (profile.hasProtectiveOrder === false) protective = es ? 'Ninguna' : 'None';
  push('protective_order', protective);

  let feeWaiver: string | null = null;
  if (profile.indigencyRequested === true) feeWaiver = es ? 'Solicitada' : 'Requested';
  else if (profile.indigencyRequested === false) feeWaiver = es ? 'No se necesita' : 'Not needed';
  push('fee_waiver', feeWaiver);

  return items;
}

/**
 * Plain-language explanations for legal terms shown on the page.
 * Written at a general-reading level; information, not advice.
 */
export const GLOSSARY: Record<string, string> = {
  Grounds:
    'The legal reason for the divorce. Most states allow "no-fault" grounds, meaning no one has to prove the other did something wrong.',
  Custody:
    'Who makes decisions for the children (legal custody) and who they live with (physical custody). "Joint" means shared.',
  'Child support':
    "Money one parent pays the other to help cover the children's costs, usually monthly.",
  'Spousal support':
    'Money one spouse pays the other after separation — sometimes called alimony or maintenance.',
  Property:
    '"Agreed" means you both accept how things will be divided; "contested" means the court may need to decide.',
  'Serving papers':
    'The other party must officially receive the court papers. They can sign a waiver accepting them, or someone (not you) delivers them formally.',
  'Military check':
    'Courts require confirming whether the other party is in the military, because service members get extra legal protections.',
  'Protective order':
    'A court order that limits contact to protect someone from harm.',
  'Court-fee waiver':
    'If paying court fees would be a hardship, you can ask the court to waive them.',
};

/** Spanish glossary, keyed by the Spanish ledger labels. */
const GLOSSARY_ES: Record<string, string> = {
  Causales:
    'La razón legal del divorcio. La mayoría de los estados permiten causales “sin culpa”, es decir, nadie tiene que probar que el otro hizo algo malo.',
  Custodia:
    'Quién toma las decisiones por los hijos (custodia legal) y con quién viven (custodia física). “Conjunta” significa compartida.',
  'Manutención de los hijos':
    'Dinero que un padre le paga al otro para ayudar a cubrir los gastos de los hijos, normalmente cada mes.',
  'Manutención del cónyuge':
    'Dinero que un cónyuge le paga al otro después de la separación — a veces se llama pensión alimenticia.',
  Bienes:
    '“Acordado” significa que ambos aceptan cómo se dividirán las cosas; “disputado” significa que el tribunal quizá tenga que decidir.',
  'Entrega de papeles':
    'La otra parte debe recibir oficialmente los papeles del tribunal. Puede firmar una renuncia aceptándolos, o alguien (no tú) se los entrega formalmente.',
  'Verificación militar':
    'Los tribunales exigen confirmar si la otra parte está en el ejército, porque los miembros del servicio tienen protecciones legales adicionales.',
  'Orden de protección':
    'Una orden del tribunal que limita el contacto para proteger a alguien de un daño.',
  'Exención de cuotas':
    'Si pagar las cuotas del tribunal sería una dificultad económica, puedes pedirle al tribunal que las exima.',
};

/** The glossary in the page's language, keyed by that language's ledger labels. */
export function getGlossary(lang: Lang = 'en'): Record<string, string> {
  return lang === 'es' ? GLOSSARY_ES : GLOSSARY;
}

/** Chat prefills for tapping a gap on the profile page — the user's own
 * words to send (editable before sending), never advice from the app. */
export const ASK_TOPICS: Record<string, string> = {
  identity: 'I want to add my name to my documents.',
  marriage: 'I want to add details about my marriage.',
  home: 'I want to add where I live.',
  grounds: 'I want to add the grounds for my divorce.',
  custody: 'I want to add our custody arrangement.',
  child_support: 'I want to add child support details.',
  spousal_support: 'I want to add whether I am requesting spousal support.',
  property: 'I want to add information about our property and debts.',
  service: 'I want to add how the papers will be served.',
  military: "I want to add my spouse's military status.",
  protective_order: 'I want to add whether there is a protective order.',
  fee_waiver: 'I want to see if I can ask the court to waive the filing fees.',
};

const ASK_TOPICS_ES: Record<string, string> = {
  identity: 'Quiero agregar mi nombre a mis documentos.',
  marriage: 'Quiero agregar detalles sobre mi matrimonio.',
  home: 'Quiero agregar dónde vivo.',
  grounds: 'Quiero agregar las causales de mi divorcio.',
  custody: 'Quiero agregar nuestro arreglo de custodia.',
  child_support: 'Quiero agregar los detalles de la manutención de los hijos.',
  spousal_support: 'Quiero agregar si estoy solicitando manutención del cónyuge.',
  property: 'Quiero agregar información sobre nuestros bienes y deudas.',
  service: 'Quiero agregar cómo se entregarán los papeles.',
  military: 'Quiero agregar el estatus militar de mi cónyuge.',
  protective_order: 'Quiero agregar si existe una orden de protección.',
  fee_waiver: 'Quiero ver si puedo pedirle al tribunal que exima las cuotas de presentación.',
};

/** Chat prefills in the user's language — their own words, ready to edit. */
export function getAskTopics(lang: Lang = 'en'): Record<string, string> {
  return lang === 'es' ? ASK_TOPICS_ES : ASK_TOPICS;
}

export type AdvisorFlag = { key: string; label: string };

/**
 * Issues where a lawyer's advice is recommended. Deterministic and shown
 * persistently (not dismissable) — the user can always keep going.
 */
export function advisorFlags(
  profile: Record<string, unknown>,
  lang: Lang = 'en',
): AdvisorFlag[] {
  const es = lang === 'es';
  const flags: AdvisorFlag[] = [];
  const contested = (v: unknown) => str(v).toLowerCase() === 'contested';
  if (contested(profile.custodyArrangement) || contested(profile.custodyType)) {
    flags.push({ key: 'custody', label: es ? 'custodia disputada' : 'contested custody' });
  }
  if (contested(profile.propertyAgreement)) {
    flags.push({ key: 'property', label: es ? 'bienes en disputa' : 'contested property' });
  }
  if (profile.hasProtectiveOrder === true) {
    flags.push({
      key: 'safety',
      label: es ? 'seguridad y órdenes de protección' : 'safety and protective orders',
    });
  }
  return flags;
}

/**
 * 2025 HHS federal poverty guidelines (48 contiguous states + DC):
 * $15,650 for one person + $5,500 per additional household member.
 * Most state fee waivers key on 125–200% of these; we hint at 150% and
 * always say "may" — eligibility is the court's call, not ours.
 */
const FPG_2025_BASE = 15650;
const FPG_2025_PER_PERSON = 5500;
const FEE_WAIVER_PCT = 1.5;

export function feeWaiverHint(profile: Record<string, unknown>): boolean {
  const income = Number(profile.monthlyIncome);
  if (!Number.isFinite(income) || income <= 0) return false;
  if (profile.indigencyRequested === true) return false; // already pursuing it
  const dependents = Number(profile.dependentsCount);
  const children = Array.isArray(profile.children) ? profile.children.length : 0;
  const household =
    1 + (Number.isFinite(dependents) && dependents >= 0 ? dependents : children);
  const annualThreshold =
    (FPG_2025_BASE + FPG_2025_PER_PERSON * (household - 1)) * FEE_WAIVER_PCT;
  return income * 12 <= annualThreshold;
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
    has(profile.spouseName) || has(profile.respondentName) || has(profile.respondentFirstName),
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

export type ChapterFact = { content: string; provenance: string };
export type FactChapter = { label: string; facts: ChapterFact[] };

/**
 * Group fact statements into labeled chapters, preserving order. Each fact
 * carries its provenance — the user's own words it was extracted from, or
 * the court paper it was read from — so the story is verifiable before it
 * goes into a sworn document.
 */
export function groupFacts(
  facts: Array<Record<string, unknown>>,
  lang: Lang = 'en',
): FactChapter[] {
  const es = lang === 'es';
  const chapters: FactChapter[] = [];
  const byLabel = new Map<string, FactChapter>();
  for (const fact of facts || []) {
    const content = str(fact?.content);
    if (!content) continue;
    const label = categoryLabel(fact?.category, lang);
    let chapter = byLabel.get(label);
    if (!chapter) {
      chapter = { label, facts: [] };
      byLabel.set(label, chapter);
      chapters.push(chapter);
    }
    const quote = str(fact?.sourceQuote);
    const source = str(fact?.source);
    let provenance = '';
    // Ingested facts store their document label as a literal "From: …" quote.
    if (quote.startsWith('From:')) {
      provenance = es ? `De:${quote.slice('From:'.length)}` : quote;
    } else if (quote) {
      provenance = es ? `Dijiste: “${quote}”` : `You said: “${quote}”`;
    } else if (source) {
      provenance = es ? `De: ${source}` : `From: ${source}`;
    }
    chapter.facts.push({ content, provenance });
  }
  return chapters;
}
