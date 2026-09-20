/**
 * Legacy adapter — the bridge between the v1 `affidavitData` blob (what the
 * client sends and the documents table stores) and the v2 CaseFile.
 *
 * toCaseFile(): typed slots for the keys the v1 code treats specially;
 *               everything else lands in `fields` untouched. v1 flags that
 *               v2 models as Confirmations become confirmations with a
 *               `derived` provenance (v1 kept no quote).
 * toAffidavitData(): the reverse, merged over the incoming blob so keys the
 *               v2 engine does not know about survive a round trip.
 *
 * The adapter has no opinions about legal meaning; it only moves values.
 */

import type { Json } from '../intelligence/types';
import {
  activeFacts,
  emptyCaseFile,
  newId,
  now,
  type CaseFile,
  type Child,
  type ConfirmationKey,
  type Fact,
  type FactCategory,
  type Field,
  type Provenance,
} from '../model/types';

export type AffidavitData = Record<string, unknown>;

const LEGACY_PROVENANCE = (): Provenance => ({ source: 'derived', derivedFrom: ['legacy'], at: now() });

/** v1 top-level keys that map to typed slots (and must not also land in `fields`). */
const SELF_FIRST = ['petitionerFirstName', 'plaintiffFirstName', 'applicantFirstName', 'currentFirstName', 'firstName'];
const SELF_LAST = ['petitionerLastName', 'plaintiffLastName', 'applicantLastName', 'currentLastName', 'lastName'];
const OTHER_FIRST = ['respondentFirstName', 'defendantFirstName'];
const OTHER_LAST = ['respondentLastName', 'defendantLastName'];

const CONFIRMATION_FLAGS: Array<[string, ConfirmationKey]> = [
  ['noPropertyConfirmed', 'no_property'],
  ['noDebtsConfirmed', 'no_debts'],
  ['spousalSupportWaived', 'support_waived'],
  ['noChildrenConfirmed', 'no_children'],
  ['userConfirmedReview', 'review_confirmed'],
  ['evidenceConfirmed', 'evidence_reviewed'],
];

const RESERVED = new Set<string>([
  ...SELF_FIRST,
  ...SELF_LAST,
  ...OTHER_FIRST,
  ...OTHER_LAST,
  'petitionerName',
  'respondentName',
  'plaintiffName',
  'defendantName',
  'affiantName',
  'state',
  'county',
  'caseNumber',
  'children',
  'facts',
  'matterTypeCode',
  'documentType',
  'document_type',
  'countryCode',
  'orchestratorState',
  'role',
  'language',
  'respondentAddress',
  'respondentAddressUnknown',
  'respondentSuspectedLocation',
  'requiredDocuments',
  'selectionReasons',
  'retiredFactStatements',
  ...CONFIRMATION_FLAGS.map(([k]) => k),
]);

const V1_CATEGORY: Record<string, FactCategory> = {
  general: 'general',
  relational: 'relationship',
  children: 'children',
  financial: 'finances',
  property: 'property',
  safety: 'safety',
  injury: 'events',
  pattern: 'events',
  event: 'events',
  evidence: 'evidence',
  exemption: 'procedure',
  identity: 'identity',
  heirship: 'relationship',
  residency: 'residence',
  support: 'support',
  debts: 'debts',
};

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function firstString(blob: AffidavitData, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = str(blob[k]);
    if (v) return v;
  }
  return undefined;
}

function field<T extends Json>(value: T, quote?: string): Field<T> {
  return { value, provenance: { ...LEGACY_PROVENANCE(), quote } };
}

export function toCaseFile(blob: AffidavitData, init: { id: string; userId: string }): CaseFile {
  const file = emptyCaseFile({ id: init.id, userId: init.userId });

  const matter = str(blob.matterTypeCode);
  const docType = str(blob.documentType) ?? str(blob.document_type);
  if (matter) file.matter = matter;
  else if (docType === 'divorce_package') file.matter = 'divorce';

  const jurisdiction = str(blob.state);
  if (jurisdiction) file.jurisdiction = jurisdiction.toUpperCase();
  const country = str(blob.countryCode);
  if (country) file.country = country.toUpperCase();
  const role = str(blob.role);
  if (role === 'respondent' || role === 'defendant') file.role = 'respondent';
  const language = str(blob.language);
  if (language === 'es') file.language = 'es';

  const selfFirst = firstString(blob, SELF_FIRST);
  const selfLast = firstString(blob, SELF_LAST);
  const otherFirst = firstString(blob, OTHER_FIRST);
  const otherLast = firstString(blob, OTHER_LAST);
  if (selfFirst) file.parties.self.firstName = field(selfFirst);
  if (selfLast) file.parties.self.lastName = field(selfLast);
  if (otherFirst) file.parties.other.firstName = field(otherFirst);
  if (otherLast) file.parties.other.lastName = field(otherLast);
  file.parties.self.fullName = [selfFirst, selfLast].filter(Boolean).join(' ') || str(blob.affiantName) || str(blob.petitionerName);
  file.parties.other.fullName = [otherFirst, otherLast].filter(Boolean).join(' ') || str(blob.respondentName);

  const otherAddress = str(blob.respondentAddress);
  if (otherAddress) file.parties.other.address = field(otherAddress);
  if (blob.respondentAddressUnknown === true) file.parties.other.whereaboutsUnknown = field(true);
  const suspected = str(blob.respondentSuspectedLocation);
  if (suspected) file.parties.other.suspectedLocation = field(suspected);

  const county = str(blob.county);
  if (county) file.county = field(county);
  const caseNumber = str(blob.caseNumber);
  if (caseNumber) file.caseNumber = field(caseNumber);

  if (Array.isArray(blob.children)) {
    file.children = (blob.children as Array<Record<string, unknown>>).map(toChild);
  }
  if (Array.isArray(blob.facts)) {
    file.facts = (blob.facts as Array<Record<string, unknown>>).map(toFact);
  }

  for (const [flag, key] of CONFIRMATION_FLAGS) {
    if (blob[flag] === true) file.confirmations[key] = LEGACY_PROVENANCE();
  }

  const state = (blob.orchestratorState ?? {}) as Record<string, unknown>;
  file.interview = {
    phase: str(state.currentPhase) ?? 'INTAKE',
    completed: Array.isArray(state.completedPhases) ? (state.completedPhases as string[]) : [],
    turns: typeof state.turns === 'number' ? state.turns : 0,
    triaged: state.triageComplete === true || !!file.matter,
  };

  for (const [key, value] of Object.entries(blob)) {
    if (RESERVED.has(key) || value === undefined || value === null || value === '') continue;
    if (typeof value === 'function') continue;
    file.fields[key] = field(value as Json);
  }
  return file;
}

