/** @jest-environment node */
/**
 * core/interview — the divorce definition with jurisdiction overlays (spec §5).
 *
 * Expected export (not yet in core/interview/types.ts):
 *
 *   getDivorceDefinition(jurisdiction: JurisdictionProfile): MatterDefinition
 *
 * from '@/core/interview'. It is resolved at runtime through `interviewExport`
 * so this file type-checks today and fails red until the export exists.
 */

import { createInterviewEngine } from '@/core/interview';
import type { InterviewEngine, MatterDefinition } from '@/core/interview/types';
import { ScriptedIntelligence } from '@/core/intelligence/scripted';
import type { JsonObject } from '@/core/intelligence/types';
import type { JurisdictionProfile } from '@/core/jurisdictions/types';
import type { CaseFile } from '@/core/model/types';
import {
  fileFor,
  interviewExport,
  jurisdictionStub,
  matterStub,
  monthsAgo,
  proposal,
  registryStub,
  runInterview,
  stated,
} from '../helpers/scripted';

type GetDivorceDefinition = (jurisdiction: JurisdictionProfile) => MatterDefinition;
const getDivorceDefinition = (): GetDivorceDefinition => interviewExport<GetDivorceDefinition>('getDivorceDefinition');

const US_PHASES = ['INTAKE', 'RESIDENCY', 'GROUNDS', 'CHILDREN', 'PROPERTY', 'SUPPORT', 'SERVICE', 'INDIGENCY', 'MILITARY', 'REVIEW'];
const CA_PHASES = US_PHASES.filter((p) => p !== 'INDIGENCY' && p !== 'MILITARY');

function harness(code: 'ON' | 'TX' | 'NY'): { engine: InterviewEngine; intel: ScriptedIntelligence; profile: JurisdictionProfile; definition: MatterDefinition } {
  const profile = jurisdictionStub(code);
  const definition = getDivorceDefinition()(profile);
  const intel = new ScriptedIntelligence();
  const engine = createInterviewEngine({
    intelligence: intel,
    matters: matterStub(definition),
    jurisdictions: registryStub([profile]),
  });
  return { engine, intel, profile, definition };
}

function divorceFile(jurisdiction: 'ON' | 'TX' | 'NY', phase: string, overrides: Partial<CaseFile> = {}): CaseFile {
  return fileFor({
    matter: 'divorce',
    jurisdiction,
    country: jurisdiction === 'ON' ? 'CA' : 'US',
    parties: {
      self: { firstName: { value: 'Marcus', provenance: stated('Marcus Bell') }, lastName: { value: 'Bell', provenance: stated('Marcus Bell') } },
      other: {},
    },
    interview: { phase, completed: [], turns: 1, triaged: true },
    ...overrides,
  });
}

const enumOf = (def: MatterDefinition, key: string): unknown => (def.fields.find((f) => f.key === key)?.schema as JsonObject | undefined)?.enum;

