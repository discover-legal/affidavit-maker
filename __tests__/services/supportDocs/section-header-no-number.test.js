/** @jest-environment node */
'use strict';

/**
 * section-header-no-number.test.js
 *
 * Attorney round-3 (2026-08-30): Marcus's Ontario Form 10 Answer
 * rendered its PART A / PART B / PART C headings as "0. PART A ..."
 * because the PDF renderer's getFactsArray coerced missing `number`
 * fields to 0, then unconditionally called renderNumberedParagraph.
 * Section-header items MUST render with no numeric prefix.
 */

const OntarioAnswer = require('../../../services/supportDocs/ontarioAnswer');
const PdfService = require('../../../services/pdfService');

describe('Section headers on Answer templates render without a numeric prefix', () => {
  test('Ontario Form 10 emits PART A/B/C as headers with no `number` field', () => {
    const doc = OntarioAnswer.answerToPetition({
      respondentName: 'Marcus Test',
      petitionerName: 'Alex Test',
      state: 'ON',
      county: 'York',
      marriageDate: '2010-05-01',
    });
    const items = (doc && doc.sections && doc.sections.facts && doc.sections.facts.items) || [];
    const headers = items.filter((it) => it && it.type === 'form10_header');
    expect(headers.length).toBeGreaterThanOrEqual(3);
    for (const h of headers) {
      expect(h.number).toBeUndefined();
      expect(h.content).toMatch(/^PART\s+[ABC]\b/);
    }
  });

  test('getFactsArray preserves type and does NOT coerce missing number to 0', () => {
    const svc = new PdfService();
    const doc = OntarioAnswer.answerToPetition({
      respondentName: 'Marcus Test',
      petitionerName: 'Alex Test',
      state: 'ON',
      county: 'York',
      marriageDate: '2010-05-01',
    });
    const arr = svc.getFactsArray(doc.sections.facts);
    const headerRows = arr.filter((r) => r.type === 'form10_header');
    expect(headerRows.length).toBeGreaterThanOrEqual(3);
    for (const h of headerRows) {
      // Not coerced to 0 (previously the case), and not > 0.
      expect(h.number == null || h.number === 0 ? h.number : 'invalid').not.toBe(0);
      expect(h.number).toBeNull();
    }
    // No rendered content should read "0. PART …".
    const joined = arr.map((r) => `${r.number ?? ''}. ${r.content}`).join('\n');
    expect(joined).not.toMatch(/(^|\n)0\.\s+PART/);
  });

  test('helper _isHeaderFactType recognizes the header types', () => {
    const svc = new PdfService();
    expect(svc._isHeaderFactType('section_header')).toBe(true);
    expect(svc._isHeaderFactType('form10_header')).toBe(true);
    expect(svc._isHeaderFactType('form10_claim_subheader')).toBe(true);
    expect(svc._isHeaderFactType('answer_position')).toBe(false);
    expect(svc._isHeaderFactType(undefined)).toBe(false);
  });

  test('Ontario Form 10 no longer leaks "respondentClaimsNothing = true" template variable', () => {
    const doc = OntarioAnswer.answerToPetition({
      respondentName: 'Marcus Test',
      petitionerName: 'Alex Test',
      state: 'ON',
      county: 'York',
      marriageDate: '2010-05-01',
    });
    const items = (doc && doc.sections && doc.sections.facts && doc.sections.facts.items) || [];
    const blob = items.map((it) => it.content || '').join('\n');
    expect(blob).not.toMatch(/respondentClaimsNothing/);
    expect(blob).not.toMatch(/set\s+`?respondentClaimsNothing`?\s*=\s*true/i);
  });
});
