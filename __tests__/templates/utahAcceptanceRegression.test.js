/** @jest-environment node */
// Live-QA acceptance regressions (katie2 replay, 2026-08).
//
// Four defects from a real Utah persona run:
//   1. The ON-SCREEN petition preview doubled the court caption — the SPA
//      renders sections.header AND caseCaption.formatted as separate blocks,
//      and with a structured caption both carried "IN THE DISTRICT COURT OF
//      THE STATE OF UTAH, IN AND FOR SALT LAKE COUNTY".
//   2. The propertyAgreement status enum leaked raw into ¶16:
//      "…division of their community/marital property. agreed".
//   3. The marriage place dropped the state: "married … in Provo." /
//      "Provo, __________" although the document's own state is Utah.
//   4. The Parenting Plan printed "a schedule to be agreed upon by the
//      parties" while the decree correctly rendered the stored
//      parentTimeDetails ("every other weekend plus Wednesday nights").

const UtahPetition = require('../../templates/states/utah/DivorcePetitionTemplate');
const OntarioPetition = require('../../templates/states/ontario/DivorcePetitionTemplate');
const generator = require('../../services/documents/DivorceDocumentGenerator');
const { normalizeCourtText, stripCourtLineFromFormatted } = require('../../templates/core/captionDedupe');

const personaData = {
  petitionerName: "Kathleen O'Brien-Hatch",
  respondentName: 'Daniel James Hatch',
  state: 'UT',
  county: 'Salt Lake',
  marriageDate: '2012-02-14',
  marriageCity: 'Provo',
  separationDate: '2026-03-01',
  groundsForDivorce: 'irreconcilable differences',
  hasMinorChildren: true,
  children: [
    { name: 'Emma Rose Hatch', dob: '2014-08-03' },
    { name: 'Lucas Daniel Hatch', dob: '2018-05-19' },
  ],
  custodyArrangement: 'joint',
  parentTimeDetails: 'Daniel Hatch has parent-time every other weekend plus Wednesday nights',
  propertyAgreement: 'agreed',
  childSupportAmount: 850,
};

const count = (haystack, needle) => haystack.split(needle).length - 1;
const sectionText = (section) =>
  (section && section.items ? section.items.map((i) => i.content).join('\n') : '');

describe('petition on-screen preview — single court caption', () => {
  it('header + caseCaption.formatted together carry the court line exactly once', () => {
    // Mirrors components/app/DocumentPreview.js, which renders these two
    // sections as adjacent blocks (affidavit-header + affidavit-caption).
    const doc = new UtahPetition().generateDocument({ ...personaData });
    const header = doc.sections.header;
    const formatted = doc.sections.caseCaption.formatted;
    expect(header).toBe(
      'IN THE DISTRICT COURT OF THE STATE OF UTAH, IN AND FOR SALT LAKE COUNTY',
    );
    const combined = normalizeCourtText(`${header}\n${formatted}`);
    expect(count(combined, normalizeCourtText(header))).toBe(1);
    // The caption block itself no longer repeats the court the header shows
    expect(normalizeCourtText(formatted)).not.toContain('DISTRICT COURT');
    // …but still carries the parties and case number
    expect(formatted).toContain("KATHLEEN O'BRIEN-HATCH");
    expect(formatted).toContain('Case No.');
  });

  it('fullText and htmlContent each identify the court exactly once', () => {
    const doc = new UtahPetition().generateDocument({ ...personaData });
    const needle = 'IN THE DISTRICT COURT OF THE STATE OF UTAH, IN AND FOR SALT LAKE COUNTY';
    expect(count(doc.fullText.toUpperCase(), needle)).toBe(1);
    expect(count(doc.htmlContent.toUpperCase(), needle)).toBe(1);
  });

  it('stripCourtLineFromFormatted only strips a true duplicate', () => {
    const caption = {
      formatted: 'IN THE DISTRICT COURT OF UTAH\n\nCase No. 123\n\nJANE DOE,\nPetitioner.',
    };
    const stripped = stripCourtLineFromFormatted(caption, 'IN THE DISTRICT COURT OF UTAH');
    expect(stripped.formatted).toBe('Case No. 123\n\nJANE DOE,\nPetitioner.');
    // A non-matching header leaves the caption untouched (same object)
    expect(stripCourtLineFromFormatted(caption, 'IN THE SUPERIOR COURT OF ARIZONA')).toBe(caption);
    expect(stripCourtLineFromFormatted(caption, '')).toBe(caption);
    expect(stripCourtLineFromFormatted(null, 'X')).toBe(null);
  });
});

