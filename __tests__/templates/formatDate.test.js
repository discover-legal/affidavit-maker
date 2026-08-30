// __tests__/templates/formatDate.test.js
//
// Regression tests for the shared base-template date helper. v12-B
// fixed the "a few months ago" rendering bug in California only —
// this test locks the same behaviour in at the base level so every
// non-CA jurisdiction inherits it.
//
// Bug: `formatDate(dateStr)` returned the raw input when
// `new Date(dateStr)` was NaN. Any jurisdiction that read a freeform
// separationDate ("a few months ago") and interpolated formatDate's
// return would emit the narrative verbatim into a pleading.

const {
  formatDate,
  isRenderableDate,
} = require('../../templates/core/dateUtils');
const BaseDivorcePetitionTemplate = require('../../templates/core/BaseDivorcePetitionTemplate');
const BaseDivorceDecreeTemplate = require('../../templates/core/BaseDivorceDecreeTemplate');

describe('shared formatDate helper', () => {
  test('freeform narrative → null', () => {
    expect(formatDate('a few months ago')).toBeNull();
    expect(formatDate('sometime in 2024')).toBeNull();
    expect(formatDate('unknown')).toBeNull();
    expect(formatDate('recently')).toBeNull();
  });

  test('empty / nullish → null', () => {
    expect(formatDate('')).toBeNull();
    expect(formatDate('   ')).toBeNull();
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
  });

  test('non-string → null', () => {
    expect(formatDate(0)).toBeNull();
    expect(formatDate(new Date())).toBeNull();
    expect(formatDate({})).toBeNull();
  });

  test('ISO YYYY-MM-DD → "Month DD, YYYY"', () => {
    expect(formatDate('2024-06-15')).toBe('June 15, 2024');
    expect(formatDate('2015-06-01')).toBe('June 1, 2015');
  });

  test('slash M/D/YYYY → "Month DD, YYYY"', () => {
    expect(formatDate('6/15/2024')).toBe('June 15, 2024');
    expect(formatDate('06/15/2024')).toBe('June 15, 2024');
  });

  test('"Month DD, YYYY" round-trips', () => {
    expect(formatDate('June 15, 2024')).toBe('June 15, 2024');
  });
});

describe('isRenderableDate', () => {
  test('accepts recognised shapes', () => {
    expect(isRenderableDate('2024-06-15')).toBe(true);
    expect(isRenderableDate('6/15/2024')).toBe(true);
    expect(isRenderableDate('June 15, 2024')).toBe(true);
  });

  test('rejects freeform narrative even when Date.parse would coerce', () => {
    // Date.parse("today") is browser/engine-dependent and can return a
    // finite timestamp — the shape check guarantees it never gets
    // through regardless.
    expect(isRenderableDate('today')).toBe(false);
    expect(isRenderableDate('a few months ago')).toBe(false);
  });
});

describe('BaseDivorcePetitionTemplate.formatDate delegates', () => {
  const t = new BaseDivorcePetitionTemplate();
  test('freeform → null', () => {
    expect(t.formatDate('a few months ago')).toBeNull();
  });
  test('ISO → formatted', () => {
    expect(t.formatDate('2024-06-15')).toBe('June 15, 2024');
  });
});

describe('BaseDivorceDecreeTemplate.formatDate delegates', () => {
  const t = new BaseDivorceDecreeTemplate();
  test('freeform → null', () => {
    expect(t.formatDate('unknown')).toBeNull();
  });
  test('ISO → formatted', () => {
    expect(t.formatDate('2024-06-15')).toBe('June 15, 2024');
  });
});

describe('Base petition marriage section: freeform date → visible blank + Draft note (not narrative)', () => {
  const t = new BaseDivorcePetitionTemplate();
  const data = {
    petitionerName: 'A',
    respondentName: 'B',
    marriageDate: 'a few months ago',
    separationDate: 'a few months ago',
  };
  const section = t.generateMarriageInformationSection(data);
  const combined = section.items.map((i) => i.content).join('\n');
  test('never renders the raw narrative', () => {
    expect(combined).not.toMatch(/a few months ago/);
  });
  test('renders a visible fill-in-by-hand blank', () => {
    expect(combined).toMatch(/__________________/);
  });
  test('renders the Draft-note callout', () => {
    expect(combined).toMatch(/Draft — insert exact date/);
  });
});

describe('Base decree jurisdiction clause: freeform date → visible blank (not narrative)', () => {
  const t = new BaseDivorceDecreeTemplate();
  const section = t.generateJurisdictionSection({
    marriageDate: 'a few months ago',
    separationDate: 'unknown',
  });
  test('never renders the raw narrative', () => {
    expect(section.text).not.toMatch(/a few months ago|unknown/);
  });
  test('renders visible blanks in place of the freeform values', () => {
    expect(section.text).toMatch(/__________________/);
  });
});
