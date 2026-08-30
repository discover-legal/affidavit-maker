import { ValidationError } from '@/lib/api/errors';

/**
 * Shared document-structure builder for PDF generation. Both
 * /api/documents/generate and /api/documents/packet must render a saved
 * document the same way — the packet previously hardcoded the affidavit
 * template, which rendered divorce packages as a generic affidavit full of
 * [PLACEHOLDER] tokens.
 */

export type TemplateManager = {
  generateAffidavit: (state: string, data: unknown) => unknown;
  hasDocumentType?: (state: string, type: string) => boolean;
  generateDocument?: (state: string, data: unknown, type: string) => unknown;
  generateDivorcePetition?: (state: string, data: unknown) => unknown;
  generateDivorceDecree?: (state: string, data: unknown) => unknown;
};

export type AffidavitData = Record<string, unknown> & {
  state?: string;
  affiantName?: string;
  firstName?: string;
  lastName?: string;
  documentType?: string;
  activeSubDocument?: string | null;
  petitionerName?: string;
  petitionerFirstName?: string;
  petitionerLastName?: string;
  respondentName?: string;
  respondentFirstName?: string;
  respondentLastName?: string;
};

export type GenerationDocumentType =
  | 'affidavit'
  | 'divorce_petition'
  | 'divorce_decree'
  | 'divorce_response';

/**
 * Support-document kinds recognized by /api/documents/generate. Values must
 * match the kinds surfaced by services/supportDocs — anything not listed here
 * is rejected as an unknown documentType. Registering a kind here allow-lists
 * it as a valid request; whether a given (state, kind) pair actually has a
 * builder is a separate check against supportDocs.getSupportDoc, which returns
 * null when the jurisdiction hasn't been wired yet (route replies 400).
 *
 * The list is deliberately broader than services/supportDocs' current
 * registry: it enumerates every support-doc kind the DocumentSelectionAgent
 * can put into a case's requiredDocuments (indigency, military status, prove
 * up, cert last known address, parenting plan, statement of inability) so the
 * per-tab download for each of those tabs at least gets a truthful
 * "not-yet-available for JURISDICTION" 400 instead of silently returning
 * a byte-identical petition.
 */
export const SUPPORT_DOC_KINDS = [
  'acceptance_of_service',
  'certificate_of_service',
  'financial_declaration',
  'default_package',
  'finalization_prep',
  'child_support_worksheet',
  'answer',
  'fee_waiver_motion',
  'lawyer_handoff',
  'indigency_affidavit',
  'military_status_affidavit',
  'cert_last_known_address',
  'prove_up_affidavit',
  'statement_of_inability',
  'parenting_plan',
] as const;

export type SupportDocKind = (typeof SUPPORT_DOC_KINDS)[number];

const SUPPORT_DOC_KIND_SET: ReadonlySet<string> = new Set(SUPPORT_DOC_KINDS);

export function isSupportDocKind(value: string | undefined | null): value is SupportDocKind {
  return typeof value === 'string' && SUPPORT_DOC_KIND_SET.has(value.trim().toLowerCase());
}

export type GenerationRequest =
  | { kind: 'affidavit' }
  | { kind: 'divorce'; type: 'divorce_petition' | 'divorce_decree' | 'divorce_response' }
  | { kind: 'support'; name: SupportDocKind };

/**
 * Classify a caller-supplied documentType into one of three concrete pathways:
 * generic affidavit template, jurisdiction-specific divorce petition/decree,
 * or a support-doc builder. divorce_package is a caller-facing umbrella that
 * resolves to petition-or-decree via activeSubDocument.
 *
 * Historical affidavit-flavored types ('affidavit', 'general_affidavit', and
 * anything ending in '_affidavit' that isn't a listed support-doc kind) route
 * to the generic affidavit template — mirroring pre-fix behavior for
 * matter-specific affidavit types stored in documents.document_type.
 */
