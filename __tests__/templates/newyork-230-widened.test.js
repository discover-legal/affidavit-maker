// Round-3 attorney-review fix (2026-08-30): NY § 230 auto-select from
// marriagePlace='Manhattan' / any NY-known borough or county token, not
// only marriageStateName='NY' / marriageLocation matching /new york/.

const NewYorkDivorcePetitionTemplate =
  require('../../templates/states/newyork/DivorcePetitionTemplate');

function base(overrides = {}) {
  return {
    petitionerName: 'David Rosenberg',
    respondentName: 'Yvonne Rosenberg',
    state: 'NY',
    county: 'Kings',
    residencyStateMonths: 60,
    ...overrides,
  };
}

describe('NY § 230 auto-select — widened residency/marriage-place picker', () => {
  const tpl = new NewYorkDivorcePetitionTemplate();

  test('marriagePlace="Manhattan" + residencyStateMonths=60 → § 230(2)', () => {
    const text = tpl.getJurisdictionStatement(base({ marriagePlace: 'Manhattan' }));
    expect(text).toMatch(/Domestic Relations Law § 230\(2\)/);
    expect(text).toMatch(/married in New York/);
  });

  test('marriageStateName="New York" also works', () => {
    const text = tpl.getJurisdictionStatement(base({ marriageStateName: 'New York' }));
    expect(text).toMatch(/Domestic Relations Law § 230\(2\)/);
  });

  test('marriagePlace="Brooklyn, NY" auto-selects § 230(2)', () => {
    const text = tpl.getJurisdictionStatement(base({ marriagePlace: 'Brooklyn, NY' }));
    expect(text).toMatch(/Domestic Relations Law § 230\(2\)/);
  });

  test('facts-derived residence signal + marriagePlace=Manhattan → § 230(2) even without residencyStateMonths', () => {
    const text = tpl.getJurisdictionStatement({
      petitionerName: 'David Rosenberg',
      respondentName: 'Yvonne Rosenberg',
      state: 'NY',
      county: 'Kings',
      marriagePlace: 'Manhattan',
      // residencyStateMonths INTENTIONALLY absent — David's shape
      facts: [
        { content: 'The parties are residents of New York and have lived in Brooklyn for several years.',
          category: 'residence', subcategory: 'state_and_county_residence' },
      ],
    });
    expect(text).toMatch(/Domestic Relations Law § 230\(2\)/);
    expect(text).not.toMatch(/\(choose one\)/);
  });

  test('No NY signal at all still renders the fill-in-blank menu (regression guard)', () => {
    const text = tpl.getJurisdictionStatement({
      petitionerName: 'X', respondentName: 'Y', state: 'NY', county: 'Kings',
      marriagePlace: 'Miami', marriageStateName: 'FL',
    });
    expect(text).toMatch(/\(choose one\)/);
  });
});
