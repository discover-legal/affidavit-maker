/**
 * Amara round-2 replay guard (2026-08): the Georgia divorce petition
 * venue paragraph must NOT allege "Defendant resides in [county]
 * County, Georgia" when the petitioner has affirmed the Defendant is
 * a nonresident of Georgia (Amara transcript: Defendant moved to
 * Alabama). Instead plead the nonresident-defendant / Plaintiff-
 * residency venue basis under O.C.G.A. § 19-5-2.
 */

const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

function renderVenue(data) {
  const tpl = new GeorgiaDivorcePetitionTemplate();
  const section = tpl.generateJurisdictionSection(data);
  return section.items.map((i) => i.content).join('\n');
}

describe('GeorgiaDivorcePetitionTemplate — nonresident-defendant venue', () => {
  test('respondentAddressUnknown=true switches venue to O.C.G.A. § 19-5-2 nonresident basis', () => {
    const body = renderVenue({
      petitionerName: 'Amara Jones',
      respondentName: 'DJ Jones',
      county: 'Fulton',
      respondentAddressUnknown: true,
      respondentSuspectedLocation: 'Alabama',
    });
    expect(body).toMatch(/Defendant is a nonresident of Georgia/i);
    expect(body).toMatch(/O\.C\.G\.A\.\s*§\s*19-5-2/);
    expect(body).toMatch(/Plaintiff is a bona fide resident of Fulton County/i);
    // The old fabricated allegation must not appear.
    expect(body).not.toMatch(/Defendant resides in Fulton County, Georgia/i);
  });

  test('known Georgia-resident Defendant keeps the current venue wording (positive control)', () => {
    const body = renderVenue({
      petitionerName: 'Amara Jones',
      respondentName: 'DJ Jones',
      county: 'Fulton',
      respondentAddress: '123 Peachtree St, Atlanta, GA 30303',
    });
    expect(body).toMatch(/Defendant resides in Fulton County, Georgia/i);
    expect(body).not.toMatch(/nonresident of Georgia/i);
  });
});