export function classifyGenerationRequest(
  documentType: string | undefined,
  activeSubDocument: string | null | undefined,
  role?: string | null,
): GenerationRequest {
  const raw = (documentType ?? 'affidavit').trim().toLowerCase();
  if (SUPPORT_DOC_KIND_SET.has(raw)) {
    return { kind: 'support', name: raw as SupportDocKind };
  }
  // divorce_package → resolve via activeSubDocument (role-aware default:
  // petitioners default to the petition; respondents default to the decree)
  if (raw === 'divorce_package') {
    const resolved = resolveGenerationDocumentType(documentType, activeSubDocument, role);
    if (resolved === 'affidavit') {
      // Guarded inside resolveGenerationDocumentType, but be explicit.
      throw new ValidationError('Unsupported divorce package document selection');
    }
    return { kind: 'divorce', type: resolved };
  }
  if (DIVORCE_TYPE_ALIASES[raw]) {
    const resolved = resolveGenerationDocumentType(documentType, activeSubDocument, role);
    return {
      kind: 'divorce',
      type: resolved as 'divorce_petition' | 'divorce_decree' | 'divorce_response',
    };
  }
  if (raw === 'affidavit' || raw === 'general_affidavit' || raw.endsWith('_affidavit')) {
    return { kind: 'affidavit' };
  }
  throw new ValidationError(`Unsupported documentType: ${raw}`);
}

const DIVORCE_TYPE_ALIASES: Readonly<
  Record<string, 'divorce_petition' | 'divorce_decree' | 'divorce_response'>
> = {
  divorce_petition: 'divorce_petition',
  petition: 'divorce_petition',
  petition_dissolution: 'divorce_petition',
  divorce_decree: 'divorce_decree',
  decree: 'divorce_decree',
  judgment_dissolution: 'divorce_decree',
  final_judgment: 'divorce_decree',
  proposed_judgment: 'divorce_decree',
  // Respondent-side pleadings — the Answer/Response the non-filing spouse
  // files after being served. Bug 1: v9-A's PACKAGE_SUB_DOCUMENTS_BY_ROLE
  // routed respondents to `['divorce_decree']` only, so a Florida respondent
  // (Tavita) never received the Answer draft they actually need to file
  // first. Aliases here mean the same document however the caller spells it;
  // rendering flows through services/supportDocs' `answer` builder until a
  // per-jurisdiction Response template lands.
  divorce_response: 'divorce_response',
  response: 'divorce_response',
  answer_of_divorce: 'divorce_response',
};

/**
 * Resolve the editor's umbrella divorce-package type to the concrete document
 * selected in the editor. Packages default to the petition, which is the first
 * document in the workflow. Direct petition/decree aliases are also accepted
 * for compatibility with older saved documents and matter orchestrators.
 */
export function resolveGenerationDocumentType(
  documentType: string | undefined,
  activeSubDocument: string | null | undefined,
  role?: string | null,
): GenerationDocumentType {
  const requestedType = (documentType ?? 'affidavit').trim().toLowerCase();
  // Role-aware default for divorce_package: petitioners default to the
  // petition (unchanged); respondents default to the Answer/Response — the
  // pleading they need to file first — because a respondent does not file
  // the other side's Application. Prior to bug 1 (Tavita, FL) the
  // respondent default was the decree, which is the eventual (often joint)
  // final order rather than the immediate first-filing requirement.
  const packageDefault: GenerationDocumentType =
    normalizeRole(role) === 'respondent' ? 'divorce_response' : 'divorce_petition';
  const effectiveType =
    requestedType === 'divorce_package'
      ? (activeSubDocument ?? packageDefault).trim().toLowerCase()
      : requestedType;

  if (requestedType === 'divorce_package' && !effectiveType) {
    return packageDefault;
  }

  const resolved = DIVORCE_TYPE_ALIASES[effectiveType];
  if (requestedType === 'divorce_package' && !resolved) {
    throw new ValidationError('Unsupported divorce package document selection');
  }
  return resolved ?? 'affidavit';
}

