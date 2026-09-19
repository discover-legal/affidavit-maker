/**
 * absorb(story, file) — merge a CaseFile back into the life story
 * (spec 02 §1.3, §1.4, §2.3, §2.6, §3.3).
 *
 *   - an absent incoming value never erases a stored one; a present one
 *     replaces it, carrying the file's provenance
 *   - facts: same id → the file's status wins (a retirement propagates, a
 *     stored retirement never reverts); new id → judged against each stored
 *     active fact one pair at a time (JUDGE.FACTS_DUPLICATE) and appended
 *     only when none is a duplicate; an incoming retired fact under a new id
 *     retires its stored duplicate instead of being added; ≤300 kept
 *   - children: the file's list is authoritative when non-empty; each
 *     incoming child is matched by id, else by JUDGE.FACTS_CHILD_IDENTITY
 *     against each unclaimed stored child; a match keeps the stored id and
 *     never shortens a name
 *   - the other party: reconciled with the stored people by
 *     JUDGE.PROFILE_SAME_PERSON, newest first; the reconciled person becomes
 *     current (last in `people`)
 *   - confirmations accumulate; updatedAt advances
 *
 * A judgment the Intelligence cannot answer propagates: the store is never
 * guessed into shape.
 */

import { yesno } from '../intelligence/types';
import type { Intelligence, Json } from '../intelligence/types';
import { JUDGE } from '../intelligence/purposes';
import { newId, now } from '../model/types';
import type { CaseFile, Child, Fact, Field, Party } from '../model/types';
import { CHILD_FIELD_KEYS, DUPLICATE_FACT, PARTY_FIELD_KEYS, SAME_PERSON, THRESHOLD_SAME_CHILD, absorbField, compact, emptyLifeStory, hasAny, overlay } from './common';
import type { LifeStory } from './types';

const MAX_FACTS = 300;

type Person = LifeStory['people'][string];

export async function absorb(intel: Intelligence, story: LifeStory | null, file: CaseFile): Promise<LifeStory> {
  const base = story ?? emptyLifeStory(file.userId);
  return {
    ...base,
    self: overlay(base.self, file.parties.self, PARTY_FIELD_KEYS),
    people: await reconcileOtherParty(intel, base.people, file.parties.other),
    children: await mergeChildren(intel, base.children, file.children),
    fields: mergeFields(base.fields, file.fields),
    facts: await mergeFacts(intel, base.facts, file.facts),
    confirmations: { ...base.confirmations, ...file.confirmations },
    updatedAt: now(),
  };
}

// ─── fields ─────────────────────────────────────────────────────────────────

function mergeFields(stored: Record<string, Field>, incoming: Record<string, Field>): Record<string, Field> {
  return overlay(stored, incoming, Object.keys(incoming));
}

// ─── facts ──────────────────────────────────────────────────────────────────

async function mergeFacts(intel: Intelligence, stored: Fact[], incoming: Fact[]): Promise<Fact[]> {
  const out = stored.map((f) => ({ ...f }));
  const byId = new Map(out.map((f) => [f.id, f]));
  const storedIds = new Set(stored.map((f) => f.id));
  const storedActive = () => out.filter((f) => f.status === 'active' && storedIds.has(f.id));

  for (const fact of incoming) {
    const same = byId.get(fact.id);
    if (same) {
      if (fact.status === 'retired') retire(same, fact.retiredBy);
      continue;
    }
    if (fact.status === 'retired') {
      for (const candidate of storedActive()) if (await isDuplicate(intel, candidate, fact)) retire(candidate, fact.retiredBy);
      continue;
    }
    let duplicate = false;
    for (const candidate of storedActive()) {
      if (await isDuplicate(intel, candidate, fact)) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) {
      const copy = { ...fact };
      out.push(copy);
      byId.set(copy.id, copy);
    }
  }
  return capFacts(out);
}

function retire(fact: Fact, retiredBy: string | undefined): void {
  if (fact.status === 'retired') return;
  fact.status = 'retired';
  if (retiredBy !== undefined) fact.retiredBy = retiredBy;
}

async function isDuplicate(intel: Intelligence, a: Fact, b: Fact): Promise<boolean> {
  const answers = await intel.judge({
    purpose: JUDGE.FACTS_DUPLICATE,
    state: { a: a.statement, b: b.statement },
    questions: {
      duplicate: yesno(
        'Do statements a and b assert the same fact about the same people, so that keeping both would repeat the record?',
        'they state the same fact, possibly in different words',
        'they state different facts, or the same topic with different details',
      ),
    },
  });
  return answers.duplicate.probability >= DUPLICATE_FACT;
}

