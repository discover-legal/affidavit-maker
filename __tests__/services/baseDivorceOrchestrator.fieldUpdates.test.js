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
