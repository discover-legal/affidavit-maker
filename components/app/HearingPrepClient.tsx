'use client';

/**
 * "Your day in court" — hearing preparation for self-represented divorce
 * litigants. Most uncontested Utah divorces finish on the papers with no
 * hearing at all; this page explains what generally happens when the court
 * sets one, and lets the user rehearse prove-up-style questions built
 * deterministically from their own stored life story (no LLM calls).
 *
 * Reads two sibling API contracts, both optional:
 *   GET /api/profile           → { success, data: { profile } }
 *   GET /api/procedure/[state] → { success, data: StateProcedure }
 * If either fails the page still renders fully: a generic checklist, and a
 * practice section that invites the user to answer a few questions in chat.
 *
 * UPL note: everything here is general information about a court process —
 * etiquette and rehearsal of the user's OWN facts — never advice about what
 * they should say or do. Their court decides their case.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Accessibility,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Gavel,
  Landmark,
  Languages,
  Loader2,
  Scale,
} from 'lucide-react';
import { getInitialLang, setLang, type Lang } from '@/lib/i18n';
import {
  childBirthDate,
  formatFriendlyDate,
  parseKnownDate,
  type ProfileChild,
} from '@/components/app/lifeStory';

// TODO: fold into lib/i18n STRINGS once free (another agent owns that file
// right now); local dictionary keeps this page self-contained meanwhile.
const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    'lang.en': 'English',
    'lang.es': 'Español',
    'lang.toggleAria': 'Page language',

    'nav.dashboard': 'Dashboard',
    'nav.lifeStory': 'Your life story',

    'hero.eyebrow': 'Step by step',
    'hero.title': 'Your day in court',
    'hero.intro':
      'Most uncontested {stateName} divorces are finished “on the papers,” with no hearing at all. But if the court sets one, here’s what generally happens — so nothing about the day takes you by surprise.',
    'hero.upl':
      'This page is general information about how hearings usually work, not legal advice. Your court decides what applies in your case.',
    'hero.otherParty': 'your spouse',

    'before.heading': 'Before the day',
    'before.sub': 'What people generally get ready ahead of a hearing.',
    'before.courses':
      'Because you have minor children ({names}), {stateName} generally requires divorcing parents to complete a parent education course — bring proof that you finished it.',
    'before.financials':
      'Financial declarations: you and {name} generally each need to have completed and exchanged a Financial Declaration. Bring your copy.',
    'before.copies':
      'Bring a copy of every paper filed in your case — the petition, proof of service, any agreement, and anything the court has sent you.',
    'before.arrive':
      'Plan your route and arrive early. Courthouse security lines take time, and arriving late can mean your case gets passed over.',
    'before.childcare':
      'Arrange childcare for the day. Children generally can’t come into the courtroom.',
    'before.datesTitle': 'Your dates',
    'before.datesSub':
      'From your own story and court papers — for quick reference on the day:',

    'court.heading': 'In the courtroom',
    'court.sub':
      'General courtroom etiquette — every judge runs their courtroom a little differently. This is etiquette information, not advice about what to say in your case.',
    'court.checkin':
      'When you arrive, check in with the clerk or bailiff so the court knows you’re there, then wait for your case to be called.',
    'court.address':
      'Address the judge or commissioner as “Your Honor.” Stand when the judge enters or leaves, and generally when you speak, unless you’re told otherwise.',
    'court.phone': 'Turn your phone all the way off before you walk in.',
    'court.dress': 'Dress plainly and cleanly. Nothing fancy — just neat.',
    'court.pen':
      'Bring a pen and paper to note dates and anything the court asks you to do.',
    'court.understand':
      'It’s okay to say “I don’t understand the question.” Judges generally prefer that to a guess.',
    'court.answer':
      'Answer only what’s asked, then stop. You don’t have to fill the silence.',
    'court.interrupt':
      'Never interrupt — not the judge, and not the other side. You’ll get your turn.',

    'practice.heading': 'Practice the questions',
    'practice.sub':
      'At an uncontested divorce hearing (sometimes called a “prove-up”), the judge generally asks short questions to confirm what’s already in your papers. Rehearse below with your own facts.',
    'practice.note':
      'The judge’s actual questions vary — this rehearses your own facts only, so you can answer them smoothly from memory.',
    'practice.counter': 'Question {n} of {total}',
    'practice.reveal': 'Show what you told us',
    'practice.hide': 'Hide your answer',
    'practice.noAnswer':
      'You haven’t told us this one yet. You can add it any time in a chat.',
    'practice.prev': 'Previous',
    'practice.next': 'Next',
    'practice.loading': 'Loading your facts…',
    'practice.empty.title': 'Nothing to rehearse yet',
    'practice.empty.body':
      'The practice questions are built from your own story. Answer a few questions in chat first, then come back to rehearse.',
    'practice.empty.cta': 'Start in chat',

    'interp.heading': 'Interpreters and accommodations',
    'interp.interpreter':
      'If you’re more comfortable in another language, Utah courts generally provide court interpreters at no cost for court proceedings. Requests are made through the court — ask the clerk as early as possible, ideally when the hearing is scheduled.',
    'interp.interpLink':
      'On the Utah courts website, search for “interpreter services.”',
    'interp.ada':
      'If you need a disability accommodation — extra time, assistive listening, accessible seating — courts have an ADA coordinator, and requests are generally made in advance through the court.',

    'check.heading': 'Check our work',
    'check.sub':
      'The court’s own free tools. Use them to double-check your paperwork before your day.',
    'check.ocap.title': 'Utah OCAP — Online Court Assistance Program',
    'check.ocap.body':
      'The Utah courts’ official free document tool. You can build the same paperwork there and compare it against yours.',
    'check.selfhelp.title': 'Utah Courts Self-Help Center',
    'check.selfhelp.body':
      'Free help from court staff by phone, chat, and email. On the site, search for “Self-Help Center.”',
    'check.lawhelp.title': 'LawHelp.org',
    'check.lawhelp.body': 'Find free or low-cost legal help near you.',

    'advisor.body':
      'A hearing is a strong moment to at least talk to a lawyer — even once. Many lawyers offer limited-scope help: preparing you for the hearing, or appearing just for it, without taking over your whole case. You can keep working here freely either way — and free or low-cost legal help is available through ',
  },
  es: {
    'lang.en': 'English',
    'lang.es': 'Español',
    'lang.toggleAria': 'Idioma de la página',

    'nav.dashboard': 'Panel',
    'nav.lifeStory': 'La historia de tu vida',

    'hero.eyebrow': 'Paso a paso',
    'hero.title': 'Tu día en el tribunal',
    'hero.intro':
      'La mayoría de los divorcios no disputados en {stateName} se terminan “sobre los papeles”, sin ninguna audiencia. Pero si el tribunal programa una, esto es lo que generalmente sucede — para que nada del día te tome por sorpresa.',
    'hero.upl':
      'Esta página es información general sobre cómo suelen funcionar las audiencias, no asesoría legal. Tu tribunal decide qué aplica en tu caso.',
    'hero.otherParty': 'tu cónyuge',

    'before.heading': 'Antes del día',
    'before.sub': 'Lo que la gente generalmente prepara antes de una audiencia.',
    'before.courses':
      'Como tienes hijos menores ({names}), {stateName} generalmente exige que los padres que se divorcian completen un curso de educación para padres — lleva prueba de que lo terminaste.',
    'before.financials':
      'Declaraciones financieras: tú y {name} generalmente necesitan haber completado e intercambiado una Declaración Financiera. Lleva tu copia.',
    'before.copies':
      'Lleva una copia de cada documento presentado en tu caso — la petición, la prueba de notificación, cualquier acuerdo y todo lo que el tribunal te haya enviado.',
    'before.arrive':
      'Planea tu ruta y llega temprano. Las filas de seguridad del tribunal toman tiempo, y llegar tarde puede hacer que pasen tu caso por alto.',
    'before.childcare':
      'Organiza el cuidado de tus hijos ese día. Los niños generalmente no pueden entrar a la sala del tribunal.',
    'before.datesTitle': 'Tus fechas',
    'before.datesSub':
      'De tu propia historia y tus documentos del tribunal — para consulta rápida ese día:',

    'court.heading': 'En la sala del tribunal',
    'court.sub':
      'Etiqueta general en la sala — cada juez maneja su sala un poco diferente. Esto es información de etiqueta, no consejo sobre qué decir en tu caso.',
    'court.checkin':
      'Al llegar, regístrate con el secretario o el alguacil para que el tribunal sepa que estás ahí, y espera a que llamen tu caso.',
    'court.address':
      'Dirígete al juez o comisionado como “Su Señoría” (“Your Honor”). Ponte de pie cuando el juez entre o salga, y generalmente cuando hables, a menos que te indiquen lo contrario.',
    'court.phone': 'Apaga tu teléfono por completo antes de entrar.',
    'court.dress': 'Vístete de forma sencilla y limpia. Nada elegante — solo pulcro.',
    'court.pen':
      'Lleva pluma y papel para anotar fechas y cualquier cosa que el tribunal te pida hacer.',
    'court.understand':
      'Está bien decir “No entiendo la pregunta.” Los jueces generalmente prefieren eso a una suposición.',
    'court.answer':
      'Responde solo lo que te pregunten, y detente. No tienes que llenar el silencio.',
    'court.interrupt':
      'Nunca interrumpas — ni al juez ni a la otra parte. Tendrás tu turno.',

    'practice.heading': 'Practica las preguntas',
    'practice.sub':
      'En una audiencia de divorcio no disputado (a veces llamada “prove-up”), el juez generalmente hace preguntas cortas para confirmar lo que ya está en tus papeles. Ensaya abajo con tus propios hechos.',
    'practice.note':
      'Las preguntas reales del juez varían — esto ensaya únicamente tus propios hechos, para que puedas responderlos con fluidez de memoria.',
    'practice.counter': 'Pregunta {n} de {total}',
    'practice.reveal': 'Mostrar lo que nos contaste',
    'practice.hide': 'Ocultar tu respuesta',
    'practice.noAnswer':
      'Aún no nos has contado esto. Puedes agregarlo en un chat cuando quieras.',
    'practice.prev': 'Anterior',
    'practice.next': 'Siguiente',
    'practice.loading': 'Cargando tus hechos…',
    'practice.empty.title': 'Aún no hay nada que ensayar',
    'practice.empty.body':
      'Las preguntas de práctica se construyen con tu propia historia. Responde primero algunas preguntas en el chat y luego vuelve a ensayar.',
    'practice.empty.cta': 'Comenzar en el chat',

    'interp.heading': 'Intérpretes y adaptaciones',
    'interp.interpreter':
      'Si te sientes más cómodo en otro idioma, los tribunales de Utah generalmente ofrecen intérpretes sin costo para los procedimientos judiciales. Las solicitudes se hacen a través del tribunal — pídelo al secretario lo antes posible, idealmente cuando se programe la audiencia.',
    'interp.interpLink':
      'En el sitio web de los tribunales de Utah, busca “interpreter services” (servicios de intérprete).',
    'interp.ada':
      'Si necesitas una adaptación por discapacidad — más tiempo, asistencia auditiva, asientos accesibles — los tribunales tienen un coordinador de ADA, y las solicitudes generalmente se hacen con anticipación a través del tribunal.',

    'check.heading': 'Verifica nuestro trabajo',
    'check.sub':
      'Las herramientas gratuitas del propio tribunal. Úsalas para verificar tu papeleo antes de tu día.',
    'check.ocap.title': 'OCAP de Utah — Online Court Assistance Program',
    'check.ocap.body':
      'La herramienta oficial y gratuita de documentos de los tribunales de Utah. Puedes preparar el mismo papeleo ahí y compararlo con el tuyo.',
    'check.selfhelp.title': 'Centro de Autoayuda de los Tribunales de Utah',
    'check.selfhelp.body':
      'Ayuda gratuita del personal del tribunal por teléfono, chat y correo. En el sitio, busca “Self-Help Center”.',
    'check.lawhelp.title': 'LawHelp.org',
    'check.lawhelp.body':
      'Encuentra ayuda legal gratuita o de bajo costo cerca de ti.',

    'advisor.body':
      'Una audiencia es un buen momento para al menos hablar con un abogado — aunque sea una vez. Muchos abogados ofrecen ayuda de alcance limitado: prepararte para la audiencia, o presentarse solo para ella, sin llevar todo tu caso. Puedes seguir trabajando aquí libremente de cualquier forma — y hay ayuda legal gratuita o de bajo costo disponible a través de ',
  },
};

/** Local string lookup with `{name}` placeholder support (EN fallback). */
function tt(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let out = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [name, val] of Object.entries(vars)) {
      out = out.split(`{${name}}`).join(String(val));
    }
  }
  return out;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isRespondent(profile: Record<string, unknown>): boolean {
  return str(profile.role).toLowerCase() === 'respondent';
}

