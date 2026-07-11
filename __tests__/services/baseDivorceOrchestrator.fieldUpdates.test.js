/** @jest-environment node */
'use strict';

const BaseDivorceOrchestrator = require('../../services/agents/BaseDivorceOrchestrator');

function makeOrchestrator() {
  return new BaseDivorceOrchestrator({
    stateCode: 'TX',
    stateName: 'Texas',
    phases: {
      INTAKE: { prompt: 'intake', displayName: 'Intake' },
      REVIEW: { prompt: 'review', displayName: 'Review' },
    },
    phaseOrder: ['INTAKE', 'REVIEW'],
  });
}

describe('BaseDivorceOrchestrator._applyFieldUpdates', () => {
  test('merges children across turns instead of replacing (reported bug)', () => {
    const orch = makeOrchestrator();
    let data = { children: [
      { name: 'Emma Smith', dob: '2015-04-02' },
      { name: 'Liam Smith', dob: '2017-06-15' },
    ] };
    // The LLM emits only the newly mentioned third child.
    data = orch._applyFieldUpdates(data, { children: [{ name: 'Ava Smith', dob: '2019-09-09' }] });
    expect(data.children).toHaveLength(3);
    expect(data.hasMinorChildren).toBe(true);
  });

  test('remove_children drops a recorded child on user correction', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates(
      { children: [{ name: 'Emma Smith' }, { name: 'Liam Smith' }] },
      { remove_children: ['Liam'] },
    );
    expect(data.children.map((c) => c.name)).toEqual(['Emma Smith']);
  });

  test('scalar fields still update normally', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates({}, {
      petitioner_first_name: 'Brandon',
      petitioner_last_name: 'Pritchard',
      grounds: 'insupportability',
    });
    expect(data.petitionerName).toBe('Brandon Pritchard');
    expect(data.groundsForDivorce).toBe('insupportability');
  });

  test('derives requestSpousalSupport for the petition relief section', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates({}, { spousal_support_requested: true });
    expect(data.requestSpousalSupport).toBe(true);
    expect(data.spousalSupportAwarded).toBe(true);
  });

  test('maps has_property / has_debts for the property section gates', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates({}, { has_property: false, has_debts: false });
    expect(data.hasProperty).toBe(false);
    expect(data.hasDebts).toBe(false);
  });
});

describe('BaseDivorceOrchestrator._summarizeCollected', () => {
  test('lists every recorded child so the LLM can preserve them', () => {
    const orch = makeOrchestrator();
    const summary = orch._summarizeCollected({
      children: [
        { name: 'Emma Smith', dob: '2015-04-02' },
        { name: 'Liam Smith', dob: '2017-06-15' },
        { name: 'Ava Smith', dob: '2019-09-09' },
      ],
    });
    expect(summary).toContain('Children recorded (3)');
    expect(summary).toContain('Emma Smith');
    expect(summary).toContain('Liam Smith');
    expect(summary).toContain('Ava Smith');
  });
});

describe('property division capture', () => {
  test('maps property/debt assignments to the fields the decree reads, as line-item arrays', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates({}, {
      petitioner_property: 'the family home, 2019 Honda Accord',
      respondent_property: '401(k) account',
      petitioner_debts: 'Chase credit card, medical bills',
      respondent_debts: 'car loan',
    });
    expect(data.petitionerProperty).toEqual(['the family home', '2019 Honda Accord']);
    expect(data.respondentProperty).toEqual(['401(k) account']);
    expect(data.petitionerDebts).toEqual(['Chase credit card', 'medical bills']);
    expect(data.respondentDebts).toEqual(['car loan']);
  });
});

