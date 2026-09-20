/** @jest-environment node */
/**
 * core/interview — facts, corrections, children and confirmations (spec §3).
 *
 * The model proposes; code disposes. A fact is retired only when a judgment
 * says the new statement supersedes it; a child is merged only when a
 * judgment says it is the same child; a Confirmation is recorded only when a
 * judgment over the user's verbatim message clears THRESHOLDS.affirmation.
 */

import { createInterviewEngine } from '@/core/interview';
import type { InterviewEngine } from '@/core/interview/types';
import { ScriptedIntelligence, no, yes } from '@/core/intelligence/scripted';
import { THRESHOLDS } from '@/core/intelligence/types';
import type { Json } from '@/core/intelligence/types';
import { JUDGE } from '@/core/intelligence/purposes';
import type { CaseFile, Fact } from '@/core/model/types';
import {
  asObject,
  fileFor,
  jurisdictionStub,
  lastJudge,
  matterStub,
  proposal,
  registryStub,
  runInterview,
  simpleDefinition,
  stated,
} from '../helpers/scripted';

const DEF = simpleDefinition();

function harness(): { engine: InterviewEngine; intel: ScriptedIntelligence } {
  const intel = new ScriptedIntelligence();
  const engine = createInterviewEngine({
    intelligence: intel,
    matters: matterStub(DEF),
    jurisdictions: registryStub([jurisdictionStub('TX')]),
  });
  return { engine, intel };
}

const F1: Fact = {
  id: 'fact_f1',
  statement: 'We separated at the end of February 2024.',
  category: 'relationship',
  subcategory: 'separation',
  provenance: stated('we separated end of February 2024'),
  status: 'active',
};

function file(overrides: Partial<CaseFile> = {}): CaseFile {
  return fileFor({
    matter: DEF.code,
    jurisdiction: 'TX',
    country: 'US',
    parties: {
      self: { firstName: { value: 'Maria', provenance: stated('Maria Lopez') }, lastName: { value: 'Lopez', provenance: stated('Maria Lopez') } },
      other: {},
    },
    county: { value: 'Travis', provenance: stated('Travis') },
    interview: { phase: 'DETAILS', completed: ['INTAKE'], turns: 1, triaged: true },
    ...overrides,
  });
}

const stateOf = (state: Json) => asObject(state);

describe('core/interview — corrections', () => {
  const message = 'actually it was March 1st';
  const correction = proposal({
    facts: [{ statement: 'We separated on 1 March 2024.', category: 'relationship', subcategory: 'separation', quote: message, values: { date: '2024-03-01' } }],
    corrections: [{ earlier_statement: F1.statement, because: 'the user corrected the separation date' }],
  });

  test('a correction the judgment upholds retires the earlier fact in favour of the new one', async () => {
    const h = harness();
    const [t1] = await runInterview(h, file({ facts: [structuredClone(F1)] }), [
      {
        user: message,
        model: correction,
        judgments: { supersedes: (_q, state) => (stateOf(state).earlier_statement === F1.statement ? yes() : no()) },
      },
    ]);

    expect(t1.result.newFacts).toHaveLength(1);
    const newFact = t1.result.newFacts[0];
    expect(newFact.values?.date).toBe('2024-03-01');

    const f1 = t1.file.facts.find((f) => f.id === F1.id);
    expect(f1?.status).toBe('retired');
    expect(f1?.retiredBy).toBe(newFact.id);
    expect(t1.result.retiredFacts.map((f) => f.id)).toEqual([F1.id]);
    expect(t1.file.facts.filter((f) => f.status === 'active').map((f) => f.id)).toEqual([newFact.id]);

    const judged = stateOf(lastJudge(h.intel, JUDGE.FACTS_CORRECTION).state);
    expect(judged.earlier_statement).toBe(F1.statement);
    expect(judged.new_statement).toBe('We separated on 1 March 2024.');
    expect(judged.because).toBe('the user corrected the separation date');
  });

  test('a correction the judgment rejects leaves the earlier fact active', async () => {
    const h = harness();
    const [t1] = await runInterview(h, file({ facts: [structuredClone(F1)] }), [{ user: message, model: correction, judgments: { supersedes: no() } }]);

    const f1 = t1.file.facts.find((f) => f.id === F1.id);
    expect(f1?.status).toBe('active');
    expect(f1?.retiredBy).toBeUndefined();
    expect(t1.result.retiredFacts).toEqual([]);
    expect(t1.file.facts.filter((f) => f.status === 'active')).toHaveLength(2);
  });

  test('a correction is judged against each active fact one pair at a time; only the matching one is retired', async () => {
    const other: Fact = { ...structuredClone(F1), id: 'fact_other', statement: 'We married in Austin in 2015.', subcategory: 'marriage' };
    const h = harness();
    const [t1] = await runInterview(h, file({ facts: [structuredClone(F1), other] }), [
      {
        user: message,
        model: correction,
        judgments: { supersedes: (_q, state) => (stateOf(state).earlier_statement === F1.statement ? yes() : no()) },
      },
    ]);

    expect(t1.file.facts.find((f) => f.id === other.id)?.status).toBe('active');
    expect(t1.file.facts.find((f) => f.id === F1.id)?.status).toBe('retired');
    for (const call of h.intel.callsTo(JUDGE.FACTS_CORRECTION)) {
      if (call.kind !== 'judge') continue;
      const s = stateOf(call.request.state);
      expect(typeof s.earlier_statement).toBe('string');
      expect(typeof s.new_statement).toBe('string');
    }
  });
});

