/** @jest-environment node */
'use strict';

/**
 * Ontario Form 10 Answer — no US Federal Rules of Civil Procedure
 * boilerplate. Attorney round-5 (Marcus ON, 2026-08-30) flagged FRCP
 * language leaking into an ON provincial pleading. Ontario Answers are
 * governed by the Family Law Rules, O. Reg. 114/99, r.10 (Form 10) — the
 * Federal Rules of Civil Procedure do not apply.
 */

const { answerToPetition } = require('../../../services/supportDocs/ontarioAnswer');

const commonData = {
  role: 'respondent',
  petitionerName: 'Priya Thompson',
  respondentName: 'Marcus Thompson',
  county: 'Toronto',
  caseNumber: 'FC-24-000123',
  state: 'ON',
  marriageDate: '2010-06-01',
  separationDate: '2023-01-15',
  oneYearSeparation: true,
  hasMinorChildren: true,
  children: [{ name: 'Aanya Thompson', birthDate: '2014-03-10' }],
};

function collectStrings(node, out) {
  if (node == null) return;
  if (typeof node === 'string') {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const el of node) collectStrings(el, out);
    return;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) collectStrings(node[key], out);
  }
}

describe('Ontario Answer — no US FRCP boilerplate leaks', () => {
  test('bare Form 10 output contains no FRCP / Fed. R. Civ. P. references', () => {
    const doc = answerToPetition(commonData);
    const strings = [];
    collectStrings(doc, strings);
    const blob = strings.join('\n');
    expect(blob).not.toMatch(/\bFRCP\b/);
    expect(blob).not.toMatch(/Federal Rules of Civil Procedure/i);
    expect(blob).not.toMatch(/Fed\.\s*R\.\s*Civ\.\s*P\./i);
    expect(blob).not.toMatch(/\b8\(b\)\(5\)/);
    expect(blob).not.toMatch(/Rule\s+8\(b\)/);
    expect(blob).not.toMatch(/Fla\.\s*R\.\s*Civ\.\s*P\./i);
  });

  test('Form 10 with counterclaim and positions still contains no FRCP text', () => {
    const doc = answerToPetition({
      ...commonData,
      includeCounterclaim: true,
      answerPositions: [
        { paragraph: '1', position: 'admit' },
        { paragraph: '3', position: 'deny' },
      ],
      supportingFacts: ['The Respondent has been the primary caregiver.'],
      claimSpousalSupport: true,
      claimEqualization: true,
    });
    const strings = [];
    collectStrings(doc, strings);
    const blob = strings.join('\n');
    expect(blob).not.toMatch(/\bFRCP\b/);
    expect(blob).not.toMatch(/Federal Rules of Civil Procedure/i);
    expect(blob).not.toMatch(/\b8\(b\)\(5\)/);
    // Sanity — the correct Ontario rule anchors are still present.
    expect(blob).toMatch(/Family Law Rules/);
  });
});
