/**
 * GA Complaint for Divorce — party terminology consistency
 * (attorney round-3, Amara, 2026-08-30).
 *
 * Georgia complaints style parties as Plaintiff / Defendant
 * (O.C.G.A. § 9-11-10 caption convention). The caption was already
 * hardcoded to Plaintiff/Defendant, but the base body used
 * DEFAULT_TERMS ("Petitioner"/"Respondent"), producing a document
 * that switched terminology between the caption and body. This test
 * asserts the terminology override is in place AND that no rendered
 * body text contains "Petitioner" or "Respondent".
 */

const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

describe('GA terminology consistency — Plaintiff / Defendant', () => {
  test('terminology override sets filerLabel=Plaintiff, responderLabel=Defendant', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    expect(tpl.terminology.filerLabel).toBe('Plaintiff');
    expect(tpl.terminology.responderLabel).toBe('Defendant');
  });

  test('no rendered body text contains Petitioner or Respondent', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const divorceData = {
      petitionerName: 'Amara Okafor',
      respondentName: 'Kwame Okafor',
      state: 'GA',
      county: 'Fulton',
      marriageDate: '2015-06-15',
      hasMinorChildren: true,
      children: [{ name: 'Ada Okafor', birthDate: '2018-04-22' }],
      groundsForDivorce: 'irretrievably_broken',
      respondentAddressUnknown: true,
      respondentSuspectedLocation: 'Alabama near Mobile',
    };

    const collected = [];
    const collect = (section) => {
      if (!section) return;
      if (section.formatted) collected.push(section.formatted);
      if (Array.isArray(section.items)) {
        for (const it of section.items) if (it && it.content) collected.push(String(it.content));
      }
    };

    collect(tpl.generateCaseCaption(divorceData));
    collect(tpl.generateGroundsSection(divorceData));
    collect(tpl.generateChildrenSection(divorceData));
    collect(tpl.generatePropertySection(divorceData));
    collect(tpl.generateReliefSection(divorceData));

    // Also test individual clauses that come from the base template.
    collected.push(tpl.getRespondentResidenceClause(divorceData));
    collected.push(tpl.getAltServiceNote(divorceData));
    collected.push(tpl.getJurisdictionStatement(divorceData));
    collected.push(tpl.getVenueReason(divorceData));

    const blob = collected.join('\n');
    // Verification text intentionally hardcodes "Plaintiff" (signature
    // block) — the token check runs against the rest of the body.
    expect(blob).not.toMatch(/\bPetitioner\b/);
    expect(blob).not.toMatch(/\bRespondent\b/);
    // Positive assertions.
    expect(blob).toMatch(/\bPlaintiff\b/);
    expect(blob).toMatch(/\bDefendant\b/);
  });
});
