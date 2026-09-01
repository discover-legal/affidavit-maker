/**
 * NY DRL § 230 sub-basis pre-selection (attorney round-2, 2026-08-30).
 *
 * When the transcript establishes the parties were married in New York
 * (via marriageStateName='NY' / 'New York', marriedInNy=true, or a
 * marriageLocation naming NY), the § 230 clause must pre-select
 * § 230(2) rather than emit the fill-in-the-blank menu. When only the
 * two-year state-residence fact is present, § 230(5) is selected.
 * Otherwise the menu renders with a Draft note.
 */

const NewYorkDivorcePetitionTemplate =
  require('../../templates/states/newyork/DivorcePetitionTemplate');

function base(overrides = {}) {
  return {
    petitionerName: 'David Cohen',
    respondentName: 'Ruth Cohen',
    state: 'NY',
    county: 'New York',
    ...overrides,
  };
}

describe('NY § 230 sub-basis pre-selection', () => {
  const tpl = new NewYorkDivorcePetitionTemplate();

  test('marriageStateName NY + 12+ months → § 230(2) selected with married-in-NY fact', () => {
    const text = tpl.getJurisdictionStatement(base({
      marriageStateName: 'NY',
      residencyStateMonths: 36,
    }));
    expect(text).toMatch(/Domestic Relations Law § 230\(2\)/);
    expect(text).toMatch(/parties were married in New York/);
    expect(text).not.toMatch(/choose one/);
    expect(text).not.toMatch(/Draft — select/);
  });

  test('marriedInNy=true (Manhattan case) → § 230(2)', () => {
    const text = tpl.getJurisdictionStatement(base({
      marriedInNy: true,
      residencyStateMonths: 60,
    }));
    expect(text).toMatch(/Domestic Relations Law § 230\(2\)/);
  });

  test('24+ months residence with no NY-marriage fact → § 230(5)', () => {
    const text = tpl.getJurisdictionStatement(base({
      residencyStateMonths: 30,
    }));
    expect(text).toMatch(/Domestic Relations Law § 230\(5\)/);
    expect(text).not.toMatch(/choose one/);
  });

  test('no facts at all → visible fill-in menu with all four § 230 sub-bases', () => {
    const text = tpl.getJurisdictionStatement(base());
    expect(text).toMatch(/choose one/);
    expect(text).toMatch(/DRL § 230\(2\)/);
    expect(text).toMatch(/DRL § 230\(3\)/);
    expect(text).toMatch(/DRL § 230\(4\)/);
    expect(text).toMatch(/DRL § 230\(5\)/);
    expect(text).toMatch(/Draft — select and complete/);
  });
});

describe('NY 22 NYCRR 202.16(e) no-prior-action disclosure', () => {
  test('grounds section emits the no-prior-action paragraph', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const section = tpl.generateGroundsSection(base());
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/No prior action for divorce, separation, or annulment/);
    expect(body).toMatch(/22 NYCRR 202\.16\(e\)/);
  });

  test('prior actions on file list them instead of the default disclosure', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const section = tpl.generateGroundsSection(base({
      priorMatrimonialActions: ['Kings County 2019 Separation Action, Index 12345/19'],
    }));
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/Kings County 2019 Separation Action/);
  });
});

describe('NY parties section — UD packet Draft note', () => {
  test('Section I opens with a note pointing to the NY UD packet', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const section = tpl.generatePartiesSection(base());
    const first = section.items[0];
    expect(first.type).toBe('official_form_note');
    expect(first.content).toMatch(/UD-1 through UD-13/);
    expect(first.content).toMatch(/UD-2/);
    expect(first.content).toMatch(/ww2\.nycourts\.gov\/divorce\/forms\.shtml/);
  });
});

describe('NY child DOB — year-only fallback', () => {
  test('birthYear on child renders "born 2020"', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const section = tpl.generateChildrenSection(base({
      hasMinorChildren: true,
      children: [{ name: 'Emma', birthYear: 2020 }],
    }));
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/Emma, born 2020/);
    expect(body).not.toMatch(/born __________________/);
  });
});
