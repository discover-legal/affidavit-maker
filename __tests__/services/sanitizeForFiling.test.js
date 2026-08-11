/** @jest-environment node */
// The filed-output guarantee: no template placeholder token survives into a
// generated PDF/DOCX. pdfService.sanitizeForFiling is the choke point; the
// ~110 jurisdiction templates keep their tokens as editor-preview hints.

const PDFService = require('../../services/pdfService');

describe('sanitizeForFiling', () => {
  const svc = new PDFService({ templateManager: null });

  it('replaces placeholder tokens with fill-in blanks, deeply', () => {
    const out = svc.sanitizeForFiling({
      caption: 'CASE NO. [CASE NUMBER]',
      nested: { court: 'IN THE [COURT NAME]', keep: 42 },
      list: ['[BIRTH DATE]', 'born [BIRTH DATE]', null],
    });
    expect(out.caption).toBe('CASE NO. ______________');
    expect(out.nested.court).toBe('IN THE ______________');
    expect(out.nested.keep).toBe(42);
    expect(out.list[0]).toBe('______________');
    expect(out.list[1]).toBe('born ______________');
    expect(out.list[2]).toBeNull();
  });

  it('leaves legitimate text alone', () => {
    const untouched = [
      '(SEAL)',
      'Judge [Smith]', // not an all-caps token
      'section 12(b)[3]', // too short / not a token shape
      'IT IS ORDERED, ADJUDGED, AND DECREED.',
    ];
    for (const text of untouched) {
      expect(svc.sanitizeForFiling(text)).toBe(text);
    }
  });
});
