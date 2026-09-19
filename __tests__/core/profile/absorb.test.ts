/**
 * @jest-environment node
 *
 * absorb(story, file) — merge a CaseFile back into the life story.
 * Spec: docs/spec/02-facts-and-life-story.md §1.3, §1.4, §2.3, §2.6, §3.3.
 *
 *   - an absent incoming value never erases a stored one; a present one replaces
 *   - facts: appended unless judged duplicate (JUDGE.FACTS_DUPLICATE); retirements
 *     propagate; the list is capped at 300 (oldest non-retired dropped)
 *   - children: merged by identity judgment (JUDGE.FACTS_CHILD_IDENTITY), never by
 *     string equality; the file's list is authoritative when non-empty
 *   - confirmations only ever accumulate
 *   - the other party is reconciled by JUDGE.PROFILE_SAME_PERSON
 */

import { ASK, JUDGE, ScriptedIntelligence, UnscriptedCallError, no, yes } from '@/core/intelligence';
import type { Json } from '@/core/intelligence';
import { createLifeStoryService } from '@/core/profile';
import type { LifeStoryService } from '@/core/profile';
import { STORED_AT, USER_ID, at, child, fact, familyFile, field, file, judgeCalls, prov, retiredFact, story } from './_helpers';

let service: LifeStoryService;
let intel: ScriptedIntelligence;

beforeEach(() => {
  intel = new ScriptedIntelligence();
  service = createLifeStoryService({ intelligence: intel });
});

/** Scripts the duplicate judgment: yes only when {a, b} is exactly the given pair (either order). */
function duplicateOf(x: string, y: string) {
  return (_q: unknown, state: Json) => {
    const a = at(state, 'a');
    const b = at(state, 'b');
    return (a === x && b === y) || (a === y && b === x) ? yes() : no();
  };
}

/** Scripts the child identity judgment: yes only for the (incoming name, existing name) pair given. */
function sameChildWhen(incomingName: string, existingName: string) {
  return (_q: unknown, state: Json) =>
    at(state, 'incoming', 'name') === incomingName && at(state, 'existing', 'name') === existingName ? yes() : no();
}

describe('absorb — scalar fields', () => {
  it('keeps a stored value when the incoming file lacks it', async () => {
    const stored = story({
      self: { firstName: field('Kathleen', 'stated', 'kathleen') },
      fields: { monthlyIncome: field(3400, 'stated', 'about 3400') },
    });

    const out = await service.absorb(stored, file());

    expect(out.fields.monthlyIncome).toEqual(field(3400, 'stated', 'about 3400'));
    expect(out.self.firstName).toEqual(field('Kathleen', 'stated', 'kathleen'));
  });

  it("replaces a stored value with a present incoming one, carrying the file's provenance", async () => {
    const stored = story({
      self: { firstName: field('Kathleen', 'stated', 'kathleen') },
      fields: { monthlyIncome: field(3400, 'stated', 'about 3400') },
    });
    const current = file({
      parties: { self: { firstName: field('Kate', 'stated', 'everyone calls me kate') }, other: {} },
      fields: { monthlyIncome: field(5000, 'stated', 'I make 5000 now') },
    });

    const out = await service.absorb(stored, current);

    expect(out.fields.monthlyIncome).toEqual(field(5000, 'stated', 'I make 5000 now'));
    expect(out.self.firstName).toEqual(field('Kate', 'stated', 'everyone calls me kate'));
  });

  it('adds fields the story did not have', async () => {
    const stored = story();
    const out = await service.absorb(stored, file({ fields: { marriageDate: field('2019-05-04') } }));
    expect(out.fields.marriageDate).toEqual(field('2019-05-04'));
  });
});

