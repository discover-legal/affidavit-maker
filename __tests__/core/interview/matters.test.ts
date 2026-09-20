/** @jest-environment node */
/**
 * core/interview — YAML matters (spec §4).
 *
 * Expected export (not yet in core/interview/types.ts):
 *
 *   fromYamlMatter(def: import('@/services/matters').MatterDefinition): MatterDefinition
 *
 * from '@/core/interview'. It adapts a validated matters/*.yaml definition
 * into the engine's MatterDefinition: phases keep their ids and camelCase
 * required fields, `prompt` becomes `guidance`, conditional phases keep
 * their skip rules, and well-known field aliases bind to typed slots
 * (current_first_name / petitioner_first_name / plaintiff_first_name →
 * self.firstName, …_last_name → self.lastName, county → county,
 * state → jurisdiction).
 */

import path from 'path';
import { loadMatterRegistry } from '@/services/matters';
import type { MatterDefinition as YamlMatterDefinition } from '@/services/matters';
import { createInterviewEngine } from '@/core/interview';
import type { InterviewEngine, MatterDefinition } from '@/core/interview/types';
import { ScriptedIntelligence, yes } from '@/core/intelligence/scripted';
import type { JsonObject } from '@/core/intelligence/types';
import { JUDGE } from '@/core/intelligence/purposes';
import { asObject, fileFor, interviewExport, jurisdictionStub, lastJudge, matterStub, proposal, registryStub, runInterview } from '../helpers/scripted';

type FromYamlMatter = (def: YamlMatterDefinition) => MatterDefinition;
const fromYamlMatter = (): FromYamlMatter => interviewExport<FromYamlMatter>('fromYamlMatter');

function loadNameChange(): YamlMatterDefinition {
  const registry = loadMatterRegistry(path.join(process.cwd(), 'matters'));
  const def = registry.get('name_change');
  if (!def) throw new Error('matters/name_change.yaml did not load');
  return def;
}

const YAML_FIELD_KEYS = [
  'current_first_name', 'current_middle_name', 'current_last_name',
  'new_first_name', 'new_middle_name', 'new_last_name',
  'state', 'county', 'change_reason', 'is_for_minor', 'prior_names',
  'criminal_history_confirmed', 'pending_proceedings', 'child_name', 'child_dob',
  'other_parent_name', 'other_parent_consent', 'publication_waiver_requested',
  'publication_waiver_reason', 'indigency_requested', 'user_confirmed_review',
];

