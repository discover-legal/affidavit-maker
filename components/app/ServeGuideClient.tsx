'use client';

/**
 * Guided "Serve the papers" page — the step where most pro se divorces
 * stall. Plain-language walkthrough of the service-of-process methods for
 * the user's state (Utah first), with downloadable helper forms.
 *
 * Reads two sibling API contracts:
 *   GET  /api/procedure/[state]      → { success, data: StateProcedure }
 *   POST /api/documents/support      → application/pdf stream
 *   GET  /api/documents/support?state=XX → { success, data: { kinds } }
 * If either isn't live yet the page degrades to a friendly
 * "not available yet" message — nothing here hard-depends on them.
 *
 * UPL note: everything on this page is general information about a court
 * process, never advice about what the user should do — their court
 * decides their case.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Download,
  FileCheck,
  Loader2,
} from 'lucide-react';
import { getInitialLang, setLang, type Lang } from '@/lib/i18n';

type ServiceMethod = {
  key: string;
  title: string;
  steps: string[];
};

type StateProcedure = {
  serviceMethods: ServiceMethod[];
  answerDeadlineDays: { inState: number; outOfState: number };
  stateName?: string;
};

type SupportKind = {
  key: string;
  title: string;
  titleEs?: string;
  description?: string;
  descriptionEs?: string;
};

type SupportFormKind = 'acceptance_of_service' | 'certificate_of_service';

type LoadState = 'loading' | 'ready' | 'unavailable';
type FormStatus = 'idle' | 'downloading' | 'error';

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
    'hero.title': 'Serving the papers',
    'hero.intro':
      'After you file, {name} must officially receive a copy of your papers — the court calls this “service of process.” Nothing in your case moves forward until it happens.',
    'hero.upl':
      'This page is general information about how service usually works, not legal advice. Your court decides what applies in your case.',
    'hero.otherParty': 'the other party',

    'methods.heading': 'Ways to serve',
    'methods.sub':
      'Courts generally allow a few different ways to complete service. Read through them and pick the one that fits your situation.',

    'loading.steps': 'Loading the steps…',
    'unavailable.body':
      'Step-by-step service instructions for your state aren’t available here yet. Your court clerk or self-help center can walk you through how service works where you filed.',
    'unavailable.retry': 'Try again',

    'forms.acceptance': 'Download an Acceptance of Service draft',
    'forms.certificate': 'Download a Certificate of Service draft',
    'forms.preparing': 'Preparing your draft…',
    'forms.error': 'The draft couldn’t be downloaded. Please try again.',

    'proof.title': 'Prove it happened',
    'proof.body':
      'Once the papers are delivered, the court needs written proof of when and how they were delivered. Until that proof is filed, the court treats service as incomplete.',

    'deadline.title': 'What happens next',
    'deadline.body':
      'After service, the other party generally has {inState} days to respond ({outOfState} if served out of state). The clock starts when service is complete — another reason the proof matters.',

    'dont.title': 'What NOT to do',
    'dont.hand':
      'You may not hand the papers to the other party yourself when formal service is required. Courts generally require a neutral adult — like a sheriff, constable, or professional process server — to deliver them.',
    'dont.copies':
      'Don’t lose the paper trail. Keep copies of everything you file, send, and receive, and note the dates.',
  },
  es: {
    'lang.en': 'English',
    'lang.es': 'Español',
    'lang.toggleAria': 'Idioma de la página',

    'nav.dashboard': 'Panel',
    'nav.lifeStory': 'La historia de tu vida',

    'hero.eyebrow': 'Paso a paso',
    'hero.title': 'Entregar los papeles',
    'hero.intro':
      'Después de presentar tu caso, {name} debe recibir oficialmente una copia de tus papeles — el tribunal lo llama “notificación” (service of process). Nada en tu caso avanza hasta que esto suceda.',
    'hero.upl':
      'Esta página es información general sobre cómo suele funcionar la notificación, no asesoría legal. Tu tribunal decide qué aplica en tu caso.',
    'hero.otherParty': 'la otra parte',

    'methods.heading': 'Formas de notificar',
    'methods.sub':
      'Los tribunales generalmente permiten varias formas de completar la notificación. Léelas y elige la que se ajuste a tu situación.',

    'loading.steps': 'Cargando los pasos…',
    'unavailable.body':
      'Las instrucciones paso a paso de notificación para tu estado aún no están disponibles aquí. El secretario del tribunal o el centro de autoayuda pueden explicarte cómo funciona la notificación donde presentaste tu caso.',
    'unavailable.retry': 'Intentar de nuevo',

    'forms.acceptance': 'Descargar un borrador de Aceptación de Notificación',
    'forms.certificate': 'Descargar un borrador de Certificado de Notificación',
    'forms.preparing': 'Preparando tu borrador…',
    'forms.error': 'No se pudo descargar el borrador. Intenta de nuevo.',

    'proof.title': 'Demuestra que sucedió',
    'proof.body':
      'Una vez entregados los papeles, el tribunal necesita prueba por escrito de cuándo y cómo se entregaron. Hasta que se presente esa prueba, el tribunal considera la notificación incompleta.',

    'deadline.title': 'Qué sigue después',
    'deadline.body':
      'Después de la notificación, la otra parte generalmente tiene {inState} días para responder ({outOfState} si fue notificada fuera del estado). El plazo empieza cuando la notificación se completa — otra razón por la que la prueba importa.',

    'dont.title': 'Qué NO hacer',
    'dont.hand':
      'No puedes entregarle los papeles a la otra parte tú mismo cuando se requiere notificación formal. Los tribunales generalmente exigen que los entregue un adulto neutral — como un alguacil o un notificador profesional.',
    'dont.copies':
      'No pierdas el rastro en papel. Guarda copias de todo lo que presentes, envíes y recibas, y anota las fechas.',
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

/** Which downloadable helper form (if any) belongs on a method card. */
function kindForMethod(methodKey: string): SupportFormKind | null {
  const k = methodKey.toLowerCase();
  if (k.includes('accept')) return 'acceptance_of_service';
  if (k.includes('certificate') || k.includes('proof')) return 'certificate_of_service';
  return null;
}

