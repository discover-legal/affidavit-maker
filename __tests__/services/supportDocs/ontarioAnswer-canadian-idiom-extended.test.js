/** @jest-environment node */
/**
 * Round-7 attorney (Marcus ON, 2026-08-30 v30b): the canadianize() filter
 * previously translated alimony/attorney's fees/Case No./"v.", but left US
 * property-vocabulary and "Counter-Petition" untouched. Ontario Form 10
 * uses Family Law Act vocabulary ("family property" s.4, "family debts"
 * used in NFP), and Ontario carries the respondent's affirmative relief
 * inside the Answer itself ("Answer with Claim" / "Respondent's Claim"),
 * never as a US-style Counter-Petition.
 */

'use strict';

const { answerToPetition } = require('../../../services/supportDocs/ontarioAnswer');
const { canadianize } = require('../../../services/supportDocs/BaseAnswerTemplate');

const baseData = {
  role: 'respondent',
  state: 'ON',
  county: 'Toronto',
  petitionerName: 'Priya Thompson',
  respondentName: 'Marcus Thompson',
  affiantName: 'Marcus Thompson',
  caseNumber: 'FS-26-00001234',
  marriageDate: '2013-08-03',
  separationDate: '2025-01-01',
  hasMinorChildren: true,
  children: [{ name: 'Ava', birthDate: '2016-03-01' }],
};

function fullText(structure) {
  const parts = [];
  const visit = (v) => {
    if (v == null) return;
    if (typeof v === 'string') { parts.push(v); return; }
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (typeof v === 'object') { Object.values(v).forEach(visit); }
  };
  visit(structure);
  return parts.join('\n');
}

describe('canadianize() extended token filter', () => {
  test('translates marital assets/debts to family property/debts', () => {
    expect(canadianize('the marital assets shall be divided')).toMatch(/family property/);
    expect(canadianize('marital debts and liabilities')).toMatch(/family debts and liabilities/);
    expect(canadianize('the marital property is')).toMatch(/family property is/);
  });

  test('translates Counter-Petition (US) to Answer with Claim (Ontario)', () => {
    expect(canadianize('may file a Counter-Petition seeking')).toMatch(/Answer with Claim/);
    expect(canadianize('a bare answer without a counter-petition')).toMatch(/answer with claim/);
    expect(canadianize('CounterPetition')).toMatch(/Answer with Claim/);
  });

  test('preserves existing translations (alimony, attorney fees, Case No., v.)', () => {
    expect(canadianize('alimony payable')).toMatch(/spousal support/);
    expect(canadianize("attorney's fees and costs")).toMatch(/^costs/);
    expect(canadianize('Case No. 123')).toMatch(/Court File No\. 123/);
  });
});

describe('Ontario Answer — extended idiom scrub in rendered document', () => {
  test('no "marital assets" leak in Part A responses', () => {
    const doc = answerToPetition(baseData);
    const text = fullText(doc);
    expect(text).not.toMatch(/\bmarital assets\b/i);
    expect(text).not.toMatch(/\bmarital debts\b/i);
    expect(text).not.toMatch(/\bmarital property\b/i);
  });

  test('no "Counter-Petition" leak anywhere in the pleading', () => {
    const doc = answerToPetition(baseData);
    const text = fullText(doc);
    expect(text).not.toMatch(/Counter-?Petition/);
  });

  test('Canadian equivalents surface (family property / family debts / Answer with Claim)', () => {
    const doc = answerToPetition(baseData);
    const text = fullText(doc);
    // At least one Canadian family-property/debt token surfaces on the
    // scaffold line that used to say "marital assets and property division".
    const hasCanFamily =
      /family property/i.test(text) || /family debts/i.test(text);
    expect(hasCanFamily).toBe(true);
    // The counter-petition offer paragraph now speaks in ON terms.
    expect(text).toMatch(/Answer with Claim|Respondent's Claim/);
  });
});
