/**
 * CA petition attorney-review guards (2026-08-30):
 *   1. realEstateItems from the profile surface in Section VI.
 *      PROPERTY as named parcels; without them, the section falls
 *      back to the generic FL-160 catch-all.
 *   2. Marriage place fills in from marriageCity + marriageStateName
 *      when marriageLocation isn't stored directly.
 *   3. Caption reads "IN RE MARRIAGE OF <surname> AND <surname>"
 *      (California convention), not "IN THE MATTER OF THE MARRIAGE
 *      OF" (WA/OR).
 *   4. A Draft note at the top of the draft points to Judicial
 *      Council form FL-100 (courts.ca.gov/forms-rules/court-forms).
 *   5. Grounds are pleaded once — never in both marriage-info and
 *      grounds sections.
 */

const CaliforniaDivorcePetitionTemplate =
  require('../../templates/states/california/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Alison McPherson',
    respondentName: 'Kenji Ito',
    state: 'CA',
    county: 'San Diego',
    marriageDate: '2010-08-20',
    marriageCity: 'Oakland',
    marriageStateName: 'California',
    separationDate: '2025-01-15',
    hasMinorChildren: false,
    numberOfChildren: 0,
    ...overrides,
  };
}

describe('CA petition — real estate items surface in property section', () => {
  test('realEstateItems with Poway home lands in the property section as a named parcel', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    const section = tpl.generatePropertySection(baseData({
      realEstateItems: [{ description: 'Poway home', county: 'San Diego' }],
    }));
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/Poway home/);
    expect(body).toMatch(/San Diego County/);
    expect(body).toMatch(/community property subject to division/);
  });

  test('street address + APN renders as commonly-known-as clause', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    const section = tpl.generatePropertySection(baseData({
      realEstateItems: [{
        address: '456 Poway Rd',
        city: 'Poway',
        county: 'San Diego',
        apn: '123-456-789',
      }],
    }));
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/456 Poway Rd/);
    expect(body).toMatch(/APN 123-456-789/);
  });

  test('no realEstateItems → generic FL-160 fallback (no Poway mention)', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    const section = tpl.generatePropertySection(baseData());
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).not.toMatch(/Poway/);
    expect(body).toMatch(/Property Declaration \(Form FL-160\)/);
  });
});

describe('CA petition — marriage place fills from marriageCity + marriageStateName', () => {
  test('marriageCity + marriageStateName → "in Oakland, California"', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    const section = tpl.generateMarriageInformationSection(baseData());
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/in Oakland, California/);
  });

  test('missing city/state → no in-clause but rest still renders', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    const section = tpl.generateMarriageInformationSection({
      petitionerName: 'A',
      respondentName: 'B',
      marriageDate: '2010-08-20',
    });
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/were married on/);
    expect(body).not.toMatch(/undefined/);
  });
});

describe('CA petition — "In re Marriage of" caption', () => {
  test('caption reads "IN RE MARRIAGE OF McPherson AND Ito"', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    const caption = tpl.generateCaseCaption(baseData());
    expect(caption.formatted).toMatch(/IN RE MARRIAGE OF McPHERSON AND ITO/i);
    expect(caption.formatted).not.toMatch(/IN THE MATTER OF THE MARRIAGE OF/);
    // Structured caption's left column carries the same convention.
    expect(caption.structured.left.join(' ')).toMatch(/IN RE MARRIAGE OF McPHERSON AND ITO/i);
  });

  test('missing names → visible fill-in blanks, never [TOKENS]', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    const caption = tpl.generateCaseCaption({});
    expect(caption.formatted).toMatch(/IN RE MARRIAGE OF __________________ AND __________________/);
    // The IN RE line itself carries no [TOKEN] placeholders. (The court
    // header still falls back to "[COUNTY]" when no county is given —
    // that pre-existing behavior is out of scope for this test.)
    const inReLine = caption.formatted.split('\n').find((l) => l.includes('IN RE MARRIAGE OF'));
    expect(inReLine).not.toMatch(/\[/);
  });
});

describe('CA petition — official Judicial Council form note', () => {
  test('Section I parties block opens with a Draft note pointing to FL-100', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    const section = tpl.generatePartiesSection(baseData());
    const noteItem = section.items[0];
    expect(noteItem.type).toBe('official_form_note');
    expect(noteItem.number).toBeNull();
    expect(noteItem.content).toMatch(/FL-100/);
    expect(noteItem.content).toMatch(/courts\.ca\.gov\/forms-rules\/court-forms/);
    expect(noteItem.content).toMatch(/Draft — Official California Judicial Council form/);
  });
});

describe('CA petition — grounds pleaded once', () => {
  test('marriage-info section no longer plea grounds; Section IV owns them', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    const marriage = tpl.generateMarriageInformationSection(baseData());
    const marriageBody = marriage.items.map((i) => i.content).join('\n');
    expect(marriageBody).not.toMatch(/Family Code § 2310\(a\)/);
    const grounds = tpl.generateGroundsSection(baseData());
    const groundsBody = grounds.items.map((i) => i.content).join('\n');
    expect(groundsBody).toMatch(/Family Code § 2310\(a\)/);
  });
});
