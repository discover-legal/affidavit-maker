// services/supportDocs/index.js
// Registry of supporting court documents by state. Utah-first: each entry
// maps a document kind to a builder (data, opts) => documentStructure that
// services/pdfService.js renders on its generic affidavit path.

const utah = require('./utah');
const texas = require('./texas');
const { childSupportWorksheet } = require('./utahChildSupportWorksheet');
const { answerToPetition } = require('./utahAnswer');
const { feeWaiverMotion } = require('./utahFeeWaiver');
const { lawyerHandoff } = require('./lawyerHandoff');
const { answerToPetition: floridaAnswer } = require('./floridaAnswer');
const { answerToPetition: georgiaAnswer } = require('./georgiaAnswer');
const { answerToPetition: newyorkAnswer } = require('./newyorkAnswer');
const { answerToPetition: texasAnswer } = require('./texasAnswer');
const { answerToPetition: californiaAnswer } = require('./californiaAnswer');
const { answerToPetition: ontarioAnswer } = require('./ontarioAnswer');
const { answerToPetition: albertaAnswer } = require('./albertaAnswer');

// Shared registry entry for the Answer / Response / Statement of Defence
// support-doc kind — every registered jurisdiction's `answer` entry shows
// the same catalog copy in the UI even when the underlying pleading title
// differs (Response, Answer, Statement of Defence). Per-jurisdiction titling
// is inside each builder's rendered document.
function answerEntry(builder) {
  return {
    build: builder,
    title: 'Answer to the petition',
    titleEs: 'Respuesta a la petición',
    description:
      "The respondent's formal response — you choose admit, deny, or " +
      '"don\'t know" for each paragraph of the petition, with an optional ' +
      'counterclaim.',
    descriptionEs:
      'La respuesta formal del demandado — tú eliges admitir, negar o ' +
      '"no sé" para cada párrafo de la petición, con una contrademanda opcional.',
  };
}

// State-agnostic kinds, available for every state (merged into list()).
const GENERAL = {
  lawyer_handoff: {
    build: lawyerHandoff,
    title: 'Case summary for attorney review',
    titleEs: 'Resumen del caso para revisión de un abogado',
    description:
      'Not a filing — a summary of your story, timeline, and finances a lawyer ' +
      'can read in ten minutes, for a consult or limited-scope help.',
    descriptionEs:
      'No es un documento judicial — un resumen de tu historia, cronología y ' +
      'finanzas que un abogado puede leer en diez minutos, para una consulta o ' +
      'ayuda de alcance limitado.',
  },
};