describe('core/interview — duplicates', () => {
  const existing: Fact = {
    id: 'fact_res',
    statement: 'I live in Travis County, Texas.',
    category: 'residence',
    provenance: stated('I live in Travis County'),
    status: 'active',
  };
  const restated = proposal({ facts: [{ statement: 'I reside in Travis County.', category: 'residence', quote: 'I reside in Travis County' }] });

  test('a fact judged to duplicate an active one is not added', async () => {
    const h = harness();
    const [t1] = await runInterview(h, file({ facts: [existing] }), [{ user: 'I reside in Travis County', model: restated, judgments: { duplicate: yes() } }]);

    expect(t1.result.newFacts).toEqual([]);
    expect(t1.file.facts.map((f) => f.id)).toEqual([existing.id]);
    const judged = stateOf(lastJudge(h.intel, JUDGE.FACTS_DUPLICATE).state);
    expect([judged.a, judged.b].sort()).toEqual([existing.statement, 'I reside in Travis County.'].sort());
  });

  test('a fact judged distinct is added beside the existing one', async () => {
    const h = harness();
    const [t1] = await runInterview(h, file({ facts: [existing] }), [{ user: 'I reside in Travis County', model: restated, judgments: { duplicate: no() } }]);

    expect(t1.result.newFacts).toHaveLength(1);
    expect(t1.file.facts).toHaveLength(2);
  });
});

describe('core/interview — children', () => {
  const emma = { id: 'child_emma', name: { value: 'Emma', provenance: stated('Emma') } };

  test('a child judged different from every existing child is added with provenance', async () => {
    const h = harness();
    const message = 'and Liam, he is 7';
    const [t1] = await runInterview(h, file({ children: [structuredClone(emma)] }), [
      { user: message, model: proposal({ children: [{ name: 'Liam', age: 7 }] }), judgments: { same_child: no() } },
    ]);

    expect(t1.file.children).toHaveLength(2);
    const liam = t1.file.children.find((c) => c.id !== emma.id);
    expect(liam?.name?.value).toBe('Liam');
    expect(liam?.age?.value).toBe(7);
    expect(liam?.name?.provenance.source).toBe('stated');
    expect(liam?.name?.provenance.quote).toBe(message);
    expect(typeof liam?.id).toBe('string');

    const judged = stateOf(lastJudge(h.intel, JUDGE.FACTS_CHILD_IDENTITY).state);
    expect(asObject(judged.incoming).name).toBe('Liam');
    expect(asObject(judged.incoming).age).toBe(7);
    expect(asObject(judged.existing).name).toBe('Emma');
  });

  test('a child judged the same as an existing one merges into that record', async () => {
    const h = harness();
    const message = 'Emma Rose was born March 2, 2017';
    const [t1] = await runInterview(h, file({ children: [structuredClone(emma)] }), [
      { user: message, model: proposal({ children: [{ name: 'Emma Rose', date_of_birth: '2017-03-02' }] }), judgments: { same_child: yes() } },
    ]);

    expect(t1.file.children).toHaveLength(1);
    const merged = t1.file.children.find((c) => c.id === emma.id);
    expect(merged?.dateOfBirth?.value).toBe('2017-03-02');
    expect(merged?.dateOfBirth?.provenance.source).toBe('stated');
    expect(merged?.dateOfBirth?.provenance.quote).toBe(message);
  });

  test('a second child with two on file is judged one pair at a time and added when neither matches', async () => {
    const h = harness();
    const liam = { id: 'child_liam', name: { value: 'Liam', provenance: stated('Liam') } };
    const [t1] = await runInterview(h, file({ children: [structuredClone(emma), liam] }), [
      { user: 'I forgot Noah, he is 4', model: proposal({ children: [{ name: 'Noah', age: 4 }] }), judgments: { same_child: no() } },
    ]);

    expect(t1.file.children).toHaveLength(3);
    const calls = h.intel.callsTo(JUDGE.FACTS_CHILD_IDENTITY);
    expect(calls).toHaveLength(2);
    const existingNames = calls.map((c) => (c.kind === 'judge' ? asObject(stateOf(c.request.state).existing).name : null)).sort();
    expect(existingNames).toEqual(['Emma', 'Liam']);
  });

  test('the first child needs no identity judgment', async () => {
    const h = harness();
    const [t1] = await runInterview(h, file(), [{ user: 'my daughter Emma is 9', model: proposal({ children: [{ name: 'Emma', age: 9 }] }) }]);

    expect(t1.file.children).toHaveLength(1);
    expect(h.intel.callsTo(JUDGE.FACTS_CHILD_IDENTITY)).toHaveLength(0);
  });
});

