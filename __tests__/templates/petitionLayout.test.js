/** @jest-environment node */
// Layout invariants for filable pleadings, added after the 2026-08-11
// document-professionalism pass:
//  - a pro se filer block opens page one
//  - captions carry the structured two-column shape for the PDF layer
//  - verification text no longer duplicates its own heading
//  - a fully populated petition contains no [PLACEHOLDER] tokens

const { StateTemplateManager } = require('../../templates/StateTemplateManager');
const { initializeTemplates } = require('../../templates/initialize');

const DATA = {
  state: 'UT',
  petitionerName: 'Jane Q. Example',
  respondentName: 'John R. Example',
  county: 'Salt Lake County',
  marriageDate: 'June 15, 2012',
  marriageCity: 'Provo',
  separationDate: 'November 1, 2025',
  children: [{ name: 'Emma Example', dob: '2015-04-02' }],
  custodyArrangement: 'joint legal custody',
  groundsForDivorce: 'irreconcilable_differences',
  email: 'jane@example.com',
};

let templateManager;
beforeAll(async () => {
  const registry = await initializeTemplates();
  templateManager = new StateTemplateManager({ registry });
});

describe('petition layout invariants (UT)', () => {
  let sections;
  beforeAll(() => {
    ({ sections } = templateManager.generateDivorcePetition('UT', DATA));
  });

  it('opens with a pro se filer block', () => {
    expect(sections.filerBlock.lines[0]).toBe('Jane Q. Example');
    expect(sections.filerBlock.lines).toContain('Petitioner, Pro Se');
    expect(sections.filerBlock.lines.join('\n')).toContain('jane@example.com');
  });

  it('carries a structured two-column caption', () => {
    const { structured } = sections.caseCaption;
    expect(structured.left.join('\n')).toContain('JANE Q. EXAMPLE');
    expect(structured.right[0]).toMatch(/^Case No\./);
    expect(structured.right.join('\n')).toContain('Judge');
  });

  it('header is the court line and the old venue opener is gone', () => {
    expect(sections.header).toMatch(/^IN THE DISTRICT COURT/i);
    expect(sections.venue).toBeNull();
  });

  it('verification text does not duplicate the section heading', () => {
    expect(sections.verification.title).toBe('VERIFICATION');
    expect(sections.verification.text.trimStart()).not.toMatch(/^VERIFICATION/);
  });

  it('a populated petition contains no [PLACEHOLDER] tokens', () => {
    const text = JSON.stringify(sections);
    expect(text).not.toMatch(/\[(COURT NAME|CASE NUMBER|PETITIONER NAME|RESPONDENT NAME|PLAINTIFF NAME|DEFENDANT NAME)\]/);
  });
});
