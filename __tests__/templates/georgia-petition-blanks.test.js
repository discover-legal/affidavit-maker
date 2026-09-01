/** @jest-environment node */
'use strict';

/**
 * georgia-petition-blanks.test.js
 *
 * Regression: Amara acceptance replay found that POST
 * /api/documents/generate for a Georgia divorce_petition returned 422
 * MissingRequiredFields ("case number", "child birth date") because the
 * template left literal `[CASE NUMBER]` and `[BIRTH DATE]` sentinel
 * tokens in the output, which the generate route's PLACEHOLDER_DENYLIST
 * catches. Same pattern the ON Divorce Order hit before v8-D.
 *
 * Fix: the GA petition subclass now renders visible fill-in-by-hand
 * blanks for optional-at-draft-time fields — Civil Action File No. (case
 * number) and each child's date of birth — plus a drafter note when the
 * case number is missing. Truly-required fields (party names, child
 * names) still surface as sentinel tokens so the denylist catches them.
 */

const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Amara Plaintiff',
    respondentName: 'Ray Defendant',
    state: 'GA',
    county: 'Fulton',
    marriageDate: '2015-06-15',
    hasMinorChildren: true,
    children: [{ name: 'Jo Matrix' /* no dob */ }],
    ...overrides,
  };
}

describe('Georgia Complaint for Divorce — missing-value rendering', () => {
  test('missing case number renders as an underscore blank, not `[CASE NUMBER]`', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const caption = tpl.generateCaseCaption(baseData());
    expect(caption.formatted).not.toMatch(/\[CASE NUMBER\]/);
    expect(caption.formatted).toMatch(/_{6,}/);
    expect(caption.formatted).toMatch(/CIVIL ACTION FILE NO\./);
  });

  test('missing case number surfaces a drafter note', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const caption = tpl.generateCaseCaption(baseData());
    expect(caption.formatted).toMatch(
      /Draft\s+—\s+insert case number before filing/i,
    );
  });

  test('present case number renders literally with no draft note', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const caption = tpl.generateCaseCaption(baseData({ caseNumber: 'SUCV-24-1234' }));
    expect(caption.formatted).toMatch(/CIVIL ACTION FILE NO\.\s+SUCV-24-1234/);
    expect(caption.formatted).not.toMatch(/Draft/i);
    expect(caption.formatted).not.toMatch(/_{6,}/);
  });

  test('child with no birth date renders as an underscore blank, not `[BIRTH DATE]`', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const section = tpl.generateChildrenSection(baseData());
    const rendered = JSON.stringify(section);
    expect(rendered).not.toMatch(/\[BIRTH DATE\]/);
    expect(rendered).toMatch(/born _{6,}/);
  });

  test('child with a name and no birth date keeps the name and blanks only the date', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const section = tpl.generateChildrenSection(
      baseData({ children: [{ name: 'Jo Matrix' }] }),
    );
    const childLine = section.items.find(
      (it) => it.type === 'child_detail' && /Jo Matrix/.test(it.content),
    );
    expect(childLine).toBeTruthy();
    expect(childLine.content).toMatch(/Jo Matrix, born _{6,}/);
  });

  test('missing child NAME still uses the `[CHILD NAME]` sentinel (denylist catches it)', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const section = tpl.generateChildrenSection(
      baseData({ children: [{ dob: '2015-04-02' }] }),
    );
    const rendered = JSON.stringify(section);
    expect(rendered).toMatch(/\[CHILD NAME\]/);
  });

  test('present child birthDate renders literally, no blank', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const section = tpl.generateChildrenSection(
      baseData({ children: [{ name: 'Jo Matrix', birthDate: '2015-04-02' }] }),
    );
    const childLine = section.items.find(
      (it) => it.type === 'child_detail' && /Jo Matrix/.test(it.content),
    );
    expect(childLine).toBeTruthy();
    expect(childLine.content).not.toMatch(/_{6,}/);
    expect(childLine.content).toMatch(/Jo Matrix, born /);
  });
});