describe('core/interview — fromYamlMatter(name_change)', () => {
  test('keeps the catalog identity', () => {
    const def = fromYamlMatter()(loadNameChange());
    expect(def.code).toBe('name_change');
    expect(def.practiceArea).toBe('civil');
    expect(def.familyProfile).toBe(false);
    expect(def.displayName).toBe('Name Change');
    expect(def.roles).toBeFalsy();
  });

  test('keeps the phase order, camelCase required fields and skip rules; prompts become guidance', () => {
    const def = fromYamlMatter()(loadNameChange());
    expect(def.phases.map((p) => p.id)).toEqual(['INTAKE', 'BACKGROUND', 'MINOR_DETAILS', 'NOTICE', 'REVIEW']);
    const byId = new Map(def.phases.map((p) => [p.id, p]));

    expect(byId.get('INTAKE')?.requiredFields).toEqual(['currentFirstName', 'currentLastName', 'newFirstName', 'newLastName', 'state', 'county']);
    expect(byId.get('BACKGROUND')?.requiredFields).toEqual(['priorNames', 'criminalHistoryConfirmed']);
    expect(byId.get('MINOR_DETAILS')?.requiredFields).toEqual(['childName', 'otherParentName']);
    expect(byId.get('MINOR_DETAILS')?.skipUnlessAny).toEqual(['isForMinor']);
    expect(byId.get('NOTICE')?.requiredFields).toEqual(['publicationWaiverRequested']);
    expect(byId.get('REVIEW')?.requiredFields).toEqual(['userConfirmedReview']);
    expect(byId.get('REVIEW')?.confirmations).toEqual(expect.arrayContaining(['review_confirmed']));

    for (const phase of def.phases) {
      expect(typeof phase.guidance).toBe('string');
      expect(phase.guidance.length).toBeGreaterThan(0);
      expect(typeof phase.displayName).toBe('string');
    }
    expect(byId.get('INTAKE')?.displayName).toBe('Getting Started');
  });

  test('carries every YAML field with its camelCase target and schema', () => {
    const def = fromYamlMatter()(loadNameChange());
    expect(def.fields.map((f) => f.key).sort()).toEqual([...YAML_FIELD_KEYS].sort());
    const byKey = new Map(def.fields.map((f) => [f.key, f]));

    expect(byKey.get('current_first_name')?.target).toBe('currentFirstName');
    expect(byKey.get('is_for_minor')?.target).toBe('isForMinor');
    expect((byKey.get('is_for_minor')?.schema as JsonObject).type).toBe('boolean');
    expect((byKey.get('publication_waiver_reason')?.schema as JsonObject).enum).toEqual(['safety', 'gender_identity', 'financial_hardship', 'none']);
    expect((byKey.get('criminal_history_confirmed')?.schema as JsonObject).type).toBe('boolean');
  });

  test('binds the well-known aliases to typed slots', () => {
    const def = fromYamlMatter()(loadNameChange());
    const byKey = new Map(def.fields.map((f) => [f.key, f]));
    expect(byKey.get('current_first_name')?.binds).toBe('self.firstName');
    expect(byKey.get('current_last_name')?.binds).toBe('self.lastName');
    expect(byKey.get('county')?.binds).toBe('county');
    expect(byKey.get('state')?.binds).toBe('jurisdiction');
    // The requested new name is matter data, not the party's legal name.
    expect(byKey.get('new_first_name')?.binds).toBeUndefined();
    expect(byKey.get('change_reason')?.binds).toBeUndefined();
  });
});