describe('absorb — facts', () => {
  it('appends new active facts', async () => {
    const stored = story({ facts: [] });
    const f1 = fact('I was married on 2019-05-04', 'relationship');
    const f2 = fact('I live in Provo, Utah', 'residence');

    const out = await service.absorb(stored, file({ facts: [f1, f2] }));

    expect(out.facts.map((f) => f.id)).toEqual([f1.id, f2.id]);
    expect(out.facts.every((f) => f.status === 'active')).toBe(true);
    expect(out.facts[0].provenance).toEqual(f1.provenance);
  });

  it('does not add a file fact judged duplicate of a stored fact, and asks about the pair', async () => {
    const storedFact = fact('I was married on 2019-05-04', 'relationship');
    const stored = story({ facts: [storedFact] });
    const duplicate = fact('I got married on May 4, 2019', 'relationship');
    const fresh = fact('I live in Provo, Utah', 'residence');
    intel.onJudge('duplicate', duplicateOf(storedFact.statement, duplicate.statement));

    const out = await service.absorb(stored, file({ facts: [storedFact, duplicate, fresh] }));

    expect(out.facts.map((f) => f.id).sort()).toEqual([storedFact.id, fresh.id].sort());

    const asked = judgeCalls(intel, JUDGE.FACTS_DUPLICATE);
    expect(asked.length).toBeGreaterThanOrEqual(1);
    const aboutPair = asked.find((c) => {
      const pair = [at(c.request.state, 'a'), at(c.request.state, 'b')];
      return pair.includes(storedFact.statement) && pair.includes(duplicate.statement);
    });
    expect(aboutPair).toBeDefined();
    expect(Object.keys(aboutPair!.request.questions)).toEqual(['duplicate']);
    expect(aboutPair!.request.questions.duplicate.type).toBe('yesno');
  });

  it('retires the stored copy when the file retired the fact (same id)', async () => {
    const f1 = fact('We separated at the end of February 2024', 'relationship');
    const stored = story({ facts: [f1] });
    const correction = fact('We separated on 2024-03-01', 'relationship');
    const retiredCopy: typeof f1 = { ...f1, status: 'retired', retiredBy: correction.id };
    intel.onJudge('duplicate', () => no());

    const out = await service.absorb(stored, file({ facts: [retiredCopy, correction] }));

    const storedF1 = out.facts.find((f) => f.id === f1.id);
    expect(storedF1?.status).toBe('retired');
    expect(storedF1?.retiredBy).toBe(correction.id);
    expect(out.facts.find((f) => f.id === correction.id)?.status).toBe('active');
  });

  it('retires a stored fact whose statement the file retired under a different id', async () => {
    const f1 = fact('We separated at the end of February 2024', 'relationship');
    const stored = story({ facts: [f1] });
    const correction = fact('We separated on 2024-03-01', 'relationship');
    const retiredElsewhere = retiredFact(f1.statement, 'relationship', correction.id);
    intel.onJudge('duplicate', duplicateOf(f1.statement, retiredElsewhere.statement));

    const out = await service.absorb(stored, file({ facts: [retiredElsewhere, correction] }));

    expect(out.facts.find((f) => f.id === f1.id)?.status).toBe('retired');
    expect(out.facts.filter((f) => f.status === 'active').map((f) => f.id)).toEqual([correction.id]);
  });

  it('never re-activates a stored retired fact', async () => {
    const live = fact('We separated on 2024-03-01', 'relationship');
    const gone = retiredFact('We separated at the end of February 2024', 'relationship', live.id);
    const stored = story({ facts: [gone, live] });
    intel.onJudge('duplicate', () => no());

    const out = await service.absorb(stored, file({ facts: [live] }));

    expect(out.facts.find((f) => f.id === gone.id)?.status).toBe('retired');
  });

  it('caps the list at 300, dropping the oldest non-retired facts beyond the cap', async () => {
    const olds = Array.from({ length: 300 }, (_, i) =>
      fact(`Stored fact number ${i}`, 'general', {
        id: `old_${i}`,
        provenance: prov('stated', `stored fact ${i}`, { at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() }),
      }),
    );
    const stored = story({ facts: olds });
    const newest = fact('I moved to Utah in 2026', 'residence', { id: 'newest' });
    intel.onJudge('duplicate', () => no());

    const out = await service.absorb(stored, file({ facts: [...olds, newest] }));

    expect(out.facts).toHaveLength(300);
    expect(out.facts.find((f) => f.id === 'newest')).toBeDefined();
    expect(out.facts.find((f) => f.id === 'old_0')).toBeUndefined();
    expect(out.facts.find((f) => f.id === 'old_299')).toBeDefined();
  });
});

