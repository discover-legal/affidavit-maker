/**
 * hydrate(story, file, scope) — pure gap-fill of a CaseFile from the stored
 * life story (spec 02 §2.2). No model calls; the input file is not mutated.
 *
 *   - identity (the self party) always hydrates
 *   - general-group fields hydrate everywhere; family-group fields, the
 *     current other party and the children only in 'family' scope
 *   - jurisdiction-group fields never hydrate
 *   - the file wins: only parts the file lacks are filled
 *   - stored active facts seed an EMPTY fact list only; retired facts never travel
 *   - children seed an empty list only (merging by identity is a judgment,
 *     which a pure function cannot make)
 *   - confirmations do not hydrate: a dispositive statement is re-elicited per document
 */

import type { CaseFile, Child, Party } from '../model/types';
import { CHILD_FIELD_KEYS, FIELD_GROUPS, PARTY_FIELD_KEYS, gapFill } from './common';
import type { HydrationScope, LifeStory } from './types';

export function hydrate(story: LifeStory | null, file: CaseFile, scope: HydrationScope): CaseFile {
  if (!story) return file;
  const family = scope === 'family';

  const fieldKeys = Object.keys(story.fields).filter((key) => {
    const group = FIELD_GROUPS[key];
    return group === 'general' || (family && group === 'family');
  });

  const out: CaseFile = {
    ...file,
    parties: {
      self: gapFill(file.parties.self, story.self, PARTY_FIELD_KEYS),
      other: family ? gapFill(file.parties.other, currentOtherParty(story), PARTY_FIELD_KEYS) : { ...file.parties.other },
    },
    children: family && file.children.length === 0 ? story.children.map(hydratedChild) : [...file.children],
    fields: gapFill(file.fields, story.fields, fieldKeys),
    facts: file.facts.length === 0 ? story.facts.filter((f) => f.status === 'active').map((f) => ({ ...f })) : [...file.facts],
  };
  return out;
}

/**
 * The current other party is the LAST person in the story's `people`:
 * absorb() appends a newly met person and moves a re-met one to the end, so
 * insertion order is the recency record (JSON persistence keeps it).
 */
export function currentOtherParty(story: LifeStory): Party | undefined {
  const people = Object.values(story.people);
  return people.length > 0 ? people[people.length - 1] : undefined;
}

function hydratedChild(stored: Child): Child {
  return gapFill<Child>({ id: stored.id }, stored, CHILD_FIELD_KEYS);
}
