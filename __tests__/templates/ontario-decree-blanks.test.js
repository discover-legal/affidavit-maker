/** @jest-environment node */
'use strict';

/**
 * ontario-decree-blanks.test.js
 *
 * Regression: v7 replay found that POST /api/documents/generate for an
 * Ontario divorce_decree (respondent role) returned 422 MissingRequiredFields
 * because the template left literal `[CASE NUMBER]` and `[BIRTH DATE]`
 * sentinel tokens in the output, which the generate route's
 * PLACEHOLDER_DENYLIST catches. The packet path (which runs
 * pdfService.sanitizeForFiling) rendered visible blanks and returned 200.
 *
 * Fix: the Ontario Divorce Order subclass now renders visible
 * fill-in-by-hand blanks for optional-at-draft-time fields — Court File No.
 * (case number) and each child's date of birth — plus a drafter note when
 * the case number is missing. Truly-required fields (party names, child
 * names) still surface as sentinel tokens so the denylist catches them.
 */

const OntarioDivorceDecreeTemplate = require('../../templates/states/ontario/DivorceDecreeTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Alex Applicant',
    respondentName: 'Sam Respondent',
    state: 'ON',
    county: 'Toronto',
    marriageDate: '2015-06-15',
    children: [{ name: 'Jo Matrix' /* no dob */ }],
    hasMinorChildren: true,
    ...overrides,
  };
}

describe('Ontario Divorce Order — missing-value rendering', () => {
  test('missing case number renders as an underscore blank, not `[CASE NUMBER]`', () => {
    const tpl = new OntarioDivorceDecreeTemplate();
    const caption = tpl.generateCaseCaption(baseData());
    expect(caption.formatted).not.toMatch(/\[CASE NUMBER\]/);
    // Visible fill-in-by-hand blank composed of underscores.
    expect(caption.formatted).toMatch(/_{6,}/);
    // Court File No. label survives the blank substitution, with a colon.
    expect(caption.formatted).toMatch(/Court File No\.:/);
  });

  test('missing case number surfaces a drafter note', () => {
    const tpl = new OntarioDivorceDecreeTemplate();
    const caption = tpl.generateCaseCaption(baseData());
    expect(caption.formatted).toMatch(
      /Draft\s+—\s+insert case number before filing/i,
    );
  });

  test('present case number renders literally with no draft note', () => {
    const tpl = new OntarioDivorceDecreeTemplate();
    const caption = tpl.generateCaseCaption(baseData({ caseNumber: 'FC-24-999' }));
    expect(caption.formatted).toMatch(/Court File No\.:\s+FC-24-999/);
    expect(caption.formatted).not.toMatch(/Draft/i);
    expect(caption.formatted).not.toMatch(/_{6,}/);
  });

  test('child with no birth date renders as an underscore blank, not `[BIRTH DATE]`', () => {
    const tpl = new OntarioDivorceDecreeTemplate();
    const section = tpl.generateChildCustodySection(baseData());
    const rendered = JSON.stringify(section);
    expect(rendered).not.toMatch(/\[BIRTH DATE\]/);
    expect(rendered).toMatch(/born _{6,}/);
  });

  test('child with a name and no birth date keeps the name and blanks only the date', () => {
    const tpl = new OntarioDivorceDecreeTemplate();
    const section = tpl.generateChildCustodySection(
      baseData({ children: [{ name: 'Jo Matrix' }] }),
    );
    const childLine = section.items.find(
      (it) => it.type === 'child_item' && /Jo Matrix/.test(it.content),
    );
    expect(childLine).toBeTruthy();
    expect(childLine.content).toMatch(/Jo Matrix, born _{6,}/);
  });

  test('missing child NAME still uses the `[CHILD NAME]` sentinel (denylist should catch it)', () => {
    const tpl = new OntarioDivorceDecreeTemplate();
    const section = tpl.generateChildCustodySection(
      baseData({ children: [{ dob: '2015-04-02' }] }),
    );
    const rendered = JSON.stringify(section);
    expect(rendered).toMatch(/\[CHILD NAME\]/);
  });
});
