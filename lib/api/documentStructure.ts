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

export type GenerationDocumentType = 'affidavit' | 'divorce_petition' | 'divorce_decree';

const DIVORCE_TYPE_ALIASES: Readonly<Record<string, 'divorce_petition' | 'divorce_decree'>> = {
  divorce_petition: 'divorce_petition',
  petition: 'divorce_petition',
  petition_dissolution: 'divorce_petition',
  divorce_decree: 'divorce_decree',
  decree: 'divorce_decree',
  judgment_dissolution: 'divorce_decree',
  final_judgment: 'divorce_decree',
  proposed_judgment: 'divorce_decree',
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
): GenerationDocumentType {
  const requestedType = (documentType ?? 'affidavit').trim().toLowerCase();
  const effectiveType =
    requestedType === 'divorce_package'
      ? (activeSubDocument ?? 'divorce_petition').trim().toLowerCase()
      : requestedType;

  if (requestedType === 'divorce_package' && !effectiveType) {
    return 'divorce_petition';
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
 */
const PACKAGE_SUB_DOCUMENTS: Readonly<Record<string, readonly GenerationDocumentType[]>> = {
  divorce_package: ['divorce_petition', 'divorce_decree'],
};

/**
 * The full list of concrete document types a saved document expands to when
 * assembling a case packet, in filing order. divorce_package → petition then
 * decree; every other type is a single document (via the same resolution used
 * for generation).
 */
export function listPacketDocumentTypes(
  documentType: string | undefined,
): GenerationDocumentType[] {
  const requestedType = (documentType ?? 'affidavit').trim().toLowerCase();
  const packageDocs = PACKAGE_SUB_DOCUMENTS[requestedType];
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
  const stored = (persistedType ?? 'affidavit').trim().toLowerCase();
  const storedIsDivorce = ['divorce_package', 'divorce_petition', 'divorce_decree'].includes(stored);
  const requested = resolveGenerationDocumentType(requestedType, activeSubDocument);
  const requestedIsDivorce = requested !== 'affidavit';

  if (storedIsDivorce !== requestedIsDivorce) {
    throw new ValidationError('Requested output does not match the saved document type');
  }
  if (
    (stored === 'divorce_petition' || stored === 'divorce_decree') &&
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
  );
  return buildDocumentStructureForType(templateManager, state, data, resolvedType);
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
): unknown {
  if (resolvedType === 'affidavit') {
    return templateManager.generateAffidavit(state, data);
  }

  if (!templateManager.hasDocumentType?.(state, resolvedType)) {
    throw new ValidationError(
      `No ${resolvedType === 'divorce_petition' ? 'divorce petition' : 'divorce decree'} template is available for this jurisdiction`,
    );
  }

  const divorceData = mapDivorceDataFields(data);
  const generate =
    resolvedType === 'divorce_petition'
      ? templateManager.generateDivorcePetition
      : templateManager.generateDivorceDecree;
  if (!generate) {
    throw new ValidationError('Divorce document generation is unavailable for this jurisdiction');
  }
  return generate.call(templateManager, state, divorceData);
}
