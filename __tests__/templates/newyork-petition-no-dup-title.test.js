/** @jest-environment node */
'use strict';

/**
 * David NY round-7 (2026-08-30): the rendered petition PDF carried
 * two consecutive "VERIFIED COMPLAINT FOR DIVORCE" headings because
 * the NY caption's `formatted` string appended this.documentTitle at
 * the end AND BaseDivorcePetitionTemplate emitted the same title
 * into sections.title, which pdfService.renderDocumentHeader renders
 * back-to-back after the caption. The title must appear exactly
 * once in the assembled document: in sections.title.
 */

const NewYorkDivorcePetitionTemplate =
  require('../../templates/states/newyork/DivorcePetitionTemplate');

describe('New York petition renders VERIFIED COMPLAINT FOR DIVORCE exactly once', () => {
  const tpl = new NewYorkDivorcePetitionTemplate();

  function payload() {
    return {
      petitionerName: 'David Rosenberg',
      respondentName: 'Yvonne Rosenberg',
      state: 'NY',
      county: 'Kings',
      marriageDate: '2015-06-15',
      separationDate: '2024-01-15',
      groundsForDivorce: 'irretrievably_broken',
      hasMinorChildren: true,
      children: [{ name: 'Emma', birthYear: 2020 }],
    };
  }

  test('caption formatted does NOT include the document title', () => {
    const caption = tpl.generateCaseCaption(payload());
    expect(caption.formatted).not.toMatch(/VERIFIED COMPLAINT FOR DIVORCE/);
  });

  test('sections.title still carries the document title', () => {
    const doc = tpl.generateDocument(payload());
    expect(doc.sections.title).toBe('VERIFIED COMPLAINT FOR DIVORCE');
  });

  test('fullText contains the document title exactly once', () => {
    const doc = tpl.generateDocument(payload());
    const matches = String(doc.fullText).match(/VERIFIED COMPLAINT FOR DIVORCE/g) || [];
    expect(matches.length).toBe(1);
  });
});