describe('core/interview — divorce definition', () => {
  test('is the divorce matter for every jurisdiction', () => {
    for (const code of ['TX', 'ON', 'NY'] as const) {
      const def = getDivorceDefinition()(jurisdictionStub(code));
      expect(def.code).toBe('divorce');
      expect(def.practiceArea).toBe('family');
      expect(def.familyProfile).toBe(true);
      expect(def.roles).toBe(true);
    }
  });

  test('US phases run INTAKE through MILITARY to REVIEW', () => {
    expect(getDivorceDefinition()(jurisdictionStub('TX')).phases.map((p) => p.id)).toEqual(US_PHASES);
    expect(getDivorceDefinition()(jurisdictionStub('NY')).phases.map((p) => p.id)).toEqual(US_PHASES);
  });

  test('Canadian phases omit INDIGENCY and MILITARY', () => {
    expect(getDivorceDefinition()(jurisdictionStub('ON')).phases.map((p) => p.id)).toEqual(CA_PHASES);
  });

  test('phases that may elicit confirmations declare them', () => {
    const byId = new Map(getDivorceDefinition()(jurisdictionStub('TX')).phases.map((p) => [p.id, p]));
    expect(byId.get('CHILDREN')?.confirmations).toEqual(expect.arrayContaining(['no_children']));
    expect(byId.get('PROPERTY')?.confirmations).toEqual(expect.arrayContaining(['no_property', 'no_debts']));
    expect(byId.get('SUPPORT')?.confirmations).toEqual(expect.arrayContaining(['support_waived']));
    expect(byId.get('MILITARY')?.confirmations).toEqual(expect.arrayContaining(['not_military']));
    expect(byId.get('REVIEW')?.confirmations).toEqual(expect.arrayContaining(['review_confirmed']));
  });

  test('the overlay carries jurisdiction guidance for GROUNDS and the grounds enum is the profile’s ground codes', () => {
    for (const code of ['ON', 'TX', 'NY'] as const) {
      const profile = jurisdictionStub(code);
      const def = getDivorceDefinition()(profile);
      expect(typeof def.overlay).toBe('function');
      const overlay = def.overlay?.(profile) ?? {};
      expect(typeof overlay.GROUNDS).toBe('string');
      expect((overlay.GROUNDS ?? '').length).toBeGreaterThan(0);
      expect(typeof overlay.RESIDENCY).toBe('string');

      const grounds = def.fields.find((f) => f.target === 'groundsForDivorce');
      expect(grounds?.key).toBe('grounds');
      expect(enumOf(def, 'grounds')).toEqual(profile.divorce?.grounds.map((g) => g.code));
    }
  });

  test('every phase has a non-empty guidance string and the GROUNDS phase names a required grounds target', () => {
    const def = getDivorceDefinition()(jurisdictionStub('TX'));
    for (const phase of def.phases) {
      expect(typeof phase.guidance).toBe('string');
      expect(phase.guidance.length).toBeGreaterThan(0);
      expect(typeof phase.displayName).toBe('string');
    }
    expect(def.phases.find((p) => p.id === 'GROUNDS')?.requiredFields).toEqual(expect.arrayContaining(['groundsForDivorce']));
  });

  test('the role field is who_filed with a closed enum, and the whereabouts fields bind to the other party', () => {
    const def = getDivorceDefinition()(jurisdictionStub('TX'));
    expect(enumOf(def, 'who_filed')).toEqual(['me', 'my_spouse', 'unknown']);
    expect(def.fields.find((f) => f.key === 'respondent_address_unknown')?.binds).toBe('other.whereaboutsUnknown');
    expect(def.fields.find((f) => f.key === 'respondent_suspected_location')?.binds).toBe('other.suspectedLocation');
    expect(def.fields.find((f) => f.key === 'respondent_first_name')?.binds).toBe('other.firstName');
    expect(def.fields.find((f) => f.key === 'petitioner_first_name')?.binds).toBe('self.firstName');
    expect(def.fields.find((f) => f.key === 'case_number')?.binds).toBe('caseNumber');
  });
});

