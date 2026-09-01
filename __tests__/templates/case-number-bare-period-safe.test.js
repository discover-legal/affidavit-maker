/**
 * Round-6 (Tavita FL, 2026-08-30 v29): captions must render a blank
 * fill-in when the case number extraction yields punctuation-only garbage
 * (bare ".", empty string, or the "null"/"undefined"/"N/A" sentinels).
 * Petitions AND answers.
 */
'use strict';

const FloridaDivorcePetitionTemplate =
  require('../../templates/states/florida/DivorcePetitionTemplate');
const { answerToPetition: floridaAnswer } =
  require('../../services/supportDocs/floridaAnswer');

function fullText(node) {
  const parts = [];
  const walk = (n) => {
    if (n == null) return;
    if (typeof n === 'string') { parts.push(n); return; }
    if (Array.isArray(n)) { for (const c of n) walk(c); return; }
    if (typeof n === 'object') { for (const k of Object.keys(n)) walk(n[k]); }
  };
  walk(node);
  return parts.join('\n');
}

const badValues = [null, undefined, '', '.', '..', ' . ', 'null', 'NULL', 'undefined', 'n/a', 'N/A', 'none', '-'];

describe('Florida petition caption is null-safe on case number', () => {
  const tpl = new FloridaDivorcePetitionTemplate();
  for (const v of badValues) {
    test(`caseNumber = ${JSON.stringify(v)} → no bare "Case No.: ."`, () => {
      const doc = tpl.generateDocument({
        petitionerName: 'Marco Rossi',
        respondentName: 'Tavita Faletau',
        state: 'FL',
        county: 'Miami-Dade',
        caseNumber: v,
      });
      const text = fullText(doc);
      expect(text).not.toMatch(/Case No\.:\s*\.\s/);
      expect(text).not.toMatch(/Case No\.:\s*null/i);
      expect(text).not.toMatch(/Case No\.:\s*undefined/i);
      // Positive: some blank fill-in appears
      expect(text).toMatch(/Case No\.:\s*_+/);
    });
  }
});

describe('Florida answer caption is null-safe on case number', () => {
  for (const v of badValues) {
    test(`caseNumber = ${JSON.stringify(v)} → no bare "Case No. ."`, () => {
      const doc = floridaAnswer({
        petitionerName: 'Marco Rossi',
        respondentName: 'Tavita Faletau',
        filerName: 'Tavita Faletau',
        state: 'FL',
        county: 'Miami-Dade',
        caseNumber: v,
      });
      const text = fullText(doc);
      expect(text).not.toMatch(/Case No\.\s*\.\s/);
      expect(text).not.toMatch(/Case No\.\s*null/i);
      expect(text).not.toMatch(/Case No\.\s*undefined/i);
      expect(text).toMatch(/Case No\.\s*_+/);
    });
  }
});
