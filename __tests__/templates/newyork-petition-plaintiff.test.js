/**
 * NY petition attorney-review guards (2026-08-30):
 *   1. Body paragraphs and signature block use "Plaintiff"/"Defendant"
 *      throughout — never "Petitioner"/"Respondent" (caption is
 *      exempt: NY captions read "Plaintiff" and "Defendant" too).
 *   2. § 230 residency pleaded with FACTS: a month count and a
 *      sub-basis (parties married in NY, resided as spouses in NY,
 *      cause arose in NY, or two-year residence), never the bare
 *      conclusion "the parties meet DRL § 230".
 *   3. Emma paragraph well-formed: one clause naming child + DOB
 *      slot + residence slot; never two adjacent numbered paragraphs
 *      where the second is just "Emma."
 *   4. Uncontested-posture recital renders when the profile carries
 *      a Settlement Agreement / mediated support / support waiver.
 *   5. NY property section pleads "marital property" (equitable
 *      distribution under DRL § 236-B) — never "community property".
 */

const NewYorkDivorcePetitionTemplate =
  require('../../templates/states/newyork/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'David Rosenberg',
    respondentName: 'Sarah Rosenberg',
    state: 'NY',
    county: 'Kings',
    marriageDate: '2010-06-15',
    marriageStateName: 'New York',
    marriageCity: 'Manhattan',
    residencyStateMonths: 36,
    hasMinorChildren: true,
    children: [{ name: 'Emma Rosenberg' }],
    ...overrides,
  };
}

function renderPetition(overrides = {}) {
  const tpl = new NewYorkDivorcePetitionTemplate();
  const doc = tpl.generateDocument(baseData(overrides));
  return { tpl, doc, text: doc.fullText };
}

function bodyWithoutCaption(doc) {
  const captionText = (doc.sections.caseCaption && doc.sections.caseCaption.formatted) || '';
  // Remove the caption text once from the full document body so
  // caption-side "Plaintiff/Defendant" labels don't skew the search.
  return doc.fullText.replace(captionText, '');
}

describe('NY petition — party labels (Plaintiff/Defendant throughout body)', () => {
  test('body and signature block say Plaintiff/Defendant, never Petitioner/Respondent', () => {
    const { doc } = renderPetition();
    const body = bodyWithoutCaption(doc);
    expect(body).not.toMatch(/\bPetitioner\b/);
    expect(body).not.toMatch(/\bRespondent\b/);
    expect(body).toMatch(/\bPlaintiff\b/);
  });

  test('filer block and signature block carry Plaintiff label', () => {
    const { doc } = renderPetition();
    const filerLines = doc.sections.filerBlock.lines.join('\n');
    expect(filerLines).toMatch(/Plaintiff/);
    expect(filerLines).not.toMatch(/Petitioner/);
    expect(doc.sections.signatureBlock.formatted).toMatch(/Plaintiff/);
    expect(doc.sections.signatureBlock.formatted).not.toMatch(/Petitioner/);
  });
});

describe('NY petition — DRL § 230 residency sub-basis with facts', () => {
  test('parties married in NY + 36 months residence → § 230(2) with month count', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const clause = tpl.getJurisdictionStatement(baseData());
    expect(clause).toMatch(/Domestic Relations Law § 230\(2\)/);
    expect(clause).toMatch(/36 months/);
    expect(clause).toMatch(/married in New York/i);
    // Never the bare-conclusion default.
    expect(clause).not.toMatch(/meet the residency requirements set forth in Domestic Relations Law § 230\.$/);
  });

  test('unspecified basis + no facts → fill-in blank + Draft note (never bare conclusion)', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const clause = tpl.getJurisdictionStatement({
      petitionerName: 'Alex',
      state: 'NY',
    });
    expect(clause).toMatch(/Draft — select and complete the applicable § 230 sub-basis/);
    expect(clause).toMatch(/DRL § 230\(2\)/);
    expect(clause).toMatch(/DRL § 230\(5\)/);
  });

  test('24+ months residence alone → § 230(5) with month count', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const clause = tpl.getJurisdictionStatement({
      petitionerName: 'Alex',
      state: 'NY',
      residencyStateMonths: 30,
    });
    expect(clause).toMatch(/Domestic Relations Law § 230\(5\)/);
    expect(clause).toMatch(/30 months/);
  });
});