describe('propertyAgreement enum never leaks raw into pleadings', () => {
  it('Utah petition ¶ reads as prose with propertyAgreement: "agreed"', () => {
    const doc = new UtahPetition().generateDocument({ ...personaData });
    const property = sectionText(doc.sections.propertyInfo);
    expect(property).not.toMatch(/property\.\s*agreed/i);
    expect(doc.fullText).not.toMatch(/property\.\s*agreed/i);
    expect(property).toContain(
      'The parties have reached an agreement regarding the division of their community/marital property.',
    );
  });

  it('a real description still renders after the agreement sentence', () => {
    const doc = new UtahPetition().generateDocument({
      ...personaData,
      propertyAgreement: 'She keeps the house; he keeps the truck and his tools.',
    });
    const property = sectionText(doc.sections.propertyInfo);
    expect(property).toContain(
      'property. She keeps the house; he keeps the truck and his tools.',
    );
  });

  it("Ontario keeps its equalization wording and never says community property or a raw token", () => {
    const doc = new OntarioPetition().generateDocument({
      ...personaData,
      state: 'ON',
      county: 'Toronto',
    });
    const text = doc.fullText;
    expect(text).not.toMatch(/community/i);
    expect(text).not.toMatch(/Family Law Act, RSO 1990, c\. F\.3\.\s*agreed/i);
    expect(text).toContain('equalization of net family property');
  });
});

describe('marriage place renders City, State — never a bare city', () => {
  it('template petition: marriageCity + own jurisdiction → "in Provo, Utah."', () => {
    const doc = new UtahPetition().generateDocument({ ...personaData });
    const marriage = sectionText(doc.sections.marriageInfo);
    expect(marriage).toContain('in Provo, Utah.');
    expect(marriage).not.toMatch(/in Provo\.\s/);
  });

  it('an extracted marriage state wins over the filing jurisdiction', () => {
    const doc = new UtahPetition().generateDocument({
      ...personaData,
      marriageStateName: 'Nevada',
    });
    expect(sectionText(doc.sections.marriageInfo)).toContain('in Provo, Nevada.');
  });

  it('a full marriageLocation passes through as-is', () => {
    const doc = new UtahPetition().generateDocument({
      ...personaData,
      marriageCity: undefined,
      marriageLocation: 'Paris, France',
    });
    expect(sectionText(doc.sections.marriageInfo)).toContain('in Paris, France.');
  });

  it('a truly unknown place renders no dangling "in …" clause', () => {
    const doc = new UtahPetition().generateDocument({
      ...personaData,
      marriageCity: undefined,
      marriageLocation: undefined,
    });
    const marriage = sectionText(doc.sections.marriageInfo);
    expect(marriage).toMatch(/were married on February 14, 2012\./);
    expect(marriage).not.toContain(' in .');
  });

  it('generic generator: known city + unknown state → filing state name, not a blank', () => {
    const doc = generator.generate('UT', 'divorce_petition', { ...personaData });
    const text = JSON.stringify(doc.sections);
    expect(text).toContain('in Provo, Utah.');
    expect(text).not.toContain('Provo, __________');
  });

  it('generic generator: unknown city keeps both blanks', () => {
    const doc = generator.generate('UT', 'divorce_petition', {
      ...personaData,
      marriageCity: undefined,
    });
    expect(JSON.stringify(doc.sections)).toContain('in __________, __________.');
  });
});

describe('parenting plan consumes the stored parent-time schedule', () => {
  it('renders parentTimeDetails in the RESIDENTIAL SCHEDULE paragraph', () => {
    const doc = generator.generate('UT', 'parenting_plan', { ...personaData });
    const schedule = doc.sections.facts.items.find((i) =>
      i.content.startsWith('RESIDENTIAL SCHEDULE:'),
    );
    expect(schedule.content).toContain(
      'Daniel Hatch has parent-time every other weekend plus Wednesday nights',
    );
    expect(schedule.content).not.toContain('a schedule to be agreed upon by the parties');
  });

  it('falls back to the as-agreed boilerplate only when no schedule is stored', () => {
    const doc = generator.generate('UT', 'parenting_plan', {
      ...personaData,
      parentTimeDetails: undefined,
    });
    const schedule = doc.sections.facts.items.find((i) =>
      i.content.startsWith('RESIDENTIAL SCHEDULE:'),
    );
    expect(schedule.content).toContain(
      'a schedule to be agreed upon by the parties or as ordered by the Court',
    );
  });

  it('custodyDetails backs up parentTimeDetails', () => {
    const doc = generator.generate('UT', 'parenting_plan', {
      ...personaData,
      parentTimeDetails: undefined,
      custodyDetails: 'Alternating weeks, exchanges Sunday at 6 pm',
    });
    const schedule = doc.sections.facts.items.find((i) =>
      i.content.startsWith('RESIDENTIAL SCHEDULE:'),
    );
    expect(schedule.content).toContain('Alternating weeks, exchanges Sunday at 6 pm');
  });
});
