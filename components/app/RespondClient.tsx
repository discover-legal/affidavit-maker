'use client';

/**
 * Guided "/respond" page for the OTHER side of a divorce case — users who
 * were SERVED papers and generally have a short window to file an Answer.
 *
 * Reads three sibling API contracts:
 *   GET   /api/profile                → served date (keyEvents), state, role
 *   PATCH /api/profile {role}         → mark the user as the respondent
 *   GET   /api/procedure/[state]      → answerDeadlineDays {inState, outOfState}
 *   POST  /api/documents/support      → application/pdf stream
 *
 * CONTRACT NOTE (documents/support): this page sends an `extra` object
 * ({answerPositions, answerRequests, includeCounterclaim, role}) that the
 * route merges OVER the profile data (extra wins). The route may not accept
 * `extra` yet — until it does, the POST 400s and this page degrades to a
 * friendly "not available yet" message, exactly like ServeGuideClient does.
 *
 * UPL note: this page transcribes the user's own decisions. It explains what
 * "admit" / "deny" / "don't know" mean in plain language but NEVER suggests
 * which one to pick for any paragraph, and it never invents requests to the
 * court. Everything is "generally / your court decides."
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  Download,
  Loader2,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { getInitialLang, setLang, type Lang } from '@/lib/i18n';
import { detectPerspective, isCanadianJurisdiction } from '@/lib/api/procedure';
import { officialFormsLink } from '@/lib/officialForms';

type Position = 'admit' | 'deny' | 'lack_knowledge';

type PositionRow = { id: number; paragraph: string; position: Position | null };

type Deadline =
  | { kind: 'loading' }
  | { kind: 'no_served_date' }
  | { kind: 'no_procedure'; servedDate: Date }
  | {
      kind: 'ready';
      servedDate: Date;
      dueDate: Date;
      daysLeft: number;
      inState: number;
      outOfState: number;
    };

type RoleStatus = 'idle' | 'saving' | 'saved' | 'error';
type DownloadStatus = 'idle' | 'downloading' | 'error' | 'unavailable';

// TODO: fold into lib/i18n STRINGS once free (another agent owns that file
// right now); local dictionary keeps this page self-contained meanwhile.
const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    'lang.en': 'English',
    'lang.es': 'Español',
    'lang.toggleAria': 'Page language',

    'nav.dashboard': 'Dashboard',
    'nav.lifeStory': 'Your life story',

    'hero.eyebrow': 'If you were served',
    'hero.title': 'You were served — here’s what generally happens',
    'hero.intro':
      'Getting divorce papers is a lot. Generally, the next step is filing a written response — an “Answer” — with the court before a deadline. This page walks you through what that usually involves and helps you put your own responses on paper.',
    'hero.eyebrowInfo': 'If you get served',
    'hero.titleInfo': 'If you get served papers — here’s what generally happens',
    'hero.introInfo':
      'Your story so far reads as the person who filed (the petitioner). If you receive court papers served on you, the next step is generally filing a written response — an “Answer” — before a deadline. This page explains what that usually involves.',
    'hero.upl':
      'This page is general information about a court process, not legal advice. Your court decides what applies in your case.',

    'confirm.title': 'Were you served with papers?',
    'confirm.body':
      'The response tools below are for someone who was served. If that happened to you in this case, confirm below and this page will switch to your response deadline and Answer tools.',
    'confirm.button': 'I was served with papers',

    'advisor.title': 'Talk to a lawyer if you can',
    'advisor.body':
      'Being sued is one of the strongest moments to at least consult a lawyer — even a single session to review your situation can matter. Free and low-cost help exists:',
    'advisor.lawhelp': 'LawHelp.org',
    'advisor.uls': 'Utah Legal Services',
    'advisor.localCa':
      'Free or low-cost legal help may be available in your area — court staff can often point you to it.',
    'advisor.continue':
      'You can keep going here either way — this tool works whether or not you talk to someone first.',

    'deadline.loading': 'Checking your dates…',
    'deadline.title': 'Your response deadline',
    'deadline.served': 'Papers served: {date}',
    'deadline.due': 'Answer generally due: {date}',
    'deadline.daysLeft': '{n} days left',
    'deadline.daysLeft1': '1 day left',
    'deadline.past': 'This deadline has generally passed',
    'deadline.explain':
      'That’s {inState} days after the day you were served ({outOfState} days if you were served outside the state).',
    'deadline.warning':
      'If nothing is filed by the deadline, a default judgment can generally be entered — meaning the court may decide the case without hearing your side. If your deadline is close or has passed, contact the court clerk or a lawyer right away; courts can sometimes still accept a late response.',
    'deadline.noDate.title': 'We don’t have your served date yet',
    'deadline.noDate.body':
      'The response clock generally starts the day you receive the papers. Add the papers you were served to your story and we’ll work out the deadline for you.',
    'deadline.noDate.cta': 'Add a court paper',
    'deadline.noProc':
      'We don’t have the deadline rules for your area here yet. The response window is generally short — your court clerk can tell you the exact deadline where your case was filed.',

    'role.title': 'Mark me as the respondent',
    'role.body':
      'In court papers, the person who filed is the “Petitioner” and the person responding is the “Respondent.” Marking yourself as the respondent helps your documents put your name on the right line.',
    'role.button': 'I’m the respondent',
    'role.saving': 'Saving…',
    'role.done': 'You’re marked as the respondent.',
    'role.error': 'That didn’t save. Please try again.',

    'positions.title': 'Respond to each numbered paragraph',
    'positions.intro':
      'A petition is written as numbered paragraphs. An Answer generally responds to them one by one. For each paragraph number, choose the response that is true for you:',
    'positions.admit': 'Admit',
    'positions.admitHelp': 'you agree that what the paragraph says is true.',
    'positions.deny': 'Deny',
    'positions.denyHelp': 'you say that what the paragraph says is not true.',
    'positions.dk': 'Don’t know',
    'positions.dkHelp':
      'you don’t have enough information to say — in an Answer, this generally counts as a denial.',
    'positions.paragraph': 'Paragraph #',
    'positions.positionAria': 'Your response to paragraph {n}',
    'positions.add': 'Add a paragraph',
    'positions.remove': 'Remove paragraph row',
    'positions.noAuto':
      'Only paragraphs you mark here go into your Answer — nothing is chosen for you. These are your decisions to make; we only write them down.',

    'requests.title': 'What do you want to ask the court for?',
    'requests.intro':
      'In your own words, list what you’d like the court to order — for example, about property, debts, or your children. Each line becomes a “Respondent asks the court to …” sentence. Leave this empty if you don’t want to ask for anything yet.',
    'requests.placeholder': 'In your own words…',
    'requests.add': 'Add a request',
    'requests.remove': 'Remove request',

    'counterclaim.title': 'Include a counterclaim',
    'counterclaim.body':
      'A counterclaim is your own request for a divorce inside the same case — it generally lets the case finish even if the other side drops their petition.',

    'download.title': 'Download your Answer draft',
    'download.body':
      'This builds a draft PDF from your choices above, with your case caption and a signature block. Check it against your court’s official Answer form, and review every line — the court clerk can tell you how and where to file.',
    'download.bodyUt':
      'This builds a draft PDF from your choices above, with your case caption and a signature block. It uses Utah’s unsworn-declaration signature (no notary needed). Check it against your court’s official Answer form, and review every line — the court clerk can tell you how and where to file.',
    'download.button': 'Download my Answer draft (PDF)',
    'download.preparing': 'Preparing your Answer…',
    'download.error': 'The document couldn’t be downloaded. Please try again.',
    'download.unavailable':
      'The Answer builder isn’t available for your area yet. Your court’s self-help services generally have an Answer form you can use instead.',
    'download.officialForms': 'Official forms for your courts:',
  },
  es: {
    'lang.en': 'English',
    'lang.es': 'Español',
    'lang.toggleAria': 'Idioma de la página',

    'nav.dashboard': 'Panel',
    'nav.lifeStory': 'La historia de tu vida',

    'hero.eyebrow': 'Si te notificaron',
    'hero.title': 'Te notificaron — esto es lo que generalmente sigue',
    'hero.intro':
      'Recibir papeles de divorcio es difícil. Generalmente, el siguiente paso es presentar una respuesta por escrito — una “Contestación” (Answer) — ante el tribunal antes de una fecha límite. Esta página te explica lo que eso suele implicar y te ayuda a poner tus propias respuestas por escrito.',
    'hero.eyebrowInfo': 'Si te llegan a notificar',
    'hero.titleInfo': 'Si te notifican papeles — esto es lo que generalmente sigue',
    'hero.introInfo':
      'Tu historia hasta ahora se lee como la de la persona que presentó el caso (el peticionario). Si recibes papeles del tribunal notificados a ti, el siguiente paso generalmente es presentar una respuesta por escrito — una “Contestación” (Answer) — antes de una fecha límite. Esta página explica lo que eso suele implicar.',
    'hero.upl':
      'Esta página es información general sobre un proceso judicial, no asesoría legal. Tu tribunal decide qué aplica en tu caso.',

    'confirm.title': '¿Te notificaron papeles?',
    'confirm.body':
      'Las herramientas de respuesta de abajo son para alguien que fue notificado. Si eso te pasó en este caso, confírmalo abajo y esta página cambiará a tu fecha límite de respuesta y a las herramientas de Contestación.',
    'confirm.button': 'Me notificaron papeles',

    'advisor.title': 'Habla con un abogado si puedes',
    'advisor.body':
      'Ser demandado es uno de los momentos más importantes para al menos consultar a un abogado — incluso una sola sesión para revisar tu situación puede marcar la diferencia. Existe ayuda gratuita y de bajo costo:',
    'advisor.lawhelp': 'LawHelp.org',
    'advisor.uls': 'Utah Legal Services',
    'advisor.localCa':
      'Puede haber ayuda legal gratuita o de bajo costo en tu área — el personal del tribunal a menudo puede orientarte.',
    'advisor.continue':
      'Puedes continuar aquí de cualquier forma — esta herramienta funciona hables o no con alguien primero.',

    'deadline.loading': 'Revisando tus fechas…',
    'deadline.title': 'Tu fecha límite para responder',
    'deadline.served': 'Papeles notificados: {date}',
    'deadline.due': 'Contestación generalmente vence: {date}',
    'deadline.daysLeft': 'Quedan {n} días',
    'deadline.daysLeft1': 'Queda 1 día',
    'deadline.past': 'Esta fecha límite generalmente ya pasó',
    'deadline.explain':
      'Son {inState} días después del día en que te notificaron ({outOfState} días si te notificaron fuera del estado).',
    'deadline.warning':
      'Si no se presenta nada antes de la fecha límite, generalmente se puede dictar una sentencia en rebeldía — es decir, el tribunal puede decidir el caso sin escuchar tu versión. Si tu fecha límite está cerca o ya pasó, contacta al secretario del tribunal o a un abogado de inmediato; a veces los tribunales aún aceptan una respuesta tardía.',
    'deadline.noDate.title': 'Aún no tenemos tu fecha de notificación',
    'deadline.noDate.body':
      'El plazo para responder generalmente empieza el día en que recibes los papeles. Agrega los papeles que te entregaron a tu historia y calcularemos la fecha límite por ti.',
    'deadline.noDate.cta': 'Agregar un documento del tribunal',
    'deadline.noProc':
      'Aún no tenemos aquí las reglas de plazos de tu área. El plazo para responder generalmente es corto — el secretario del tribunal puede decirte la fecha exacta donde se presentó tu caso.',

    'role.title': 'Márcame como la parte demandada',
    'role.body':
      'En los papeles del tribunal, quien presentó el caso es el “Peticionario” (Petitioner) y quien responde es el “Demandado” (Respondent). Marcarte como demandado ayuda a que tus documentos pongan tu nombre en la línea correcta.',
    'role.button': 'Soy el demandado',
    'role.saving': 'Guardando…',
    'role.done': 'Quedaste marcado como la parte demandada.',
    'role.error': 'No se pudo guardar. Intenta de nuevo.',

    'positions.title': 'Responde a cada párrafo numerado',
    'positions.intro':
      'Una petición está escrita en párrafos numerados. Una Contestación generalmente los responde uno por uno. Para cada número de párrafo, elige la respuesta que sea verdadera para ti:',
    'positions.admit': 'Admitir',
    'positions.admitHelp': 'estás de acuerdo en que lo que dice el párrafo es cierto.',
    'positions.deny': 'Negar',
    'positions.denyHelp': 'dices que lo que dice el párrafo no es cierto.',
    'positions.dk': 'No sé',
    'positions.dkHelp':
      'no tienes suficiente información para decirlo — en una Contestación, esto generalmente cuenta como una negación.',
    'positions.paragraph': 'Párrafo #',
    'positions.positionAria': 'Tu respuesta al párrafo {n}',
    'positions.add': 'Agregar un párrafo',
    'positions.remove': 'Quitar fila de párrafo',
    'positions.noAuto':
      'Solo los párrafos que marques aquí entran en tu Contestación — nada se elige por ti. Estas decisiones son tuyas; nosotros solo las escribimos.',

    'requests.title': '¿Qué quieres pedirle al tribunal?',
    'requests.intro':
      'Con tus propias palabras, escribe lo que te gustaría que el tribunal ordene — por ejemplo, sobre bienes, deudas o tus hijos. Cada línea se convierte en una oración de “El Demandado pide al tribunal que …”. Déjalo vacío si aún no quieres pedir nada.',
    'requests.placeholder': 'Con tus propias palabras…',
    'requests.add': 'Agregar una petición',
    'requests.remove': 'Quitar petición',

    'counterclaim.title': 'Incluir una contrademanda',
    'counterclaim.body':
      'Una contrademanda es tu propia solicitud de divorcio dentro del mismo caso — generalmente permite que el caso termine aunque la otra parte retire su petición.',

    'download.title': 'Descarga el borrador de tu Contestación',
    'download.body':
      'Esto genera un borrador en PDF con tus decisiones de arriba, el encabezado de tu caso y un bloque de firma. Compáralo con el formulario oficial de Contestación de tu tribunal y revisa cada línea — el secretario del tribunal puede decirte cómo y dónde presentar.',
    'download.bodyUt':
      'Esto genera un borrador en PDF con tus decisiones de arriba, el encabezado de tu caso y un bloque de firma. Usa la declaración no jurada de Utah (no necesita notario). Compáralo con el formulario oficial de Contestación de tu tribunal y revisa cada línea — el secretario del tribunal puede decirte cómo y dónde presentar.',
    'download.button': 'Descargar el borrador de mi Contestación (PDF)',
    'download.preparing': 'Preparando tu Contestación…',
    'download.error': 'No se pudo descargar el documento. Intenta de nuevo.',
    'download.unavailable':
      'El generador de Contestaciones aún no está disponible para tu área. Los servicios de autoayuda de tu tribunal generalmente tienen un formulario de Contestación que puedes usar.',
    'download.officialForms': 'Formularios oficiales de tus tribunales:',
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

/** Parse a stored keyEvents date; date-only strings pin to local midnight. */
function parseEventDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date, lang: Lang): string {
  return d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

let nextRowId = 1;
function newRow(): PositionRow {
  return { id: nextRowId++, paragraph: '', position: null };
}

export default function RespondClient() {
  const router = useRouter();
  // Start in English so the first client render matches SSR; the saved or
  // browser preference applies in an effect right after hydration.
  const [lang, setLangState] = useState<Lang>('en');
  // null until the profile lookup resolves — jurisdiction-specific links
  // (Utah Legal Services, LawHelp.org) must never flash for the wrong user.
  const [stateCode, setStateCode] = useState<string | null>(null);
  // Which side of the case the profile reads as. Petitioners get an
  // informational page and must explicitly confirm they were served before
  // any respondent tooling (deadline, role switch, Answer builder) appears.
  const [perspective, setPerspective] = useState<'petitioner' | 'respondent' | null>(null);
  const [confirmedServed, setConfirmedServed] = useState(false);
  const [deadline, setDeadline] = useState<Deadline>({ kind: 'loading' });
  const [roleStatus, setRoleStatus] = useState<RoleStatus>('idle');
  const [rows, setRows] = useState<PositionRow[]>(() => [newRow()]);
  const [requests, setRequests] = useState<string[]>(['']);
  const [includeCounterclaim, setIncludeCounterclaim] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');

  useEffect(() => {
    setLangState(getInitialLang());
  }, []);

  const chooseLang = useCallback((next: Lang) => {
    setLangState(next);
    setLang(next); // persists to localStorage for future visits
  }, []);

  // Profile (served date + state + stored role) → procedure (deadline days).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let st = 'UT';
      let servedDate: Date | null = null;
      let side: 'petitioner' | 'respondent' = 'petitioner';
      try {
        const res = await fetch('/api/profile');
        const json = await res.json();
        if (json?.success) {
          const p = (json.data?.profile ?? {}) as Record<string, unknown>;
          side = detectPerspective(p);
          if (typeof p.state === 'string' && p.state.trim()) {
            st = p.state.trim().toUpperCase();
          }
          if (p.role === 'respondent') setRoleStatus('saved');
          // First "served" key event with a parseable date — the ingest
          // pipeline labels these e.g. "Served" / "Original petition served
          // on you".
          const events = Array.isArray(p.keyEvents) ? p.keyEvents : [];
          for (const e of events) {
            if (!e || typeof e !== 'object') continue;
            const ev = e as Record<string, unknown>;
            if (!/serv/i.test(String(ev.label ?? ''))) continue;
            const parsed = parseEventDate(String(ev.date ?? ''));
            if (parsed) {
              servedDate = parsed;
              break;
            }
          }
        }
      } catch {
        // No profile — informational mode with no served date.
      }
      if (cancelled) return;
      setStateCode(st);
      setPerspective(side);

      if (!servedDate) {
        setDeadline({ kind: 'no_served_date' });
        return;
      }

      try {
        const res = await fetch(`/api/procedure/${encodeURIComponent(st)}`);
        const json = await res.json();
        const days = json?.success ? json.data?.answerDeadlineDays : null;
        const inState = Number(days?.inState);
        const outOfState = Number(days?.outOfState);
        if (!res.ok || !Number.isFinite(inState) || !Number.isFinite(outOfState)) {
          throw new Error('Procedure not available');
        }
        const dueDate = new Date(servedDate);
        dueDate.setDate(dueDate.getDate() + inState);
        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const daysLeft = Math.round(
          (dueDate.getTime() - todayMidnight.getTime()) / 86400000,
        );
        if (!cancelled) {
          setDeadline({ kind: 'ready', servedDate, dueDate, daysLeft, inState, outOfState });
        }
      } catch {
        // Endpoint missing or state not covered yet — degrade gracefully.
        if (!cancelled) setDeadline({ kind: 'no_procedure', servedDate });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markRespondent = useCallback(async () => {
    setRoleStatus('saving');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'respondent' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error('Save failed');
      setRoleStatus('saved');
      setPerspective('respondent');
    } catch {
      setRoleStatus('error');
    }
  }, []);

  const setRowParagraph = useCallback((id: number, paragraph: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, paragraph } : r)));
  }, []);
  const setRowPosition = useCallback((id: number, position: Position) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, position } : r)));
  }, []);
  const addRow = useCallback(() => setRows((rs) => [...rs, newRow()]), []);
  const removeRow = useCallback(
    (id: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs)),
    [],
  );

  const setRequest = useCallback((idx: number, value: string) => {
    setRequests((prev) => prev.map((r, i) => (i === idx ? value : r)));
  }, []);
  const addRequest = useCallback(() => setRequests((prev) => [...prev, '']), []);
  const removeRequest = useCallback(
    (idx: number) =>
      setRequests((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)),
    [],
  );

  // Only rows the user fully classified are sent — the builder side enforces
  // the same rule (nothing is ever auto-admitted or auto-denied).
  const classifiedPositions = useMemo(
    () =>
      rows
        .filter((r) => r.paragraph.trim() !== '' && r.position !== null)
        .map((r) => ({ paragraph: r.paragraph.trim(), position: r.position as Position })),
    [rows],
  );

  // Blob-anchor download, mirroring ServeGuideClient's pattern.
  const downloadAnswer = useCallback(async () => {
    const st = stateCode ?? 'UT';
    setDownloadStatus('downloading');
    try {
      const res = await fetch('/api/documents/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'answer',
          state: st,
          signatureStyle: 'unsworn',
          // `extra` is merged over the profile data server-side (extra wins).
          // If the route doesn't accept it yet, we get a 400/404 and show the
          // "not available yet" message below.
          extra: {
            answerPositions: classifiedPositions,
            answerRequests: requests.map((r) => r.trim()).filter(Boolean),
            includeCounterclaim,
            role: 'respondent',
          },
        }),
      });
      if (res.status === 400 || res.status === 404) {
        setDownloadStatus('unavailable');
        return;
      }
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `answer-${st}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setDownloadStatus('idle');
    } catch (err) {
      console.error('Answer download failed:', err);
      setDownloadStatus('error');
      setTimeout(() => setDownloadStatus('idle'), 4000);
    }
  }, [stateCode, classifiedPositions, requests, includeCounterclaim]);

  const deadlineUrgent =
    deadline.kind === 'ready' && deadline.daysLeft <= 7;

  // Respondent tooling renders only when the profile reads as a respondent,
  // or after the user explicitly confirms "I was served with papers" —
  // never presented as fact to a petitioner-perspective profile.
  const respondentMode = perspective === 'respondent' || confirmedServed;
  const isUT = stateCode === 'UT';
  const isCA = stateCode !== null && isCanadianJurisdiction(stateCode);
  const officialForms = stateCode !== null ? officialFormsLink(stateCode) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Top nav: back links + EN/ES pill (same pattern as the serve page). */}
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

      {/* Hero — served-framing ONLY once the profile (or the user) says so;
          petitioner-perspective profiles get the informational variant. */}
      <header className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          {tt(lang, respondentMode ? 'hero.eyebrow' : 'hero.eyebrowInfo')}
        </p>
        <h1 className="font-serif text-4xl text-gray-900 sm:text-5xl">
          {tt(lang, respondentMode ? 'hero.title' : 'hero.titleInfo')}
        </h1>
        {(respondentMode || perspective === 'petitioner') && (
          <p className="mt-3 max-w-xl text-gray-600">
            {tt(lang, respondentMode ? 'hero.intro' : 'hero.introInfo')}
          </p>
        )}
        <p className="mt-2 max-w-xl text-sm text-gray-500">{tt(lang, 'hero.upl')}</p>
      </header>

      {/* Non-dismissable advisor note — the lawyer-recommended pattern. */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          {tt(lang, 'advisor.title')}
        </h2>
        <p className="mt-2 text-sm text-amber-900">{tt(lang, 'advisor.body')}</p>
        {stateCode !== null && (
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {/* LawHelp.org is US-only; Utah Legal Services is UT-only. */}
            {!isCA && (
              <li>
                <a
                  href="https://www.lawhelp.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2 hover:text-amber-700"
                >
                  {tt(lang, 'advisor.lawhelp')}
                </a>
              </li>
            )}
            {isUT && (
              <li>
                <a
                  href="https://www.utahlegalservices.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2 hover:text-amber-700"
                >
                  {tt(lang, 'advisor.uls')}
                </a>
              </li>
            )}
            {isCA && <li>{tt(lang, 'advisor.localCa')}</li>}
            {!isUT && officialForms && (
              <li>
                <a
                  href={officialForms.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2 hover:text-amber-700"
                >
                  {officialForms.name}
                </a>
              </li>
            )}
          </ul>
        )}
        <p className="mt-2 text-sm text-amber-900">{tt(lang, 'advisor.continue')}</p>
      </div>

      {/* Perspective guard — a petitioner-perspective profile must
          explicitly confirm being served before any respondent tooling
          (deadline, role switch, Answer builder) is offered. */}
      {perspective === 'petitioner' && !confirmedServed && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 font-serif text-xl text-gray-900">
            <UserCheck className="h-5 w-5 text-brand" aria-hidden="true" />
            {tt(lang, 'confirm.title')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">{tt(lang, 'confirm.body')}</p>
          <button
            onClick={() => setConfirmedServed(true)}
            className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong"
          >
            {tt(lang, 'confirm.button')}
          </button>
        </div>
      )}

      {/* Deadline banner — respondent mode only. */}
      {respondentMode && deadline.kind === 'loading' && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {tt(lang, 'deadline.loading')}
        </div>
      )}

      {respondentMode && deadline.kind === 'ready' && (
        <div
          className={`mb-6 rounded-xl border p-4 sm:p-5 ${
            deadlineUrgent ? 'border-red-300 bg-red-50' : 'border-brand-soft bg-brand-tint/50'
          }`}
        >
          <h2
            className={`flex items-center gap-2 font-semibold ${
              deadlineUrgent ? 'text-red-900' : 'text-gray-900'
            }`}
          >
            <CalendarClock
              className={`h-5 w-5 shrink-0 ${deadlineUrgent ? 'text-red-700' : 'text-brand'}`}
              aria-hidden="true"
            />
            {tt(lang, 'deadline.title')}
          </h2>
          <div className={`mt-2 text-sm ${deadlineUrgent ? 'text-red-900' : 'text-gray-700'}`}>
            <p>{tt(lang, 'deadline.served', { date: formatDate(deadline.servedDate, lang) })}</p>
            <p className="mt-1 font-semibold">
              {tt(lang, 'deadline.due', { date: formatDate(deadline.dueDate, lang) })}
              {' — '}
              {deadline.daysLeft < 0
                ? tt(lang, 'deadline.past')
                : deadline.daysLeft === 1
                  ? tt(lang, 'deadline.daysLeft1')
                  : tt(lang, 'deadline.daysLeft', { n: deadline.daysLeft })}
            </p>
            <p className="mt-1">
              {tt(lang, 'deadline.explain', {
                inState: deadline.inState,
                outOfState: deadline.outOfState,
              })}
            </p>
            {deadlineUrgent && <p className="mt-2">{tt(lang, 'deadline.warning')}</p>}
          </div>
        </div>
      )}

      {respondentMode && deadline.kind === 'no_procedure' && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <CalendarClock className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            {tt(lang, 'deadline.title')}
          </h2>
          <p className="mt-2 text-sm text-gray-700">
            {tt(lang, 'deadline.served', { date: formatDate(deadline.servedDate, lang) })}
          </p>
          <p className="mt-1 text-sm text-gray-700">{tt(lang, 'deadline.noProc')}</p>
        </div>
      )}

      {respondentMode && deadline.kind === 'no_served_date' && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <CalendarClock className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            {tt(lang, 'deadline.noDate.title')}
          </h2>
          <p className="mt-2 text-sm text-gray-700">{tt(lang, 'deadline.noDate.body')}</p>
          <button
            onClick={() => router.push('/profile')}
            className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong"
          >
            {tt(lang, 'deadline.noDate.cta')}
          </button>
        </div>
      )}

      {/* Respondent tooling — only in respondent mode. */}
      {respondentMode && (
        <>
      {/* Mark me as the respondent. */}
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 font-serif text-xl text-gray-900">
          <UserCheck className="h-5 w-5 text-brand" aria-hidden="true" />
          {tt(lang, 'role.title')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">{tt(lang, 'role.body')}</p>
        {roleStatus === 'saved' ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
            <Check className="h-4 w-4" aria-hidden="true" />
            {tt(lang, 'role.done')}
          </p>
        ) : (
          <div className="mt-3">
            <button
              onClick={markRespondent}
              disabled={roleStatus === 'saving'}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong disabled:opacity-60"
            >
              {roleStatus === 'saving' && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {roleStatus === 'saving' ? tt(lang, 'role.saving') : tt(lang, 'role.button')}
            </button>
            {roleStatus === 'error' && (
              <p className="mt-1.5 text-sm text-red-600">{tt(lang, 'role.error')}</p>
            )}
          </div>
        )}
      </section>

      {/* Position builder — the user's own admit/deny/don't-know choices. */}
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-serif text-xl text-gray-900">{tt(lang, 'positions.title')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">{tt(lang, 'positions.intro')}</p>
        <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
          <li>
            <span className="font-semibold">{tt(lang, 'positions.admit')}</span> —{' '}
            {tt(lang, 'positions.admitHelp')}
          </li>
          <li>
            <span className="font-semibold">{tt(lang, 'positions.deny')}</span> —{' '}
            {tt(lang, 'positions.denyHelp')}
          </li>
          <li>
            <span className="font-semibold">{tt(lang, 'positions.dk')}</span> —{' '}
            {tt(lang, 'positions.dkHelp')}
          </li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">{tt(lang, 'positions.noAuto')}</p>

        <div className="mt-4 flex flex-col gap-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-3"
            >
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <span className="whitespace-nowrap">{tt(lang, 'positions.paragraph')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  value={row.paragraph}
                  onChange={(e) => setRowParagraph(row.id, e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </label>
              <div
                role="group"
                aria-label={tt(lang, 'positions.positionAria', {
                  n: row.paragraph || '?',
                })}
                className="flex flex-wrap gap-1.5"
              >
                {(
                  [
                    ['admit', 'positions.admit'],
                    ['deny', 'positions.deny'],
                    ['lack_knowledge', 'positions.dk'],
                  ] as const
                ).map(([value, labelKey]) => (
                  <button
                    key={value}
                    onClick={() => setRowPosition(row.id, value)}
                    aria-pressed={row.position === value}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      row.position === value
                        ? 'border-brand bg-brand text-brand-on'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'
                    }`}
                  >
                    {tt(lang, labelKey)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                aria-label={tt(lang, 'positions.remove')}
                className="ml-auto rounded-lg p-1.5 text-gray-400 transition-colors hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addRow}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {tt(lang, 'positions.add')}
        </button>
      </section>

      {/* Requests to the court — the user's own words, transcribed. */}
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-serif text-xl text-gray-900">{tt(lang, 'requests.title')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">{tt(lang, 'requests.intro')}</p>
        <div className="mt-4 flex flex-col gap-2">
          {requests.map((request, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                maxLength={500}
                value={request}
                onChange={(e) => setRequest(idx, e.target.value)}
                placeholder={tt(lang, 'requests.placeholder')}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <button
                onClick={() => removeRequest(idx)}
                disabled={requests.length === 1}
                aria-label={tt(lang, 'requests.remove')}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addRequest}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {tt(lang, 'requests.add')}
        </button>

        {/* Counterclaim toggle. */}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
          <input
            type="checkbox"
            checked={includeCounterclaim}
            onChange={(e) => setIncludeCounterclaim(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
          />
          <span className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{tt(lang, 'counterclaim.title')}.</span>{' '}
            {tt(lang, 'counterclaim.body')}
          </span>
        </label>
      </section>

      {/* Download. */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-serif text-xl text-gray-900">{tt(lang, 'download.title')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          {tt(lang, isUT ? 'download.bodyUt' : 'download.body')}
        </p>
        {downloadStatus === 'unavailable' ? (
          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <p>{tt(lang, 'download.unavailable')}</p>
            {officialForms && (
              <p className="mt-2">
                {tt(lang, 'download.officialForms')}{' '}
                <a
                  href={officialForms.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand underline hover:text-brand-strong"
                >
                  {officialForms.name}
                </a>
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <button
              onClick={downloadAnswer}
              disabled={downloadStatus === 'downloading'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong disabled:opacity-60 sm:w-auto"
            >
              {downloadStatus === 'downloading' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {downloadStatus === 'downloading'
                ? tt(lang, 'download.preparing')
                : tt(lang, 'download.button')}
            </button>
            {downloadStatus === 'error' && (
              <p className="mt-1.5 text-sm text-red-600">{tt(lang, 'download.error')}</p>
            )}
          </div>
        )}
      </section>
        </>
      )}
    </main>
  );
}