const REGISTRY = {
  FL: {
    answer: answerEntry(floridaAnswer),
  },
  GA: {
    answer: answerEntry(georgiaAnswer),
  },
  NY: {
    answer: answerEntry(newyorkAnswer),
  },
  CA: {
    answer: answerEntry(californiaAnswer),
  },
  ON: {
    answer: answerEntry(ontarioAnswer),
  },
  AB: {
    answer: answerEntry(albertaAnswer),
  },
  TX: {
    answer: answerEntry(texasAnswer),
    statement_of_inability: {
      build: texas.statementOfInability,
      title: 'Statement of Inability to Afford Payment of Court Costs',
      titleEs: 'Declaración de incapacidad para pagar los costos judiciales',
      description:
        'Sworn statement asking a Texas court to waive filing fees under Tex. R. Civ. P. 145, ' +
        'prefilled from your itemized monthly income, expenses, dependents, and assets. ' +
        'The court decides.',
      descriptionEs:
        'Declaración jurada que pide a un tribunal de Texas que exima las cuotas de ' +
        'presentación conforme a la Regla 145, precompletada con tus ingresos, gastos, ' +
        'dependientes y bienes mensuales detallados. El tribunal decide.',
    },
    // Alias — the DocumentSelectionAgent and the editor may use either
    // 'indigency_affidavit' (the historical catalog kind) or the current
    // 'statement_of_inability' (the actual title of the Rule 145 form).
    // Both resolve to the same TX builder.
    indigency_affidavit: {
      build: texas.statementOfInability,
      title: 'Statement of Inability to Afford Payment of Court Costs',
      titleEs: 'Declaración de incapacidad para pagar los costos judiciales',
      description:
        'Sworn statement asking a Texas court to waive filing fees under Tex. R. Civ. P. 145, ' +
        'prefilled from your itemized monthly income, expenses, dependents, and assets. ' +
        'The court decides.',
      descriptionEs:
        'Declaración jurada que pide a un tribunal de Texas que exima las cuotas de ' +
        'presentación conforme a la Regla 145, precompletada con tus ingresos, gastos, ' +
        'dependientes y bienes mensuales detallados. El tribunal decide.',
    },
    financial_declaration: {
      build: texas.financialInformationStatement,
      title: "Petitioner's Financial Information Statement",
      titleEs: 'Declaración informativa financiera del solicitante',
      description:
        'A plain-language summary of your income, expenses, property, and debts drawn from ' +
        'the information on file. Texas has no single statewide financial declaration form; ' +
        'this is a starting point, not a substitute for Tex. R. Civ. P. 194 initial ' +
        'disclosures or a court-ordered inventory and appraisement.',
      descriptionEs:
        'Un resumen en lenguaje sencillo de tus ingresos, gastos, bienes y deudas basado en ' +
        'la información registrada. Texas no publica un formulario financiero único; este ' +
        'documento es un punto de partida, no un sustituto de las divulgaciones iniciales ' +
        'de la Regla 194 ni del inventario y avalúo ordenado por el tribunal.',
    },
  },
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
    child_support_worksheet: {
      build: childSupportWorksheet,
      title: 'Child support worksheet (estimate)',
      titleEs: 'Hoja de cálculo de manutención (estimación)',
      description:
        'An estimate from Utah\'s statutory tables using both parents\' incomes. ' +
        'The court\'s official calculator and the judge decide the real number.',
      descriptionEs:
        'Una estimación según las tablas legales de Utah usando los ingresos de ' +
        'ambos padres. La calculadora oficial del tribunal y el juez deciden la ' +
        'cifra real.',
    },
    answer: {
      build: answerToPetition,
      title: 'Answer to the petition',
      titleEs: 'Respuesta a la petición',
      description:
        'The Respondent\'s formal response — you choose admit, deny, or ' +
        '"don\'t know" for each paragraph of the petition, with an optional ' +
        'counterclaim.',
      descriptionEs:
        'La respuesta formal del demandado — tú eliges admitir, negar o ' +
        '"no sé" para cada párrafo de la petición, con una contrademanda opcional.',
    },
    fee_waiver_motion: {
      build: feeWaiverMotion,
      title: 'Motion to waive fees',
      titleEs: 'Moción para eximir cuotas',
      description:
        'Asks the court to waive filing fees because you cannot afford them, ' +
        'with a sworn statement of your finances. The court decides.',
      descriptionEs:
        'Pide al tribunal que exima las cuotas de presentación porque no puedes ' +
        'pagarlas, con una declaración jurada de tus finanzas. El tribunal decide.',
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
  'child_support_worksheet',
  'answer',
  'fee_waiver_motion',
  'lawyer_handoff',
];

/**
 * Look up a builder. Returns (data, opts) => documentStructure, or null when
 * the state or kind isn't supported. State-agnostic kinds (GENERAL) resolve
 * for every state.
 */
function getSupportDoc(state, kind) {
  const stateEntry = REGISTRY[String(state || '').toUpperCase()];
  const entry = (stateEntry && stateEntry[kind]) || GENERAL[kind];
  return entry ? entry.build : null;
}

/**
 * List available kinds for a state with human titles + descriptions (EN + ES).
 * State-agnostic kinds are always included, so even unsupported states get
 * the lawyer handoff.
 */
function list(state) {
  const stateEntry = REGISTRY[String(state || '').toUpperCase()] || {};
  return Object.entries({ ...stateEntry, ...GENERAL }).map(([key, entry]) => ({
    key,
    title: entry.title,
    titleEs: entry.titleEs,
    description: entry.description,
    descriptionEs: entry.descriptionEs,
  }));
}

module.exports = { SUPPORT_DOC_KINDS, getSupportDoc, list };
