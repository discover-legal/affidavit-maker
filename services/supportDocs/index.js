// services/supportDocs/index.js
// Registry of supporting court documents by state. Utah-first: each entry
// maps a document kind to a builder (data, opts) => documentStructure that
// services/pdfService.js renders on its generic affidavit path.

const utah = require('./utah');

const REGISTRY = {
  UT: {
    acceptance_of_service: {
      build: utah.acceptanceOfService,
      title: 'Acceptance of Service',
      titleEs: 'Aceptación de la notificación',
      description:
        'Respondent confirms they received the Petition and Summons — accepting delivery ' +
        'only, not agreeing with the petition.',
      descriptionEs:
        'El demandado confirma que recibió la petición y la citación — acepta solo la ' +
        'entrega, no está de acuerdo con la petición.',
    },
    certificate_of_service: {
      build: utah.certificateOfService,
      title: 'Certificate of Service',
      titleEs: 'Certificado de notificación',
      description:
        'Proof for the court of who served which documents on whom, when, and how.',
      descriptionEs:
        'Prueba para el tribunal de quién notificó qué documentos, a quién, cuándo y cómo.',
    },
    financial_declaration: {
      build: utah.financialDeclaration,
      title: 'Financial Declaration',
      titleEs: 'Declaración financiera',
      description:
        'Simplified Utah Rule 26.1 financial declaration, prefilled from your itemized ' +
        'monthly income and expenses.',
      descriptionEs:
        'Declaración financiera simplificada según la Regla 26.1 de Utah, precompletada con ' +
        'sus ingresos y gastos mensuales detallados.',
    },
    default_package: {
      build: utah.motionForDefaultPackage,
      title: 'Motion for Default (with supporting declaration)',
      titleEs: 'Moción de rebeldía (con declaración de apoyo)',
      description:
        'Asks the court to enter the Respondent\'s default when no answer was filed within ' +
        '21 days of service, with a supporting declaration reciting the service facts.',
      descriptionEs:
        'Pide al tribunal que declare la rebeldía del demandado cuando no presentó respuesta ' +
        'dentro de los 21 días posteriores a la notificación, con una declaración de apoyo ' +
        'que relata los hechos de la notificación.',
    },
    finalization_prep: {
      build: utah.finalizationPrep,
      title: 'Finalization prep sheet',
      titleEs: 'Hoja de preparación para finalizar',
      description:
        'Not a filing — a personalized checklist and declaration-prep Q&A for finishing an ' +
        'uncontested Utah divorce on the papers.',
      descriptionEs:
        'No es un documento judicial — una lista de verificación personalizada y preguntas de ' +
        'preparación para finalizar un divorcio no disputado en Utah sin audiencia.',
    },
  },
};

const SUPPORT_DOC_KINDS = [
  'acceptance_of_service',
  'certificate_of_service',
  'financial_declaration',
  'default_package',
  'finalization_prep',
];

/**
 * Look up a builder. Returns (data, opts) => documentStructure, or null when
 * the state or kind isn't supported.
 */
function getSupportDoc(state, kind) {
  const stateEntry = REGISTRY[String(state || '').toUpperCase()];
  const entry = stateEntry && stateEntry[kind];
  return entry ? entry.build : null;
}

/**
 * List available kinds for a state with human titles + descriptions (EN + ES).
 * Returns [] for unsupported states.
 */
function list(state) {
  const stateEntry = REGISTRY[String(state || '').toUpperCase()];
  if (!stateEntry) return [];
  return Object.entries(stateEntry).map(([key, entry]) => ({
    key,
    title: entry.title,
    titleEs: entry.titleEs,
    description: entry.description,
    descriptionEs: entry.descriptionEs,
  }));
}

module.exports = { SUPPORT_DOC_KINDS, getSupportDoc, list };