/**
 * Multi-document package types and their sub-documents in FILING ORDER.
 * A court packet for a package must contain every sub-document (the editor's
 * activeSubDocument only selects which one is on screen — the filed packet
 * needs them all).
 *
 * ROLE-AWARE: the petitioner packet expands to
 * `['divorce_petition', 'divorce_decree']`; the respondent packet DROPS the
 * petition (a respondent does not file the other side's Application) and
 * leads with the Answer/Response — bug 1 (Tavita, FL, 2026-08-29). The
 * respondent tuple is `['divorce_response', 'divorce_decree']`.
 *
 * `divorce_response` currently renders through services/supportDocs' generic
 * `answer` builder (Utah is the only state with a jurisdiction-specific
 * Answer template today; every other jurisdiction returns null from
 * getSupportDoc → buildDocumentStructureForType throws a truthful
 * "not yet available" 400 for that sub-doc, and the packet route already
 * degrades per-sub-doc rather than 500-ing). When per-jurisdiction Answer
 * templates land (Ontario Form 10, FL 12.903(a), etc.) they take over
 * naturally without another mapping change.
 *
 * Before this fix, a respondent-role user asking "please generate the
 * answer, decree, and financial statements" received exactly one file
 * (decree.txt = `{}`) because the petitioner-shaped expansion attempted to
 * render a petition the interview never populated for the respondent.
 */
const PACKAGE_SUB_DOCUMENTS_BY_ROLE: Readonly<
  Record<'petitioner' | 'respondent', Readonly<Record<string, readonly GenerationDocumentType[]>>>
> = {
  petitioner: {
    divorce_package: ['divorce_petition', 'divorce_decree'],
  },
  respondent: {
    // Bug 1 (Tavita, FL): respondents need the Answer/Response to file
    // FIRST — the decree is the eventual joint or default final order.
    // Rendering the response routes through services/supportDocs' `answer`
    // builder (see buildDocumentStructureForType); jurisdictions without an
    // `answer` builder degrade with a truthful per-sub-doc 400 in
    // buildDocumentStructureForType rather than silently rendering nothing.
    //
    // Marcus (ON, 2026-08) follow-up: bundling a proposed Divorce Order
    // with an Answer is procedurally incoherent — a proposed final order
    // is a post-hearing / on-consent document, not part of the respondent's
    // initial pleading. Ship the respondent packet with the Answer alone;
    // the decree belongs in a separate on-consent / finalization packet
    // when the parties reach that stage.
    divorce_package: ['divorce_response'],
  },
};

/** Back-compat alias — the petitioner mapping is the historical default. */
const PACKAGE_SUB_DOCUMENTS = PACKAGE_SUB_DOCUMENTS_BY_ROLE.petitioner;

/**
 * Coerce a stored role value to the two roles PACKAGE_SUB_DOCUMENTS_BY_ROLE
 * understands. Canadian family law uses 'applicant' / 'respondent' where U.S.
 * jurisdictions use 'petitioner' / 'respondent'; both petitioner-side labels
 * ('petitioner', 'applicant', 'plaintiff') collapse to the internal
 * 'petitioner' bucket so a Canadian applicant's divorce_package expands to
 * [divorce_petition, divorce_decree] just like a U.S. petitioner's.
 *
 * Unknown / missing values default to 'petitioner' — matches the legacy
 * role-blind behaviour so a saved document with no explicit role still expands
 * to the two-doc petitioner packet.
 */
function normalizeRole(role: string | null | undefined): 'petitioner' | 'respondent' {
  if (typeof role !== 'string') return 'petitioner';
  const trimmed = role.trim().toLowerCase();
  if (trimmed === 'respondent' || trimmed === 'defendant') return 'respondent';
  return 'petitioner';
}

/**
 * The full list of concrete document types a saved document expands to when
 * assembling a case packet, in filing order. divorce_package → petition then
 * decree; every other type is a single document (via the same resolution used
 * for generation).
 */