function toChild(c: Record<string, unknown>): Child {
  const child: Child = { id: str(c.id) ?? newId('child') };
  const name = str(c.name);
  const dob = str(c.dob) ?? str(c.dateOfBirth);
  if (name) child.name = field(name);
  if (dob) child.dateOfBirth = field(dob);
  if (typeof c.age === 'number') child.age = field(c.age);
  return child;
}

function toFact(f: Record<string, unknown>): Fact {
  const category = V1_CATEGORY[String(f.category ?? '')] ?? 'general';
  const values: Fact['values'] = {};
  if (typeof f.numericValue === 'number') values.number = f.numericValue;
  const place = str(f.placeValue);
  if (place) values.place = place;
  const ground = str(f.groundsValue);
  if (ground) values.ground = ground;
  return {
    id: str(f.id) ?? newId('fact'),
    statement: str(f.content) ?? str(f.statement) ?? '',
    category,
    subcategory: str(f.subcategory),
    provenance: {
      source: str(f.source) === 'ingested' ? 'ingested' : 'stated',
      quote: str(f.sourceQuote),
      at: str(f.timestamp) ?? now(),
    },
    status: f.status === 'retired' ? 'retired' : 'active',
    values: Object.keys(values).length ? values : undefined,
  };
}

// ─── CaseFile → affidavitData ───────────────────────────────────────────────

export function toAffidavitData(file: CaseFile, base: AffidavitData = {}): AffidavitData {
  const out: AffidavitData = { ...base };

  for (const [key, f] of Object.entries(file.fields)) out[key] = f.value;

  if (file.matter) out.matterTypeCode = file.matter;
  if (file.matter === 'divorce') out.documentType = 'divorce_package';
  if (file.jurisdiction) out.state = file.jurisdiction;
  if (file.country) out.countryCode = file.country;
  out.role = file.role;
  out.language = file.language;

  const self = file.parties.self;
  const other = file.parties.other;
  if (self.firstName) out.petitionerFirstName = self.firstName.value;
  if (self.lastName) out.petitionerLastName = self.lastName.value;
  const selfName = [self.firstName?.value, self.lastName?.value].filter(Boolean).join(' ') || self.fullName;
  if (selfName) {
    out.petitionerName = selfName;
    out.affiantName = selfName;
  }
  if (other.firstName) out.respondentFirstName = other.firstName.value;
  if (other.lastName) out.respondentLastName = other.lastName.value;
  const otherName = [other.firstName?.value, other.lastName?.value].filter(Boolean).join(' ') || other.fullName;
  if (otherName) out.respondentName = otherName;
  if (other.address) out.respondentAddress = other.address.value;
  if (other.whereaboutsUnknown?.value) out.respondentAddressUnknown = true;
  if (other.suspectedLocation) out.respondentSuspectedLocation = other.suspectedLocation.value;

  if (file.county) out.county = file.county.value;
  if (file.caseNumber) out.caseNumber = file.caseNumber.value;

  out.children = file.children.map((c) => ({
    id: c.id,
    ...(c.name ? { name: c.name.value } : {}),
    ...(c.dateOfBirth ? { dob: c.dateOfBirth.value } : {}),
    ...(c.age ? { age: c.age.value } : {}),
  }));

  out.facts = activeFacts(file).map((f) => ({
    id: f.id,
    content: f.statement,
    category: f.category,
    subcategory: f.subcategory ?? '',
    type: 'fact',
    confidence: 0.9,
    severity: 'success',
    sourceQuote: f.provenance.quote ?? '',
    timestamp: f.provenance.at,
    ...(f.values?.number !== undefined ? { numericValue: f.values.number } : {}),
    ...(f.values?.place ? { placeValue: f.values.place } : {}),
    ...(f.values?.ground ? { groundsValue: f.values.ground } : {}),
  }));
  const retired = file.facts.filter((f) => f.status === 'retired').map((f) => f.statement);
  if (retired.length) out.retiredFactStatements = retired;

  for (const [flag, key] of CONFIRMATION_FLAGS) {
    if (file.confirmations[key]) out[flag] = true;
  }

  out.orchestratorState = {
    ...((base.orchestratorState as Record<string, unknown>) ?? {}),
    currentPhase: file.interview.phase,
    completedPhases: file.interview.completed,
    turns: file.interview.turns,
    triageComplete: file.interview.triaged,
    matterTypeCode: file.matter ?? null,
    engine: 'v2',
  };
  return out;
}