describe('absorb — children', () => {
  it('merges an incoming child judged the same as a stored one, gaining missing fields and losing none', async () => {
    const emma = child({ id: 'child_emma', name: 'Emma Smith', dateOfBirth: '2015-04-02' });
    const stored = story({ children: [emma] });
    const incoming = child({ id: 'c_turn_1', name: 'Emma', age: 11 });
    intel.onJudge('same_child', sameChildWhen('Emma', 'Emma Smith'));

    const out = await service.absorb(stored, familyFile({ children: [incoming] }));

    expect(out.children).toHaveLength(1);
    const merged = out.children[0];
    expect(merged.id).toBe('child_emma');
    // spec §2.3(5): a shorter name never replaces a longer one
    expect(merged.name?.value).toBe('Emma Smith');
    expect(merged.dateOfBirth?.value).toBe('2015-04-02');
    expect(merged.age?.value).toBe(11);
    expect(merged.age?.provenance).toEqual(incoming.age?.provenance);

    const asked = judgeCalls(intel, JUDGE.FACTS_CHILD_IDENTITY);
    expect(asked).toHaveLength(1);
    expect(Object.keys(asked[0].request.state as object).sort()).toEqual(['existing', 'incoming']);
    expect(Object.keys(asked[0].request.questions)).toEqual(['same_child']);
    expect(at(asked[0].request.state, 'incoming', 'name')).toBe('Emma');
    expect(at(asked[0].request.state, 'existing', 'name')).toBe('Emma Smith');
  });

  it('appends an incoming child judged different', async () => {
    const emma = child({ id: 'child_emma', name: 'Emma Smith', dateOfBirth: '2015-04-02' });
    const stored = story({ children: [emma] });
    const emmaAgain = child({ id: 'c_turn_1', name: 'Emma', age: 11 });
    const liam = child({ id: 'c_turn_2', name: 'Liam', age: 8 });
    intel.onJudge('same_child', sameChildWhen('Emma', 'Emma Smith'));

    const out = await service.absorb(stored, familyFile({ children: [emmaAgain, liam] }));

    expect(out.children).toHaveLength(2);
    expect(out.children.find((c) => c.id === 'child_emma')?.name?.value).toBe('Emma Smith');
    const added = out.children.find((c) => c.name?.value === 'Liam');
    expect(added).toBeDefined();
    expect(added?.age?.value).toBe(8);
  });

  // Rule (spec §2.3(5), 01 §7): the file's children are authoritative when the file has any
  // (`file.children.length > 0`) so removals made during the interview persist; a file with
  // no children keeps the stored ones (an empty list never erases).
  it("removes a stored child the file no longer lists when the file's list is non-empty", async () => {
    const emma = child({ id: 'child_emma', name: 'Emma Smith' });
    const liam = child({ id: 'child_liam', name: 'Liam Smith' });
    const stored = story({ children: [emma, liam] });
    intel.onJudge('same_child', sameChildWhen('Emma', 'Emma Smith'));

    const out = await service.absorb(stored, familyFile({ children: [child({ id: 'c_turn_1', name: 'Emma', age: 11 })] }));

    expect(out.children.map((c) => c.id)).toEqual(['child_emma']);
  });

  it('keeps stored children when the file lists none', async () => {
    const emma = child({ id: 'child_emma', name: 'Emma Smith' });
    const stored = story({ children: [emma] });

    const out = await service.absorb(stored, familyFile({ children: [] }));

    expect(out.children).toEqual([emma]);
    expect(judgeCalls(intel, JUDGE.FACTS_CHILD_IDENTITY)).toHaveLength(0);
  });
});

describe('absorb — confirmations', () => {
  it('stores a new confirmation with its provenance and never clears existing ones', async () => {
    const noProperty = prov('confirmed', 'we own nothing at all', { at: STORED_AT });
    const stored = story({ confirmations: { no_property: noProperty } });
    const noDebts = prov('confirmed', 'no debts either', { turnId: 'turn_7' });

    const out = await service.absorb(stored, familyFile({ confirmations: { no_debts: noDebts } }));

    expect(out.confirmations.no_property).toEqual(noProperty);
    expect(out.confirmations.no_debts).toEqual(noDebts);
    expect(Object.keys(out.confirmations).sort()).toEqual(['no_debts', 'no_property']);
  });

  it('keeps stored confirmations when the file has none', async () => {
    const noProperty = prov('confirmed', 'we own nothing at all');
    const stored = story({ confirmations: { no_property: noProperty } });

    const out = await service.absorb(stored, file({ confirmations: {} }));

    expect(out.confirmations).toEqual({ no_property: noProperty });
  });
});

