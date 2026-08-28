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

function makePhaseOrchestrator() {
  const order = ['INTAKE', 'RESIDENCY', 'GROUNDS', 'CHILDREN', 'PROPERTY', 'SUPPORT', 'SERVICE', 'INDIGENCY', 'MILITARY', 'REVIEW'];
  return new BaseDivorceOrchestrator({
    stateCode: 'UT',
    stateName: 'Utah',
    phases: Object.fromEntries(order.map((name) => [name, { prompt: name, displayName: name }])),
    phaseOrder: order,
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
      petitioner_first_name: 'Jordan',
      petitioner_last_name: 'Example',
      grounds: 'insupportability',
    });
    expect(data.petitionerName).toBe('Jordan Example');
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

  test('shows known My Story phase details so the interview does not ask for them again', () => {
    const orch = makeOrchestrator();
    const summary = orch._summarizeCollected({
      residencyStateMonths: 72,
      marriageDate: '2018-09-15',
      marriageCity: 'Salt Lake City',
      marriageStateName: 'Utah',
      separationDate: '2026-05-20',
      groundsForDivorce: 'Irreconcilable differences',
      hasMinorChildren: false,
      propertyAgreement: 'agreed',
      spousalSupportRequested: false,
      serviceMethod: 'waiver',
      indigencyRequested: false,
      respondentMilitaryStatus: 'not_active_duty',
      facts: [{ content: 'We have no minor children together.' }],
    });

    expect(summary).toContain('Time living in state/province: 72 months');
    expect(summary).toContain('Marriage place: Salt Lake City, Utah');
    expect(summary).toContain('Separation date: 2026-05-20');
    expect(summary).toContain('Grounds: Irreconcilable differences');
    expect(summary).toContain('Minor children: no');
    expect(summary).toContain('Property agreement: agreed');
    expect(summary).toContain('Spousal support requested: no');
    expect(summary).toContain('Service method: waiver');
    expect(summary).toContain('Fee waiver requested: no');
    expect(summary).toContain('Respondent military status: not_active_duty');
    expect(summary).toContain('Previously documented facts (do not ask for these again)');
    expect(summary).toContain('We have no minor children together.');
  });
});

describe('BaseDivorceOrchestrator returning-user phase routing', () => {
  test('skips sections already answered in My Story', () => {
    const orch = makePhaseOrchestrator();
    const next = orch._getNextPhase('RESIDENCY', {
      grounds: 'Irreconcilable differences',
      marriageDate: '2018-09-15',
      marriageCity: 'Salt Lake City',
      hasMinorChildren: false,
      propertyAgreement: 'agreed',
      spousalSupportRequested: false,
      serviceMethod: 'waiver',
      indigencyRequested: false,
      respondentMilitaryStatus: 'not_active_duty',
      militarySearchDate: '2026-07-13',
    });
    expect(next).toBe('REVIEW');
  });

  test('does not skip a section that still needs a real answer', () => {
    const orch = makePhaseOrchestrator();
    expect(orch._getNextPhase('RESIDENCY', {
      marriageDate: '2018-09-15',
      marriageCity: 'Salt Lake City',
    })).toBe('GROUNDS');
    expect(orch._getNextPhase('GROUNDS', { hasMinorChildren: true })).toBe('CHILDREN');
  });

  test('recognizes an older profile with an explicit no-minor-children fact', () => {
    const orch = makePhaseOrchestrator();
    expect(orch._getNextPhase('GROUNDS', {
      facts: [{ content: 'Morgan Avery and I have no children together who are under 18.' }],
    })).toBe('PROPERTY');
    expect(orch._getNextPhase('GROUNDS', {
      facts: [{ content: 'Morgan Avery and I have two minor children.' }],
    })).toBe('CHILDREN');
    expect(orch._getNextPhase('GROUNDS', {
      facts: [{ content: 'I have no children from a previous relationship, but we have a child together.' }],
    })).toBe('CHILDREN');
  });

  test('recognizes a completed military check stored as older narrative facts', () => {
    const orch = makePhaseOrchestrator();
    expect(orch._getNextPhase('INDIGENCY', {
      facts: [
        { content: 'Morgan Avery is not in the military.' },
        { content: 'I checked the DMDC on July 13, 2026, and it showed no active-duty status.' },
      ],
    })).toBe('REVIEW');
    expect(orch._getNextPhase('INDIGENCY', {
      facts: [{ content: 'Morgan Avery is not in the military.' }],
    })).toBe('MILITARY');
  });
});