function captionName(profile: Record<string, unknown>, side: 'petitioner' | 'respondent'): string {
  return (
    str(profile[`${side}Name`]) ||
    [str(profile[`${side}FirstName`]), str(profile[`${side}LastName`])]
      .filter(Boolean)
      .join(' ')
  );
}

function personName(profile: Record<string, unknown>): string {
  return (
    str(profile.affiantName) ||
    captionName(profile, isRespondent(profile) ? 'respondent' : 'petitioner') ||
    [str(profile.firstName), str(profile.lastName)].filter(Boolean).join(' ')
  );
}

function spouseFullName(profile: Record<string, unknown>): string {
  // spouseName is canonical and role-independent; the caption fields are a
  // fallback for older profiles and must be read through the user's role.
  return (
    str(profile.spouseName) ||
    captionName(profile, isRespondent(profile) ? 'petitioner' : 'respondent')
  );
}

function marriagePlace(profile: Record<string, unknown>): string {
  return (
    str(profile.marriageLocation) ||
    [str(profile.marriageCity), str(profile.marriageStateName)].filter(Boolean).join(', ') ||
    str(profile.marriagePlace)
  );
}

function profileChildren(profile: Record<string, unknown>): ProfileChild[] {
  return (Array.isArray(profile.children) ? profile.children : []).filter(
    (c): c is ProfileChild => Boolean(c) && typeof c === 'object' && Boolean(str((c as ProfileChild).name)),
  );
}

