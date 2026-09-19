export * from './types';
import type { MatterDefinition as YamlMatterDefinition } from '@/services/matters';
import type { JurisdictionProfile } from '../jurisdictions/types';
import type { InterviewDeps, InterviewEngine, MatterDefinition } from './types';

export function createInterviewEngine(_deps: InterviewDeps): InterviewEngine {
  throw new Error('core/interview: not implemented yet');
}

/** Adapt a YAML matter (services/matters) into the engine's MatterDefinition. */
export function fromYamlMatter(_def: YamlMatterDefinition): MatterDefinition {
  throw new Error('core/interview: fromYamlMatter not implemented yet');
}

/** The divorce interview for one jurisdiction (phases + fields + overlay). */
export function getDivorceDefinition(_jurisdiction: JurisdictionProfile): MatterDefinition {
  throw new Error('core/interview: getDivorceDefinition not implemented yet');
}