describe('spousal support payor/payee derivation', () => {
  test('petitioner (the requester) is payee, respondent is payor when support is requested', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates(
      { petitionerName: 'Brandon Pritchard', respondentName: 'Casey Pritchard' },
      { spousal_support_requested: true },
    );
    expect(data.spousalSupportAwarded).toBe(true);
    expect(data.spousalSupportPayee).toBe('Brandon Pritchard');
    expect(data.spousalSupportPayor).toBe('Casey Pritchard');
  });

  test('not derived when support is not requested, and existing values are kept', () => {
    const orch = makeOrchestrator();
    const waived = orch._applyFieldUpdates(
      { petitionerName: 'Brandon Pritchard', respondentName: 'Casey Pritchard' },
      { spousal_support_requested: false },
    );
    expect(waived.spousalSupportPayee).toBeUndefined();
    expect(waived.spousalSupportPayor).toBeUndefined();

    const kept = orch._applyFieldUpdates(
      {
        petitionerName: 'Brandon Pritchard',
        respondentName: 'Casey Pritchard',
        spousalSupportPayor: 'Brandon Pritchard',
        spousalSupportPayee: 'Casey Pritchard',
      },
      { spousal_support_requested: true },
    );
    expect(kept.spousalSupportPayor).toBe('Brandon Pritchard');
    expect(kept.spousalSupportPayee).toBe('Casey Pritchard');
  });

  test('derives on a later turn once names arrive, when support was requested earlier', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates(
      { spousalSupportRequested: true },
      { petitioner_first_name: 'Brandon', petitioner_last_name: 'Pritchard',
        respondent_first_name: 'Casey', respondent_last_name: 'Pritchard' },
    );
    expect(data.spousalSupportPayee).toBe('Brandon Pritchard');
    expect(data.spousalSupportPayor).toBe('Casey Pritchard');
  });
});

describe('parent-time election capture', () => {
  test('maps parent_time_plan and parent_time_details straight through as scalars', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates({}, {
      parent_time_plan: 'custom',
      parent_time_details: 'alternating weeks, exchanges Sunday at 6 pm at the McDonald\'s in Lehi',
    });
    expect(data.parentTimePlan).toBe('custom');
    expect(data.parentTimeDetails).toBe('alternating weeks, exchanges Sunday at 6 pm at the McDonald\'s in Lehi');
  });

  test('a later election overwrites the earlier one without touching details semantics', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates(
      { parentTimePlan: 'custom', parentTimeDetails: 'every other weekend' },
      { parent_time_plan: 'statutory_minimum' },
    );
    expect(data.parentTimePlan).toBe('statutory_minimum');
    // Scalars only overwrite when re-sent; prior details remain recorded.
    expect(data.parentTimeDetails).toBe('every other weekend');
  });
});

describe('former-name restoration capture', () => {
  test('maps previous_name / restore_previous_name and derives the template gate', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates({}, {
      restore_previous_name: true,
      previous_name: 'Casey Jordan Miller',
    });
    expect(data.restorePreviousName).toBe(true);
    expect(data.previousName).toBe('Casey Jordan Miller');
    // Templates gate the RESTORATION OF NAME section on requestNameChange.
    expect(data.requestNameChange).toBe(true);
  });

  test('an explicit decline flips the gate off, even set on an earlier turn', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates(
      { restorePreviousName: true, requestNameChange: true, previousName: 'Casey Jordan Miller' },
      { restore_previous_name: false },
    );
    expect(data.restorePreviousName).toBe(false);
    expect(data.requestNameChange).toBe(false);
  });

  test('name_change_party resolves party roles to actual names for the decree', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates(
      { petitionerName: 'Brandon Pritchard', respondentName: 'Casey Pritchard' },
      { restore_previous_name: true, previous_name: 'Casey Jordan Miller', name_change_party: 'respondent' },
    );
    expect(data.nameChangeParty).toBe('Casey Pritchard');
  });

  test('untouched turns leave the name fields alone (non-destructive merge)', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates(
      { restorePreviousName: true, requestNameChange: true, previousName: 'Casey Jordan Miller' },
      { grounds: 'insupportability' },
    );
    expect(data.previousName).toBe('Casey Jordan Miller');
    expect(data.requestNameChange).toBe(true);
  });
});

describe('affiant derivation', () => {
  test('petitioner name doubles as affiantName for divorce filings', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates({}, {
      petitioner_first_name: 'Brandon',
      petitioner_last_name: 'Pritchard',
    });
    expect(data.affiantName).toBe('Brandon Pritchard');
    // An explicitly set affiantName is never overwritten.
    const kept = orch._applyFieldUpdates(
      { affiantName: 'Someone Else' },
      { petitioner_first_name: 'Brandon' },
    );
    expect(kept.affiantName).toBe('Someone Else');
  });
});