describe('property division capture', () => {
  test('maps property/debt assignments to the fields the decree reads, as line-item arrays', () => {
    // Item splitting is the MODEL's job via the array schema — the code
    // never splits on commas (a comma split once shattered "$62,000" into
    // "$62" + "000"). Arrays pass through element-for-element.
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates({}, {
      petitioner_property: ['the family home', '2019 Honda Accord'],
      respondent_property: ['Fidelity 401(k), approximately $62,000'],
      petitioner_debts: ['Chase credit card', 'medical bills'],
      respondent_debts: ['car loan'],
    });
    expect(data.petitionerProperty).toEqual(['the family home', '2019 Honda Accord']);
    expect(data.respondentProperty).toEqual(['Fidelity 401(k), approximately $62,000']);
    expect(data.petitionerDebts).toEqual(['Chase credit card', 'medical bills']);
    expect(data.respondentDebts).toEqual(['car loan']);
  });

  test('a legacy string value becomes ONE element — never re-split on commas', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates({}, {
      respondent_property: 'Fidelity 401(k) worth about $62,000',
    });
    expect(data.respondentProperty).toEqual(['Fidelity 401(k) worth about $62,000']);
  });
});

describe('spousal support payor/payee derivation', () => {
  test('petitioner (the requester) is payee, respondent is payor when support is requested', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates(
      { petitionerName: 'Jordan Example', respondentName: 'Casey Example' },
      { spousal_support_requested: true },
    );
    expect(data.spousalSupportAwarded).toBe(true);
    expect(data.spousalSupportPayee).toBe('Jordan Example');
    expect(data.spousalSupportPayor).toBe('Casey Example');
  });

  test('not derived when support is not requested, and existing values are kept', () => {
    const orch = makeOrchestrator();
    const waived = orch._applyFieldUpdates(
      { petitionerName: 'Jordan Example', respondentName: 'Casey Example' },
      { spousal_support_requested: false },
    );
    expect(waived.spousalSupportPayee).toBeUndefined();
    expect(waived.spousalSupportPayor).toBeUndefined();

    const kept = orch._applyFieldUpdates(
      {
        petitionerName: 'Jordan Example',
        respondentName: 'Casey Example',
        spousalSupportPayor: 'Jordan Example',
        spousalSupportPayee: 'Casey Example',
      },
      { spousal_support_requested: true },
    );
    expect(kept.spousalSupportPayor).toBe('Jordan Example');
    expect(kept.spousalSupportPayee).toBe('Casey Example');
  });

  test('derives on a later turn once names arrive, when support was requested earlier', () => {
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates(
      { spousalSupportRequested: true },
      { petitioner_first_name: 'Jordan', petitioner_last_name: 'Example',
        respondent_first_name: 'Casey', respondent_last_name: 'Example' },
    );
    expect(data.spousalSupportPayee).toBe('Jordan Example');
    expect(data.spousalSupportPayor).toBe('Casey Example');
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
      { petitionerName: 'Jordan Example', respondentName: 'Casey Example' },
      { restore_previous_name: true, previous_name: 'Casey Jordan Miller', name_change_party: 'respondent' },
    );
    expect(data.nameChangeParty).toBe('Casey Example');
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
      petitioner_first_name: 'Jordan',
      petitioner_last_name: 'Example',
    });
    expect(data.affiantName).toBe('Jordan Example');
    // An explicitly set affiantName is never overwritten.
    const kept = orch._applyFieldUpdates(
      { affiantName: 'Someone Else' },
      { petitioner_first_name: 'Jordan' },
    );
    expect(kept.affiantName).toBe('Someone Else');
  });
});

