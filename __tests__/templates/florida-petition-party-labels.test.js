/**
 * Round-7 attorney review (Tavita FL, 2026-08-30): the Florida petition
 * body used the parties' proper names ("Marco Rossi has been a resident
 * of Florida..."); FL convention uses the role labels in body prose and
 * names the parties once in the caption.
 */

const FloridaDivorcePetitionTemplate =
  require('../../templates/states/florida/DivorcePetitionTemplate');

function baseData() {
  return {
    petitionerName: 'Marco Rossi',
    respondentName: 'Tavita Faletau',
    state: 'FL',
    county: 'Miami-Dade',
    marriageDate: '2018-06-15',
    hasMinorChildren: false,
    hasProperty: false,
    noPropertyConfirmed: true,
  };
}

describe('Florida petition — party role labels in body prose (Round-7)', () => {
  test('jurisdiction statement uses "Petitioner", not the party name', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const stmt = tpl.getJurisdictionStatement(baseData());
    expect(stmt).toMatch(/^Petitioner has been a resident/);
    expect(stmt).not.toMatch(/Marco Rossi/);
    expect(stmt).not.toMatch(/Tavita Faletau/);
  });

  test('bothResidents branch also uses role labels', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const stmt = tpl.getJurisdictionStatement({ ...baseData(), bothResidents: true });
    expect(stmt).toMatch(/^Petitioner and Respondent/);
    expect(stmt).not.toMatch(/Marco/);
    expect(stmt).not.toMatch(/Tavita/);
  });

  test('rendered jurisdiction section body does not contain party names in prose', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const section = tpl.generateJurisdictionSection(baseData());
    const jurisdictionItem = section.items.find(
      (i) => i.type === 'jurisdiction',
    );
    expect(jurisdictionItem.content).not.toMatch(/Marco Rossi/);
  });
});