export function listPacketDocumentTypes(
  documentType: string | undefined,
  role?: string | null,
): GenerationDocumentType[] {
  const requestedType = (documentType ?? 'affidavit').trim().toLowerCase();
  const perRole = PACKAGE_SUB_DOCUMENTS_BY_ROLE[normalizeRole(role)];
  const packageDocs = perRole[requestedType];
  if (packageDocs) return [...packageDocs];
  return [resolveGenerationDocumentType(documentType, undefined)];
}

/**
 * Bind generation to the immutable type on the paid document row. Editor
 * content is user-controlled and must not be able to upgrade an affidavit
 * entitlement into a divorce package.
 */
export function assertGenerationTypeAllowed(
  persistedType: string | null | undefined,
  requestedType: string | undefined,
  activeSubDocument: string | null | undefined,
): void {
  // Support docs (indigency, financial declaration, worksheets, etc.) are
  // supplementary papers users can pull for their case regardless of what
  // main document is stored — the /api/documents/support route ships them
  // free with no payment gate, and /generate mirrors that policy. So don't
  // bind them to the persisted main-document type.
  const requestedRaw = (requestedType ?? '').trim().toLowerCase();
  if (SUPPORT_DOC_KIND_SET.has(requestedRaw)) return;

  const stored = (persistedType ?? 'affidavit').trim().toLowerCase();
  const storedIsDivorce = [
    'divorce_package',
    'divorce_petition',
    'divorce_decree',
    'divorce_response',
  ].includes(stored);
  const requested = resolveGenerationDocumentType(requestedType, activeSubDocument);
  const requestedIsDivorce = requested !== 'affidavit';

  if (storedIsDivorce !== requestedIsDivorce) {
    throw new ValidationError('Requested output does not match the saved document type');
  }
  // Bug 1 (Tavita, FL) fix: a saved divorce_package row must be able to
  // render ANY sub-document that appears in its role-aware packet expansion
  // (petition + decree for petitioners; response + decree for respondents).
  // Only standalone rows (row.document_type is a single divorce doc type)
  // stay bound to their exact type.
  if (
    (stored === 'divorce_petition' ||
      stored === 'divorce_decree' ||
      stored === 'divorce_response') &&
    requested !== stored
  ) {
    throw new ValidationError('Requested output does not match the saved document type');
  }
}

function mapDivorceDataFields(data: AffidavitData): AffidavitData {
  const mapped = { ...data };
  if (!mapped.petitionerName && (mapped.petitionerFirstName || mapped.petitionerLastName)) {
    mapped.petitionerName = [mapped.petitionerFirstName, mapped.petitionerLastName]
      .filter(Boolean)
      .join(' ');
  }
  if (!mapped.respondentName && (mapped.respondentFirstName || mapped.respondentLastName)) {
    mapped.respondentName = [mapped.respondentFirstName, mapped.respondentLastName]
      .filter(Boolean)
      .join(' ');
  }
  return mapped;
}

export function buildDocumentStructure(
  templateManager: TemplateManager,
  state: string,
  data: AffidavitData,
): unknown {
  const resolvedType = resolveGenerationDocumentType(
    data.documentType,
    data.activeSubDocument,
    (data as Record<string, unknown>).role as string | undefined,
  );
  return buildDocumentStructureForType(templateManager, state, data, resolvedType);
}

/**
 * Options for buildDocumentStructureForType.
 *
 * `renderContext: 'reference'` marks the produced structure as informational
 * only — used for the decree draft in a respondent packet, because the
 * eventual Final Judgment/Decree is the order the court signs at the end of
 * the case, not a document a respondent files as part of their responsive
 * pleadings. The banner is prepended to the header and mirrored into
 * metadata.renderContext so downstream renderers (packet route, PDF service)
 * can decorate the file name if desired.
 */
export interface BuildDocumentStructureOptions {
  renderContext?: 'filing' | 'reference';
}

