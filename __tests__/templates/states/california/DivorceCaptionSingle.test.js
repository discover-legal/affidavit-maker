/** @jest-environment node */
'use strict';

/**
 * DivorceCaptionSingle.test.js
 *
 * California divorce petition and decree QA (2026-08-28) reported the court
 * identification line "IN THE SUPERIOR COURT OF CALIFORNIA, COUNTY OF SANTA
 * CLARA" rendering THREE times at the top of the petition and FIVE times at
 * the top of the decree — the doubled/tripled caption bug the
 * templates/core/captionDedupe.js sweep is meant to prevent. This file locks
 * the fix with realistic California case data (populated names, a real
 * county, both PDF and preview surfaces) so a regression is loud.
 */

const path = require('path');

const CA_DIR = path.join(__dirname, '..', '..', '..', '..', 'templates', 'states', 'california');
const PetitionTemplate = require(path.join(CA_DIR, 'DivorcePetitionTemplate.js'));
const DecreeTemplate = require(path.join(CA_DIR, 'DivorceDecreeTemplate.js'));

const CA_DATA = {
  petitionerName: 'Jane McPherson',
  respondentName: 'John Doe',
  county: 'Santa Clara',
  caseNumber: 'FL-2026-001234',
  marriageDate: '2015-06-20',
  separationDate: '2024-11-15',
  divorceDate: '2026-08-27',
  hearingDate: '2026-08-27',
  groundsForDivorce: 'irreconcilable_differences',
  hasMinorChildren: false,
  state: 'CA',
};

const COURT_PHRASES = [
  'IN THE SUPERIOR COURT OF CALIFORNIA, COUNTY OF SANTA CLARA',
  'SUPERIOR COURT OF CALIFORNIA, COUNTY OF SANTA CLARA',
  'SUPERIOR COURT OF CALIFORNIA',
  'COUNTY OF SANTA CLARA',
];

const countOccurrences = (haystack, needle) =>
  needle ? haystack.split(needle).length - 1 : 0;

// Preview + fullText surface: sections.header, sections.venue, and
// sections.caseCaption.formatted are concatenated by both DocumentPreview and
// generateFullText, so combined they must carry exactly ONE court identification.
const combinedHead = (doc) =>
  `${doc.sections.header || ''}\n${doc.sections.venue || ''}\n${doc.sections.caseCaption?.formatted || ''}`;

// htmlContent escapes text — un-escape enough of it to match against the
// canonical uppercase court phrases.
const unescapeHtml = (html) =>
  String(html)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

describe('California divorce: single court identification (Santa Clara)', () => {
  describe.each([
    ['petition', PetitionTemplate],
    ['decree', DecreeTemplate],
  ])('%s', (label, Template) => {
    const doc = new Template().generateDocument(CA_DATA);
    const fullText = doc.fullText;
    const html = unescapeHtml(doc.htmlContent);
    const combined = combinedHead(doc);
    const title = doc.sections.title || '';
    const headText = title && fullText.includes(title) ? fullText.slice(0, fullText.indexOf(title)) : fullText;
    const headHtml = title && html.includes(title) ? html.slice(0, html.indexOf(title)) : html;

    // The court phrase that actually appears in this document's caption.
    const primaryPhrase =
      COURT_PHRASES.find((p) => headText.includes(p)) || COURT_PHRASES[0];

    it(`renders "${primaryPhrase}" exactly once in fullText above the title`, () => {
      expect(countOccurrences(headText, primaryPhrase)).toBe(1);
    });

    it(`renders "${primaryPhrase}" exactly once in htmlContent above the title`, () => {
      expect(countOccurrences(headHtml, primaryPhrase)).toBe(1);
    });

    it('preview contract: header + venue + caption together identify the court exactly once', () => {
      // The most-specific phrase actually rendered.
      const phrase = COURT_PHRASES.find((p) => combined.includes(p)) || primaryPhrase;
      expect(countOccurrences(combined, phrase)).toBe(1);
    });

    it('never renders "COUNTY OF SANTA CLARA" more than twice anywhere in the document body head (bare fragment guard)', () => {
      // Some downstream sections (jurisdiction findings, venue recitals) can
      // legitimately name the county in body prose once beyond the caption;
      // the doubled-caption bug produced FIVE.
      expect(countOccurrences(headText, 'COUNTY OF SANTA CLARA')).toBeLessThanOrEqual(2);
    });
  });
});
