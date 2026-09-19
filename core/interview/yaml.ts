/**
 * Adapts a validated matters/*.yaml definition (services/matters) into the
 * engine's MatterDefinition. The loader has already resolved phase field
 * references to camelCase targets; this file maps shapes and binds the
 * well-known field aliases to typed slots.
 */

import type { MatterDefinition as YamlMatterDefinition } from '@/services/matters';
import type { Json } from '../intelligence/types';
import type { ConfirmationKey, FactCategory } from '../model/types';
import { isFactCategory } from './schema';
import type { FieldSpec, MatterDefinition, PhaseSpec } from './types';

type Binds = NonNullable<FieldSpec['binds']>;

/**
 * Field keys that mean the same thing across matters, bound to their typed
 * slot. Identifiers matched by exact equality; a key not listed lands on
 * `fields` under its camelCase target.
 */
const ALIAS_BINDS: Record<string, Binds> = {
  current_first_name: 'self.firstName',
  petitioner_first_name: 'self.firstName',
  plaintiff_first_name: 'self.firstName',
  applicant_first_name: 'self.firstName',
  current_last_name: 'self.lastName',
  petitioner_last_name: 'self.lastName',
  plaintiff_last_name: 'self.lastName',
  applicant_last_name: 'self.lastName',
  respondent_first_name: 'other.firstName',
  defendant_first_name: 'other.firstName',
  respondent_last_name: 'other.lastName',
  defendant_last_name: 'other.lastName',
  county: 'county',
  state: 'jurisdiction',
  case_number: 'caseNumber',
  children: 'children',
  respondent_address_unknown: 'other.whereaboutsUnknown',
  respondent_suspected_location: 'other.suspectedLocation',
};

/** Confirmations a phase may elicit, from what the phase is about. */
const CONFIRMATIONS_BY_CATEGORY: Partial<Record<FactCategory, ConfirmationKey[]>> = {
  children: ['no_children'],
  safety: ['no_safety_concerns'],
  evidence: ['evidence_reviewed'],
};

export function fromYamlMatter(def: YamlMatterDefinition): MatterDefinition {
  return {
    code: def.code,
    practiceArea: def.practiceArea,
    displayName: def.displayName,
    familyProfile: def.familyProfile,
    fields: def.fields.map(toFieldSpec),
    phases: def.phases.map(toPhaseSpec),
  };
}

function toFieldSpec(field: YamlMatterDefinition['fields'][number]): FieldSpec {
  const spec: FieldSpec = { key: field.key, target: field.target, schema: field.schema as unknown as Json };
  const binds = ALIAS_BINDS[field.key];
  if (binds) spec.binds = binds;
  return spec;
}

function toPhaseSpec(phase: YamlMatterDefinition['phases'][number]): PhaseSpec {
  const factCategory = isFactCategory(phase.factCategory) ? phase.factCategory : undefined;
  const confirmations: ConfirmationKey[] = [
    ...(factCategory ? CONFIRMATIONS_BY_CATEGORY[factCategory] ?? [] : []),
    ...(phase.id === 'REVIEW' ? (['review_confirmed'] as ConfirmationKey[]) : []),
  ];
  const spec: PhaseSpec = {
    id: phase.id,
    displayName: phase.displayName,
    guidance: phase.prompt,
    requiredFields: [...phase.requiredFields],
  };
  if (phase.skipUnlessAny.length > 0) spec.skipUnlessAny = [...phase.skipUnlessAny];
  if (phase.skipIfAny.length > 0) spec.skipIfAny = [...phase.skipIfAny];
  if (factCategory) spec.factCategory = factCategory;
  if (confirmations.length > 0) spec.confirmations = confirmations;
  return spec;
}
