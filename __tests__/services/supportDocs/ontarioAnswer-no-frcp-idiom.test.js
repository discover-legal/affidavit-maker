/**
 * Round-6 (Marcus ON, 2026-08-30 v29): Ontario Form 10 must NOT use the
 * US FRCP 8(b)(5) "IS WITHOUT KNOWLEDGE OR INFORMATION SUFFICIENT TO
 * FORM A BELIEF AND THEREFORE DENIES" phrasing. And residency/venue +
 * grounds scaffold rows must NOT re-appear after the pre-admitted
 * jurisdiction / one-year-separation lines already cover them.
 */
'use strict';

const { answerToPetition } = require('../../../services/supportDocs/ontarioAnswer');

function payload() {
  return {
    filerName: 'Marcus Thompson',
    petitionerName: 'Priya Thompson',
    respondentName: 'Marcus Thompson',
    state: 'ON',
    county: 'Toronto',
    marriageDate: '2013-08-03',
    separationDate: '2025-01-01',
    residencyOntario: true,
    oneYearSeparation: true,
    groundsForDivorce: 'one-year separation',
    hasMinorChildren: true,
    children: [
      { name: 'Ava', birthYear: 2016 },
      { name: 'Ethan', birthYear: 2019 },
    ],
  };
}

function fullText(doc) {
  const parts = [];
  const walk = (n) => {
    if (n == null) return;
    if (typeof n === 'string') { parts.push(n); return; }
    if (Array.isArray(n)) { for (const c of n) walk(c); return; }
    if (typeof n === 'object') { for (const k of Object.keys(n)) walk(n[k]); }
  };
  walk(doc);
  return parts.join('\n');
}

describe('Ontario Answer (Form 10) — no US FRCP idiom, no duplicated admissions', () => {
  test('no FRCP "IS WITHOUT KNOWLEDGE" phrasing anywhere', () => {
    const doc = answerToPetition(payload());
    const text = fullText(doc);
    expect(text).not.toMatch(/IS WITHOUT KNOWLEDGE OR INFORMATION SUFFICIENT/i);
    expect(text).not.toMatch(/FORM A BELIEF AND THEREFORE DENIES/i);
  });

  test('residency/venue scaffold does not re-appear after jurisdiction admission', () => {
    const doc = answerToPetition(payload());
    const text = fullText(doc);
    // Jurisdiction admission is present
    expect(text).toMatch(/habitually resident in Ontario/i);
    // The residency scaffold checkbox (which would duplicate that fact) is gone
    expect(text).not.toMatch(/Regarding the residency and venue allegations/i);
  });

  test('grounds scaffold does not re-appear after one-year-separation admission', () => {
    const doc = answerToPetition(payload());
    const text = fullText(doc);
    expect(text).toMatch(/one year immediately preceding the determination/i);
    expect(text).not.toMatch(/Regarding the ground stated for the divorce \(irretrievable/i);
  });
});
