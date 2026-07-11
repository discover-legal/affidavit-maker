/**
 * Tiny dependency-free i18n helper for the pro se UI (v1: the /profile
 * "life story" page). Flat string tables, English fallback, and a
 * localStorage-persisted preference — no library, no context provider.
 *
 * Known v1 limits: dates render via formatFriendlyDate (en-US month names)
 * and numbers via toLocaleString('en-US') regardless of language.
 */

export type Lang = 'en' | 'es';

export const LANG_STORAGE_KEY = 'dl_lang';

export const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    'lang.en': 'English',
    'lang.es': 'Español',
    'lang.toggleAria': 'Page language',

    'nav.dashboard': 'Dashboard',

    'header.eyebrow': 'In the matter of',
    'header.title': 'Your life story',
    'header.subtitle':
      'Everything your assistant remembers from your conversations — so you never have to repeat yourself, in any document.',

    'meter.complete': 'Your core story is complete',
    'meter.progress': '{known} of {total} story details shared',

    'loading.opening': 'Opening your story…',
    'error.cantOpen': 'Your story couldn’t be opened.',
    'error.tryAgain': 'Try again',

    'empty.title': 'Your story hasn’t started yet',
    'empty.body':
      'Start a document and tell the assistant about your situation. Everything you share is remembered here, ready for the next document.',
    'empty.blank': 'Your name is …',
    'empty.cta': 'Start your first document',

    'story.aria': 'What your assistant knows',
    'story.addTitle': 'Add this to your story',

    'children.none': 'You have no minor children.',
    'children.one': 'You have one child.',
    'children.many': 'You have {n} children.',

    'actions.fix': 'Fix my story',
    'actions.addPaper': 'Add a court paper',

    'next.aria': 'Your next steps',
    'next.heading': 'What’s next',
    'next.intro':
      'The usual path for a {stateName} divorce. General information — your court decides your case.',
    'next.due': 'Due {date}',
    'next.done': 'Done',
    'next.calendar': 'Add my deadlines to my calendar',

    'stepper.aria': 'Your case at a glance',
    'stepper.caption':
      'Where your case generally is — the court decides the real timeline.',
    'stepper.due': 'due {date}',
    'stepper.stepDone': 'done',
    'stepper.stepCurrent': 'current step',

    'respond.banner': 'You were served with papers — you can prepare your answer here.',
    'respond.daysLeft': '{n} days left to file your answer.',
    'respond.dayLeft': '1 day left to file your answer.',
    'respond.overdue': 'The answer deadline may have passed — responding soon still matters.',
    'respond.cta': 'Build your answer',

    'docs.aria': 'Papers you can create',
    'docs.heading': 'Papers you can create',
    'docs.intro':
      'Court-ready PDFs filled in from your story. Review everything before you sign or file.',
    'docs.download': 'Download',
    'docs.preparing': 'Preparing…',
    'docs.error': 'The download didn’t work. Please try again.',
    'docs.answerCta': 'Build your answer',
    'docs.answerNote': 'This one is built step by step — you choose what to admit or deny.',
    'docs.handoffTitle': 'Taking this to a lawyer?',
    'docs.handoffBody': 'Download a case summary they can read in ten minutes.',
    'docs.ocapPre': 'Utah has a free official tool you can use to check our work: ',
    'docs.ocapLink': 'OCAP, the Utah Courts’ Online Court Assistance Program',
    'docs.hearing': 'Your day in court — how to prepare',

    'ledger.aria': 'Legal details on record',
    'ledger.heading': 'Also on the record',
    'ledger.add': 'add this +',

    'chapters.aria': 'Facts you have shared',
    'chapters.heading': 'In your own words',

    'privacy.aria': 'Privacy',
    'privacy.title': 'This story is yours.',
    'privacy.body':
      'It stays private to your account and is used only to fill in your documents. Erasing it won’t touch any saved documents.',
    'privacy.erase': 'Erase my story',
    'privacy.eraseAll': 'Erase everything',
    'privacy.keep': 'Keep it',

    'feeWaiver.p1a': 'Based on the income you’ve shared, you ',
    'feeWaiver.may': 'may qualify',
    'feeWaiver.p1b': ' to ask the court to waive its filing fees (a “fee waiver”).',
    'feeWaiver.add': 'Add this to your documents',
    'feeWaiver.p2a': '. This is general information, not legal advice — a ',
    'feeWaiver.legalAid': 'legal-aid office',
    'feeWaiver.p2b': ' can confirm what applies to you.',

    'advisor.lead': 'A lawyer’s advice is recommended for: ',
    'advisor.body':
      ' You can keep working here — and free or low-cost legal help is available through ',

    'money.in': 'Comes in',
    'money.out': 'Goes out',
    'money.perMonth': '/mo',
    'money.leftOver': 'left over each month',
    'money.short': 'short each month',

    'timeline.today': 'Today',

    'edit.title': 'Fix your story',
    'edit.body':
      'Changes here update what the assistant remembers. Existing documents keep their own copy until you continue them in chat.',
    'edit.yourName': 'Your name',
    'edit.spouseName': 'Spouse’s name',
    'edit.marriageDate': 'Marriage date',
    'edit.separationDate': 'Separation date',
    'edit.children': 'Children',
    'edit.childName': 'Name',
    'edit.childDob': 'Born YYYY-MM-DD',
    'edit.addChild': '+ Add a child',
    'edit.removeChild': 'Remove {name}',
    'edit.aChild': 'child',
    'edit.save': 'Save changes',
    'edit.cancel': 'Cancel',
    'edit.saveFailed': 'Save failed',

    'ingest.title': 'Add a court paper',
    'ingest.body':
      'Got served or received something from the court? Paste its text here — or add a photo of it — dates go on your timeline and what it says joins your story, marked as coming from that document.',
    'ingest.labelPlaceholder':
      "What is it? (e.g. 'Papers I was served', 'Hearing notice') — optional",
    'ingest.textPlaceholder': 'Paste the document’s text here…',
    'ingest.textPlaceholderPhoto': 'Photo attached — text is optional',
    'ingest.photoAdd': 'or add a photo',
    'ingest.photoChange': 'Choose a different photo',
    'ingest.photoRemove': 'Remove',
    'ingest.photoRemoveAria': 'Remove photo',
    'ingest.errType': 'Only PNG and JPEG photos are supported.',
    'ingest.errSize': 'That photo is too large — 8MB max. Try a smaller one or paste the text.',
    'ingest.errRead': 'Could not read that file — try again or paste the text.',
    'ingest.errFail': 'Could not read this document',
    'ingest.submit': 'Read this document',
    'ingest.submitBusyPhoto': 'Reading your photo…',
    'ingest.summary':
      'Read “{kind}” — added {events} {eventsNoun} to your timeline and {facts} {factsNoun} to your record.',
    'ingest.event': 'event',
    'ingest.events': 'events',
    'ingest.statement': 'statement',
    'ingest.statements': 'statements',
    'ingest.defaultKind': 'document',

    'request.failed': 'Request failed',
  },
  es: {
    'lang.en': 'English',
    'lang.es': 'Español',
    'lang.toggleAria': 'Idioma de la página',

    'nav.dashboard': 'Panel',

    'header.eyebrow': 'En el asunto de',
    'header.title': 'La historia de tu vida',
    'header.subtitle':
      'Todo lo que tu asistente recuerda de tus conversaciones — para que nunca tengas que repetirte, en ningún documento.',

    'meter.complete': 'Tu historia principal está completa',
    'meter.progress': '{known} de {total} detalles de tu historia compartidos',

    'loading.opening': 'Abriendo tu historia…',
    'error.cantOpen': 'No se pudo abrir tu historia.',
    'error.tryAgain': 'Intentar de nuevo',

    'empty.title': 'Tu historia aún no ha comenzado',
    'empty.body':
      'Comienza un documento y cuéntale al asistente tu situación. Todo lo que compartas se recuerda aquí, listo para el próximo documento.',
    'empty.blank': 'Tu nombre es …',
    'empty.cta': 'Comienza tu primer documento',

    'story.aria': 'Lo que tu asistente sabe',
    'story.addTitle': 'Agrega esto a tu historia',

    'children.none': 'No tienes hijos menores de edad.',
    'children.one': 'Tienes un hijo.',
    'children.many': 'Tienes {n} hijos.',

    'actions.fix': 'Corregir mi historia',
    'actions.addPaper': 'Agregar un documento del tribunal',

    'next.aria': 'Tus próximos pasos',
    'next.heading': '¿Qué sigue?',
    'next.intro':
      'El camino usual de un divorcio en {stateName}. Información general — tu tribunal decide tu caso.',
    'next.due': 'Vence {date}',
    'next.done': 'Hecho',
    'next.calendar': 'Agregar mis fechas límite a mi calendario',

    'stepper.aria': 'Tu caso de un vistazo',
    'stepper.caption':
      'Dónde va tu caso en general — el tribunal decide el calendario real.',
    'stepper.due': 'vence {date}',
    'stepper.stepDone': 'hecho',
    'stepper.stepCurrent': 'paso actual',

    'respond.banner': 'Te entregaron papeles — aquí puedes preparar tu respuesta.',
    'respond.daysLeft': 'Te quedan {n} días para presentar tu respuesta.',
    'respond.dayLeft': 'Te queda 1 día para presentar tu respuesta.',
    'respond.overdue':
      'Es posible que el plazo para responder ya haya pasado — responder pronto todavía importa.',
    'respond.cta': 'Prepara tu respuesta',

    'docs.aria': 'Documentos que puedes crear',
    'docs.heading': 'Documentos que puedes crear',
    'docs.intro':
      'PDFs listos para el tribunal, completados con tu historia. Revisa todo antes de firmar o presentar.',
    'docs.download': 'Descargar',
    'docs.preparing': 'Preparando…',
    'docs.error': 'No se pudo descargar. Intenta de nuevo.',
    'docs.answerCta': 'Prepara tu respuesta',
    'docs.answerNote': 'Este se prepara paso a paso — tú eliges qué admitir o negar.',
    'docs.handoffTitle': '¿Vas a llevar esto a un abogado?',
    'docs.handoffBody': 'Descarga un resumen de tu caso que pueden leer en diez minutos.',
    'docs.ocapPre':
      'Utah tiene una herramienta oficial gratuita para verificar nuestro trabajo: ',
    'docs.ocapLink': 'OCAP, el programa de asistencia en línea de los tribunales de Utah',
    'docs.hearing': 'Tu día en el tribunal — cómo prepararte',

    'ledger.aria': 'Detalles legales registrados',
    'ledger.heading': 'También en el registro',
    'ledger.add': 'agregar esto +',

    'chapters.aria': 'Hechos que has compartido',
    'chapters.heading': 'En tus propias palabras',

    'privacy.aria': 'Privacidad',
    'privacy.title': 'Esta historia es tuya.',
    'privacy.body':
      'Se mantiene privada en tu cuenta y se usa solo para completar tus documentos. Borrarla no afectará ningún documento guardado.',
    'privacy.erase': 'Borrar mi historia',
    'privacy.eraseAll': 'Borrar todo',
    'privacy.keep': 'Conservarla',

    'feeWaiver.p1a': 'Según los ingresos que has compartido, ',
    'feeWaiver.may': 'podrías calificar',
    'feeWaiver.p1b':
      ' para pedirle al tribunal que exima sus cuotas de presentación (una “exención de cuotas”).',
    'feeWaiver.add': 'Agregar esto a tus documentos',
    'feeWaiver.p2a': '. Esta es información general, no asesoría legal — una ',
    'feeWaiver.legalAid': 'oficina de ayuda legal',
    'feeWaiver.p2b': ' puede confirmar qué aplica en tu caso.',

    'advisor.lead': 'Se recomienda el consejo de un abogado para: ',
    'advisor.body':
      ' Puedes seguir trabajando aquí — y hay ayuda legal gratuita o de bajo costo disponible a través de ',

    'money.in': 'Entra',
    'money.out': 'Sale',
    'money.perMonth': '/mes',
    'money.leftOver': 'sobran cada mes',
    'money.short': 'faltan cada mes',

    'timeline.today': 'Hoy',

    'edit.title': 'Corrige tu historia',
    'edit.body':
      'Los cambios aquí actualizan lo que el asistente recuerda. Los documentos existentes conservan su propia copia hasta que los continúes en el chat.',
    'edit.yourName': 'Tu nombre',
    'edit.spouseName': 'Nombre de tu cónyuge',
    'edit.marriageDate': 'Fecha de matrimonio',
    'edit.separationDate': 'Fecha de separación',
    'edit.children': 'Hijos',
    'edit.childName': 'Nombre',
    'edit.childDob': 'Nació AAAA-MM-DD',
    'edit.addChild': '+ Agregar un hijo',
    'edit.removeChild': 'Quitar a {name}',
    'edit.aChild': 'este hijo',
    'edit.save': 'Guardar cambios',
    'edit.cancel': 'Cancelar',
    'edit.saveFailed': 'No se pudo guardar',

    'ingest.title': 'Agregar un documento del tribunal',
    'ingest.body':
      '¿Te entregaron papeles o recibiste algo del tribunal? Pega su texto aquí — o agrega una foto — las fechas van a tu línea de tiempo y lo que dice se une a tu historia, marcado como proveniente de ese documento.',
    'ingest.labelPlaceholder':
      '¿Qué es? (p. ej. “Papeles que me entregaron”, “Aviso de audiencia”) — opcional',
    'ingest.textPlaceholder': 'Pega aquí el texto del documento…',
    'ingest.textPlaceholderPhoto': 'Foto adjunta — el texto es opcional',
    'ingest.photoAdd': 'o agrega una foto',
    'ingest.photoChange': 'Elegir otra foto',
    'ingest.photoRemove': 'Quitar',
    'ingest.photoRemoveAria': 'Quitar la foto',
    'ingest.errType': 'Solo se admiten fotos PNG y JPEG.',
    'ingest.errSize':
      'Esa foto es demasiado grande — máximo 8MB. Prueba con una más pequeña o pega el texto.',
    'ingest.errRead': 'No se pudo leer ese archivo — intenta de nuevo o pega el texto.',
    'ingest.errFail': 'No se pudo leer este documento',
    'ingest.submit': 'Leer este documento',
    'ingest.submitBusyPhoto': 'Leyendo tu foto…',
    'ingest.summary':
      'Se leyó “{kind}” — se agregaron {events} {eventsNoun} a tu línea de tiempo y {facts} {factsNoun} a tu registro.',
    'ingest.event': 'evento',
    'ingest.events': 'eventos',
    'ingest.statement': 'declaración',
    'ingest.statements': 'declaraciones',
    'ingest.defaultKind': 'documento',

    'request.failed': 'La solicitud falló',
  },
};

/**
 * Look up a UI string. Missing Spanish keys fall back to English; a key
 * missing everywhere comes back as itself so the page never renders blank.
 * Optional `{name}` placeholders are replaced from `vars`.
 */
export function t(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  let out = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) {
    for (const [name, val] of Object.entries(vars)) {
      out = out.split(`{${name}}`).join(String(val));
    }
  }
  return out;
}

/**
 * The language to start in: the saved preference when present, else the
 * browser language (any `es-*`), else English. Safe on the server —
 * without a `window` it always answers 'en', so first paint matches SSR
 * and the client corrects itself in an effect.
 */
export function getInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    // localStorage can throw (privacy modes) — fall through to the browser language.
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** Persist the user's language choice for future visits. */
export function setLang(lang: Lang): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Best-effort persistence only.
  }
}