describe('income/expense breakdown replace-per-person accumulation', () => {
  test('same person restated under a label variant REPLACES, never appends (katie2 replay)', () => {
    const orch = makeOrchestrator();
    let data = orch._applyFieldUpdates({}, {
      income_breakdown: [
        { label: "Katie O'Brien-Hatch wages as office manager at dental office", amount: 3400, person: 'petitioner' },
        { label: 'Daniel Hatch wages as HVAC technician', amount: 5200, person: 'respondent' },
      ],
    });
    // A later turn restates both incomes under the parties' full legal names.
    data = orch._applyFieldUpdates(data, {
      income_breakdown: [
        { label: "Kathleen O'Brien-Hatch wages as office manager at a dental office", amount: 3400, person: 'petitioner' },
        { label: 'Daniel James Hatch wages as HVAC technician', amount: 5200, person: 'respondent' },
      ],
    });
    expect(data.incomeBreakdown).toHaveLength(2);
    expect(data.incomeBreakdown.filter((e) => e.person === 'petitioner')).toHaveLength(1);
    // Totals recomputed from the replaced list — not doubled.
    expect(data.monthlyIncome).toBe(3400);
    expect(data.spouseMonthlyIncome).toBe(5200);
  });

  test('a turn touching only one person leaves the other person\'s entries and total intact', () => {
    const orch = makeOrchestrator();
    let data = orch._applyFieldUpdates({}, {
      income_breakdown: [
        { label: 'My wages', amount: 3400, person: 'petitioner' },
        { label: 'Spouse wages', amount: 5200, person: 'respondent' },
      ],
    });
    data = orch._applyFieldUpdates(data, {
      income_breakdown: [{ label: 'My wages', amount: 3600, person: 'petitioner' }],
    });
    expect(data.incomeBreakdown).toHaveLength(2);
    expect(data.monthlyIncome).toBe(3600);
    expect(data.spouseMonthlyIncome).toBe(5200);
  });

  test('expense mirror: restating the complete expense list replaces it and recomputes monthlyExpenses', () => {
    const orch = makeOrchestrator();
    let data = orch._applyFieldUpdates({}, {
      expense_breakdown: [
        { label: 'Mortgage', amount: 1450 },
        { label: 'Groceries', amount: 700 },
      ],
    });
    data = orch._applyFieldUpdates(data, {
      expense_breakdown: [
        { label: 'Mortgage', amount: 1450 },
        { label: 'Groceries', amount: 700 },
        { label: 'Utilities', amount: 300 },
      ],
    });
    expect(data.expenseBreakdown).toHaveLength(3);
    expect(data.monthlyExpenses).toBe(2450);
  });

  test('schema tells the model to emit the COMPLETE per-person list', () => {
    const orch = makeOrchestrator();
    const props = orch.tool.function.parameters.properties;
    expect(props.income_breakdown.description).toContain('COMPLETE list');
    expect(props.income_breakdown.description).toContain('REPLACE');
    expect(props.expense_breakdown.description).toContain('COMPLETE current expense list');
  });
});

describe('_summarizeCollected lists recorded money items', () => {
  test('income and expense entries appear with person, label, and amount', () => {
    const orch = makeOrchestrator();
    const summary = orch._summarizeCollected({
      incomeBreakdown: [
        { label: 'My wages', amount: 3400, person: 'petitioner' },
        { label: 'Spouse wages', amount: 5200, person: 'respondent' },
      ],
      expenseBreakdown: [{ label: 'Mortgage', amount: 1450 }],
    });
    expect(summary).toContain('Income items recorded');
    expect(summary).toContain('[petitioner] My wages: $3400/month');
    expect(summary).toContain('[respondent] Spouse wages: $5200/month');
    expect(summary).toContain('Expense items recorded');
    expect(summary).toContain('- Mortgage: $1450/month');
    expect(summary).toContain("COMPLETE list");
  });
});

describe('spousal support waiver derivation stays mutually consistent', () => {
  test('declining support sets waived and clears awarded (and vice versa)', () => {
    const orch = makeOrchestrator();
    const waived = orch._applyFieldUpdates(
      { spousalSupportAwarded: true }, // stale hydrated flag from an earlier document
      { spousal_support_requested: false },
    );
    expect(waived.spousalSupportWaived).toBe(true);
    expect(waived.spousalSupportAwarded).toBe(false);

    const awarded = orch._applyFieldUpdates(
      { spousalSupportWaived: true },
      { spousal_support_requested: true },
    );
    expect(awarded.spousalSupportAwarded).toBe(true);
    expect(awarded.spousalSupportWaived).toBe(false);
  });
});

describe('pending-question pacing guidance', () => {
  test('system prompt caps re-asking to at most every other turn with varied phrasing', () => {
    const orch = makeOrchestrator();
    const prompt = orch._buildSystemPrompt(
      { currentPhase: 'INTAKE', completedPhases: [] },
      {},
    );
    expect(prompt).toContain('AT MOST once every other turn');
    expect(prompt).toContain('vary the phrasing');
    expect(prompt).toContain('never repeat a question word-for-word');
  });
});
