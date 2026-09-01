/** @jest-environment node */
/**
 * Round-7 attorney (Marcus ON, 2026-08-30 v30b): Marcus's transcript
 * carries structured facts for contested parenting (custodyArrangement =
 * "contested", parenting_time fact) and income (respondent_income $96k,
 * petitioner_income $78k). Yet Form 10 Part B ("important facts supporting
 * the responses") and Part C ("claims by the respondent") both rendered
 * as bare underscore lines. Extend Part B/C population to auto-fill from
 * the schema-typed facts the profile already carries.
 */

'use strict';

const { answerToPetition } = require('../../../services/supportDocs/ontarioAnswer');

const marcusData = {
  role: 'respondent',
  state: 'ON',
  county: 'Toronto',
  courtLocation: 'Toronto',
  petitionerName: 'Priya Thompson',
  respondentName: 'Marcus Thompson',
  affiantName: 'Marcus Thompson',
  caseNumber: 'FS-26-00001234',
  marriageDate: '2013-08-03',
  marriageLocation: 'Toronto, ON',
  separationDate: '2025-01-01',
  groundsForDivorce: 'breakdown_of_marriage',
  hasMinorChildren: true,
  custodyArrangement: 'contested',
  primaryCustodian: 'Priya Thompson',
  monthlyIncome: 8000,
  spouseMonthlyIncome: 6500,
  children: [
    { name: 'Ava', birthDate: '2016-03-01' },
    { name: 'Ethan', birthDate: '2019-09-01' },
  ],
  facts: [
    {
      category: 'children',
      subcategory: 'parenting_time',
      content:
        'I disagree with the parenting schedule and want more mid-week parenting time with Ava and Ethan.',
    },
    {
      category: 'financial',
      subcategory: 'respondent_income',
      content: 'I stated that I earn approximately $96,000 annually as a project manager.',
    },
    {
      category: 'financial',
      subcategory: 'petitioner_income',
      content: 'I stated that Priya Thompson earns approximately $78,000 annually as a nurse.',
    },
    {
      category: 'children',
      subcategory: 'residence',
      content: 'Our children live primarily with Priya Thompson in Toronto, Ontario.',
    },
  ],
};

function partItems(doc, headerRegex) {
  const items = ((doc.sections || {}).facts || {}).items || [];
  const startIdx = items.findIndex((it) => it && it.type === 'form10_header' && headerRegex.test(String(it.content || '')));
  if (startIdx === -1) return [];
  const out = [];
  for (let i = startIdx + 1; i < items.length; i += 1) {
    const it = items[i];
    if (!it) continue;
    if (it.type === 'form10_header') break;
    out.push(it);
  }
  return out;
}

describe('Ontario Answer Form 10 — Parts B and C auto-populated from facts', () => {
  test('Part B (important facts) is NOT a bare underscore line when facts exist', () => {
    const doc = answerToPetition(marcusData);
    const partB = partItems(doc, /PART B/);
    expect(partB.length).toBeGreaterThan(0);
    const text = partB.map((i) => i.content || '').join('\n');
    // No lone-underscore stub — the parenting/income facts must surface.
    expect(text).not.toMatch(/Important facts supporting the Respondent's responses:\s*_+\./);
    expect(text).toMatch(/parenting|mid-week/i);
  });

  test('Part B surfaces income facts (respondent $96k, petitioner $78k)', () => {
    const doc = answerToPetition(marcusData);
    const partB = partItems(doc, /PART B/);
    const text = partB.map((i) => i.content || '').join('\n');
    expect(text).toMatch(/96,?000/);
    expect(text).toMatch(/78,?000/);
  });

  test('Part C claim auto-populates a s.16 parenting order claim when parenting is contested', () => {
    const doc = answerToPetition(marcusData);
    const partC = partItems(doc, /PART C/);
    expect(partC.length).toBeGreaterThan(0);
    const text = partC.map((i) => i.content || '').join('\n');
    // The v29 default-scaffold "RESERVES and CLAIMS ... complete before
    // filing: ___" placeholder must NOT be the sole claim — a real
    // parenting claim must render from the fact.
    expect(text).toMatch(/parenting order|sections?\s*16/i);
    expect(text).toMatch(/mid-week|parenting schedule|Ava|Ethan/i);
  });

  test('when NO parenting facts exist, Part C still emits the default scaffold (no regression)', () => {
    const doc = answerToPetition({ ...marcusData, custodyArrangement: undefined, facts: [] });
    const partC = partItems(doc, /PART C/);
    const text = partC.map((i) => i.content || '').join('\n');
    expect(text).toMatch(/RESERVES and CLAIMS|corollary relief/i);
  });
});