describe('core/interview — divorce turns', () => {
  test('who_filed my_spouse makes the user the respondent', async () => {
    const h = harness('ON');
    const message = 'she filed, I was served June 24';
    const [t1] = await runInterview(h, divorceFile('ON', 'INTAKE'), [
      { user: message, model: proposal({ fields: { who_filed: 'my_spouse', service_date: '2025-06-24' } }) },
    ]);

    expect(t1.file.role).toBe('respondent');
    expect(t1.file.parties.self.firstName?.value).toBe('Marcus');
    expect(t1.file.fields.serviceDate?.value).toBe('2025-06-24');
    expect(t1.file.fields.serviceDate?.provenance.quote).toBe(message);
  });

  test('who_filed me keeps the user as petitioner', async () => {
    const h = harness('TX');
    const [t1] = await runInterview(h, divorceFile('TX', 'INTAKE'), [{ user: 'I am filing', model: proposal({ fields: { who_filed: 'me' } }) }]);
    expect(t1.file.role).toBe('petitioner');
  });

  test('whereabouts: unknown address and a suspected location bind to the other party with provenance', async () => {
    const h = harness('TX');
    const message = 'he moved out, no idea where, maybe Louisiana or Mississippi';
    const [t1] = await runInterview(h, divorceFile('TX', 'SERVICE'), [
      {
        user: message,
        model: proposal({
          fields: { respondent_address_unknown: true, respondent_suspected_location: 'Louisiana or Mississippi' },
          facts: [{ statement: 'My spouse moved out and I do not know where he lives; possibly Louisiana or Mississippi.', category: 'residence', subcategory: 'respondent_whereabouts', quote: message, values: { place: 'Louisiana or Mississippi' } }],
        }),
      },
    ]);

    const { other } = t1.file.parties;
    expect(other.whereaboutsUnknown?.value).toBe(true);
    expect(other.whereaboutsUnknown?.provenance.source).toBe('stated');
    expect(other.whereaboutsUnknown?.provenance.quote).toBe(message);
    expect(other.suspectedLocation?.value).toBe('Louisiana or Mississippi');
    expect(other.suspectedLocation?.provenance.quote).toBe(message);
    expect(other.address).toBeUndefined();
    expect(t1.result.newFacts).toHaveLength(1);
    expect(t1.result.newFacts[0].provenance.quote).toBe(message);
  });

  test('grounds: a jurisdiction ground is recorded with provenance', async () => {
    const h = harness('TX');
    const message = 'we just cannot get along anymore, no fault';
    const [t1] = await runInterview(h, divorceFile('TX', 'GROUNDS'), [
      { user: message, model: proposal({ fields: { grounds: 'insupportability' }, facts: [{ statement: 'Our marriage has become insupportable.', category: 'relationship', subcategory: 'grounds', quote: message, values: { ground: 'insupportability' } }] }) },
    ]);

    expect(t1.file.fields.groundsForDivorce?.value).toBe('insupportability');
    expect(t1.file.fields.groundsForDivorce?.provenance.quote).toBe(message);
    expect(t1.result.newFacts[0]?.values?.ground).toBe('insupportability');
  });

  test('separation gate: one-year separation is not recorded when the separation is shorter than the jurisdiction requires', async () => {
    const h = harness('ON');
    const separationDate = monthsAgo(4);
    const message = 'we separated 4 months ago';
    const [t1] = await runInterview(h, divorceFile('ON', 'GROUNDS'), [
      {
        user: message,
        model: proposal({
          fields: { grounds: 'one_year_separation', separation_date: separationDate },
          facts: [{ statement: 'My spouse and I separated four months ago.', category: 'relationship', subcategory: 'separation', quote: message, values: { date: separationDate } }],
        }),
      },
    ]);

    expect(t1.file.fields.groundsForDivorce).toBeUndefined();
    expect(t1.file.fields.separationDate?.value).toBe(separationDate);
    expect(t1.result.newFacts).toHaveLength(1);
    expect(t1.result.newFacts[0].values?.date).toBe(separationDate);
    expect(t1.result.phaseAdvanced).toBe(false);
  });

  test('separation gate: one-year separation is recorded once the required months have passed', async () => {
    const h = harness('ON');
    const separationDate = monthsAgo(14);
    const [t1] = await runInterview(h, divorceFile('ON', 'GROUNDS'), [
      { user: 'we separated over a year ago', model: proposal({ fields: { grounds: 'one_year_separation', separation_date: separationDate } }) },
    ]);

    expect(t1.file.fields.groundsForDivorce?.value).toBe('one_year_separation');
    expect(t1.file.fields.separationDate?.value).toBe(separationDate);
  });

  test('grounds outside the jurisdiction’s closed set are not recorded', async () => {
    const h = harness('TX');
    const [t1] = await runInterview(h, divorceFile('TX', 'GROUNDS'), [{ user: 'irreconcilable differences I guess', model: proposal({ fields: { grounds: 'irreconcilable_differences' } }) }]);
    expect(t1.file.fields.groundsForDivorce).toBeUndefined();
  });

  test('silence is never a waiver: not requesting support does not confirm support_waived', async () => {
    const h = harness('TX');
    const [t1] = await runInterview(h, divorceFile('TX', 'SUPPORT'), [
      { user: 'I am not asking for spousal support', model: proposal({ fields: { spousal_support_requested: false } }) },
    ]);

    expect(t1.file.fields.spousalSupportRequested?.value).toBe(false);
    expect(t1.file.confirmations.support_waived).toBeUndefined();
    expect(t1.result.confirmed).toEqual([]);
  });
});