describe('core/interview — affirmations', () => {
  const message = 'No, we do not own anything together, no house, no cars';
  const noProperty = proposal({ affirmations: ['no_property'] });

  test('an affirmation that clears the threshold is recorded with the verbatim quote', async () => {
    const h = harness();
    const [t1] = await runInterview(h, file(), [{ user: message, model: noProperty, judgments: { affirmed: yes(0.9) } }]);

    expect(t1.result.confirmed).toEqual(['no_property']);
    expect(t1.result.unconfirmed).toEqual([]);
    expect(t1.file.confirmations.no_property?.quote).toBe(message);
    expect(t1.file.confirmations.no_property?.source).toBe('confirmed');
    expect(typeof t1.file.confirmations.no_property?.at).toBe('string');

    const judged = stateOf(lastJudge(h.intel, JUDGE.INTERVIEW_AFFIRMATION).state);
    expect(judged.message).toBe(message);
    expect(judged.confirmation).toBe('no_property');
  });

  test('an affirmation below the threshold is not recorded and is reported as unconfirmed', async () => {
    const h = harness();
    const [t1] = await runInterview(h, file(), [{ user: message, model: noProperty, judgments: { affirmed: yes(THRESHOLDS.affirmation - 0.25) } }]);

    expect(t1.file.confirmations.no_property).toBeUndefined();
    expect(t1.result.confirmed).toEqual([]);
    expect(t1.result.unconfirmed).toEqual(['no_property']);
  });

  test('each proposed affirmation is judged separately over the user’s message', async () => {
    const h = harness();
    const [t1] = await runInterview(h, file(), [
      {
        user: message,
        model: proposal({ affirmations: ['no_property', 'no_debts'] }),
        judgments: { affirmed: (_q, state) => (stateOf(state).confirmation === 'no_property' ? yes(0.95) : yes(0.5)) },
      },
    ]);

    expect(t1.result.confirmed).toEqual(['no_property']);
    expect(t1.result.unconfirmed).toEqual(['no_debts']);
    expect(t1.file.confirmations.no_debts).toBeUndefined();
    expect(h.intel.callsTo(JUDGE.INTERVIEW_AFFIRMATION)).toHaveLength(2);
  });

  test('never a confirmation from silence: fields without an affirmation record nothing', async () => {
    const h = harness();
    const [t1] = await runInterview(h, file(), [{ user: 'no kids', model: proposal({ fields: { has_children: false } }) }]);

    expect(t1.file.fields.hasChildren?.value).toBe(false);
    expect(t1.file.confirmations).toEqual({});
    expect(t1.result.confirmed).toEqual([]);
    expect(t1.result.unconfirmed).toEqual([]);
    expect(h.intel.callsTo(JUDGE.INTERVIEW_AFFIRMATION)).toHaveLength(0);
  });
});