/**
 * For a role-aware packet, return the render context each concrete document
 * should be built with. A respondent's decree entry is a REFERENCE — the
 * court signs the decree, and a respondent's responsive packet should not
 * hand the clerk a decree to file. Petitioner-side and other combinations
 * default to 'filing'.
 */
export function packetRenderContextFor(
  role: string | null | undefined,
  resolvedType: GenerationDocumentType,
): 'filing' | 'reference' {
  if (normalizeRole(role) === 'respondent' && resolvedType === 'divorce_decree') {
    return 'reference';
  }
  return 'filing';
}

const REFERENCE_BANNER =
  'REFERENCE — NOT FOR FILING. This document shows what the eventual Final ' +
  'Judgment/Decree of Dissolution will look like when the court signs it at ' +
  'the end of the case. A respondent does NOT file the decree as part of a ' +
  'responsive packet; the court prepares and enters it. Use this draft only ' +
  'to see what terms the eventual order would need to cover.';

function markStructureAsReference(structure: unknown): unknown {
  if (!structure || typeof structure !== 'object') return structure;
  const s = structure as Record<string, unknown>;
  const sections = (s.sections && typeof s.sections === 'object')
    ? { ...(s.sections as Record<string, unknown>) }
    : {};
  const existingHeader = typeof sections.header === 'string' ? sections.header : '';
  sections.header = existingHeader
    ? `${REFERENCE_BANNER}\n\n${existingHeader}`
    : REFERENCE_BANNER;
  const metadata = (s.metadata && typeof s.metadata === 'object')
    ? { ...(s.metadata as Record<string, unknown>) }
    : {};
  metadata.renderContext = 'reference';
  return { ...s, sections, metadata, renderContext: 'reference' };
}

/**
 * Build the structure for one already-resolved concrete type. Used directly by
 * the packet route, which expands a package to several concrete types and
 * builds each in turn.
 */
export function buildDocumentStructureForType(
  templateManager: TemplateManager,
  state: string,
  data: AffidavitData,
  resolvedType: GenerationDocumentType,
  opts: BuildDocumentStructureOptions = {},
): unknown {
  const wrap = (built: unknown): unknown =>
    opts.renderContext === 'reference' ? markStructureAsReference(built) : built;

  if (resolvedType === 'affidavit') {
    return wrap(templateManager.generateAffidavit(state, data));
  }

  const divorceData = mapDivorceDataFields(data);

  // Bug 1 fix: divorce_response has no jurisdictional template (no state
  // ships an Answer template as of 2026-08 — see grep in /templates); route
  // through services/supportDocs' `answer` builder, which currently covers
  // Utah only. Every other jurisdiction returns null → we throw a truthful
  // "not yet available" 400 rather than silently rendering the wrong doc.
  if (resolvedType === 'divorce_response') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const supportDocs = require('@/services/supportDocs') as {
      getSupportDoc: (
        state: string,
        kind: string,
      ) => ((data: Record<string, unknown>, opts?: { signatureStyle?: string }) => unknown) | null;
    };
    const builder = supportDocs.getSupportDoc(state, 'answer');
    if (!builder) {
      throw new ValidationError(
        `No divorce response (Answer) template is available for ${state} yet — coverage gap`,
      );
    }
    return wrap(builder(divorceData as Record<string, unknown>, { signatureStyle: 'unsworn' }));
  }

  if (!templateManager.hasDocumentType?.(state, resolvedType)) {
    throw new ValidationError(
      `No ${resolvedType === 'divorce_petition' ? 'divorce petition' : 'divorce decree'} template is available for this jurisdiction`,
    );
  }

  const generate =
    resolvedType === 'divorce_petition'
      ? templateManager.generateDivorcePetition
      : templateManager.generateDivorceDecree;
  if (!generate) {
    throw new ValidationError('Divorce document generation is unavailable for this jurisdiction');
  }
  return wrap(generate.call(templateManager, state, divorceData));
}