describe('absorb — other party identity', () => {
  const storedWithDana = () =>
    story({
      self: { firstName: field('Marcus'), lastName: field('Bell') },
      people: { p_dana: { firstName: field('Dana'), lastName: field('Bell'), relationship: field('spouse') } },
    });

  it('adds a second person when the judgment says the file names someone else, and makes them current', async () => {
    intel.onJudge('same_person', () => no());
    const current = familyFile({
      parties: { self: {}, other: { firstName: field('Jordan', 'stated', 'my ex is jordan lee'), lastName: field('Lee') } },
    });

    const out = await service.absorb(storedWithDana(), current);

    const people = Object.values(out.people);
    expect(people).toHaveLength(2);
    expect(people.map((p) => p.firstName?.value).sort()).toEqual(['Dana', 'Jordan']);
    expect(people.find((p) => p.firstName?.value === 'Dana')?.lastName?.value).toBe('Bell');
    expect(people.find((p) => p.firstName?.value === 'Jordan')?.lastName?.value).toBe('Lee');

    // the current other party is the file's: a fresh family file hydrates Jordan, not Dana
    const rehydrated = service.hydrate(out, familyFile(), 'family');
    expect(rehydrated.parties.other.firstName?.value).toBe('Jordan');
    expect(rehydrated.parties.other.lastName?.value).toBe('Lee');

    const asked = judgeCalls(intel, JUDGE.PROFILE_SAME_PERSON);
    expect(asked).toHaveLength(1);
    expect(Object.keys(asked[0].request.state as object).sort()).toEqual(['a', 'b']);
    expect(Object.keys(asked[0].request.questions)).toEqual(['same_person']);
  });

  it('merges into the stored person when the judgment says same person', async () => {
    intel.onJudge('same_person', () => yes());
    const current = familyFile({
      parties: { self: {}, other: { firstName: field('Dana'), address: field('12 Elm St, Provo', 'stated', 'she is at 12 elm st') } },
    });

    const out = await service.absorb(storedWithDana(), current);

    const people = Object.values(out.people);
    expect(people).toHaveLength(1);
    expect(out.people.p_dana).toBeDefined();
    expect(out.people.p_dana.firstName?.value).toBe('Dana');
    expect(out.people.p_dana.lastName?.value).toBe('Bell');
    expect(out.people.p_dana.address).toEqual(field('12 Elm St, Provo', 'stated', 'she is at 12 elm st'));
    expect(judgeCalls(intel, JUDGE.PROFILE_SAME_PERSON)).toHaveLength(1);
  });

  it('does not touch stored people when the file names no other party', async () => {
    const out = await service.absorb(storedWithDana(), familyFile());
    expect(Object.keys(out.people)).toEqual(['p_dana']);
    expect(judgeCalls(intel, JUDGE.PROFILE_SAME_PERSON)).toHaveLength(0);
  });

  it('rejects with UnscriptedCallError when the identity judgment was not scripted', async () => {
    const current = familyFile({ parties: { self: {}, other: { firstName: field('Jordan') } } });
    await expect(service.absorb(storedWithDana(), current)).rejects.toBeInstanceOf(UnscriptedCallError);
    expect(intel.callsTo(ASK.PROFILE_PROMOTE)).toHaveLength(0);
  });
});

describe('absorb — bookkeeping', () => {
  it('advances updatedAt', async () => {
    const stored = story({ updatedAt: STORED_AT });
    const out = await service.absorb(stored, file({ fields: { monthlyIncome: field(3400) } }));
    expect(out.updatedAt).not.toBe(STORED_AT);
    expect(new Date(out.updatedAt).getTime()).toBeGreaterThan(new Date(STORED_AT).getTime());
    expect(Number.isNaN(new Date(out.updatedAt).getTime())).toBe(false);
  });

  it('creates a story for file.userId when there is none', async () => {
    const current = familyFile({
      userId: 'user_new',
      parties: { self: { firstName: field('Marcus') }, other: { firstName: field('Dana') } },
      children: [child({ id: 'c1', name: 'Emma', age: 11 })],
      facts: [fact('I was married on 2019-05-04', 'relationship')],
      fields: { monthlyIncome: field(3400) },
      confirmations: { no_property: prov('confirmed', 'we own nothing') },
    });

    const out = await service.absorb(null, current);

    expect(out.userId).toBe('user_new');
    expect(out.self.firstName?.value).toBe('Marcus');
    expect(Object.values(out.people).map((p) => p.firstName?.value)).toEqual(['Dana']);
    expect(out.children.map((c) => c.name?.value)).toEqual(['Emma']);
    expect(out.facts).toHaveLength(1);
    expect(out.fields.monthlyIncome?.value).toBe(3400);
    expect(out.confirmations.no_property).toEqual(prov('confirmed', 'we own nothing'));
    expect(out.events).toEqual([]);
    expect(intel.calls).toHaveLength(0);
  });

  it('never stores the userId of another file over the story', async () => {
    const stored = story({ userId: USER_ID });
    const out = await service.absorb(stored, file({ userId: USER_ID }));
    expect(out.userId).toBe(USER_ID);
  });
});
