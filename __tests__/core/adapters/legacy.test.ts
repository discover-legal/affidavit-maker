/** @jest-environment node */
import { toAffidavitData, toCaseFile } from '@/core/adapters/legacy';
import { emptyCaseFile } from '@/core/model/types';

const v1Blob = {
  matterTypeCode: 'divorce',
  documentType: 'divorce_package',
  state: 'on',
  countryCode: 'ca',
  county: 'Toronto',
  caseNumber: 'FS-26-01234',
  petitionerFirstName: 'Marcus',
  petitionerLastName: 'Thompson',
  respondentFirstName: 'Dana',
  respondentLastName: 'Thompson',
  respondentAddressUnknown: true,
  respondentSuspectedLocation: 'Hamilton',
  role: 'respondent',
  marriageDate: '2015-06-20',
  hasProperty: true,
  noPropertyConfirmed: false,
  spousalSupportWaived: true,
  children: [{ name: 'Emma', dob: '2017-03-02' }, { name: 'Liam', age: 7 }],
  facts: [
    { id: 'f1', content: 'We separated on 2024-03-01.', category: 'relational', sourceQuote: 'we split march 1st 2024', timestamp: '2026-01-01T00:00:00.000Z' },
    { id: 'f2', content: 'I earn $4,000 a month.', category: 'financial', numericValue: 4000 },
  ],
  orchestratorState: { currentPhase: 'CHILDREN', completedPhases: ['INTAKE', 'RESIDENCY', 'GROUNDS'], triageComplete: true },
  requiredDocuments: ['divorce_response'],
  someClientOnlyKey: { nested: true },
};

describe('legacy adapter', () => {
  test('toCaseFile maps typed slots, confirmations, facts and leaves the rest in fields', () => {
    const file = toCaseFile(v1Blob, { id: 'doc1', userId: 'u1' });
    expect(file.matter).toBe('divorce');
    expect(file.jurisdiction).toBe('ON');
    expect(file.country).toBe('CA');
    expect(file.role).toBe('respondent');
    expect(file.parties.self.firstName?.value).toBe('Marcus');
    expect(file.parties.self.fullName).toBe('Marcus Thompson');
    expect(file.parties.other.lastName?.value).toBe('Thompson');
    expect(file.parties.other.whereaboutsUnknown?.value).toBe(true);
    expect(file.parties.other.suspectedLocation?.value).toBe('Hamilton');
    expect(file.county?.value).toBe('Toronto');
    expect(file.caseNumber?.value).toBe('FS-26-01234');
    expect(file.children).toHaveLength(2);
    expect(file.children[0].dateOfBirth?.value).toBe('2017-03-02');
    expect(file.children[1].age?.value).toBe(7);
    expect(file.facts.map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(file.facts[0].category).toBe('relationship');
    expect(file.facts[0].provenance.quote).toBe('we split march 1st 2024');
    expect(file.facts[1].values?.number).toBe(4000);
    expect(file.confirmations.support_waived?.source).toBe('derived');
    expect(file.confirmations.no_property).toBeUndefined(); // false flag is not a confirmation
    expect(file.interview).toEqual({ phase: 'CHILDREN', completed: ['INTAKE', 'RESIDENCY', 'GROUNDS'], turns: 0, triaged: true });
    expect(file.fields.marriageDate?.value).toBe('2015-06-20');
    expect(file.fields.hasProperty?.value).toBe(true);
    expect(file.fields.someClientOnlyKey?.value).toEqual({ nested: true });
    // typed slots never duplicate into fields
    expect(file.fields.petitionerFirstName).toBeUndefined();
    expect(file.fields.requiredDocuments).toBeUndefined();
  });

  test('a divorce_package document without matterTypeCode is a divorce matter', () => {
    const file = toCaseFile({ documentType: 'divorce_package' }, { id: 'd', userId: 'u' });
    expect(file.matter).toBe('divorce');
    expect(file.interview.triaged).toBe(true);
  });

  test('toAffidavitData round-trips and preserves unknown base keys', () => {
    const file = toCaseFile(v1Blob, { id: 'doc1', userId: 'u1' });
    file.facts[1] = { ...file.facts[1], status: 'retired', retiredBy: 'f3' };
    const out = toAffidavitData(file, { ...v1Blob, clientCursor: 42 });
    expect(out.clientCursor).toBe(42);
    expect(out.matterTypeCode).toBe('divorce');
    expect(out.documentType).toBe('divorce_package');
    expect(out.state).toBe('ON');
    expect(out.petitionerName).toBe('Marcus Thompson');
    expect(out.affiantName).toBe('Marcus Thompson');
    expect(out.respondentName).toBe('Dana Thompson');
    expect(out.respondentAddressUnknown).toBe(true);
    expect(out.spousalSupportWaived).toBe(true);
    expect(out.noPropertyConfirmed).toBe(false); // untouched base value; only confirmations write `true`
    expect(out.marriageDate).toBe('2015-06-20');
    expect((out.children as unknown[]).length).toBe(2);
    const facts = out.facts as Array<Record<string, unknown>>;
    expect(facts.map((f) => f.id)).toEqual(['f1']); // retired facts are not re-emitted
    expect(facts[0].content).toBe('We separated on 2024-03-01.');
    expect(facts[0].sourceQuote).toBe('we split march 1st 2024');
    expect(out.retiredFactStatements).toEqual(['I earn $4,000 a month.']);
    expect(out.orchestratorState).toEqual({
      currentPhase: 'CHILDREN',
      completedPhases: ['INTAKE', 'RESIDENCY', 'GROUNDS'],
      turns: 0,
      triageComplete: true,
      matterTypeCode: 'divorce',
      engine: 'v2',
    });
  });

  test('an empty CaseFile produces a minimal blob', () => {
    const out = toAffidavitData(emptyCaseFile({ id: 'x', userId: 'u' }));
    expect(out.children).toEqual([]);
    expect(out.facts).toEqual([]);
    expect(out.role).toBe('petitioner');
    expect(out.matterTypeCode).toBeUndefined();
  });
});