export type PracticeQuestion = {
  id: string;
  /** The prove-up-style question, in the page language. */
  question: string;
  /** The user's stored answer, or null when they haven't shared it yet. */
  answer: string | null;
};

export type DateLine = { label: string; date: string };

/**
 * "Your dates" reference lines from the profile's keyEvents (served/filed
 * dates read from ingested court papers). Purely presentational.
 */
export function buildYourDates(
  profile: Record<string, unknown>,
  lang: Lang = 'en',
): DateLine[] {
  const raw = Array.isArray(profile.keyEvents) ? profile.keyEvents : [];
  const lines: DateLine[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as { label?: unknown; date?: unknown };
    const label = str(e.label);
    const date = str(e.date);
    if (!label || !date) continue;
    lines.push({ label, date: formatFriendlyDate(date, lang) || date });
    if (lines.length >= 8) break;
  }
  return lines;
}

/**
 * The deterministic prove-up rehearsal set, mirroring the Q&A of the Utah
 * finalization prep sheet (services/supportDocs/utah.js). Always returns the
 * full set of questions; `answer` is null wherever the story is silent so
 * the page can invite the user to fill the gap. No LLM involved.
 */
export function buildPracticeQuestions(
  profile: Record<string, unknown>,
  lang: Lang = 'en',
  waitingDays: number | null = null,
): PracticeQuestion[] {
  const es = lang === 'es';
  const questions: PracticeQuestion[] = [];

  // 1 — your name
  const name = personName(profile);
  questions.push({
    id: 'name',
    question: es
      ? 'Por favor, di tu nombre para el registro.'
      : 'Please state your name for the record.',
    answer: name ? (es ? `Tu nombre es ${name}.` : `Your name is ${name}.`) : null,
  });

  // 2 — marriage date and place
  const married = formatFriendlyDate(profile.marriageDate, lang);
  const place = marriagePlace(profile);
  questions.push({
    id: 'marriage',
    question: es ? '¿Cuándo y dónde se casaron?' : 'When and where were you married?',
    answer:
      married || place
        ? es
          ? `Te casaste${married ? ` el ${married}` : ''}${place ? ` en ${place}` : ''}.`
          : `You were married${married ? ` on ${married}` : ''}${place ? ` in ${place}` : ''}.`
        : null,
  });

  // 3 — separation
  const spouseFirst = spouseFullName(profile).split(/\s+/)[0] ?? '';
  const separated = formatFriendlyDate(profile.separationDate, lang);
  questions.push({
    id: 'separation',
    question: es
      ? `¿Cuándo se separaron tú y ${spouseFirst || 'tu cónyuge'}?`
      : `When did you and ${spouseFirst || 'your spouse'} separate?`,
    answer: separated
      ? es
        ? `Se separaron el ${separated}.`
        : `You separated on ${separated}.`
      : null,
  });

  // 4 — residency / county
  const county = str(profile.county);
  const where = county
    ? es
      ? `el condado de ${county}`
      : `${county} County`
    : es
      ? 'tu condado'
      : 'your county';
  const months = Number(profile.residencyStateMonths);
  questions.push({
    id: 'residency',
    question: es
      ? `¿Has vivido en ${where} durante al menos tres meses antes de presentar tu caso?`
      : `Have you lived in ${where} for at least three months before you filed?`,
    answer:
      Number.isFinite(months) && months > 0
        ? es
          ? `Nos contaste de unos ${months} meses.`
          : `You told us about ${months} months.`
        : null,
  });

  // 5 — children names and birth dates
  const children = profileChildren(profile);
  let childrenAnswer: string | null = null;
  if (children.length > 0) {
    childrenAnswer = children
      .map((c) => {
        const dob = formatFriendlyDate(childBirthDate(c), lang);
        return dob
          ? `${str(c.name)} (${es ? 'nació el' : 'born'} ${dob})`
          : str(c.name);
      })
      .join('; ');
  } else if (profile.hasMinorChildren === false) {
    childrenAnswer = es
      ? 'Nos dijiste que no tienes hijos menores de edad.'
      : 'You told us you have no minor children.';
  }
  questions.push({
    id: 'children',
    question: es
      ? '¿Cuáles son los nombres y fechas de nacimiento de tus hijos menores?'
      : 'What are the names and birth dates of your minor children?',
    answer: childrenAnswer,
  });

  // 6 — grounds
  const grounds = str(profile.groundsForDivorce);
  questions.push({
    id: 'grounds',
    question: es
      ? '¿Cuál es la razón legal — las “causales” — de tu divorcio? (Por ejemplo, diferencias irreconciliables.)'
      : 'What is the legal reason — the “grounds” — for your divorce? (For example, irreconcilable differences.)',
    answer: grounds ? (es ? `Nos dijiste: ${grounds}` : `You told us: ${grounds}`) : null,
  });

  // 7 — is the agreement fair and voluntary
  const fairParts: string[] = [];
  const property = str(profile.propertyAgreement);
  if (property) fairParts.push(es ? `Bienes: ${property}.` : `Property: ${property}.`);
  const custody = str(profile.custodyArrangement) || str(profile.custodyType);
  if (custody) fairParts.push(es ? `Custodia: ${custody}.` : `Custody: ${custody}.`);
  questions.push({
    id: 'fair',
    question: es
      ? '¿Es justo el acuerdo que presentan, y lo aceptaron ambos voluntariamente?'
      : 'Is the agreement you are presenting fair, and did you both enter into it voluntarily?',
    answer: fairParts.length
      ? `${es ? 'Tu historia dice —' : 'Your story says —'} ${fairParts.join(' ')}`
      : null,
  });

  // 8 — waiting period, computed from the filed date on record. Dates are
  // added by local calendar components (not ms) so DST/timezone can't shift
  // the printed day.
  const friendlyLocalDate = (d: Date): string =>
    d.toLocaleDateString(es ? 'es-US' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  let waitingAnswer: string | null = null;
  const keyEvents = Array.isArray(profile.keyEvents) ? profile.keyEvents : [];
  for (const entry of keyEvents as Array<{ label?: unknown; date?: unknown }>) {
    if (!/\bfil/i.test(str(entry?.label))) continue;
    const filed = parseKnownDate(entry?.date);
    if (!filed) continue;
    const filedFriendly = friendlyLocalDate(filed);
    if (waitingDays && waitingDays > 0) {
      const end = new Date(filed.getFullYear(), filed.getMonth(), filed.getDate() + waitingDays);
      const endFriendly = friendlyLocalDate(end);
      waitingAnswer = es
        ? `Tus papeles muestran una presentación el ${filedFriendly}; ${waitingDays} días después es el ${endFriendly}.`
        : `Your papers show a filing on ${filedFriendly}; ${waitingDays} days after that is ${endFriendly}.`;
    } else {
      waitingAnswer = es
        ? `Tus papeles muestran una presentación el ${filedFriendly}.`
        : `Your papers show a filing on ${filedFriendly}.`;
    }
    break;
  }
  questions.push({
    id: 'waiting',
    question:
      waitingDays && waitingDays > 0
        ? es
          ? `¿Han pasado los ${waitingDays} días de espera desde que presentaste tu petición?`
          : `Has the ${waitingDays}-day waiting period passed since you filed your petition?`
        : es
          ? '¿Ha pasado el período de espera de tu estado desde que presentaste tu petición?'
          : 'Has your state’s waiting period passed since you filed your petition?',
    answer: waitingAnswer,
  });

  return questions;
}

type StateInfo = { stateName?: string; waitingPeriodDays?: number };

export default function HearingPrepClient() {
  const router = useRouter();
  // Start in English so the first client render matches SSR; the saved or
  // browser preference applies in an effect right after hydration.
  const [lang, setLangState] = useState<Lang>('en');
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  // Becomes true once the profile fetch settles (success OR failure) — the
  // page renders fully either way, just without personalization on failure.
  const [profileReady, setProfileReady] = useState(false);
  const [stateInfo, setStateInfo] = useState<StateInfo | null>(null);

  const [qIndex, setQIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setLangState(getInitialLang());
  }, []);

  const chooseLang = useCallback((next: Lang) => {
    setLangState(next);
    setLang(next); // persists to localStorage for future visits
  }, []);

  // Profile first (it decides the state), then that state's procedure for
  // the localized state name + waiting period. Both degrade silently.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let p: Record<string, unknown> = {};
      try {
        const res = await fetch('/api/profile');
        const json = await res.json();
        if (json?.success && json.data?.profile && typeof json.data.profile === 'object') {
          p = json.data.profile as Record<string, unknown>;
        }
      } catch {
        // No profile — generic checklist and an empty practice mode.
      }
      if (cancelled) return;
      setProfile(p);
      setProfileReady(true);

      const st =
        typeof p.state === 'string' && /^[A-Za-z]{2}$/.test(p.state.trim())
          ? p.state.trim().toUpperCase()
          : 'UT';
      try {
        const res = await fetch(`/api/procedure/${encodeURIComponent(st)}`);
        const json = await res.json();
        if (cancelled || !json?.success || !json.data) return;
        const days = Number(json.data.waitingPeriodDays);
        setStateInfo({
          stateName: typeof json.data.stateName === 'string' ? json.data.stateName : undefined,
          waitingPeriodDays: Number.isFinite(days) && days > 0 ? days : undefined,
        });
      } catch {
        // Procedure endpoint missing or state not covered — generic copy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stateCode = str(profile.state).toUpperCase() || 'UT';
  const stateName = stateInfo?.stateName || (stateCode === 'UT' ? 'Utah' : stateCode);
  // Utah's 30-day wait is a safe local default; other states only get a
  // number when their procedure endpoint provides one.
  const waitingDays = stateInfo?.waitingPeriodDays ?? (stateCode === 'UT' ? 30 : null);

  const questions = useMemo(
    () => buildPracticeQuestions(profile, lang, waitingDays),
    [profile, lang, waitingDays],
  );
  const hasStory = useMemo(() => questions.some((q) => q.answer !== null), [questions]);
  const dates = useMemo(() => buildYourDates(profile, lang), [profile, lang]);

  const children = profileChildren(profile);
  const childNames = children.map((c) => str(c.name)).join(', ');
  const spouseFirst = spouseFullName(profile).split(/\s+/)[0] ?? '';

  const goTo = useCallback(
    (i: number) => {
      setQIndex(Math.min(questions.length - 1, Math.max(0, i)));
      setRevealed(false);
    },
    [questions.length],
  );

  const checklist: string[] = [];
  if (children.length > 0) {
    checklist.push(tt(lang, 'before.courses', { names: childNames, stateName }));
  }
  checklist.push(
    tt(lang, 'before.financials', { name: spouseFirst || tt(lang, 'hero.otherParty') }),
  );
  checklist.push(tt(lang, 'before.copies'));
  checklist.push(tt(lang, 'before.arrive'));
  checklist.push(tt(lang, 'before.childcare'));

  const currentQuestion = questions[qIndex];

  const checkLinks = [
    {
      key: 'ocap',
      href: 'https://www.utcourts.gov/ocap/',
      title: tt(lang, 'check.ocap.title'),
      body: tt(lang, 'check.ocap.body'),
    },
    {
      key: 'selfhelp',
      href: 'https://www.utcourts.gov',
      title: tt(lang, 'check.selfhelp.title'),
      body: tt(lang, 'check.selfhelp.body'),
    },
    {
      key: 'lawhelp',
      href: 'https://www.lawhelp.org/find-help',
      title: tt(lang, 'check.lawhelp.title'),
      body: tt(lang, 'check.lawhelp.body'),
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Top nav: back links + EN/ES pill (same pattern as /serve and /profile). */}
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 sm:gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {tt(lang, 'nav.dashboard')}
          </button>
          <button
            onClick={() => router.push('/profile')}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {tt(lang, 'nav.lifeStory')}
          </button>
        </div>

        <div
          role="group"
          aria-label={tt(lang, 'lang.toggleAria')}
          className="inline-flex shrink-0 rounded-full border border-gray-300 p-0.5 font-sans"
        >
          {(['en', 'es'] as const).map((code) => (
            <button
              key={code}
              onClick={() => chooseLang(code)}
              aria-pressed={lang === code}
              aria-label={tt(lang, `lang.${code}`)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                lang === code ? 'bg-brand text-brand-on' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {code === 'en' ? 'EN' : 'ES'}
            </button>
          ))}
        </div>
      </div>

      {/* Hero — most uncontested cases end without a hearing at all. */}
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          {tt(lang, 'hero.eyebrow')}
        </p>
        <h1 className="font-serif text-4xl text-gray-900 sm:text-5xl">
          {tt(lang, 'hero.title')}
        </h1>
        <p className="mt-3 max-w-xl text-gray-600">
          {tt(lang, 'hero.intro', { stateName })}
        </p>
        <p className="mt-2 max-w-xl text-sm text-gray-500">{tt(lang, 'hero.upl')}</p>
      </header>

      {/* 1 — Before the day: personalized checklist. */}
      <section aria-label={tt(lang, 'before.heading')}>
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          {tt(lang, 'before.heading')}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-gray-600">{tt(lang, 'before.sub')}</p>
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <ul className="space-y-3">
            {checklist.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-gray-300"
                />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>

          {dates.length > 0 && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <CalendarDays className="h-4 w-4 text-brand" aria-hidden="true" />
                {tt(lang, 'before.datesTitle')}
              </h3>
              <p className="mt-1 text-xs text-gray-500">{tt(lang, 'before.datesSub')}</p>
              <ul className="mt-2 space-y-1.5">
                {dates.map((d, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2 text-sm text-gray-700">
                    <span className="min-w-0">{d.label}</span>
                    <span aria-hidden="true" className="text-gray-300">
                      —
                    </span>
                    <span className="font-medium text-gray-900">{d.date}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* 2 — In the courtroom: etiquette information. */}
      <section aria-label={tt(lang, 'court.heading')} className="mt-10">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          <Gavel className="h-4 w-4" aria-hidden="true" />
          {tt(lang, 'court.heading')}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-gray-600">{tt(lang, 'court.sub')}</p>
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <ul className="space-y-3">
            {[
              'court.checkin',
              'court.address',
              'court.phone',
              'court.dress',
              'court.pen',
              'court.understand',
              'court.answer',
              'court.interrupt',
            ].map((key) => (
              <li key={key} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-brand-strong"
                >
                  •
                </span>
                <span className="min-w-0">{tt(lang, key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3 — Practice the questions: deterministic prove-up rehearsal. */}
      <section aria-label={tt(lang, 'practice.heading')} className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          {tt(lang, 'practice.heading')}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-gray-600">{tt(lang, 'practice.sub')}</p>

        {!profileReady && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {tt(lang, 'practice.loading')}
            </p>
          </div>
        )}

        {profileReady && !hasStory && (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h3 className="font-serif text-xl text-gray-900">
              {tt(lang, 'practice.empty.title')}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
              {tt(lang, 'practice.empty.body')}
            </p>
            <button
              onClick={() => router.push('/editor/new')}
              className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong"
            >
              {tt(lang, 'practice.empty.cta')}
            </button>
          </div>
        )}

        {profileReady && hasStory && currentQuestion && (
          <>
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                {tt(lang, 'practice.counter', { n: qIndex + 1, total: questions.length })}
              </p>
              <p className="mt-3 font-serif text-xl text-gray-900">
                {currentQuestion.question}
              </p>

              <button
                onClick={() => setRevealed((v) => !v)}
                aria-expanded={revealed}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {revealed ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
                {revealed ? tt(lang, 'practice.hide') : tt(lang, 'practice.reveal')}
              </button>

              {revealed && (
                <div className="mt-3 rounded-xl border border-brand-soft bg-brand-tint/50 p-4 text-sm leading-relaxed text-gray-800">
                  {currentQuestion.answer ?? tt(lang, 'practice.noAnswer')}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between">
                <button
                  onClick={() => goTo(qIndex - 1)}
                  disabled={qIndex === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  {tt(lang, 'practice.prev')}
                </button>
                <button
                  onClick={() => goTo(qIndex + 1)}
                  disabled={qIndex === questions.length - 1}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {tt(lang, 'practice.next')}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <p className="mt-3 max-w-xl text-xs text-gray-500">{tt(lang, 'practice.note')}</p>
          </>
        )}
      </section>

      {/* 4 — Interpreters and accommodations. */}
      <section aria-label={tt(lang, 'interp.heading')} className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          {tt(lang, 'interp.heading')}
        </h2>
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex gap-3">
            <Languages className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-gray-700">
                {tt(lang, 'interp.interpreter')}
              </p>
              <p className="mt-1.5 text-sm text-gray-600">
                {tt(lang, 'interp.interpLink')}{' '}
                <a
                  href="https://www.utcourts.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-brand underline hover:text-brand-strong"
                >
                  utcourts.gov
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-3 border-t border-gray-100 pt-4">
            <Accessibility className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-gray-700">{tt(lang, 'interp.ada')}</p>
          </div>
        </div>
      </section>

      {/* 5 — Check our work: the court's own free tools. */}
      <section aria-label={tt(lang, 'check.heading')} className="mt-10">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          <Landmark className="h-4 w-4" aria-hidden="true" />
          {tt(lang, 'check.heading')}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-gray-600">{tt(lang, 'check.sub')}</p>
        <div className="mt-4 flex flex-col gap-3">
          {checkLinks.map((link) => (
            <a
              key={link.key}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:p-5"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 group-hover:text-brand-strong">
                {link.title}
                <ExternalLink className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
              </span>
              <span className="mt-1 block text-sm text-gray-600">{link.body}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Advisor note — persistent, never dismissable; the user can always keep going. */}
      <div className="mt-10 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 font-sans sm:p-5">
        <Scale className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-sm text-amber-900">
          {tt(lang, 'advisor.body')}
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
    </main>
  );
}