/**
 * Keep at most MAX_FACTS. Retired tombstones go first (oldest first), then
 * the oldest active facts. Timestamp comparison is ISO-date arithmetic, so
 * it is syntactic. The surviving facts keep their order.
 */
function capFacts(facts: Fact[]): Fact[] {
  if (facts.length <= MAX_FACTS) return facts;
  const ranked = [...facts].sort((x, y) => rank(x) - rank(y) || statedAt(x) - statedAt(y));
  const dropped = new Set(ranked.slice(0, facts.length - MAX_FACTS).map((f) => f.id));
  return facts.filter((f) => !dropped.has(f.id));
}

const rank = (f: Fact): number => (f.status === 'retired' ? 0 : 1);
const statedAt = (f: Fact): number => {
  const t = Date.parse(f.provenance.at);
  return Number.isNaN(t) ? 0 : t;
};

// ─── children ───────────────────────────────────────────────────────────────

async function mergeChildren(intel: Intelligence, stored: Child[], incoming: Child[]): Promise<Child[]> {
  if (incoming.length === 0) return stored;
  const unclaimed = new Map(stored.map((c) => [c.id, c]));
  const out: Child[] = [];
  for (const child of incoming) {
    const match = unclaimed.get(child.id) ?? (await findSameChild(intel, child, [...unclaimed.values()]));
    if (match) {
      unclaimed.delete(match.id);
      out.push(mergeChild(match, child));
    } else {
      out.push({ ...child });
    }
  }
  return out;
}

async function findSameChild(intel: Intelligence, incoming: Child, candidates: Child[]): Promise<Child | undefined> {
  for (const existing of candidates) {
    const answers = await intel.judge({
      purpose: JUDGE.FACTS_CHILD_IDENTITY,
      state: { incoming: childIdentity(incoming), existing: childIdentity(existing) },
      questions: { same_child: yesno('Do the incoming and existing records describe the same child?') },
    });
    if (answers.same_child.probability >= THRESHOLD_SAME_CHILD) return existing;
  }
  return undefined;
}

function childIdentity(child: Child): Json {
  return compact({ name: child.name?.value, date_of_birth: child.dateOfBirth?.value, age: child.age?.value });
}

/** Field by field under the absorb rule; a shorter name never replaces a longer one (spec §2.3(5)). */
function mergeChild(stored: Child, incoming: Child): Child {
  const merged = overlay(stored, incoming, CHILD_FIELD_KEYS);
  // Syntactic: comparing name lengths, not reading the names.
  if (stored.name && incoming.name && incoming.name.value.length < stored.name.value.length) merged.name = stored.name;
  return merged;
}

// ─── the other party ────────────────────────────────────────────────────────

async function reconcileOtherParty(intel: Intelligence, people: Record<string, Person>, other: Party): Promise<Record<string, Person>> {
  if (!namesSomeone(other)) return people;
  const entries = Object.entries(people);
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const [id, person] = entries[i];
    if (await isSamePerson(intel, person, other)) {
      const rest = Object.fromEntries(entries.filter(([key]) => key !== id));
      // Re-met: merge, and move to the end so hydrate() treats this person as current.
      return { ...rest, [id]: overlay(person, other, PARTY_FIELD_KEYS) };
    }
  }
  return { ...people, [newId('person')]: overlay({}, other, PARTY_FIELD_KEYS) };
}

/** The file names another party only when it holds a name part that did not itself come from the store. */
function namesSomeone(other: Party): boolean {
  const named = hasAny(other, ['firstName', 'middleName', 'lastName']);
  const fresh = PARTY_FIELD_KEYS.some((key) => other[key] !== undefined && absorbField(other[key], other[key]) !== undefined && other[key]?.provenance.source !== 'hydrated');
  return named && fresh;
}

async function isSamePerson(intel: Intelligence, a: Party, b: Party): Promise<boolean> {
  const answers = await intel.judge({
    purpose: JUDGE.PROFILE_SAME_PERSON,
    state: { a: partyIdentity(a), b: partyIdentity(b) },
    questions: { same_person: yesno('Are a and b the same person?') },
  });
  return answers.same_person.probability >= SAME_PERSON;
}

function partyIdentity(party: Party & { relationship?: Field<string> }): Json {
  return compact({
    first_name: party.firstName?.value,
    middle_name: party.middleName?.value,
    last_name: party.lastName?.value,
    address: party.address?.value,
    relationship: party.relationship?.value,
  });
}
