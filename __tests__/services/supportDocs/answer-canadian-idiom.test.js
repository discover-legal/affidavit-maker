/** @jest-environment node */
/**
 * Attorney round-2 finding (Marcus, ON, 2026-08-30): the shared Answer
 * scaffold leaked US legal vernacular into Canadian (ON, AB) Form 10 /
 * Statement of Defence pleadings — "alimony", "attorney's fees",
 * "Case No.", "v." between parties. BaseAnswerTemplate now runs a strict
 * canadianize() token filter on every string in the final structure when
 * the configured state is Canadian; this test locks that in.
 */

'use strict';

const { answerToPetition: onAnswer } = require('../../../services/supportDocs/ontarioAnswer');
const { answerToPetition: abAnswer } = require('../../../services/supportDocs/albertaAnswer');
const { answerToPetition: flAnswer } = require('../../../services/supportDocs/floridaAnswer');
const { answerToPetition: nyAnswer } = require('../../../services/supportDocs/newyorkAnswer');

const commonData = {
  role: 'respondent',
  petitionerName: 'Alice Q. Example',
  respondentName: 'Bob R. Example',
  county: 'Toronto',
  courtLocation: 'Toronto',
  judicialCentre: 'Calgary',
  caseNumber: 'CASE-1234',
  marriageDate: '2018-03-15',
  separationDate: '2025-08-01',
};

function fullText(structure) {
  const s = structure.sections;
  const items = (s.facts && s.facts.items) || [];
  return [
    s.header,
    s.title,
    s.caseCaption && s.caseCaption.formatted,
    s.introduction,
    items.map((i) => i.content).join('\n'),
    s.conclusion,
    s.perjuryStatement,
  ]
    .filter(Boolean)
    .join('\n');
}

describe.each([
  { name: 'Ontario', build: onAnswer },
  { name: 'Alberta', build: abAnswer },
])('$name Answer — Canadian idiom filter', ({ build }) => {
  test('no US-idiom tokens ("alimony", "attorney"/"attorneys", "Case No.", " v. ")', () => {
    const text = fullText(build(commonData));
    expect(text).not.toMatch(/\balimony\b/i);
    expect(text).not.toMatch(/\battorney'?s?\b/i);
    expect(text).not.toMatch(/\bCase No\./);
    // "v." between parties in the caption is the specific leak — a bare " v."
    // between two non-numeric tokens should not appear anywhere.
    expect(text).not.toMatch(/\s+v\.\s+/);
  });

  test('Canadian equivalents render in the scaffold', () => {
    const text = fullText(build(commonData));
    expect(text).toMatch(/spousal support/i);
    expect(text).toMatch(/costs/i);
    expect(text).toMatch(/Court File No\./);
  });
});

describe.each([
  { name: 'Florida', build: flAnswer },
  { name: 'New York', build: nyAnswer },
])('$name Answer — US idiom retained (filter must not fire outside Canada)', ({ build }) => {
  test('US jurisdictions keep US vernacular', () => {
    const text = fullText(build(commonData));
    // At least one US-idiom token still surfaces (alimony in the scaffold,
    // attorney's fees line, or the Case No. label). Any one is enough — we
    // just want proof the filter did NOT rewrite US docs.
    const anyUsToken = /\balimony\b/i.test(text) ||
      /\battorney'?s\s+fees\b/i.test(text) ||
      /\bCase No\./.test(text);
    expect(anyUsToken).toBe(true);
  });
});
