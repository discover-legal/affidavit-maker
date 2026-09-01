/** @jest-environment node */
/**
 * Round-7 attorney (Marcus ON, 2026-08-30 v30b): the court file number
 * captured during the interview (Marcus turn 4: "file number
 * FS-26-00001234") must render in the Form 10 header, the case caption,
 * and any structured caption slot — a blank Court File No. on a served
 * respondent's Answer is a filing-defect fabrication.
 */

'use strict';

const { answerToPetition } = require('../../../services/supportDocs/ontarioAnswer');

const baseData = {
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
  hasMinorChildren: true,
  children: [
    { name: 'Ava', birthDate: '2016-03-01' },
    { name: 'Ethan', birthDate: '2019-09-01' },
  ],
};

function collectText(structure) {
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

describe('Ontario Answer — court file number renders throughout', () => {
  test('caseNumber flows into Form 10 header', () => {
    const doc = answerToPetition(baseData);
    const header = doc.sections.header || '';
    expect(header).toMatch(/FS-26-00001234/);
    expect(header).toMatch(/Court File No\./);
  });

  test('caseNumber renders in the case caption (formatted + structured)', () => {
    const doc = answerToPetition(baseData);
    const caption = doc.sections.caseCaption;
    expect(caption.formatted).toMatch(/FS-26-00001234/);
    // Canadianize should have rewritten Case No. → Court File No.
    expect(caption.formatted).toMatch(/Court File No\./);
    expect(caption.formatted).not.toMatch(/Case No\./);
  });

  test('caseNumber appears in the full rendered document text at least once', () => {
    const doc = answerToPetition(baseData);
    const text = collectText(doc);
    expect((text.match(/FS-26-00001234/g) || []).length).toBeGreaterThanOrEqual(1);
  });

  test('missing caseNumber falls back to blank rather than a placeholder like [COURT FILE NUMBER]', () => {
    const doc = answerToPetition({ ...baseData, caseNumber: '' });
    const header = doc.sections.header || '';
    expect(header).toMatch(/Court File No\./);
    // Blank filler is fine; a template placeholder is not.
    expect(header).not.toMatch(/\[COURT FILE NUMBER\]/i);
  });

  test('divorce orchestrator schema exposes case_number → caseNumber mapping', () => {
    // Round-7 bug 1 root cause: the LLM schema had no case_number field so
    // the model never populated caseNumber, and the profile-merge dropped
    // the value onto the fact log only. Lock the schema surface in.
    const BaseDivorceOrchestrator = require('../../../services/agents/BaseDivorceOrchestrator');
    const src = require('fs').readFileSync(
      require.resolve('../../../services/agents/BaseDivorceOrchestrator.js'),
      'utf8',
    );
    expect(src).toMatch(/case_number:\s*\{[^}]*type:\s*'string'/);
    expect(src).toMatch(/case_number:\s*'caseNumber'/);
    // Sanity: module still loads.
    expect(BaseDivorceOrchestrator).toBeTruthy();
  });
});
