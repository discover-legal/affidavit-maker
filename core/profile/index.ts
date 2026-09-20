/**
 * Life story — the durable profile a person builds across sessions and
 * documents. Contract: ./types.ts. Each operation lives in its own file;
 * this module wires them to one Intelligence.
 */

export * from './types';
export { hydrate, currentOtherParty } from './hydrate';
export { absorb } from './absorb';
export { promote } from './promote';
export { ingest } from './ingest';
export { normalizeName } from './names';
export { emptyLifeStory, FIELD_GROUPS } from './common';

import type { Party } from '../model/types';
import { absorb } from './absorb';
import { emptyLifeStory } from './common';
import { hydrate } from './hydrate';
import { ingest } from './ingest';
import { normalizeName } from './names';
import { promote } from './promote';
import type { LifeStoryDeps, LifeStoryService } from './types';

/** The contract plus name casing (spec 02 §2.6), which LifeStoryService does not yet declare. */
export interface LifeStoryServiceWithNames extends LifeStoryService {
  normalizeName(party: Party): Promise<Party>;
}

export function createLifeStoryService(deps: LifeStoryDeps): LifeStoryServiceWithNames {
  const intel = deps.intelligence;
  return {
    hydrate,
    absorb: (story, file) => absorb(intel, story, file),
    promote: (file, definition) => promote(intel, file, definition),
    ingest: (story, input) => ingest(intel, story, input),
    erase: emptyLifeStory,
    normalizeName: (party) => normalizeName(intel, party),
  };
}