describe('core/interview — name_change interview loop', () => {
  function harness(): { engine: InterviewEngine; intel: ScriptedIntelligence } {
    const definition = fromYamlMatter()(loadNameChange());
    const intel = new ScriptedIntelligence();
    const engine = createInterviewEngine({
      intelligence: intel,
      matters: matterStub(definition),
      jurisdictions: registryStub([jurisdictionStub('TX')]),
    });
    return { engine, intel };
  }

  test('runs INTAKE → BACKGROUND → NOTICE → REVIEW, skipping MINOR_DETAILS, and completes on a confirmed review', async () => {
    const h = harness();
    const definition = fromYamlMatter()(loadNameChange());
    const file = fileFor({ matter: 'name_change', country: 'US' });
    const confirmMessage = 'Yes, everything is correct, the spelling is right';

    const records = await runInterview(h, file, [
      {
        user: 'My name is Jordan Reyes and I want to become Jordan Alvarez. I am in Travis County, Texas. It is for me, not a child; I want my late father’s surname.',
        model: proposal({
          say: 'Got it. Have you ever gone by any other names?',
          questions_asked: ['Have you ever gone by any other names?'],
          phase_complete: true,
          fields: {
            current_first_name: 'Jordan',
            current_last_name: 'Reyes',
            new_first_name: 'Jordan',
            new_last_name: 'Alvarez',
            state: 'TX',
            county: 'Travis',
            is_for_minor: false,
            change_reason: 'to carry my late father’s surname',
          },
        }),
      },
      {
        user: 'I used Jordan Reyes-Smith while married. No felonies, nothing pending.',
        model: proposal({
          say: 'Thanks. Do you want to request a waiver of the publication requirement?',
          questions_asked: ['Do you want to request a waiver of the publication requirement?'],
          phase_complete: true,
          fields: { prior_names: 'Jordan Reyes-Smith', criminal_history_confirmed: true, pending_proceedings: false },
          facts: [{ statement: 'I previously used the name Jordan Reyes-Smith while married.', category: 'identity', quote: 'I used Jordan Reyes-Smith while married' }],
        }),
      },
      {
        user: 'No waiver, and I do not need a fee waiver either.',
        model: proposal({
          say: 'Understood. Here is the summary; does everything look correct?',
          questions_asked: ['Does everything look correct?'],
          phase_complete: true,
          fields: { publication_waiver_requested: false, indigency_requested: false },
        }),
      },
      {
        user: 'Wait, can you show me the new name spelling again?',
        model: proposal({
          say: 'Jordan Alvarez. Is that spelling correct?',
          questions_asked: ['Is that spelling correct?'],
          phase_complete: false,
        }),
      },
      {
        user: confirmMessage,
        model: proposal({
          say: 'Your name change petition draft is ready. Would you like to generate it now?',
          questions_asked: ['Would you like to generate it now?'],
          phase_complete: true,
          fields: { user_confirmed_review: true },
          affirmations: ['review_confirmed'],
        }),
        judgments: { affirmed: yes(0.95) },
      },
    ]);

    expect(records).toHaveLength(5);
    const [t1, t2, t3, t4, t5] = records;

    // T1 — INTAKE complete: name bound, jurisdiction and county bound, phase moves on.
    expect(t1.file.parties.self.firstName?.value).toBe('Jordan');
    expect(t1.file.parties.self.lastName?.value).toBe('Reyes');
    expect(t1.file.county?.value).toBe('Travis');
    expect(t1.file.jurisdiction).toBe('TX');
    expect(t1.file.fields.newLastName?.value).toBe('Alvarez');
    expect(t1.file.fields.isForMinor?.value).toBe(false);
    expect(t1.result.phaseAdvanced).toBe(true);
    expect(t1.file.interview.completed).toEqual(['INTAKE']);
    expect(t1.file.interview.phase).toBe('BACKGROUND');
    expect(h.engine.isComplete(t1.file, definition)).toBe(false);

    // T2 — BACKGROUND complete: MINOR_DETAILS is skipped because isForMinor is false.
    expect(t2.result.newFacts).toHaveLength(1);
    expect(t2.file.fields.criminalHistoryConfirmed?.value).toBe(true);
    expect(t2.file.interview.completed).toEqual(['INTAKE', 'BACKGROUND']);
    expect(t2.file.interview.phase).toBe('NOTICE');

    // T3 — NOTICE complete.
    expect(t3.file.fields.publicationWaiverRequested?.value).toBe(false);
    expect(t3.file.interview.completed).toEqual(['INTAKE', 'BACKGROUND', 'NOTICE']);
    expect(t3.file.interview.phase).toBe('REVIEW');

    // T4 — still in REVIEW; nothing confirmed from a question.
    expect(t4.result.phaseAdvanced).toBe(false);
    expect(t4.file.interview.phase).toBe('REVIEW');
    expect(t4.file.confirmations.review_confirmed).toBeUndefined();
    expect(h.engine.isComplete(t4.file, definition)).toBe(false);

    // T5 — review confirmed by a judged affirmation over the verbatim message.
    expect(t5.result.confirmed).toEqual(['review_confirmed']);
    expect(t5.file.confirmations.review_confirmed?.quote).toBe(confirmMessage);
    expect(t5.file.confirmations.review_confirmed?.source).toBe('confirmed');
    expect(asObject(lastJudge(h.intel, JUDGE.INTERVIEW_AFFIRMATION).state).message).toBe(confirmMessage);
    expect(t5.file.fields.userConfirmedReview?.value).toBe(true);
    expect(t5.file.interview.completed).toEqual(['INTAKE', 'BACKGROUND', 'NOTICE', 'REVIEW']);
    expect(t5.file.interview.turns).toBe(5);
    expect(h.engine.nextPhase(t5.file, definition)).toBeNull();
    expect(h.engine.isComplete(t5.file, definition)).toBe(true);
  });
});