describe('NY petition — children section renders well-formed clauses', () => {
  test('single child renders as one clause naming child, DOB slot, residence slot', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const section = tpl.generateChildrenSection(baseData());
    const clauses = section.items
      .filter((i) => i.type === 'children_info' || i.type === 'child_detail')
      .map((i) => i.content);
    const emmaClause = clauses.find((c) => /Emma/.test(c));
    expect(emmaClause).toBeTruthy();
    expect(emmaClause).toMatch(/The child of the marriage under the age of 21 years is Emma Rosenberg/);
    expect(emmaClause).toMatch(/born (____|[A-Za-z0-9])/);
    expect(emmaClause).toMatch(/residing at/);
    // Never the broken shape: a bare "Emma." on its own numbered paragraph.
    const emmaOnlyItem = section.items.find(
      (i) => typeof i.content === 'string' && i.content.trim() === 'Emma' || i.content === 'Emma.'
    );
    expect(emmaOnlyItem).toBeFalsy();
  });

  test('child with DOB and address renders those inline', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const section = tpl.generateChildrenSection(baseData({
      children: [{
        name: 'Emma Rosenberg',
        birthDate: '2018-03-15',
        address: '123 Prospect St, Brooklyn, NY',
      }],
    }));
    const clause = section.items.map((i) => i.content).join(' ');
    expect(clause).toMatch(/Emma Rosenberg/);
    expect(clause).toMatch(/born /);
    expect(clause).toMatch(/123 Prospect St/);
  });
});

describe('NY petition — uncontested / settlement recital', () => {
  test('Settlement Agreement date + waived support renders recital', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const doc = tpl.generateDocument(baseData({
      settlementAgreementDate: '2026-05-01',
      mediatedChildSupport: true,
      spousalSupportWaived: true,
      spousalSupportRequested: false,
    }));
    const groundsBody = doc.sections.grounds.items.map((i) => i.content).join('\n');
    expect(groundsBody).toMatch(/Settlement Agreement/);
    expect(groundsBody).toMatch(/Child Support Standards Act/);
    expect(groundsBody).toMatch(/equitable distribution/);
    expect(groundsBody).toMatch(/mutual waiver of spousal maintenance/);
  });

  test('no settlement data → no recital', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const doc = tpl.generateDocument(baseData());
    const groundsBody = doc.sections.grounds.items.map((i) => i.content).join('\n');
    expect(groundsBody).not.toMatch(/Settlement Agreement/);
  });
});

describe('NY petition — equitable-distribution property (never community)', () => {
  test('affirmative hasProperty=true → marital-property pleading, never "community"', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const section = tpl.generatePropertySection(baseData({ hasProperty: true }));
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).not.toMatch(/community property/i);
    expect(body).toMatch(/marital property/i);
    expect(body).toMatch(/§ 236-B/);
    expect(section.title).toMatch(/MARITAL PROPERTY/);
  });

  test('silent hasProperty (round-3 attorney review) → draft-note blank, never fabricated allegation', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const section = tpl.generatePropertySection(baseData());
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).not.toMatch(/community property/i);
    // Fabricated real-property allegation must NOT appear on silent data.
    expect(body).not.toMatch(/real property, personal property, and financial accounts/i);
    expect(body).toMatch(/Draft — confirm whether you and your spouse/i);
  });

  test('hasProperty=false path still avoids the word "community"', () => {
    const tpl = new NewYorkDivorcePetitionTemplate();
    const section = tpl.generatePropertySection(baseData({ hasProperty: false }));
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).not.toMatch(/community/i);
  });
});