function FormDownloadButton({
  kind,
  lang,
  status,
  description,
  onDownload,
}: {
  kind: SupportFormKind;
  lang: Lang;
  status: FormStatus;
  description?: string;
  onDownload: (kind: SupportFormKind) => void;
}) {
  const label =
    kind === 'acceptance_of_service'
      ? tt(lang, 'forms.acceptance')
      : tt(lang, 'forms.certificate');
  return (
    <div className="mt-4">
      <button
        onClick={() => onDownload(kind)}
        disabled={status === 'downloading'}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong disabled:opacity-60 sm:w-auto"
      >
        {status === 'downloading' ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        {status === 'downloading' ? tt(lang, 'forms.preparing') : label}
      </button>
      {description && <p className="mt-1.5 text-xs text-gray-500">{description}</p>}
      {status === 'error' && (
        <p className="mt-1.5 text-sm text-red-600">{tt(lang, 'forms.error')}</p>
      )}
    </div>
  );
}

export default function ServeGuideClient() {
  const router = useRouter();
  // Start in English so the first client render matches SSR; the saved or
  // browser preference applies in an effect right after hydration.
  const [lang, setLangState] = useState<Lang>('en');
  // null until the profile lookup resolves (it decides the state code).
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [respondentFirst, setRespondentFirst] = useState('');
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [procedure, setProcedure] = useState<StateProcedure | null>(null);
  const [supportKinds, setSupportKinds] = useState<SupportKind[]>([]);
  const [formStatus, setFormStatus] = useState<Record<SupportFormKind, FormStatus>>({
    acceptance_of_service: 'idle',
    certificate_of_service: 'idle',
  });

  useEffect(() => {
    setLangState(getInitialLang());
  }, []);

  const chooseLang = useCallback((next: Lang) => {
    setLangState(next);
    setLang(next); // persists to localStorage for future visits
  }, []);

  // Profile → which state's procedure to show + who "the other party" is.
  // An explicit ?state=XX in the URL wins over the profile (deep links,
  // e.g. from a state-specific resource page).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let st = 'UT';
      let respondent = '';
      const urlState = new URLSearchParams(window.location.search).get('state');
      const urlOverride = /^[A-Za-z]{2}$/.test(urlState ?? '') ? urlState!.toUpperCase() : null;
      try {
        const res = await fetch('/api/profile');
        const json = await res.json();
        if (json?.success) {
          const p = (json.data?.profile ?? {}) as Record<string, unknown>;
          if (typeof p.state === 'string' && p.state.trim()) {
            st = p.state.trim().toUpperCase();
          }
          const rawName =
            (typeof p.respondentFirstName === 'string' && p.respondentFirstName.trim()) ||
            (typeof p.respondentName === 'string' && p.respondentName.trim()) ||
            '';
          respondent = rawName.split(/\s+/)[0] ?? '';
        }
      } catch {
        // No profile — fall back to Utah and generic copy.
      }
      if (cancelled) return;
      setRespondentFirst(respondent);
      setStateCode(urlOverride ?? st);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProcedure = useCallback(async (state: string) => {
    setLoadState('loading');
    try {
      const res = await fetch(`/api/procedure/${encodeURIComponent(state)}`);
      const json = await res.json();
      const data = json?.success ? (json.data as StateProcedure) : null;
      if (!res.ok || !data || !Array.isArray(data.serviceMethods) || data.serviceMethods.length === 0) {
        throw new Error('Procedure not available');
      }
      setProcedure(data);
      setLoadState('ready');
    } catch {
      // Endpoint missing or state not covered yet — degrade gracefully.
      setProcedure(null);
      setLoadState('unavailable');
    }
  }, []);

  useEffect(() => {
    if (stateCode) loadProcedure(stateCode);
  }, [stateCode, loadProcedure]);

  // Optional metadata about the helper forms (localized titles/blurbs).
  // Purely decorative here — a failure just means plainer buttons.
  useEffect(() => {
    if (!stateCode) return;
    let cancelled = false;
    fetch(`/api/documents/support?state=${encodeURIComponent(stateCode)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success) return;
        const kinds = json.data?.kinds;
        if (Array.isArray(kinds)) setSupportKinds(kinds as SupportKind[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stateCode]);

  const kindDescription = useCallback(
    (kind: SupportFormKind): string | undefined => {
      const meta = supportKinds.find((k) => k.key === kind);
      if (!meta) return undefined;
      return (lang === 'es' ? meta.descriptionEs : meta.description) || meta.description;
    },
    [supportKinds, lang],
  );

  // Blob-anchor download, mirroring GenerateButton's pattern.
  const downloadForm = useCallback(
    async (kind: SupportFormKind) => {
      const state = stateCode || 'UT';
      setFormStatus((s) => ({ ...s, [kind]: 'downloading' }));
      try {
        const res = await fetch('/api/documents/support', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, state }),
        });
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${kind.replace(/_/g, '-')}-${state}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setFormStatus((s) => ({ ...s, [kind]: 'idle' }));
      } catch (err) {
        console.error('Support form download failed:', err);
        setFormStatus((s) => ({ ...s, [kind]: 'error' }));
        setTimeout(() => setFormStatus((s) => ({ ...s, [kind]: 'idle' })), 4000);
      }
    },
    [stateCode],
  );

  const methods = procedure?.serviceMethods ?? [];
  const certificateOnAMethod = methods.some(
    (m) => kindForMethod(m.key) === 'certificate_of_service',
  );
  const inStateDays = Number(procedure?.answerDeadlineDays?.inState);
  const outOfStateDays = Number(procedure?.answerDeadlineDays?.outOfState);
  const showDeadline =
    loadState === 'ready' && Number.isFinite(inStateDays) && Number.isFinite(outOfStateDays);
  const otherParty = respondentFirst || tt(lang, 'hero.otherParty');

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Top nav: back links + EN/ES pill (same pattern as the profile page). */}
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

      {/* Hero — why this step exists, in plain language. */}
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          {tt(lang, 'hero.eyebrow')}
        </p>
        <h1 className="font-serif text-4xl text-gray-900 sm:text-5xl">
          {tt(lang, 'hero.title')}
        </h1>
        <p className="mt-3 max-w-xl text-gray-600">
          {tt(lang, 'hero.intro', { name: otherParty })}
        </p>
        <p className="mt-2 max-w-xl text-sm text-gray-500">{tt(lang, 'hero.upl')}</p>
      </header>

      {loadState === 'loading' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="space-y-4" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-4 rounded bg-gray-100" style={{ width: `${78 - i * 16}%` }} />
            ))}
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {tt(lang, 'loading.steps')}
          </p>
        </div>
      )}

      {loadState === 'unavailable' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="mx-auto max-w-md text-gray-700">{tt(lang, 'unavailable.body')}</p>
          <button
            onClick={() => stateCode && loadProcedure(stateCode)}
            className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on transition-colors hover:bg-brand-strong"
          >
            {tt(lang, 'unavailable.retry')}
          </button>
        </div>
      )}

      {loadState === 'ready' && (
        <>
          {/* Method chooser — one card per way to complete service. */}
          <section aria-label={tt(lang, 'methods.heading')}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              {tt(lang, 'methods.heading')}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-gray-600">{tt(lang, 'methods.sub')}</p>
            <div className="mt-4 flex flex-col gap-4">
              {methods.map((method) => {
                const formKind = kindForMethod(method.key);
                return (
                  <div
                    key={method.key}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
                  >
                    <h3 className="font-serif text-xl text-gray-900">{method.title}</h3>
                    <ol className="mt-3 space-y-2.5">
                      {method.steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm leading-relaxed text-gray-700">
                          <span
                            aria-hidden="true"
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-brand-strong"
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0">{step}</span>
                        </li>
                      ))}
                    </ol>
                    {formKind && (
                      <FormDownloadButton
                        kind={formKind}
                        lang={lang}
                        status={formStatus[formKind]}
                        description={kindDescription(formKind)}
                        onDownload={downloadForm}
                      />
                    )}
                  </div>
                );
              })}

              {/* Proof of service — its own card unless a method already carries it. */}
              {!certificateOnAMethod && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                  <h3 className="flex items-center gap-2 font-serif text-xl text-gray-900">
                    <FileCheck className="h-5 w-5 text-brand" aria-hidden="true" />
                    {tt(lang, 'proof.title')}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-700">
                    {tt(lang, 'proof.body')}
                  </p>
                  <FormDownloadButton
                    kind="certificate_of_service"
                    lang={lang}
                    status={formStatus.certificate_of_service}
                    description={kindDescription('certificate_of_service')}
                    onDownload={downloadForm}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Answer-deadline callout — what the clock looks like after service. */}
          {showDeadline && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-brand-soft bg-brand-tint/50 p-4">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">
                  {tt(lang, 'deadline.title')}.
                </span>{' '}
                {tt(lang, 'deadline.body', {
                  inState: inStateDays,
                  outOfState: outOfStateDays,
                })}
              </p>
            </div>
          )}
        </>
      )}

      {/* What NOT to do — static, shown regardless of the procedure fetch. */}
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-semibold text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          {tt(lang, 'dont.title')}
        </h2>
        <ul className="mt-2 space-y-2 text-sm text-amber-900">
          <li className="flex gap-2">
            <span aria-hidden="true" className="select-none">•</span>
            <span>{tt(lang, 'dont.hand')}</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="select-none">•</span>
            <span>{tt(lang, 'dont.copies')}</span>
          </li>
        </ul>
      </div>
    </main>
  );
}
